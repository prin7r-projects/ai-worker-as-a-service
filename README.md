# Shiftledger — AI worker as a service (outcome-based)

> The first **payroll for AI workers**. You only pay when the shift ships.

Shiftledger puts AI workers on an outcome-based payroll: you specify the deliverable (X tickets resolved, Y leads contacted, Z articles drafted), we run a pre-trained worker against your stack, and you pay **only when the receipt clears**. No hour-billing, no opaque per-token math, no minimum commit.

## What's in this repo

| Path | Purpose |
|---|---|
| [`/DESIGN.md`](./DESIGN.md) | Canonical brand + design system. 15 sections per Wave 2 v2 standard. |
| [`/docs/`](./docs/) | The 10 strategy docs: brand, architecture, journeys, pain, audience, channels, sales, marketing, GTM, pitch deck. |
| [`/apps/landing/`](./apps/landing/) | Public marketing site (Next.js 15 + Tailwind). Hero receipt → 6 worker profiles → outcome pricing → trust/verification → tiers (NOWPayments crypto checkout) → FAQ. |
| [`/apps/app/`](./apps/app/) | Stub for the open-saas-fork dashboard (a future wave will fork [`wasp-lang/open-saas`](https://github.com/wasp-lang/open-saas) into here). |
| [`/Dockerfile.landing`](./Dockerfile.landing) | Multistage Next.js standalone build. |
| [`/docker-compose.yml`](./docker-compose.yml) | Single `landing` service behind dokploy-traefik on storage-contabo. |
| [`/docs/screenshots/`](./docs/screenshots/) | Production renders of the landing at 1440x900 + 390x844. |

## Live deploy

- **Landing**: https://ai-worker-as-a-service.prin7r.com
- **Notion opportunity**: https://www.notion.so/AI-worker-as-a-service-outcome-based-3543ceec26198168a35ee7ba2e8a09c9
- **Repo**: https://github.com/prin7r-projects/ai-worker-as-a-service

## Local dev

```bash
cd apps/landing
pnpm install
pnpm dev   # http://localhost:3000
```

To exercise the NOWPayments hosted-invoice CTA locally, copy `.env.example` to `.env.local` in `apps/landing/` and fill in `NOWPAYMENTS_API_KEY` + `NOWPAYMENTS_IPN_SECRET`. The same merchant is shared across Wave 2; ask the orchestrator for current values. Without those, every Buy CTA returns HTTP 503 `missing_env` with a brand-voice fallback message.

## Architecture in one paragraph

The landing is the **front door**: a static Next.js 15 marketing site (App Router, Tailwind, no JS frameworks beyond React) deployed as a standalone container. The two server routes that matter — `POST /api/checkout/nowpayments` (creates a hosted invoice and redirects the customer to `nowpayments.io/payment/?iid=...`) and `POST /api/webhooks/nowpayments` (verifies the IPN with HMAC-SHA512 over the sorted JSON payload) — are the canonical Shiftledger payment surface. The actual worker fleet (Shiftledger's runtime: queue, worker profiles, outcome verification) is **not** in this repo — it ships in `apps/app/` next wave when the open-saas fork lands.

## Screenshots

Both rendered against the production URL, committed to `/docs/screenshots/`:

![Shiftledger landing — desktop (1440x900)](./docs/screenshots/landing-desktop.png)

![Shiftledger landing — mobile (390x844)](./docs/screenshots/landing-mobile.png)

## License

MIT — see [LICENSE](./LICENSE).
