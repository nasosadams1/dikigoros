create table if not exists public.partner_session_audit_events (
  id uuid primary key default gen_random_uuid(),
  partner_email text not null,
  session_id uuid references public.partner_sessions(id) on delete set null,
  event_type text not null check (event_type in ('access_code_failed','previous_sessions_revoked','session_issued')),
  actor_label text not null default 'verify_partner_access_code',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists partner_session_audit_email_idx
  on public.partner_session_audit_events (lower(partner_email),created_at desc);

alter table public.partner_session_audit_events enable row level security;

drop policy if exists "Operations can read partner session audit events" on public.partner_session_audit_events;
create policy "Operations can read partner session audit events"
  on public.partner_session_audit_events for select
  to authenticated
  using (public.is_operations_user());

revoke all on public.partner_session_audit_events from anon, authenticated;
grant select on public.partner_session_audit_events to authenticated;

drop function if exists public.verify_partner_access_code(text, text);
create or replace function public.verify_partner_access_code(p_email text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matching_code uuid;
  partner_session_id uuid;
  partner_session_token text;
  partner_session_expires_at timestamptz;
  revoked_session_count integer := 0;
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
    insert into public.partner_session_audit_events (partner_email,event_type,actor_label,metadata)
    values (
      lower(p_email),
      'access_code_failed',
      'verify_partner_access_code',
      jsonb_build_object('reason','invalid_or_expired_code')
    );

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

  get diagnostics revoked_session_count = row_count;

  if revoked_session_count > 0 then
    insert into public.partner_session_audit_events (partner_email,event_type,actor_label,metadata)
    values (
      lower(p_email),
      'previous_sessions_revoked',
      'verify_partner_access_code',
      jsonb_build_object('revokedSessionCount',revoked_session_count)
    );
  end if;

  delete from public.partner_sessions
  where lower(email) = lower(p_email)
    and (revoked_at is not null or expires_at < now());

  partner_session_token := encode(gen_random_bytes(32), 'hex');

  insert into public.partner_sessions (email, session_token_hash, expires_at)
  values (lower(p_email), crypt(partner_session_token, gen_salt('bf')), now() + interval '2 hours')
  returning id, expires_at into partner_session_id, partner_session_expires_at;

  insert into public.partner_session_audit_events (partner_email,session_id,event_type,actor_label,metadata)
  values (
    lower(p_email),
    partner_session_id,
    'session_issued',
    'verify_partner_access_code',
    jsonb_build_object('expiresAt',partner_session_expires_at)
  );

  return jsonb_build_object(
    'ok', true,
    'sessionToken', partner_session_token,
    'expiresAt', partner_session_expires_at
  );
end;
$$;

grant execute on function public.verify_partner_access_code(text, text) to anon, authenticated;
