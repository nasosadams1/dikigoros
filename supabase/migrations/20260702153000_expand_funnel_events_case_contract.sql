do $$
declare
  check_constraint record;
begin
  for check_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.funnel_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%event_name%'
  loop
    execute format('alter table public.funnel_events drop constraint if exists %I', check_constraint.conname);
  end loop;
end $$;

alter table public.funnel_events
  add constraint funnel_events_event_name_check
  check (event_name in (
    'homepage_search',
    'search_profile_opened',
    'profile_booking_start',
    'booking_start',
    'booking_created',
    'payment_opened',
    'payment_completed',
    'consultation_completed',
    'review_submitted',
    'lawyer_application_submitted',
    'lawyer_application_approved',
    'approved_lawyer_first_completed_consultation',
    'partner_plan_checkout_opened',
    'partner_subscription_active',
    'case_created',
    'case_status_updated',
    'case_note_created'
  ));
