create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (
    event_name in (
      'homepage_search',
      'search_profile_opened',
      'profile_booking_start',
      'booking_start',
      'booking_created',
      'payment_opened',
      'payment_completed',
      'consultation_completed',
      'review_submitted',
      'lawyer_application_submitted',
      'lawyer_application_approved',
      'approved_lawyer_first_completed_consultation'
    )
  ),
  occurred_at timestamptz not null default now(),
  session_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  lawyer_id text,
  booking_id uuid references public.booking_requests (id) on delete set null,
  city text,
  category text,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists funnel_events_name_time_idx on public.funnel_events (event_name, occurred_at desc);
create index if not exists funnel_events_session_idx on public.funnel_events (session_id, occurred_at desc);
create index if not exists funnel_events_lawyer_idx on public.funnel_events (lawyer_id, occurred_at desc) where lawyer_id is not null;
create index if not exists funnel_events_booking_idx on public.funnel_events (booking_id, occurred_at desc) where booking_id is not null;
create index if not exists funnel_events_city_category_idx on public.funnel_events (city, category, occurred_at desc);

alter table public.funnel_events enable row level security;

drop policy if exists "Anyone can create funnel events" on public.funnel_events;
create policy "Anyone can create funnel events"
  on public.funnel_events for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Authenticated users can read funnel events" on public.funnel_events;
create policy "Authenticated users can read funnel events"
  on public.funnel_events for select
  to authenticated
  using (true);

grant insert on public.funnel_events to anon, authenticated;
grant select on public.funnel_events to authenticated;

alter table public.booking_requests drop constraint if exists booking_requests_status_check;
alter table public.booking_requests add column if not exists consultation_status text not null default 'scheduled';
alter table public.booking_requests add column if not exists updated_at timestamptz not null default now();

update public.booking_requests br
set status = case
    when br.status = 'confirmed' and exists (
      select 1 from public.booking_payments bp where bp.booking_id = br.id and bp.status = 'paid'
    ) then 'confirmed_paid'
    when br.status = 'confirmed' then 'confirmed_unpaid'
    else br.status
  end,
  consultation_status = case
    when br.status = 'completed' then 'completed_confirmed'
    else coalesce(nullif(br.consultation_status, ''), 'scheduled')
  end;

alter table public.booking_requests
  alter column status set default 'pending_confirmation';

alter table public.booking_requests
  add constraint booking_requests_status_check
  check (status in ('pending_confirmation', 'confirmed_unpaid', 'confirmed_paid', 'completed', 'cancelled'));

alter table public.booking_requests drop constraint if exists booking_requests_consultation_status_check;
alter table public.booking_requests
  add constraint booking_requests_consultation_status_check
  check (consultation_status in ('scheduled', 'completed_pending_partner_confirmation', 'completed_confirmed'));

drop index if exists booking_requests_active_slot_idx;
create unique index if not exists booking_requests_active_slot_idx
  on public.booking_requests (lawyer_id, date_label, time)
  where status in ('pending_confirmation', 'confirmed_unpaid', 'confirmed_paid');

alter table public.booking_payments drop constraint if exists booking_payments_status_check;

update public.booking_payments
set status = case
    when status = 'pending' and (stripe_checkout_session_id is not null or checkout_session_url is not null) then 'checkout_opened'
    when status = 'pending' then 'not_opened'
    else status
  end;

alter table public.booking_payments
  alter column status set default 'not_opened';

alter table public.booking_payments
  add constraint booking_payments_status_check
  check (status in ('not_opened', 'checkout_opened', 'paid', 'failed', 'refund_requested', 'refunded'));

alter table public.booking_reviews drop constraint if exists booking_reviews_status_check;

update public.booking_reviews
set status = case
    when status in ('pending_review', 'flagged') then 'under_moderation'
    when status = 'hidden' then 'rejected'
    else status
  end;

alter table public.booking_reviews
  alter column status set default 'under_moderation';

alter table public.booking_reviews
  add constraint booking_reviews_status_check
  check (status in ('draft', 'submitted', 'under_moderation', 'published', 'rejected'));

alter table public.user_documents add column if not exists retention_until timestamptz;
alter table public.user_documents add column if not exists deletion_status text not null default 'active';
alter table public.user_documents add column if not exists access_audit jsonb not null default '[]'::jsonb;
alter table public.user_documents add column if not exists visibility_history jsonb not null default '[]'::jsonb;

alter table public.user_documents drop constraint if exists user_documents_deletion_status_check;
alter table public.user_documents
  add constraint user_documents_deletion_status_check
  check (deletion_status in ('active', 'deletion_requested', 'deleted', 'retained_for_legal_reason'));

update public.user_documents
set retention_until = coalesce(retention_until, created_at + interval '5 years'),
    visibility_history = case
      when visibility_history = '[]'::jsonb then jsonb_build_array(jsonb_build_object(
        'at', created_at,
        'actor', 'Client',
        'visibleToLawyer', visible_to_lawyer
      ))
      else visibility_history
    end;

create or replace function public.reserve_booking_slot(
  p_booking_id uuid,
  p_user_id uuid,
  p_reference_id text,
  p_lawyer_id text,
  p_lawyer_name text,
  p_consultation_type text,
  p_consultation_mode text,
  p_price integer,
  p_duration text,
  p_date_label text,
  p_time text,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_issue_summary text default null
)
returns public.booking_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_booking public.booking_requests;
begin
  if p_user_id is not null and auth.uid() is distinct from p_user_id then
    raise exception 'INVALID_BOOKING_USER' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.partner_accounts pa
    where lower(pa.lawyer_id) = lower(p_lawyer_id)
      and pa.status = 'approved'
      and (
        pa.user_id = auth.uid()
        or lower(pa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  ) then
    raise exception 'SELF_BOOKING_FORBIDDEN' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.booking_requests
    where lawyer_id = p_lawyer_id
      and date_label = p_date_label
      and time = p_time
      and status in ('pending_confirmation', 'confirmed_unpaid', 'confirmed_paid')
  ) then
    raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.booking_requests (
    id,
    user_id,
    reference_id,
    lawyer_id,
    lawyer_name,
    consultation_type,
    consultation_mode,
    price,
    duration,
    date_label,
    time,
    client_name,
    client_email,
    client_phone,
    issue_summary,
    status,
    consultation_status
  )
  values (
    p_booking_id,
    p_user_id,
    p_reference_id,
    p_lawyer_id,
    p_lawyer_name,
    p_consultation_type,
    p_consultation_mode,
    p_price,
    p_duration,
    p_date_label,
    p_time,
    p_client_name,
    lower(p_client_email),
    p_client_phone,
    nullif(p_issue_summary, ''),
    'confirmed_unpaid',
    'scheduled'
  )
  returning * into inserted_booking;

  insert into public.booking_payments (booking_id, user_id, lawyer_id, amount, currency, status, invoice_number)
  values (
    inserted_booking.id,
    inserted_booking.user_id,
    inserted_booking.lawyer_id,
    inserted_booking.price,
    'EUR',
    'not_opened',
    'INV-' || regexp_replace(inserted_booking.reference_id, '^BK-', '')
  )
  on conflict (booking_id) do nothing;

  return inserted_booking;
exception
  when unique_violation then
    raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode = 'P0001';
end;
$$;

drop function if exists public.cancel_booking_as_user(uuid);
create or replace function public.cancel_booking_as_user(p_booking_id uuid)
returns public.booking_requests
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_user_id uuid := auth.uid();
  updated_booking public.booking_requests;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  update public.booking_requests
  set status = 'cancelled',
      updated_at = now()
  where id = p_booking_id
    and user_id = current_user_id
    and status in ('pending_confirmation', 'confirmed_unpaid', 'confirmed_paid')
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  update public.booking_payments
  set status = case
      when status in ('paid', 'refund_requested') then 'refund_requested'
      when status = 'refunded' then 'refunded'
      when status = 'checkout_opened' then 'failed'
      else status
    end,
    provider_payload = case
      when status = 'paid' then provider_payload || jsonb_build_object(
        'refundReviewRequired', true,
        'refundRequestedAt', now()
      )
      else provider_payload
    end,
    updated_at = now()
  where booking_id = p_booking_id;

  return updated_booking;
end;
$$;

drop function if exists public.complete_booking_as_partner(text, text, uuid);
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
  set status = 'completed',
      consultation_status = 'completed_confirmed',
      updated_at = now()
  where id = p_booking_id
    and lower(lawyer_id) = lower(partner_lawyer_id)
    and status in ('confirmed_unpaid', 'confirmed_paid')
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  return updated_booking;
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

  if target_booking.status <> 'completed' or target_booking.consultation_status <> 'completed_confirmed' then
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
    'under_moderation'
  )
  on conflict (booking_id) do update
    set rating = excluded.rating,
        clarity_rating = excluded.clarity_rating,
        responsiveness_rating = excluded.responsiveness_rating,
        review_text = excluded.review_text,
        status = 'under_moderation',
        updated_at = now()
    where public.booking_reviews.user_id = current_user_id
  returning * into saved_review;

  if saved_review.id is null then
    raise exception 'REVIEW_NOT_SAVED' using errcode = '42501';
  end if;

  return saved_review;
end;
$$;

drop policy if exists "Users can cancel own confirmed booking requests" on public.booking_requests;
create policy "Users can cancel own active booking requests"
  on public.booking_requests for update
  using (user_id = auth.uid() and status in ('pending_confirmation', 'confirmed_unpaid', 'confirmed_paid'))
  with check (user_id = auth.uid() and status = 'cancelled');

grant execute on function public.cancel_booking_as_user(uuid) to authenticated;
grant execute on function public.complete_booking_as_partner(text, text, uuid) to anon, authenticated;
grant execute on function public.submit_booking_review(uuid, text, integer, integer, integer, text) to authenticated;
