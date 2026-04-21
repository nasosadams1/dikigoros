begin;

alter table public.booking_payments add column if not exists partner_plan_id text not null default 'basic';
alter table public.booking_payments add column if not exists partner_platform_fee_cents integer not null default 0;
alter table public.booking_payments add column if not exists partner_net_amount_cents integer;
alter table public.booking_payments add column if not exists partner_fee_status text not null default 'not_applicable';

alter table public.booking_payments drop constraint if exists booking_payments_partner_plan_id_check;
alter table public.booking_payments
  add constraint booking_payments_partner_plan_id_check
  check (partner_plan_id in ('basic','pro','premium'));

alter table public.booking_payments drop constraint if exists booking_payments_partner_platform_fee_cents_check;
alter table public.booking_payments
  add constraint booking_payments_partner_platform_fee_cents_check
  check (partner_platform_fee_cents >= 0);

alter table public.booking_payments drop constraint if exists booking_payments_partner_net_amount_cents_check;
alter table public.booking_payments
  add constraint booking_payments_partner_net_amount_cents_check
  check (partner_net_amount_cents is null or partner_net_amount_cents >= 0);

alter table public.booking_payments drop constraint if exists booking_payments_partner_fee_status_check;
alter table public.booking_payments
  add constraint booking_payments_partner_fee_status_check
  check (partner_fee_status in ('not_applicable','deducted_from_payout','waived_by_subscription','refunded'));

alter table public.partner_subscriptions add column if not exists billing_interval text not null default 'monthly';
alter table public.partner_subscriptions add column if not exists stripe_price_id text;
alter table public.partner_subscriptions add column if not exists plan_amount_cents integer not null default 0;

alter table public.partner_subscriptions drop constraint if exists partner_subscriptions_billing_interval_check;
alter table public.partner_subscriptions
  add constraint partner_subscriptions_billing_interval_check
  check (billing_interval in ('monthly','annual'));

alter table public.partner_subscriptions drop constraint if exists partner_subscriptions_plan_amount_cents_check;
alter table public.partner_subscriptions
  add constraint partner_subscriptions_plan_amount_cents_check
  check (plan_amount_cents >= 0);

drop function if exists public.get_partner_subscription_checkout_context(text,text,text);
drop function if exists public.get_partner_subscription_checkout_context(text,text,text,text,text,integer);

create or replace function public.get_partner_subscription_checkout_context(
  p_partner_email text,
  p_session_token text,
  p_plan_id text,
  p_billing_interval text default 'monthly',
  p_stripe_price_id text default null,
  p_plan_amount_cents integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  normalized_plan_id text := lower(trim(p_plan_id));
  normalized_billing_interval text := case when lower(trim(coalesce(p_billing_interval, 'monthly'))) = 'annual' then 'annual' else 'monthly' end;
begin
  if normalized_plan_id not in ('basic','pro','premium') then
    raise exception 'INVALID_PARTNER_PLAN' using errcode = '22023';
  end if;

  partner_lawyer_id := public.get_partner_session_lawyer_id(p_partner_email, p_session_token);
  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  insert into public.partner_subscriptions (
    partner_email,
    lawyer_id,
    plan_id,
    billing_interval,
    stripe_price_id,
    plan_amount_cents,
    status,
    provider_payload
  )
  values (
    lower(trim(p_partner_email)),
    partner_lawyer_id,
    normalized_plan_id,
    normalized_billing_interval,
    nullif(trim(coalesce(p_stripe_price_id, '')), ''),
    greatest(coalesce(p_plan_amount_cents, 0), 0),
    case when normalized_plan_id = 'basic' then 'active' else 'checkout_opened' end,
    jsonb_build_object(
      'checkoutRequestedAt', now(),
      'billingInterval', normalized_billing_interval,
      'stripePriceId', nullif(trim(coalesce(p_stripe_price_id, '')), ''),
      'planAmountCents', greatest(coalesce(p_plan_amount_cents, 0), 0)
    )
  )
  on conflict (partner_email, lawyer_id) do update
    set plan_id = excluded.plan_id,
        billing_interval = excluded.billing_interval,
        stripe_price_id = excluded.stripe_price_id,
        plan_amount_cents = excluded.plan_amount_cents,
        status = excluded.status,
        provider_payload = public.partner_subscriptions.provider_payload || excluded.provider_payload,
        updated_at = now();

  return jsonb_build_object(
    'partner_email', lower(trim(p_partner_email)),
    'lawyer_id', partner_lawyer_id,
    'plan_id', normalized_plan_id,
    'billing_interval', normalized_billing_interval
  );
end;
$$;

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
  active_partner_plan_id text := 'basic';
  platform_fee_cents integer := 0;
  fee_status text := 'not_applicable';
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

  select coalesce(ps.plan_id, 'basic') into active_partner_plan_id
  from public.partner_subscriptions ps
  where ps.lawyer_id = partner_lawyer_id
    and lower(ps.partner_email) = lower(trim(p_partner_email))
    and ps.status = 'active'
  order by ps.updated_at desc
  limit 1;

  active_partner_plan_id := coalesce(active_partner_plan_id, 'basic');
  platform_fee_cents := case when active_partner_plan_id = 'basic' then 700 else 0 end;
  fee_status := case when platform_fee_cents > 0 then 'deducted_from_payout' else 'waived_by_subscription' end;

  update public.booking_payments
  set partner_plan_id = active_partner_plan_id,
      partner_platform_fee_cents = platform_fee_cents,
      partner_net_amount_cents = greatest((amount * 100) - platform_fee_cents, 0),
      partner_fee_status = fee_status,
      provider_payload = provider_payload || jsonb_build_object(
        'partnerPlanBilling',
        jsonb_build_object(
          'planId', active_partner_plan_id,
          'platformFeeCents', platform_fee_cents,
          'netAmountCents', greatest((amount * 100) - platform_fee_cents, 0),
          'feeStatus', fee_status,
          'feeAppliedAt', now()
        )
      ),
      updated_at = now()
  where booking_id = p_booking_id
    and status = 'paid';

  insert into public.partner_pipeline_items (booking_id, lawyer_id, status, metadata)
  values (
    updated_booking.id,
    partner_lawyer_id,
    'completed',
    jsonb_build_object('completedAt', now(), 'source', 'partner_completion')
  )
  on conflict (booking_id) do update
    set status = 'completed',
        metadata = public.partner_pipeline_items.metadata || excluded.metadata,
        updated_at = now();

  update public.lawyer_profiles
  set completed_consultations = completed_consultations + 1,
      updated_at = now()
  where id = partner_lawyer_id;

  return updated_booking;
end;
$$;

grant execute on function public.get_partner_subscription_checkout_context(text,text,text,text,text,integer) to service_role;
grant execute on function public.complete_booking_as_partner(text,text,uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
