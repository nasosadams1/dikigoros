alter table public.booking_requests add column if not exists updated_at timestamptz not null default now();
alter table public.booking_requests add column if not exists consultation_status text not null default 'scheduled';
alter table public.booking_payments add column if not exists provider_payload jsonb not null default '{}'::jsonb;

alter table public.booking_requests drop constraint if exists booking_requests_status_check;
alter table public.booking_requests
  add constraint booking_requests_status_check
  check (status in ('pending_confirmation','confirmed_unpaid','confirmed_paid','completed','cancelled','confirmed'));

alter table public.booking_requests drop constraint if exists booking_requests_consultation_status_check;
alter table public.booking_requests
  add constraint booking_requests_consultation_status_check
  check (consultation_status in ('scheduled','completed_pending_partner_confirmation','completed_confirmed'));

alter table public.booking_payments drop constraint if exists booking_payments_status_check;
alter table public.booking_payments
  add constraint booking_payments_status_check
  check (status in ('not_opened','checkout_opened','paid','failed','refund_requested','refunded','pending'));

drop index if exists public.booking_requests_active_slot_idx;
create unique index booking_requests_active_slot_idx
  on public.booking_requests (lawyer_id,date_label,time)
  where status in ('pending_confirmation','confirmed_unpaid','confirmed_paid','confirmed');

drop function if exists public.reserve_booking_slot(uuid,uuid,text,text,text,text,text,integer,text,text,text,text,text,text,text);
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
  current_user_id uuid := auth.uid();
  effective_user_id uuid := coalesce(p_user_id, auth.uid());
  inserted_booking public.booking_requests;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED_FOR_BOOKING' using errcode = '42501';
  end if;

  if effective_user_id is null or current_user_id is distinct from effective_user_id then
    raise exception 'INVALID_BOOKING_USER' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.partner_accounts pa
    where lower(pa.lawyer_id) = lower(p_lawyer_id)
      and pa.status = 'approved'
      and (
        pa.user_id = current_user_id
        or lower(pa.email) = lower(coalesce(auth.jwt() ->> 'email',''))
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
      and status in ('pending_confirmation','confirmed_unpaid','confirmed_paid','confirmed')
  ) then
    raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.booking_requests (
    id,user_id,reference_id,lawyer_id,lawyer_name,consultation_type,consultation_mode,
    price,duration,date_label,time,client_name,client_email,client_phone,issue_summary,status,consultation_status,updated_at
  )
  values (
    p_booking_id,effective_user_id,p_reference_id,p_lawyer_id,p_lawyer_name,p_consultation_type,p_consultation_mode,
    p_price,p_duration,p_date_label,p_time,p_client_name,lower(trim(p_client_email)),p_client_phone,nullif(p_issue_summary,''),
    'confirmed_unpaid','scheduled',now()
  )
  returning * into inserted_booking;

  insert into public.booking_payments (booking_id,user_id,lawyer_id,amount,currency,status,invoice_number,updated_at)
  values (
    inserted_booking.id,inserted_booking.user_id,inserted_booking.lawyer_id,inserted_booking.price,
    'EUR','not_opened','INV-' || regexp_replace(inserted_booking.reference_id,'^BK-',''),now()
  )
  on conflict (booking_id) do update
    set user_id = excluded.user_id,
        status = case when public.booking_payments.status = 'pending' then 'not_opened' else public.booking_payments.status end,
        updated_at = now();

  return inserted_booking;
exception
  when unique_violation then
    raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode = 'P0001';
end;
$$;

drop function if exists public.cancel_booking_as_user(uuid);
create or replace function public.cancel_booking_as_user(p_booking_id uuid)
returns public.booking_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text := lower(coalesce(auth.jwt() ->> 'email',''));
  updated_booking public.booking_requests;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  update public.booking_requests
  set status = 'cancelled',
      user_id = coalesce(user_id, current_user_id),
      cancelled_at = coalesce(cancelled_at, now()),
      cancellation_actor = coalesce(cancellation_actor, 'client'),
      cancellation_reason = coalesce(cancellation_reason, 'client_requested'),
      updated_at = now()
  where id = p_booking_id
    and status in ('pending_confirmation','confirmed_unpaid','confirmed_paid','confirmed')
    and (
      user_id = current_user_id
      or (
        user_id is null
        and current_user_email <> ''
        and lower(client_email) = current_user_email
      )
    )
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  update public.booking_payments
  set status = case
      when status in ('paid','refund_requested') then 'refund_requested'
      when status = 'refunded' then 'refunded'
      when status in ('checkout_opened','pending') then 'failed'
      else status
    end,
    provider_payload = case
      when status = 'paid' then provider_payload || jsonb_build_object(
        'refundReviewRequired', true,
        'refundRequestedAt', now(),
        'cancelledAt', now()
      )
      else provider_payload
    end,
    updated_at = now()
  where booking_id = p_booking_id;

  return updated_booking;
end;
$$;

create or replace function public.submit_partner_application(
  p_application_id uuid,
  p_reference_id text,
  p_full_name text,
  p_work_email text,
  p_phone text,
  p_city text,
  p_law_firm_name text,
  p_website_or_linkedin text,
  p_bar_association text,
  p_registration_number text,
  p_years_of_experience text,
  p_specialties text[],
  p_professional_bio text,
  p_document_metadata jsonb
)
returns public.partner_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_application public.partner_applications;
  persisted_application public.partner_applications;
  normalized_email text := lower(trim(p_work_email));
begin
  if normalized_email = '' or normalized_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_PARTNER_APPLICATION_EMAIL' using errcode = '22023';
  end if;

  select * into existing_application
  from public.partner_applications
  where lower(work_email) = normalized_email
    and status in ('under_review','approved')
  order by created_at desc
  limit 1;

  if existing_application.id is not null then
    return existing_application;
  end if;

  select * into existing_application
  from public.partner_applications
  where lower(work_email) = normalized_email
    and status = 'needs_more_info'
  order by created_at desc
  limit 1;

  if existing_application.id is not null then
    update public.partner_applications
    set full_name = trim(p_full_name),
        phone = trim(p_phone),
        city = trim(p_city),
        law_firm_name = nullif(trim(coalesce(p_law_firm_name,'')), ''),
        website_or_linkedin = nullif(trim(coalesce(p_website_or_linkedin,'')), ''),
        bar_association = trim(p_bar_association),
        registration_number = trim(p_registration_number),
        years_of_experience = trim(p_years_of_experience),
        specialties = coalesce(p_specialties, '{}'),
        professional_bio = trim(p_professional_bio),
        document_metadata = coalesce(p_document_metadata, '[]'::jsonb),
        status = 'under_review',
        reviewed_at = null
    where id = existing_application.id
    returning * into persisted_application;

    return persisted_application;
  end if;

  insert into public.partner_applications (
    id,reference_id,full_name,work_email,phone,city,law_firm_name,website_or_linkedin,
    bar_association,registration_number,years_of_experience,specialties,professional_bio,document_metadata,status,created_at
  )
  values (
    p_application_id,p_reference_id,trim(p_full_name),normalized_email,trim(p_phone),trim(p_city),
    nullif(trim(coalesce(p_law_firm_name,'')), ''),nullif(trim(coalesce(p_website_or_linkedin,'')), ''),
    trim(p_bar_association),trim(p_registration_number),trim(p_years_of_experience),
    coalesce(p_specialties, '{}'),trim(p_professional_bio),coalesce(p_document_metadata, '[]'::jsonb),'under_review',now()
  )
  returning * into persisted_application;

  return persisted_application;
exception
  when unique_violation then
    select * into existing_application
    from public.partner_applications
    where lower(work_email) = normalized_email
      and status in ('under_review','needs_more_info','approved')
    order by created_at desc
    limit 1;

    if existing_application.id is not null then
      return existing_application;
    end if;

    raise;
end;
$$;

create or replace function public.create_operational_case(
  p_case_id uuid,
  p_reference_id text,
  p_area text,
  p_title text,
  p_summary text,
  p_status text default 'new',
  p_priority text default 'normal',
  p_owner text default null,
  p_requester_email text default null,
  p_related_reference text default null,
  p_evidence jsonb default '[]'::jsonb,
  p_timeline jsonb default '[]'::jsonb,
  p_sla_due_at timestamptz default null
)
returns public.operational_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  is_ops boolean := public.is_operations_user();
  normalized_requester_email text := lower(nullif(trim(coalesce(p_requester_email,'')), ''));
  normalized_area text := coalesce(nullif(trim(p_area), ''), 'support');
  normalized_status text := coalesce(nullif(trim(p_status), ''), 'new');
  normalized_priority text := coalesce(nullif(trim(p_priority), ''), 'normal');
  actor_label text := case when is_ops then 'Λειτουργία' else 'Αιτών' end;
  evidence_payload jsonb := case when jsonb_typeof(coalesce(p_evidence, '[]'::jsonb)) = 'array' then coalesce(p_evidence, '[]'::jsonb) else '[]'::jsonb end;
  timeline_payload jsonb := case
    when jsonb_typeof(coalesce(p_timeline, '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(p_timeline, '[]'::jsonb)) > 0 then p_timeline
    else jsonb_build_array(jsonb_build_object(
      'at', now(),
      'actor', actor_label,
      'action', 'Άνοιγμα υπόθεσης',
      'note', p_summary
    ))
  end;
  persisted_case public.operational_cases;
begin
  if normalized_area not in ('payments','supply','verification','reviews','bookingDisputes','support','privacyDocuments','security') then
    raise exception 'INVALID_OPERATIONAL_AREA' using errcode = '22023';
  end if;

  if normalized_status not in ('new','assigned','waiting_evidence','in_review','escalated','resolved','rejected','suspended') then
    raise exception 'INVALID_OPERATIONAL_STATUS' using errcode = '22023';
  end if;

  if normalized_priority not in ('urgent','high','normal','low') then
    raise exception 'INVALID_OPERATIONAL_PRIORITY' using errcode = '22023';
  end if;

  if not is_ops then
    if normalized_area not in ('payments','bookingDisputes','support','privacyDocuments','security','reviews')
      or normalized_status not in ('new','assigned')
      or normalized_requester_email is null
      or length(normalized_requester_email) <= 3 then
      raise exception 'OPERATIONAL_CASE_FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  insert into
    public.operational_cases (
      id,reference_id,area,title,summary,status,priority,owner,requester_email,
      related_reference,evidence,timeline,sla_due_at,created_at,updated_at
    )
  values (
    p_case_id,p_reference_id,normalized_area,trim(p_title),trim(p_summary),normalized_status,
    normalized_priority,coalesce(nullif(trim(coalesce(p_owner,'')), ''), 'Operations lead'),
    normalized_requester_email,nullif(trim(coalesce(p_related_reference,'')), ''),
    evidence_payload,timeline_payload,coalesce(p_sla_due_at, now() + interval '48 hours'),now(),now()
  )
  returning * into persisted_case;

  insert into public.operational_audit_events (
    operational_case_id,actor_id,actor_label,event_type,note,payload,created_at
  )
  values (
    persisted_case.id,auth.uid(),actor_label,'case_created',persisted_case.summary,
    jsonb_build_object('area', persisted_case.area, 'referenceId', persisted_case.reference_id),
    now()
  );

  return persisted_case;
end;
$$;

grant execute on function public.reserve_booking_slot(uuid,uuid,text,text,text,text,text,integer,text,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.cancel_booking_as_user(uuid) to authenticated;
grant execute on function public.submit_partner_application(uuid,text,text,text,text,text,text,text,text,text,text,text[],text,jsonb) to anon, authenticated;
grant execute on function public.create_operational_case(uuid,text,text,text,text,text,text,text,text,text,jsonb,jsonb,timestamptz) to anon, authenticated;
