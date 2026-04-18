alter table public.booking_requests add column if not exists cancelled_at timestamptz;
alter table public.booking_requests add column if not exists cancellation_actor text;
alter table public.booking_requests add column if not exists cancellation_reason text;
alter table public.booking_requests add column if not exists reschedule_requested boolean not null default false;

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
    and lawyer_id = partner_lawyer_id
    and status = 'confirmed_paid'
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_NOT_PAID' using errcode = '42501';
  end if;

  return updated_booking;
end;
$$;

create or replace function public.cancel_booking_as_partner(
  p_partner_email text,
  p_session_token text,
  p_booking_id uuid,
  p_reason text default 'lawyer_requested_reschedule'
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
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_actor = 'lawyer',
      cancellation_reason = coalesce(nullif(trim(p_reason), ''), 'lawyer_requested_reschedule'),
      reschedule_requested = true,
      updated_at = now()
  where id = p_booking_id
    and lawyer_id = partner_lawyer_id
    and status in ('pending_confirmation', 'confirmed_unpaid', 'confirmed_paid')
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_ALREADY_CLOSED' using errcode = '42501';
  end if;

  update public.booking_payments
  set status = case
        when status in ('paid', 'refund_requested') then 'refund_requested'
        when status = 'refunded' then 'refunded'
        when status = 'checkout_opened' then 'failed'
        else status
      end,
      provider_payload = coalesce(provider_payload, '{}'::jsonb) || jsonb_build_object(
        'cancelledBy', 'lawyer',
        'cancelledAt', now(),
        'refundReviewRequired', status in ('paid', 'refund_requested'),
        'reason', coalesce(nullif(trim(p_reason), ''), 'lawyer_requested_reschedule')
      ),
      updated_at = now()
  where booking_id = p_booking_id;

  return updated_booking;
end;
$$;

grant execute on function public.complete_booking_as_partner(text,text,uuid) to anon, authenticated;
grant execute on function public.cancel_booking_as_partner(text,text,uuid,text) to anon, authenticated;
