create table if not exists public.operational_cases (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  area text not null check (
    area in (
      'payments',
      'supply',
      'verification',
      'reviews',
      'bookingDisputes',
      'support',
      'privacyDocuments',
      'security'
    )
  ),
  title text not null,
  summary text not null,
  status text not null default 'new' check (
    status in (
      'new',
      'assigned',
      'waiting_evidence',
      'in_review',
      'escalated',
      'resolved',
      'rejected',
      'suspended'
    )
  ),
  priority text not null default 'normal' check (priority in ('urgent', 'high', 'normal', 'low')),
  owner text not null default 'Operations lead',
  requester_email text,
  related_reference text,
  evidence jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  sla_due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_cases_area_status_idx
  on public.operational_cases (area, status, sla_due_at);

create index if not exists operational_cases_requester_idx
  on public.operational_cases (requester_email, created_at desc)
  where requester_email is not null;

create table if not exists public.operational_audit_events (
  id uuid primary key default gen_random_uuid(),
  operational_case_id uuid references public.operational_cases (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_label text not null default 'Operations',
  event_type text not null,
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists operational_audit_case_idx
  on public.operational_audit_events (operational_case_id, created_at desc);

create table if not exists public.booking_payment_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.booking_requests (id) on delete cascade,
  stripe_event_id text not null unique,
  event_type text not null,
  payment_status text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists booking_payment_events_booking_idx
  on public.booking_payment_events (booking_id, created_at desc);

alter table public.operational_cases enable row level security;
alter table public.operational_audit_events enable row level security;
alter table public.booking_payment_events enable row level security;

drop policy if exists "Users can create own support cases" on public.operational_cases;
create policy "Users can create own support cases"
  on public.operational_cases for insert
  to authenticated
  with check (
    area in ('payments', 'bookingDisputes', 'support', 'privacyDocuments', 'security')
    and (
      requester_email is null
      or lower(requester_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "Users can read own support cases" on public.operational_cases;
create policy "Users can read own support cases"
  on public.operational_cases for select
  to authenticated
  using (
    requester_email is not null
    and lower(requester_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

revoke all on public.operational_cases from anon, authenticated;
revoke all on public.operational_audit_events from anon, authenticated;
revoke all on public.booking_payment_events from anon, authenticated;

grant select, insert on public.operational_cases to authenticated;
