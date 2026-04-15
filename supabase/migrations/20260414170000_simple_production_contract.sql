create extension if not exists pgcrypto;

drop function if exists public.cancel_booking_as_user(uuid);
create or replace function public.cancel_booking_as_user(p_booking_id uuid)
returns public.booking_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_booking public.booking_requests;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  update public.booking_requests
  set status = 'cancelled'
  where id = p_booking_id
    and user_id = current_user_id
    and status = 'confirmed'
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  update public.booking_payments
  set status = case when status = 'paid' then 'refunded' else 'failed' end,
      updated_at = now()
  where booking_id = p_booking_id
    and status in ('pending','paid');

  return updated_booking;
end;
$$;

drop function if exists public.list_documents_as_partner(text,text,text);
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
    ud.created_at,
    br.reference_id,
    br.client_name
  from public.user_documents ud
  join public.booking_requests br on br.id = ud.booking_id
  where br.lawyer_id = p_lawyer_id
    and ud.visible_to_lawyer
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

drop function if exists public.get_partner_document_storage_path(text,text,uuid);
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
  document_path text;
begin
  select ud.storage_path into document_path
  from public.user_documents ud
  join public.booking_requests br on br.id = ud.booking_id
  where ud.id = p_document_id
    and ud.visible_to_lawyer
    and exists (
      select 1
      from public.partner_accounts pa
      join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
      where lower(pa.email) = lower(p_partner_email)
        and pa.lawyer_id = br.lawyer_id
        and pa.status = 'approved'
        and ps.revoked_at is null
        and ps.expires_at > now()
        and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
    )
  limit 1;

  if document_path is null then
    raise exception 'DOCUMENT_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  return document_path;
end;
$$;

drop function if exists public.update_review_as_partner(text,text,uuid,text,text);
create or replace function public.update_review_as_partner(
  p_partner_email text,
  p_session_token text,
  p_review_id uuid,
  p_lawyer_reply text,
  p_status text default null
)
returns public.booking_reviews
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  updated_review public.booking_reviews;
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

  update public.booking_reviews
  set lawyer_reply = coalesce(p_lawyer_reply, lawyer_reply),
      status = case
        when p_status in ('published','flagged','hidden') then p_status
        else status
      end,
      updated_at = now()
  where id = p_review_id
    and lawyer_id = partner_lawyer_id
  returning * into updated_review;

  if updated_review.id is null then
    raise exception 'REVIEW_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  return updated_review;
end;
$$;

drop policy if exists "Public can create booking requests" on public.booking_requests;
drop policy if exists "Users can update own booking requests" on public.booking_requests;
drop policy if exists "Partners can update own booking requests" on public.booking_requests;
drop policy if exists "Users can create own pending payments" on public.booking_payments;
drop policy if exists "Users can update own pending payments" on public.booking_payments;
drop policy if exists "Users can create own reviews" on public.booking_reviews;
drop policy if exists "Users can update own reviews" on public.booking_reviews;
drop policy if exists "Partners can update own review replies" on public.booking_reviews;
drop policy if exists "Partners can manage own profile settings" on public.partner_profile_settings;

grant usage on schema public to anon, authenticated;
revoke all on public.booking_requests from anon, authenticated;
revoke all on public.booking_payments from anon, authenticated;
revoke all on public.booking_reviews from anon, authenticated;
revoke all on public.partner_profile_settings from anon, authenticated;

grant select on public.booking_requests to anon, authenticated;
grant select on public.booking_payments to authenticated;
grant select on public.booking_reviews to anon, authenticated;
grant select on public.partner_profile_settings to anon, authenticated;

grant execute on function public.cancel_booking_as_user(uuid) to authenticated;
grant execute on function public.list_documents_as_partner(text,text,text) to anon, authenticated;
grant execute on function public.get_partner_document_storage_path(text,text,uuid) to service_role;
grant execute on function public.update_review_as_partner(text,text,uuid,text,text) to anon, authenticated;
grant execute on function public.save_partner_workspace_as_partner(text,text,jsonb,jsonb,jsonb,jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
