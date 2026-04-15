create extension if not exists pgcrypto;

create table if not exists public.partner_sessions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  session_token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists partner_sessions_email_idx
  on public.partner_sessions (lower(email), expires_at desc);

alter table public.partner_sessions enable row level security;

create or replace function public.nomos_is_current_partner_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_accounts pa
    where lower(pa.email) = lower(p_email)
      and pa.status = 'approved'
      and (
        pa.user_id = auth.uid()
        or lower(pa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

create or replace function public.nomos_is_current_partner_for_lawyer(p_lawyer_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_accounts pa
    where lower(pa.lawyer_id) = lower(p_lawyer_id)
      and pa.status = 'approved'
      and (
        pa.user_id = auth.uid()
        or lower(pa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

drop function if exists public.verify_partner_access_code(text, text);
create or replace function public.verify_partner_access_code(p_email text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matching_code uuid;
  partner_session_token text;
  partner_session_expires_at timestamptz;
begin
  select id into matching_code
  from public.partner_access_codes
  where lower(email) = lower(p_email)
    and consumed_at is null
    and expires_at > now()
    and code_hash = crypt(p_code, code_hash)
  order by created_at desc
  limit 1;

  if matching_code is null then
    return jsonb_build_object('ok', false);
  end if;

  update public.partner_access_codes
  set consumed_at = now()
  where id = matching_code;

  delete from public.partner_sessions
  where lower(email) = lower(p_email)
    and (revoked_at is not null or expires_at < now());

  partner_session_token := encode(gen_random_bytes(32), 'hex');

  insert into public.partner_sessions (email, session_token_hash, expires_at)
  values (lower(p_email), crypt(partner_session_token, gen_salt('bf')), now() + interval '12 hours')
  returning expires_at into partner_session_expires_at;

  return jsonb_build_object(
    'ok', true,
    'sessionToken', partner_session_token,
    'expiresAt', partner_session_expires_at
  );
end;
$$;

create or replace function public.complete_booking_as_partner(
  p_partner_email text,
  p_session_token text,
  p_booking_id uuid
)
returns public.booking_requests
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  updated_booking public.booking_requests;
begin
  select pa.lawyer_id into partner_lawyer_id
  from public.partner_accounts pa
  join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
  where lower(pa.email) = lower(p_partner_email)
    and pa.status = 'approved'
    and ps.revoked_at is null
    and ps.expires_at > now()
    and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
  order by ps.created_at desc
  limit 1;

  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  update public.booking_requests
  set status = 'completed'
  where id = p_booking_id
    and lower(lawyer_id) = lower(partner_lawyer_id)
    and status = 'confirmed'
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  return updated_booking;
end;
$$;

create or replace function public.list_bookings_as_partner(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns setof public.booking_requests
language sql
security definer
set search_path = public, extensions
as $$
  select br.*
  from public.booking_requests br
  where lower(br.lawyer_id) = lower(p_lawyer_id)
    and exists (
      select 1
      from public.partner_accounts pa
      join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
      where lower(pa.email) = lower(p_partner_email)
        and lower(pa.lawyer_id) = lower(p_lawyer_id)
        and pa.status = 'approved'
        and ps.revoked_at is null
        and ps.expires_at > now()
        and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
    )
  order by br.created_at desc;
$$;

create or replace function public.list_payments_as_partner(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns setof public.booking_payments
language sql
security definer
set search_path = public, extensions
as $$
  select bp.*
  from public.booking_payments bp
  where lower(bp.lawyer_id) = lower(p_lawyer_id)
    and exists (
      select 1
      from public.partner_accounts pa
      join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
      where lower(pa.email) = lower(p_partner_email)
        and lower(pa.lawyer_id) = lower(p_lawyer_id)
        and pa.status = 'approved'
        and ps.revoked_at is null
        and ps.expires_at > now()
        and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
    )
  order by bp.created_at desc;
$$;

drop function if exists public.list_reviews_as_partner(text, text, text);
create or replace function public.list_reviews_as_partner(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns table (
  id uuid,
  booking_id uuid,
  user_id uuid,
  lawyer_id text,
  rating integer,
  clarity_rating integer,
  responsiveness_rating integer,
  review_text text,
  lawyer_reply text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  client_name text,
  consultation_type text
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    brv.id,
    brv.booking_id,
    brv.user_id,
    brv.lawyer_id,
    brv.rating,
    brv.clarity_rating,
    brv.responsiveness_rating,
    brv.review_text,
    brv.lawyer_reply,
    brv.status,
    brv.created_at,
    brv.updated_at,
    br.client_name,
    br.consultation_type
  from public.booking_reviews brv
  join public.booking_requests br on br.id = brv.booking_id
  where lower(brv.lawyer_id) = lower(p_lawyer_id)
    and exists (
      select 1
      from public.partner_accounts pa
      join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
      where lower(pa.email) = lower(p_partner_email)
        and lower(pa.lawyer_id) = lower(p_lawyer_id)
        and pa.status = 'approved'
        and ps.revoked_at is null
        and ps.expires_at > now()
        and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
    )
  order by brv.created_at desc;
$$;

drop function if exists public.save_partner_workspace_as_partner(text, text, jsonb, jsonb, jsonb, jsonb);
create or replace function public.save_partner_workspace_as_partner(
  p_partner_email text,
  p_session_token text,
  p_profile jsonb,
  p_availability jsonb,
  p_notifications jsonb,
  p_reviews jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  normalized_profile jsonb := coalesce(p_profile, '{}'::jsonb);
  normalized_availability jsonb := coalesce(p_availability, '[]'::jsonb);
  normalized_notifications jsonb := coalesce(p_notifications, '{}'::jsonb);
  normalized_reviews jsonb := coalesce(p_reviews, '[]'::jsonb);
  profile_specialties text[];
  profile_languages text[];
  profile_modes text[];
  video_price integer := greatest(0, coalesce(nullif(normalized_profile ->> 'videoPrice', '')::integer, 0));
  phone_price integer := greatest(0, coalesce(nullif(normalized_profile ->> 'phonePrice', '')::integer, 0));
  in_person_price integer := greatest(0, coalesce(nullif(normalized_profile ->> 'inPersonPrice', '')::integer, 0));
  selected_price integer;
  profile_consultations jsonb;
begin
  select pa.lawyer_id into partner_lawyer_id
  from public.partner_accounts pa
  join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
  where lower(pa.email) = lower(p_partner_email)
    and pa.status = 'approved'
    and pa.lawyer_id is not null
    and ps.revoked_at is null
    and ps.expires_at > now()
    and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
  order by ps.created_at desc
  limit 1;

  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  select coalesce(array_agg(trim(value)), array[]::text[]) into profile_specialties
  from jsonb_array_elements_text(coalesce(normalized_profile -> 'specialties', '[]'::jsonb)) as items(value)
  where trim(value) <> '';

  if array_length(profile_specialties, 1) is null then
    profile_specialties := array['Legal services'];
  end if;

  select coalesce(array_agg(trim(value)), array[]::text[]) into profile_languages
  from jsonb_array_elements_text(coalesce(normalized_profile -> 'languages', '[]'::jsonb)) as items(value)
  where trim(value) <> '';

  if array_length(profile_languages, 1) is null then
    profile_languages := array['Greek'];
  end if;

  select coalesce(array_agg(trim(value)), array[]::text[]) into profile_modes
  from jsonb_array_elements_text(coalesce(normalized_profile -> 'consultationModes', '[]'::jsonb)) as items(value)
  where trim(value) in ('video', 'phone', 'inPerson');

  if array_length(profile_modes, 1) is null then
    profile_modes := array['video'];
  end if;

  select min(price) into selected_price
  from (
    values
      (case when 'video' = any(profile_modes) then video_price else null end),
      (case when 'phone' = any(profile_modes) then phone_price else null end),
      (case when 'inPerson' = any(profile_modes) then in_person_price else null end)
  ) as prices(price)
  where price is not null;

  selected_price := coalesce(selected_price, 0);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'mode', mode,
        'type', case mode
          when 'phone' then 'Phone consultation'
          when 'inPerson' then 'In-person consultation'
          else 'Video consultation'
        end,
        'price', case mode
          when 'phone' then phone_price
          when 'inPerson' then in_person_price
          else video_price
        end,
        'duration', case mode
          when 'inPerson' then '45 minutes'
          else '30 minutes'
        end,
        'desc', coalesce(nullif(trim(normalized_profile ->> 'serviceArea'), ''), 'Legal consultation')
      )
    ),
    '[]'::jsonb
  ) into profile_consultations
  from unnest(profile_modes) as mode_values(mode);

  insert into public.partner_profile_settings (
    partner_email,
    lawyer_id,
    profile,
    availability,
    reviews,
    notifications,
    published_profile,
    published_availability,
    is_public,
    updated_at
  )
  values (
    lower(p_partner_email),
    partner_lawyer_id,
    normalized_profile || jsonb_build_object('lawyerId', partner_lawyer_id),
    normalized_availability,
    normalized_reviews,
    normalized_notifications,
    normalized_profile || jsonb_build_object('lawyerId', partner_lawyer_id),
    normalized_availability,
    true,
    now()
  )
  on conflict (partner_email) do update
    set lawyer_id = excluded.lawyer_id,
        profile = excluded.profile,
        availability = excluded.availability,
        reviews = excluded.reviews,
        notifications = excluded.notifications,
        published_profile = excluded.published_profile,
        published_availability = excluded.published_availability,
        is_public = true,
        updated_at = now();

  update public.lawyer_profiles
  set name = coalesce(nullif(trim(normalized_profile ->> 'displayName'), ''), name),
      specialty = coalesce(profile_specialties[1], specialty),
      specialty_short = coalesce(profile_specialties[1], specialty_short),
      specialties = profile_specialties,
      specialty_keywords = profile_specialties,
      best_for = coalesce(nullif(trim(normalized_profile ->> 'serviceArea'), ''), best_for),
      city = coalesce(nullif(trim(normalized_profile ->> 'city'), ''), city),
      price = selected_price,
      consultation_modes = profile_modes,
      bio = coalesce(nullif(trim(normalized_profile ->> 'bio'), ''), bio),
      languages = profile_languages,
      consultations = profile_consultations,
      updated_at = now()
  where id = partner_lawyer_id;

  if not found then
    raise exception 'LAWYER_PROFILE_NOT_FOUND' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'ok', true,
    'lawyerId', partner_lawyer_id,
    'updatedAt', now()
  );
end;
$$;

drop function if exists public.submit_booking_review(uuid, text, integer, integer, integer, text);
create or replace function public.submit_booking_review(
  p_booking_id uuid,
  p_lawyer_id text,
  p_rating integer,
  p_clarity_rating integer,
  p_responsiveness_rating integer,
  p_review_text text
)
returns public.booking_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_booking public.booking_requests;
  saved_review public.booking_reviews;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into target_booking
  from public.booking_requests
  where id = p_booking_id
    and user_id = current_user_id
    and lower(lawyer_id) = lower(p_lawyer_id);

  if target_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  if target_booking.status <> 'completed' then
    raise exception 'BOOKING_NOT_COMPLETED' using errcode = 'P0001';
  end if;

  if length(trim(coalesce(p_review_text, ''))) < 12 then
    raise exception 'REVIEW_TEXT_TOO_SHORT' using errcode = '23514';
  end if;

  insert into public.booking_reviews (
    booking_id,
    user_id,
    lawyer_id,
    rating,
    clarity_rating,
    responsiveness_rating,
    review_text,
    status
  )
  values (
    p_booking_id,
    current_user_id,
    p_lawyer_id,
    greatest(1, least(5, p_rating)),
    greatest(1, least(5, p_clarity_rating)),
    greatest(1, least(5, p_responsiveness_rating)),
    trim(p_review_text),
    'published'
  )
  on conflict (booking_id) do update
    set rating = excluded.rating,
        clarity_rating = excluded.clarity_rating,
        responsiveness_rating = excluded.responsiveness_rating,
        review_text = excluded.review_text,
        status = 'published',
        updated_at = now()
    where public.booking_reviews.user_id = current_user_id
  returning * into saved_review;

  if saved_review.id is null then
    raise exception 'REVIEW_NOT_SAVED' using errcode = '42501';
  end if;

  return saved_review;
end;
$$;

drop policy if exists "Users can update own booking requests" on public.booking_requests;
create policy "Users can cancel own confirmed booking requests"
  on public.booking_requests for update
  using (user_id = auth.uid() and status = 'confirmed')
  with check (user_id = auth.uid() and status = 'cancelled');

drop policy if exists "Users can create own pending payments" on public.booking_payments;
drop policy if exists "Users can update own pending payments" on public.booking_payments;

drop policy if exists "Partners can read own booking requests" on public.booking_requests;
create policy "Partners can read own booking requests"
  on public.booking_requests for select
  using (public.nomos_is_current_partner_for_lawyer(lawyer_id));

drop policy if exists "Partners can update own booking requests" on public.booking_requests;
create policy "Partners can update own booking requests"
  on public.booking_requests for update
  using (public.nomos_is_current_partner_for_lawyer(lawyer_id))
  with check (public.nomos_is_current_partner_for_lawyer(lawyer_id));

drop policy if exists "Partners can read own payments" on public.booking_payments;
create policy "Partners can read own payments"
  on public.booking_payments for select
  using (public.nomos_is_current_partner_for_lawyer(lawyer_id));

drop policy if exists "Partners can read own reviews" on public.booking_reviews;
create policy "Partners can read own reviews"
  on public.booking_reviews for select
  using (public.nomos_is_current_partner_for_lawyer(lawyer_id));

drop policy if exists "Partners can update own review replies" on public.booking_reviews;
create policy "Partners can update own review replies"
  on public.booking_reviews for update
  using (public.nomos_is_current_partner_for_lawyer(lawyer_id))
  with check (public.nomos_is_current_partner_for_lawyer(lawyer_id));

grant execute on function public.nomos_is_current_partner_email(text) to authenticated;
grant execute on function public.nomos_is_current_partner_for_lawyer(text) to authenticated;
grant execute on function public.verify_partner_access_code(text, text) to anon, authenticated;
grant execute on function public.complete_booking_as_partner(text, text, uuid) to anon, authenticated;
grant execute on function public.list_bookings_as_partner(text, text, text) to anon, authenticated;
grant execute on function public.list_payments_as_partner(text, text, text) to anon, authenticated;
grant execute on function public.list_reviews_as_partner(text, text, text) to anon, authenticated;
grant execute on function public.save_partner_workspace_as_partner(text, text, jsonb, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.submit_booking_review(uuid, text, integer, integer, integer, text) to authenticated;
