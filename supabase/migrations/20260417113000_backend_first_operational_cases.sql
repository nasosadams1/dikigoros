create or replace function public.is_operations_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'ops', 'operations')
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'ops', 'operations')
    or lower(coalesce(auth.jwt() ->> 'email', '')) like '%@dikigoros.gr';
$$;

grant execute on function public.is_operations_user() to anon, authenticated;

alter table public.operational_cases enable row level security;
alter table public.operational_audit_events enable row level security;

drop policy if exists "Users can create own support cases" on public.operational_cases;
drop policy if exists "Users can read own support cases" on public.operational_cases;
drop policy if exists "Anyone can create operational support cases" on public.operational_cases;
drop policy if exists "Requesters can read own operational cases" on public.operational_cases;
drop policy if exists "Operations can read all operational cases" on public.operational_cases;
drop policy if exists "Operations can update operational cases" on public.operational_cases;

create policy "Anyone can create operational support cases"
  on public.operational_cases for insert
  to anon, authenticated
  with check (
    public.is_operations_user()
    or (
      area in ('payments', 'bookingDisputes', 'support', 'privacyDocuments', 'security', 'reviews')
      and status in ('new', 'assigned')
      and requester_email is not null
      and length(trim(requester_email)) > 3
    )
  );

create policy "Requesters can read own operational cases"
  on public.operational_cases for select
  to authenticated
  using (
    requester_email is not null
    and lower(requester_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "Operations can read all operational cases"
  on public.operational_cases for select
  to authenticated
  using (public.is_operations_user());

create policy "Operations can update operational cases"
  on public.operational_cases for update
  to authenticated
  using (public.is_operations_user())
  with check (public.is_operations_user());

drop policy if exists "Operations can read operational audit events" on public.operational_audit_events;
drop policy if exists "Operations can insert operational audit events" on public.operational_audit_events;

create policy "Operations can read operational audit events"
  on public.operational_audit_events for select
  to authenticated
  using (public.is_operations_user());

create policy "Operations can insert operational audit events"
  on public.operational_audit_events for insert
  to authenticated
  with check (public.is_operations_user());

grant insert on public.operational_cases to anon;
grant select, insert, update on public.operational_cases to authenticated;
grant select, insert on public.operational_audit_events to authenticated;

insert into public.operational_cases (
  reference_id,
  area,
  title,
  summary,
  status,
  priority,
  owner,
  evidence,
  timeline,
  sla_due_at,
  created_at,
  updated_at
)
values
  (
    'PAY-LAUNCH-STRIPE',
    'payments',
    'Confirm live Stripe settlement path',
    'Verify live Checkout key, webhook secret, booking payment row, receipt URL, and refund path before national launch.',
    'new',
    'urgent',
    'Payments owner',
    jsonb_build_array('Checkout Sessions for booking payments', 'Webhook updates paid, failed, and refunded states'),
    jsonb_build_array(jsonb_build_object('at', now() - interval '3 hours', 'actor', 'Operations', 'action', 'Launch gate opened', 'note', 'Payment reconciliation must be proven from backend state.')),
    now() + interval '4 hours',
    now() - interval '3 hours',
    now() - interval '3 hours'
  ),
  (
    'SUPPLY-LAUNCH-DENSITY',
    'supply',
    'Athens and Thessaloniki density check',
    'Track verified bookable lawyer coverage in family, employment, property, inheritance, and criminal categories.',
    'new',
    'high',
    'Marketplace supply lead',
    jsonb_build_array('Minimum city and category coverage thresholds are calculated from live public profiles'),
    jsonb_build_array(jsonb_build_object('at', now() - interval '9 hours', 'actor', 'Operations', 'action', 'Launch gate opened', 'note', 'Core supply density must be proven before wider rollout.')),
    now() + interval '24 hours',
    now() - interval '9 hours',
    now() - interval '9 hours'
  ),
  (
    'VER-LAUNCH-QUEUE',
    'verification',
    'Application review queue',
    'Assign reviewer for identity, license, bar association, professional details, and profile readiness checks.',
    'new',
    'normal',
    'Verification lead',
    jsonb_build_array('Profiles stay public only after readiness checks pass'),
    jsonb_build_array(jsonb_build_object('at', now() - interval '26 hours', 'actor', 'Operations', 'action', 'Launch gate opened', 'note', 'Partner verification needs owned review before public activation.')),
    now() + interval '48 hours',
    now() - interval '26 hours',
    now() - interval '26 hours'
  ),
  (
    'REV-LAUNCH-MODERATION',
    'reviews',
    'Completed-booking review moderation',
    'Hold new reviews for completed-booking proof, case-detail screening, fraud checks, and lawyer reply handling.',
    'new',
    'normal',
    'Trust and reviews lead',
    jsonb_build_array('Review request opens only after booking completion'),
    jsonb_build_array(jsonb_build_object('at', now() - interval '18 hours', 'actor', 'Operations', 'action', 'Launch gate opened', 'note', 'Published reviews must depend on completed consultation proof.')),
    now() + interval '48 hours',
    now() - interval '18 hours',
    now() - interval '18 hours'
  ),
  (
    'DSP-LAUNCH-RESCHEDULE',
    'bookingDisputes',
    'Reschedule and no-show decision path',
    'Confirm cancellation window, payment state, communication history, and refund or reschedule outcome.',
    'new',
    'high',
    'Booking support lead',
    jsonb_build_array('Free cancellation or reschedule before the 24-hour window'),
    jsonb_build_array(jsonb_build_object('at', now() - interval '7 hours', 'actor', 'Operations', 'action', 'Launch gate opened', 'note', 'Booking exceptions need a shared queue and closure rule.')),
    now() + interval '24 hours',
    now() - interval '7 hours',
    now() - interval '7 hours'
  ),
  (
    'PRV-LAUNCH-DOCUMENTS',
    'privacyDocuments',
    'Document retention and deletion workflow',
    'Route access, deletion, visibility, and retention requests with booking/account context.',
    'new',
    'normal',
    'Privacy and documents lead',
    jsonb_build_array('Documents are visible to the booked lawyer only when user visibility allows it'),
    jsonb_build_array(jsonb_build_object('at', now() - interval '16 hours', 'actor', 'Operations', 'action', 'Launch gate opened', 'note', 'Document visibility and deletion require audit-friendly handling.')),
    now() + interval '48 hours',
    now() - interval '16 hours',
    now() - interval '16 hours'
  ),
  (
    'SEC-LAUNCH-RUNBOOK',
    'security',
    'Sensitive legal data incident runbook',
    'Confirm containment, audit context, notification decision, corrective controls, and closure record.',
    'new',
    'urgent',
    'Security and privacy lead',
    jsonb_build_array('Security and privacy concerns escalate before normal support handling'),
    jsonb_build_array(jsonb_build_object('at', now() - interval '90 minutes', 'actor', 'Operations', 'action', 'Launch gate opened', 'note', 'Security incidents must bypass normal support triage.')),
    now() + interval '2 hours',
    now() - interval '90 minutes',
    now() - interval '90 minutes'
  )
on conflict (reference_id) do nothing;
