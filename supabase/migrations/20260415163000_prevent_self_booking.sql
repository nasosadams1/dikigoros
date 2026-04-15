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
      and status = 'confirmed'
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
    status
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
    'confirmed'
  )
  returning * into inserted_booking;

  insert into public.booking_payments (booking_id, user_id, lawyer_id, amount, currency, status, invoice_number)
  values (
    inserted_booking.id,
    inserted_booking.user_id,
    inserted_booking.lawyer_id,
    inserted_booking.price,
    'EUR',
    'pending',
    'INV-' || regexp_replace(inserted_booking.reference_id, '^BK-', '')
  )
  on conflict (booking_id) do nothing;

  return inserted_booking;
exception
  when unique_violation then
    raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode = 'P0001';
end;
$$;
