begin;

create table if not exists public.intake_requests (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  city text not null,
  category text not null,
  urgency text not null check (urgency in ('today','this_week','flexible')),
  budget text not null check (budget in ('under_50','50_80','80_120','120_plus','flexible')),
  consultation_mode text not null check (consultation_mode in ('any','video','phone','inPerson')),
  timing text not null default '',
  issue_summary text not null,
  client_name text not null default '',
  client_email text not null default '',
  client_phone text not null default '',
  ranked_lawyer_ids text[] not null default '{}',
  status text not null default 'new' check (status in ('new','routed','booked','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intake_requests_city_category_idx on public.intake_requests (city, category, created_at desc);
create index if not exists intake_requests_user_idx on public.intake_requests (user_id, created_at desc);

create table if not exists public.partner_subscriptions (
  id uuid primary key default gen_random_uuid(),
  partner_email text not null,
  lawyer_id text not null references public.lawyer_profiles(id) on delete cascade,
  plan_id text not null check (plan_id in ('basic','pro','premium')),
  status text not null default 'inactive' check (status in ('inactive','checkout_opened','active','past_due','canceled','unpaid','incomplete')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_subscriptions_partner_lawyer_idx
  on public.partner_subscriptions (partner_email, lawyer_id);
create index if not exists partner_subscriptions_lawyer_status_idx
  on public.partner_subscriptions (lawyer_id, status);

alter table public.lawyer_profiles add column if not exists partner_plan text not null default 'basic'
  check (partner_plan in ('basic','pro','premium'));
alter table public.lawyer_profiles add column if not exists visibility_tier text not null default 'basic'
  check (visibility_tier in ('basic','pro','premium'));
alter table public.lawyer_profiles add column if not exists completed_consultations integer not null default 0 check (completed_consultations >= 0);

create table if not exists public.partner_pipeline_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  lawyer_id text not null references public.lawyer_profiles(id) on delete cascade,
  status text not null check (status in ('booked','paid','upcoming','completed','review_pending','refund_risk','follow_up_needed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id)
);

create index if not exists partner_pipeline_items_lawyer_status_idx
  on public.partner_pipeline_items (lawyer_id, status, updated_at desc);

create table if not exists public.partner_case_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  lawyer_id text not null references public.lawyer_profiles(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists partner_case_notes_booking_idx on public.partner_case_notes (booking_id, created_at desc);

create table if not exists public.partner_followup_tasks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  lawyer_id text not null references public.lawyer_profiles(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_followup_tasks_lawyer_status_idx
  on public.partner_followup_tasks (lawyer_id, status, due_at);

drop trigger if exists nomos_intake_requests_updated_at on public.intake_requests;
create trigger nomos_intake_requests_updated_at before update on public.intake_requests
  for each row execute function public.nomos_touch_updated_at();

drop trigger if exists nomos_partner_subscriptions_updated_at on public.partner_subscriptions;
create trigger nomos_partner_subscriptions_updated_at before update on public.partner_subscriptions
  for each row execute function public.nomos_touch_updated_at();

drop trigger if exists nomos_partner_pipeline_items_updated_at on public.partner_pipeline_items;
create trigger nomos_partner_pipeline_items_updated_at before update on public.partner_pipeline_items
  for each row execute function public.nomos_touch_updated_at();

drop trigger if exists nomos_partner_followup_tasks_updated_at on public.partner_followup_tasks;
create trigger nomos_partner_followup_tasks_updated_at before update on public.partner_followup_tasks
  for each row execute function public.nomos_touch_updated_at();

create or replace function public.get_partner_session_lawyer_id(
  p_partner_email text,
  p_session_token text
)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select pa.lawyer_id
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
$$;

create or replace function public.create_intake_request(
  p_request_id uuid,
  p_reference_id text,
  p_city text,
  p_category text,
  p_urgency text,
  p_budget text,
  p_consultation_mode text,
  p_timing text,
  p_issue_summary text,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_ranked_lawyer_ids text[]
)
returns public.intake_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  persisted_request public.intake_requests;
begin
  if length(trim(coalesce(p_issue_summary, ''))) < 20 then
    raise exception 'INTAKE_SUMMARY_TOO_SHORT' using errcode = '22023';
  end if;

  insert into public.intake_requests (
    id, reference_id, user_id, city, category, urgency, budget, consultation_mode,
    timing, issue_summary, client_name, client_email, client_phone, ranked_lawyer_ids, status
  )
  values (
    p_request_id, p_reference_id, auth.uid(), trim(p_city), trim(p_category), p_urgency, p_budget,
    p_consultation_mode, trim(coalesce(p_timing, '')), trim(p_issue_summary),
    trim(coalesce(p_client_name, '')), lower(trim(coalesce(p_client_email, ''))),
    trim(coalesce(p_client_phone, '')), coalesce(p_ranked_lawyer_ids, '{}'),
    case when cardinality(coalesce(p_ranked_lawyer_ids, '{}')) > 0 then 'routed' else 'new' end
  )
  returning * into persisted_request;

  return persisted_request;
end;
$$;

create or replace function public.route_intake_request(
  p_request_id uuid,
  p_ranked_lawyer_ids text[]
)
returns public.intake_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  persisted_request public.intake_requests;
begin
  update public.intake_requests
  set ranked_lawyer_ids = coalesce(p_ranked_lawyer_ids, '{}'),
      status = 'routed',
      updated_at = now()
  where id = p_request_id
    and (user_id = auth.uid() or user_id is null)
  returning * into persisted_request;

  if persisted_request.id is null then
    raise exception 'INTAKE_REQUEST_NOT_FOUND' using errcode = '42501';
  end if;

  return persisted_request;
end;
$$;

create or replace function public.list_partner_case_notes(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns setof public.partner_case_notes
language sql
security definer
set search_path = public, extensions
as $$
  select notes.*
  from public.partner_case_notes notes
  where notes.lawyer_id = p_lawyer_id
    and public.get_partner_session_lawyer_id(p_partner_email, p_session_token) = p_lawyer_id
  order by notes.created_at desc;
$$;

create or replace function public.list_partner_followup_tasks(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns setof public.partner_followup_tasks
language sql
security definer
set search_path = public, extensions
as $$
  select tasks.*
  from public.partner_followup_tasks tasks
  where tasks.lawyer_id = p_lawyer_id
    and public.get_partner_session_lawyer_id(p_partner_email, p_session_token) = p_lawyer_id
  order by tasks.due_at asc;
$$;

create or replace function public.save_partner_case_note(
  p_partner_email text,
  p_session_token text,
  p_note_id uuid,
  p_booking_id uuid,
  p_note text
)
returns public.partner_case_notes
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  booking_lawyer_id text;
  persisted_note public.partner_case_notes;
begin
  partner_lawyer_id := public.get_partner_session_lawyer_id(p_partner_email, p_session_token);
  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  select lawyer_id into booking_lawyer_id from public.booking_requests where id = p_booking_id;
  if booking_lawyer_id is null or booking_lawyer_id <> partner_lawyer_id then
    raise exception 'BOOKING_NOT_FOUND_FOR_PARTNER' using errcode = '42501';
  end if;

  insert into public.partner_case_notes (id, booking_id, lawyer_id, note)
  values (p_note_id, p_booking_id, partner_lawyer_id, trim(p_note))
  returning * into persisted_note;

  return persisted_note;
end;
$$;

create or replace function public.upsert_partner_followup_task(
  p_partner_email text,
  p_session_token text,
  p_task_id uuid,
  p_booking_id uuid,
  p_title text,
  p_due_at timestamptz,
  p_status text
)
returns public.partner_followup_tasks
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  booking_lawyer_id text;
  persisted_task public.partner_followup_tasks;
begin
  partner_lawyer_id := public.get_partner_session_lawyer_id(p_partner_email, p_session_token);
  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  select lawyer_id into booking_lawyer_id from public.booking_requests where id = p_booking_id;
  if booking_lawyer_id is null or booking_lawyer_id <> partner_lawyer_id then
    raise exception 'BOOKING_NOT_FOUND_FOR_PARTNER' using errcode = '42501';
  end if;

  insert into public.partner_followup_tasks (id, booking_id, lawyer_id, title, due_at, status)
  values (p_task_id, p_booking_id, partner_lawyer_id, trim(p_title), p_due_at, p_status)
  on conflict (id) do update
    set title = excluded.title,
        due_at = excluded.due_at,
        status = excluded.status,
        updated_at = now()
  returning * into persisted_task;

  return persisted_task;
end;
$$;

create or replace function public.update_partner_pipeline_status(
  p_partner_email text,
  p_session_token text,
  p_booking_id uuid,
  p_status text
)
returns public.partner_pipeline_items
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  booking_lawyer_id text;
  persisted_item public.partner_pipeline_items;
begin
  partner_lawyer_id := public.get_partner_session_lawyer_id(p_partner_email, p_session_token);
  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  select lawyer_id into booking_lawyer_id from public.booking_requests where id = p_booking_id;
  if booking_lawyer_id is null or booking_lawyer_id <> partner_lawyer_id then
    raise exception 'BOOKING_NOT_FOUND_FOR_PARTNER' using errcode = '42501';
  end if;

  insert into public.partner_pipeline_items (booking_id, lawyer_id, status)
  values (p_booking_id, partner_lawyer_id, p_status)
  on conflict (booking_id) do update
    set status = excluded.status,
        updated_at = now()
  returning * into persisted_item;

  return persisted_item;
end;
$$;

create or replace function public.get_partner_subscription_checkout_context(
  p_partner_email text,
  p_session_token text,
  p_plan_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  normalized_plan_id text := lower(trim(p_plan_id));
begin
  if normalized_plan_id not in ('basic','pro','premium') then
    raise exception 'INVALID_PARTNER_PLAN' using errcode = '22023';
  end if;

  partner_lawyer_id := public.get_partner_session_lawyer_id(p_partner_email, p_session_token);
  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  insert into public.partner_subscriptions (partner_email, lawyer_id, plan_id, status)
  values (lower(trim(p_partner_email)), partner_lawyer_id, normalized_plan_id, case when normalized_plan_id = 'basic' then 'active' else 'checkout_opened' end)
  on conflict (partner_email, lawyer_id) do update
    set plan_id = excluded.plan_id,
        status = excluded.status,
        updated_at = now();

  return jsonb_build_object(
    'partner_email', lower(trim(p_partner_email)),
    'lawyer_id', partner_lawyer_id,
    'plan_id', normalized_plan_id
  );
end;
$$;

alter table public.intake_requests enable row level security;
alter table public.partner_subscriptions enable row level security;
alter table public.partner_pipeline_items enable row level security;
alter table public.partner_case_notes enable row level security;
alter table public.partner_followup_tasks enable row level security;

drop policy if exists "Users can read own intake requests" on public.intake_requests;
create policy "Users can read own intake requests" on public.intake_requests
  for select using (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on public.intake_requests to authenticated;
grant select on public.partner_subscriptions to authenticated;
grant select on public.partner_pipeline_items to authenticated;
grant select on public.partner_case_notes to authenticated;
grant select on public.partner_followup_tasks to authenticated;

grant execute on function public.create_intake_request(uuid,text,text,text,text,text,text,text,text,text,text,text,text[]) to anon, authenticated;
grant execute on function public.route_intake_request(uuid,text[]) to authenticated;
grant execute on function public.list_partner_case_notes(text,text,text) to anon, authenticated;
grant execute on function public.list_partner_followup_tasks(text,text,text) to anon, authenticated;
grant execute on function public.save_partner_case_note(text,text,uuid,uuid,text) to anon, authenticated;
grant execute on function public.upsert_partner_followup_task(text,text,uuid,uuid,text,timestamptz,text) to anon, authenticated;
grant execute on function public.update_partner_pipeline_status(text,text,uuid,text) to anon, authenticated;
grant execute on function public.get_partner_subscription_checkout_context(text,text,text) to service_role;

notify pgrst, 'reload schema';

commit;
