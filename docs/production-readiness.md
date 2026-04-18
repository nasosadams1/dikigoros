# Production Readiness Controls

This project handles legal requests, private documents, bookings, reviews, and payments. Before launch, the following controls are required.

## Secrets

- Browser-visible configuration is limited to `VITE_*` values.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, email-provider keys, and partner-auth secrets must be configured only in Supabase Edge Function secrets.
- Rotate any live secret that was ever stored outside the deployment secret manager.
- Keep `.env.local` local and placeholder-only; use `.env.example` as the onboarding contract.

## Payments

- Card collection must stay in Stripe-hosted Checkout or setup flows.
- Browser code must never create or mutate successful payment records.
- Webhook verification is required before marking payments paid or refunded.
- Checkout return URLs must be restricted through `ALLOWED_APP_ORIGINS`.

## Legal Documents

- Client upload validation allows only PDF, Word, JPG, and PNG files up to 15 MB.
- Storage policies require object ownership for users and verified booking visibility for partners.
- Production storage should add malware scanning, retention policy, and audit logging before broad rollout.

## Database Contract

- Migrations are the source of truth. Do not rely on `desired_supabase_from_scratch.sql` without a matching migration.
- Verified reviews must go through `submit_booking_review`.
- Partner booking mutations must go through session-token RPCs.
- Users may cancel their own confirmed booking, but may not directly complete bookings or mutate payment state.

## Release Gate

- `npm run build`
- `npm exec tsc --noEmit --pretty false`
- `npm run test`
- `npm run lint`
- `npm run launch:audit`
- Supabase migrations applied to staging from scratch
- Stripe test-mode checkout, setup, webhook success, cancel, and refund paths verified

## Dynamic Launch Audit

Run `npm run launch:audit` before any launch decision. The command reads the configured Supabase project and writes:

- `var/launch-readiness-report.md`
- `var/launch-readiness-report.json`

The audit checks live/backend evidence for:

- booking/payment exception scenarios
- support workflow closure evidence
- backend-first operations source
- required funnel events across a 7-day window
- Αθήνα, Θεσσαλονίκη, Πειραιάς, Ηράκλειο και Πάτρα supply density across the 5 active practice areas
- partner ROI evidence

Protected operational and funnel tables require `SUPABASE_SERVICE_ROLE_KEY` in the local environment or CI secret store. Without it, those gates stay blocked rather than falling back to browser-local data.
