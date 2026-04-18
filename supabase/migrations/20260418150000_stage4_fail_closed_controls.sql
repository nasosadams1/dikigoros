-- Stage 4 hardening: backend-only partner sessions, analytics evidence, and payment reconciliation.

delete from public.partner_access_codes;

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

  update public.partner_sessions
  set revoked_at = now()
  where lower(email) = lower(p_email)
    and revoked_at is null
    and expires_at > now();

  delete from public.partner_sessions
  where lower(email) = lower(p_email)
    and (revoked_at is not null or expires_at < now());

  partner_session_token := encode(gen_random_bytes(32), 'hex');

  insert into public.partner_sessions (email, session_token_hash, expires_at)
  values (lower(p_email), crypt(partner_session_token, gen_salt('bf')), now() + interval '2 hours')
  returning expires_at into partner_session_expires_at;

  return jsonb_build_object(
    'ok', true,
    'sessionToken', partner_session_token,
    'expiresAt', partner_session_expires_at
  );
end;
$$;

create table if not exists public.payment_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  checked_count integer not null default 0,
  mismatch_count integer not null default 0,
  notes text
);

create table if not exists public.payment_reconciliation_mismatches (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.payment_reconciliation_runs(id) on delete set null,
  booking_payment_id uuid references public.booking_payments(id) on delete set null,
  booking_id uuid references public.booking_requests(id) on delete set null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  mismatch_type text not null,
  expected_state text,
  observed_state text,
  severity text not null default 'high' check (severity in ('low', 'medium', 'high', 'critical')),
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_reconciliation_mismatches_open_idx
  on public.payment_reconciliation_mismatches (created_at desc)
  where resolved_at is null;

alter table public.payment_reconciliation_runs enable row level security;
alter table public.payment_reconciliation_mismatches enable row level security;

drop policy if exists "Operations can read payment reconciliation runs" on public.payment_reconciliation_runs;
create policy "Operations can read payment reconciliation runs"
  on public.payment_reconciliation_runs for select
  to authenticated
  using (public.is_operations_user());

drop policy if exists "Operations can read payment reconciliation mismatches" on public.payment_reconciliation_mismatches;
create policy "Operations can read payment reconciliation mismatches"
  on public.payment_reconciliation_mismatches for select
  to authenticated
  using (public.is_operations_user());

revoke all on public.payment_reconciliation_runs from anon, authenticated;
revoke all on public.payment_reconciliation_mismatches from anon, authenticated;
grant select on public.payment_reconciliation_runs to authenticated;
grant select on public.payment_reconciliation_mismatches to authenticated;

alter table public.funnel_events add column if not exists contract_version integer not null default 2;
alter table public.funnel_events add column if not exists delivery_state text not null default 'persisted'
  check (delivery_state in ('persisted', 'retry', 'dropped'));
alter table public.funnel_events add column if not exists filtered_reason text;

create index if not exists funnel_events_contract_window_idx
  on public.funnel_events (contract_version, occurred_at desc);

create table if not exists public.document_access_audit_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.user_documents(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_label text not null,
  action text not null,
  reason_code text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.user_documents add column if not exists malware_scan_status text not null default 'pending'
  check (malware_scan_status in ('pending', 'clean', 'blocked', 'failed'));
alter table public.user_documents add column if not exists malware_scan_provider text;
alter table public.user_documents add column if not exists malware_scan_checked_at timestamptz;

create index if not exists document_access_audit_document_idx
  on public.document_access_audit_events (document_id, created_at desc);

alter table public.document_access_audit_events enable row level security;

drop function if exists public.list_documents_as_partner(text, text, text);
create or replace function public.list_documents_as_partner(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns table (
  id uuid,
  booking_id uuid,
  name text,
  size integer,
  mime_type text,
  category text,
  storage_path text,
  visible_to_lawyer boolean,
  malware_scan_status text,
  created_at timestamptz,
  reference_id text,
  client_name text
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    ud.id,
    ud.booking_id,
    ud.name,
    ud.size,
    ud.mime_type,
    ud.category,
    ud.storage_path,
    ud.visible_to_lawyer,
    ud.malware_scan_status,
    ud.created_at,
    br.reference_id,
    br.client_name
  from public.user_documents ud
  join public.booking_requests br on br.id = ud.booking_id
  where br.lawyer_id = p_lawyer_id
    and ud.visible_to_lawyer
    and ud.malware_scan_status = 'clean'
    and exists (
      select 1
      from public.partner_accounts pa
      join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
      where lower(pa.email) = lower(p_partner_email)
        and pa.lawyer_id = p_lawyer_id
        and pa.status = 'approved'
        and ps.revoked_at is null
        and ps.expires_at > now()
        and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
    )
  order by ud.created_at desc;
$$;

drop function if exists public.get_partner_document_storage_path(text, text, uuid);
create or replace function public.get_partner_document_storage_path(
  p_partner_email text,
  p_session_token text,
  p_document_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  storage_path_value text;
begin
  select ud.storage_path into storage_path_value
  from public.user_documents ud
  join public.booking_requests br on br.id = ud.booking_id
  join public.partner_accounts pa on pa.lawyer_id = br.lawyer_id
  join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
  where ud.id = p_document_id
    and ud.visible_to_lawyer
    and ud.malware_scan_status = 'clean'
    and lower(pa.email) = lower(p_partner_email)
    and pa.status = 'approved'
    and ps.revoked_at is null
    and ps.expires_at > now()
    and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
  limit 1;

  if storage_path_value is not null then
    insert into public.document_access_audit_events (
      document_id,
      actor_label,
      action,
      reason_code,
      metadata
    )
    values (
      p_document_id,
      lower(p_partner_email),
      'signed_url_created',
      'partner_case_access',
      jsonb_build_object('source', 'create-partner-document-url')
    );
  end if;

  return storage_path_value;
end;
$$;

drop policy if exists "Operations can read document access audit" on public.document_access_audit_events;
create policy "Operations can read document access audit"
  on public.document_access_audit_events for select
  to authenticated
  using (public.is_operations_user());

revoke all on public.document_access_audit_events from anon, authenticated;
grant select on public.document_access_audit_events to authenticated;
grant execute on function public.list_documents_as_partner(text, text, text) to anon, authenticated;
grant execute on function public.get_partner_document_storage_path(text, text, uuid) to anon, authenticated;
