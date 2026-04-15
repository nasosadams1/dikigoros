# Dikigoros

React/Vite marketplace for finding verified lawyers, booking consultations, managing legal documents, handling Stripe-hosted payments, and publishing verified post-appointment reviews.

## Local Setup

1. Install dependencies with `npm install`.
2. Use `.env.example` as the environment contract.
3. Keep server-only secrets in Supabase Edge Function secrets, not in the browser app.
4. Run the app with `npm run dev`.

## Release Checks

```bash
npm run build
npm exec tsc --noEmit --pretty false
npm run test
npm run lint
npm audit --omit=dev
```

## Production Notes

See [docs/production-readiness.md](docs/production-readiness.md) for the security, payments, document, database, and release controls expected before launch.

Use [docs/supabase-production-contract.md](docs/supabase-production-contract.md) as the Supabase setup/runbook. The canonical SQL file is `supabase/desired_supabase_from_scratch.sql`.
