begin;

alter table public.partner_profile_settings
  add column if not exists time_off jsonb not null default '[]'::jsonb;

alter table public.booking_requests drop constraint if exists booking_requests_status_check;
alter table public.booking_requests
  add constraint booking_requests_status_check
  check (status in ('pending_confirmation','confirmed_unpaid','confirmed_paid','completed','no_show','cancelled'));

drop function if exists public.get_partner_workspace_as_partner(text,text);
create or replace function public.get_partner_workspace_as_partner(
  p_partner_email text,
  p_session_token text
)
returns table (
  partner_email text,
  lawyer_id text,
  profile jsonb,
  availability jsonb,
  time_off jsonb,
  reviews jsonb,
  notifications jsonb,
  published_profile jsonb,
  published_availability jsonb,
  is_public boolean,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    lower(pa.email) as partner_email,
    pa.lawyer_id,
    coalesce(pps.profile, '{}'::jsonb) as profile,
    coalesce(pps.availability, '[]'::jsonb) as availability,
    coalesce(pps.time_off, '[]'::jsonb) as time_off,
    coalesce(pps.reviews, '[]'::jsonb) as reviews,
    coalesce(pps.notifications, '{}'::jsonb) as notifications,
    coalesce(pps.published_profile, '{}'::jsonb) as published_profile,
    coalesce(pps.published_availability, '[]'::jsonb) as published_availability,
    coalesce(pps.is_public, true) as is_public,
    pps.updated_at
  from public.partner_accounts pa
  join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
  left join public.partner_profile_settings pps on lower(pps.partner_email) = lower(pa.email)
  where lower(pa.email) = lower(p_partner_email)
    and pa.status = 'approved'
    and pa.lawyer_id is not null
    and ps.revoked_at is null
    and ps.expires_at > now()
    and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
  order by ps.created_at desc
  limit 1;
$$;

drop function if exists public.save_partner_workspace_as_partner(text,text,jsonb,jsonb,jsonb,jsonb);
drop function if exists public.save_partner_workspace_as_partner(text,text,jsonb,jsonb,jsonb,jsonb,jsonb);
create or replace function public.save_partner_workspace_as_partner(
  p_partner_email text,
  p_session_token text,
  p_profile jsonb,
  p_availability jsonb,
  p_notifications jsonb,
  p_reviews jsonb default '[]'::jsonb,
  p_time_off jsonb default '[]'::jsonb
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
  normalized_time_off jsonb := coalesce(p_time_off, '[]'::jsonb);
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

  if jsonb_typeof(normalized_time_off) <> 'array' then
    raise exception 'INVALID_PARTNER_TIME_OFF' using errcode = '22023';
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
    time_off,
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
    normalized_time_off,
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
        time_off = excluded.time_off,
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

create table if not exists public.partner_cases (
  id uuid primary key default gen_random_uuid(),
  lawyer_id text not null references public.lawyer_profiles(id) on delete cascade,
  client_name text not null,
  client_email text,
  title text not null,
  practice_area text not null,
  status text not null default 'new' check (status in ('new','in_progress','waiting_documents','waiting_client','completed','archived')),
  source_booking_id uuid references public.booking_requests(id) on delete set null,
  next_step text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_cases_source_booking_idx
  on public.partner_cases(source_booking_id)
  where source_booking_id is not null;
create index if not exists partner_cases_lawyer_status_idx
  on public.partner_cases(lawyer_id,status,updated_at desc);

create table if not exists public.partner_case_booking_links (
  case_id uuid not null references public.partner_cases(id) on delete cascade,
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, booking_id)
);

create index if not exists partner_case_booking_links_booking_idx
  on public.partner_case_booking_links(booking_id);

create table if not exists public.partner_case_private_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.partner_cases(id) on delete cascade,
  lawyer_id text not null references public.lawyer_profiles(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists partner_case_private_notes_case_idx
  on public.partner_case_private_notes(case_id,created_at desc);

create table if not exists public.partner_case_history_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.partner_cases(id) on delete cascade,
  lawyer_id text not null references public.lawyer_profiles(id) on delete cascade,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists partner_case_history_events_case_idx
  on public.partner_case_history_events(case_id,created_at desc);

create table if not exists public.partner_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  partner_email text not null,
  lawyer_id text not null references public.lawyer_profiles(id) on delete cascade,
  provider text not null check (provider = 'google'),
  provider_account_email text,
  status text not null default 'connected' check (status in ('connected','needs_reauth','disabled','error')),
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  expires_at timestamptz,
  scope text[] not null default '{}',
  last_error text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_email, lawyer_id, provider)
);

create index if not exists partner_calendar_connections_lawyer_idx
  on public.partner_calendar_connections(lawyer_id,status,provider);

drop trigger if exists nomos_partner_cases_updated_at on public.partner_cases;
create trigger nomos_partner_cases_updated_at before update on public.partner_cases
  for each row execute function public.nomos_touch_updated_at();

drop trigger if exists nomos_partner_calendar_connections_updated_at on public.partner_calendar_connections;
create trigger nomos_partner_calendar_connections_updated_at before update on public.partner_calendar_connections
  for each row execute function public.nomos_touch_updated_at();

alter table public.partner_cases enable row level security;
alter table public.partner_case_booking_links enable row level security;
alter table public.partner_case_private_notes enable row level security;
alter table public.partner_case_history_events enable row level security;
alter table public.partner_calendar_connections enable row level security;

create or replace function public.list_partner_cases(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns table (
  id uuid,
  lawyer_id text,
  client_name text,
  client_email text,
  title text,
  practice_area text,
  status text,
  next_step text,
  source_booking_id uuid,
  booking_ids uuid[],
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    cases.id,
    cases.lawyer_id,
    cases.client_name,
    cases.client_email,
    cases.title,
    cases.practice_area,
    cases.status,
    cases.next_step,
    cases.source_booking_id,
    coalesce(array_agg(links.booking_id order by links.created_at) filter (where links.booking_id is not null), array[]::uuid[]) as booking_ids,
    cases.created_at,
    cases.updated_at
  from public.partner_cases cases
  left join public.partner_case_booking_links links on links.case_id = cases.id
  where cases.lawyer_id = p_lawyer_id
    and public.get_partner_session_lawyer_id(p_partner_email, p_session_token) = p_lawyer_id
  group by cases.id
  order by cases.updated_at desc, cases.created_at desc;
$$;

create or replace function public.accept_booking_as_partner(
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
  paid_payment_exists boolean;
begin
  partner_lawyer_id := public.get_partner_session_lawyer_id(p_partner_email, p_session_token);
  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.booking_payments
    where booking_id = p_booking_id and status = 'paid'
  ) into paid_payment_exists;

  update public.booking_requests
  set status = case when paid_payment_exists then 'confirmed_paid' else 'confirmed_unpaid' end,
      updated_at = now()
  where id = p_booking_id
    and lawyer_id = partner_lawyer_id
    and status in ('pending_confirmation','confirmed')
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_NOT_PENDING' using errcode = '42501';
  end if;

  return updated_booking;
end;
$$;

create or replace function public.mark_booking_no_show_as_partner(
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
  partner_lawyer_id := public.get_partner_session_lawyer_id(p_partner_email, p_session_token);
  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  update public.booking_requests
  set status = 'no_show',
      consultation_status = 'scheduled',
      updated_at = now()
  where id = p_booking_id
    and lawyer_id = partner_lawyer_id
    and status in ('pending_confirmation','confirmed_unpaid','confirmed_paid','confirmed')
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_NOT_ACTIVE' using errcode = '42501';
  end if;

  return updated_booking;
end;
$$;

create or replace function public.create_partner_case_from_booking(
  p_partner_email text,
  p_session_token text,
  p_booking_id uuid,
  p_title text default null,
  p_practice_area text default null,
  p_next_step text default null
)
returns public.partner_cases
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  target_booking public.booking_requests;
  existing_case public.partner_cases;
  persisted_case public.partner_cases;
  has_paid_payment boolean;
begin
  partner_lawyer_id := public.get_partner_session_lawyer_id(p_partner_email, p_session_token);
  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  select * into target_booking
  from public.booking_requests
  where id = p_booking_id
    and lawyer_id = partner_lawyer_id;

  if target_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_FOR_PARTNER' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.booking_payments
    where booking_id = p_booking_id and status = 'paid'
  ) into has_paid_payment;

  if target_booking.status not in ('confirmed_paid','completed') and not has_paid_payment then
    raise exception 'BOOKING_NOT_READY_FOR_CASE' using errcode = '22023';
  end if;

  select * into existing_case
  from public.partner_cases
  where source_booking_id = p_booking_id
  limit 1;

  if existing_case.id is not null then
    insert into public.partner_case_booking_links(case_id, booking_id)
    values (existing_case.id, p_booking_id)
    on conflict do nothing;
    return existing_case;
  end if;

  insert into public.partner_cases (
    lawyer_id, client_name, client_email, title, practice_area, source_booking_id, next_step
  )
  values (
    partner_lawyer_id,
    target_booking.client_name,
    target_booking.client_email,
    coalesce(nullif(trim(p_title), ''), nullif(trim(target_booking.issue_summary), ''), target_booking.consultation_type),
    coalesce(nullif(trim(p_practice_area), ''), target_booking.consultation_type, 'general'),
    target_booking.id,
    coalesce(nullif(trim(p_next_step), ''), 'Ορίστε το επόμενο βήμα συνεργασίας.')
  )
  returning * into persisted_case;

  insert into public.partner_case_booking_links(case_id, booking_id)
  values (persisted_case.id, target_booking.id)
  on conflict do nothing;

  insert into public.partner_case_history_events(case_id, lawyer_id, event_type, message, metadata)
  values (
    persisted_case.id,
    partner_lawyer_id,
    'case_created',
    'Case created from paid booking',
    jsonb_build_object('bookingId', target_booking.id, 'referenceId', target_booking.reference_id)
  );

  return persisted_case;
end;
$$;

create or replace function public.update_partner_case(
  p_partner_email text,
  p_session_token text,
  p_case_id uuid,
  p_title text default null,
  p_practice_area text default null,
  p_status text default null,
  p_next_step text default null
)
returns public.partner_cases
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  persisted_case public.partner_cases;
  normalized_status text := nullif(trim(coalesce(p_status, '')), '');
begin
  partner_lawyer_id := public.get_partner_session_lawyer_id(p_partner_email, p_session_token);
  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  if normalized_status is not null and normalized_status not in ('new','in_progress','waiting_documents','waiting_client','completed','archived') then
    raise exception 'INVALID_PARTNER_CASE_STATUS' using errcode = '22023';
  end if;

  update public.partner_cases
  set title = coalesce(nullif(trim(p_title), ''), title),
      practice_area = coalesce(nullif(trim(p_practice_area), ''), practice_area),
      status = coalesce(normalized_status, status),
      next_step = coalesce(nullif(trim(p_next_step), ''), next_step)
  where id = p_case_id
    and lawyer_id = partner_lawyer_id
  returning * into persisted_case;

  if persisted_case.id is null then
    raise exception 'PARTNER_CASE_NOT_FOUND' using errcode = '42501';
  end if;

  insert into public.partner_case_history_events(case_id, lawyer_id, event_type, message, metadata)
  values (
    persisted_case.id,
    partner_lawyer_id,
    'case_updated',
    'Case fields updated',
    jsonb_build_object('status', persisted_case.status, 'nextStep', persisted_case.next_step)
  );

  return persisted_case;
end;
$$;

create or replace function public.save_partner_case_private_note(
  p_partner_email text,
  p_session_token text,
  p_note_id uuid,
  p_case_id uuid,
  p_note text
)
returns public.partner_case_private_notes
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  case_lawyer_id text;
  persisted_note public.partner_case_private_notes;
begin
  partner_lawyer_id := public.get_partner_session_lawyer_id(p_partner_email, p_session_token);
  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  select lawyer_id into case_lawyer_id from public.partner_cases where id = p_case_id;
  if case_lawyer_id is null or case_lawyer_id <> partner_lawyer_id then
    raise exception 'PARTNER_CASE_NOT_FOUND' using errcode = '42501';
  end if;

  insert into public.partner_case_private_notes(id, case_id, lawyer_id, note)
  values (p_note_id, p_case_id, partner_lawyer_id, trim(p_note))
  returning * into persisted_note;

  insert into public.partner_case_history_events(case_id, lawyer_id, event_type, message)
  values (p_case_id, partner_lawyer_id, 'note_added', 'Private case note added');

  return persisted_note;
end;
$$;

create or replace function public.list_partner_case_private_notes(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns setof public.partner_case_private_notes
language sql
security definer
set search_path = public, extensions
as $$
  select notes.*
  from public.partner_case_private_notes notes
  where notes.lawyer_id = p_lawyer_id
    and public.get_partner_session_lawyer_id(p_partner_email, p_session_token) = p_lawyer_id
  order by notes.created_at desc;
$$;

create or replace function public.list_partner_case_history_events(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns setof public.partner_case_history_events
language sql
security definer
set search_path = public, extensions
as $$
  select events.*
  from public.partner_case_history_events events
  where events.lawyer_id = p_lawyer_id
    and public.get_partner_session_lawyer_id(p_partner_email, p_session_token) = p_lawyer_id
  order by events.created_at desc;
$$;

create or replace function public.list_partner_calendar_connections(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns table (
  provider text,
  provider_account_email text,
  status text,
  scope text[],
  connected_at timestamptz,
  updated_at timestamptz,
  last_error text
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    connections.provider,
    connections.provider_account_email,
    connections.status,
    connections.scope,
    connections.connected_at,
    connections.updated_at,
    connections.last_error
  from public.partner_calendar_connections connections
  where connections.lawyer_id = p_lawyer_id
    and lower(connections.partner_email) = lower(p_partner_email)
    and public.get_partner_session_lawyer_id(p_partner_email, p_session_token) = p_lawyer_id
  order by connections.provider;
$$;

create or replace function public.disconnect_partner_calendar_connection(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text,
  p_provider text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
begin
  partner_lawyer_id := public.get_partner_session_lawyer_id(p_partner_email, p_session_token);
  if partner_lawyer_id is null or partner_lawyer_id <> p_lawyer_id then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  update public.partner_calendar_connections
  set status = 'disabled',
      access_token_ciphertext = null,
      refresh_token_ciphertext = null,
      last_error = null,
      updated_at = now()
  where lower(partner_email) = lower(p_partner_email)
    and lawyer_id = p_lawyer_id
    and provider = p_provider;

  return true;
end;
$$;

revoke all on public.partner_calendar_connections from anon, authenticated;
revoke all on public.partner_cases from anon, authenticated;
revoke all on public.partner_case_booking_links from anon, authenticated;
revoke all on public.partner_case_private_notes from anon, authenticated;
revoke all on public.partner_case_history_events from anon, authenticated;

grant execute on function public.get_partner_workspace_as_partner(text,text) to anon, authenticated;
grant execute on function public.save_partner_workspace_as_partner(text,text,jsonb,jsonb,jsonb,jsonb,jsonb) to anon, authenticated;
grant execute on function public.list_partner_cases(text,text,text) to anon, authenticated;
grant execute on function public.accept_booking_as_partner(text,text,uuid) to anon, authenticated;
grant execute on function public.mark_booking_no_show_as_partner(text,text,uuid) to anon, authenticated;
grant execute on function public.create_partner_case_from_booking(text,text,uuid,text,text,text) to anon, authenticated;
grant execute on function public.update_partner_case(text,text,uuid,text,text,text,text) to anon, authenticated;
grant execute on function public.save_partner_case_private_note(text,text,uuid,uuid,text) to anon, authenticated;
grant execute on function public.list_partner_case_private_notes(text,text,text) to anon, authenticated;
grant execute on function public.list_partner_case_history_events(text,text,text) to anon, authenticated;
grant execute on function public.list_partner_calendar_connections(text,text,text) to anon, authenticated;
grant execute on function public.disconnect_partner_calendar_connection(text,text,text,text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
