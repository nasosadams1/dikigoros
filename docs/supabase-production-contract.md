# Supabase Production Contract

This app should have one operational Supabase contract: `supabase/desired_supabase_from_scratch.sql`.

## Initial Setup

1. Open the Supabase project SQL Editor.
2. Run `supabase/desired_supabase_from_scratch.sql`.
3. Confirm the final check table returns `true` for every row.
4. Deploy the Edge Functions:

```bash
supabase functions deploy partner-access-code
supabase functions deploy create-payment-setup-session
supabase functions deploy create-booking-checkout-session
supabase functions deploy create-partner-document-url
supabase functions deploy stripe-webhook
```

5. Set these Edge Function secrets:

```bash
supabase secrets set ALLOWED_APP_ORIGINS="https://your-domain.com,http://localhost:8080,http://localhost:4173"
supabase secrets set SUPABASE_URL="https://your-project.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="your-anon-key"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
supabase secrets set STRIPE_SECRET_KEY="sk_live_or_test"
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
supabase secrets set RESEND_API_KEY="re_..."
supabase secrets set PARTNER_AUTH_FROM_EMAIL="Dikigoros <partners@your-domain.com>"
```

## How The App Talks To Supabase

Browser table access is limited to reads and user-owned profile/document writes. Operational mutations go through RPCs or Edge Functions:

- `reserve_booking_slot`: creates bookings and pending payments atomically.
- `cancel_booking_as_user`: lets a signed-in user cancel only their own confirmed booking.
- `submit_booking_review`: lets a signed-in user review only a completed booking.
- `create_partner_access_code`: service-role only; used by the partner email code function.
- `verify_partner_access_code`: verifies the code and issues a short-lived partner session token.
- `list_bookings_as_partner`, `list_payments_as_partner`, `list_reviews_as_partner`, `list_documents_as_partner`: partner reads with the session token.
- `create-partner-document-url`: creates short-lived legal document download URLs for verified partners.
- `complete_booking_as_partner`, `update_review_as_partner`, `save_partner_workspace_as_partner`: partner writes with the session token.
- Stripe writes happen only through Edge Functions and the Stripe webhook.

## If An RPC Returns 404

Run:

```sql
notify pgrst, 'reload schema';
```

Then verify the function exists:

```sql
select to_regprocedure('public.save_partner_workspace_as_partner(text,text,jsonb,jsonb,jsonb,jsonb)');
```

If that returns `NULL`, rerun `supabase/desired_supabase_from_scratch.sql`.

## Partner Account Setup

Every approved partner must point to a real lawyer profile:

```sql
insert into public.partner_accounts (email, status, lawyer_id, approved_at)
values ('partner@example.com', 'approved', 'maria-papadopoulou', now())
on conflict (email) do update
set status = 'approved',
    lawyer_id = excluded.lawyer_id,
    approved_at = now();
```

The `lawyer_id` must already exist in `public.lawyer_profiles`.
