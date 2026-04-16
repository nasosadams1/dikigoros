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
  set status = case when status = 'pending' then 'failed' else status end,
      provider_payload = case
        when status = 'paid' then provider_payload || jsonb_build_object(
          'refundReviewRequired', true,
          'cancelledAt', now()
        )
        else provider_payload
      end,
      updated_at = now()
  where booking_id = p_booking_id
    and status in ('pending','paid');

  return updated_booking;
end;
$$;

