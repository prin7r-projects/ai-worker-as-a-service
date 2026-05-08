# Tally — apps/app/ (open-saas fork stub)

This directory is a **stub for the Wave 2 → Wave 3 transition**. The Tally runtime (auth, workspace model, worker pool, ledger DB, billing reconciliation against NOWPayments) ships here in the next wave by forking [`wasp-lang/open-saas`](https://github.com/wasp-lang/open-saas).

## Why a fork

[Open-SaaS](https://github.com/wasp-lang/open-saas) gives us, on Day 1 of the runtime build:

- Wasp framework with Prisma + Postgres + React + Tailwind
- Auth (email + Google OAuth) with verified email flow
- Stripe integration we'll **swap for NOWPayments** in `src/payment/`
- Workspace + Org model with API tokens
- Admin dashboard, marketing emails plumbing, file uploads — all of which we'll keep

We do **not** want to write all of that from scratch when the moat is the worker fleet + verification + receipt rendering, not auth and a billing schema.

## Plan for the fork (next wave)

1. `git submodule add https://github.com/wasp-lang/open-saas wasp-app` (or fork-and-clone), then strip the demo features (the AI image gen demo, the daily quote etc.).
2. Replace the Stripe integration in `src/payment/stripe/` with a NOWPayments adapter that mirrors the patterns in `/apps/landing/lib/nowpayments.ts`. The adapter writes one settlement row per cleared shift, not per subscription tick.
3. Add the Tally domain models:
   - `Worker` (profile_id, name, runtime_config)
   - `Contract` (org_id, profile_id, unit_price_usd, verification_rule, pool_balance_usd)
   - `Shift` (contract_id, started_at, ended_at, attempted, cleared, voided, total_charged_usd)
   - `LineItem` (shift_id, status, payload, verification_evidence, charged_usd)
   - `Receipt` (shift_id, pdf_url, issued_at, paid_at, nowpayments_invoice_id)
4. Add the worker fleet runtime — separate `apps/runtime/` with one process per profile, queue + worker pattern via BullMQ + Redis.
5. Wire the verification rule engine — a per-profile pure function `(line, buyerState) => "cleared" | "voided" | "pending"` with side-effect-free evaluation against the buyer's source of truth API.
6. Wire receipt PDF rendering (Puppeteer + the same paper-and-ink templates from `/apps/landing/`).
7. Wire the IPN handler in this app to mark shifts paid when the corresponding NOWPayments invoice clears.

## What's **here** today

Just this README and a `.gitkeep`. The Wave 2 build deliberately stopped short of the runtime so the landing + checkout could ship immediately.

## Why we did not include the open-saas template now

The repo is large (~140 MB at full clone with assets). Including it for Wave 2 — which is landing-only — would inflate the build container, slow CI, and force CI to compile Wasp on every landing rebuild for no reason. The split keeps each surface independently buildable.

## Next-wave entrypoint

When the runtime build kicks off, this README will be replaced by the open-saas README, and a `DESIGN.md` for the dashboard surface will be added at `apps/app/DESIGN.md` per the Wave 2 v2 standard (per-surface DESIGN.md for monorepos).
