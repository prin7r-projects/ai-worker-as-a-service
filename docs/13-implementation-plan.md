# 13 — Implementation Plan

> **Hand-off ready.** This plan is for the Phase 2 implementation agent picking up Shiftledger after the Wave 2 landing has shipped. You will find: (a) deployed landing at `https://ai-worker-as-a-service.prin7r.com` with NOWPayments checkout wired and verified; (b) brand identity / audience / architecture in `/docs/01..10-*.md`; (c) the user-story contract in `/docs/11-user-stories-and-scenarios.md`; (d) the technical spec in `/docs/12-technical-specification.md`; (e) the open-saas fork stub in `apps/app/` (currently a `.gitkeep` + README). Your first job is to bring `apps/app/` online — the worker runtime that turns the receipt metaphor into reality. Read docs 11 + 12 before any phase.

---

## 1. Phase breakdown

7 phases. Each has a verifiable Definition of Done.

| Phase | Goal | Effort |
|---|---|---|
| **0 — Scaffolding** | App stub fork; landing build green; seeded worker profiles | S — 2-4h |
| **1 — Core domain** | Contract / shift / receipt / verifier model live | L — 3-5d |
| **2 — UX surfaces** | Dashboard with contracts / shifts / receipts / integrations | L — 3-5d |
| **3 — Payments + onboarding + Notion** | Trial / Standard / Enterprise checkout end-to-end + magic-link onboarding | M — 2-3d |
| **4 — Production hardening** | Rate limits, idempotency, alerts, runbook | M — 1-2d |
| **5 — Launch ops** | Eval-runner, weekly digests, refund flow, admin dashboard | L — 2-3d |
| **6 — Post-launch experiments** | White-label receipts, partner analytics, drift watch | M — 1-2d |

---

### Phase 0 — Scaffolding

**Goal.** Fresh clone runs `pnpm install && pnpm -F landing dev` rendering the landing on `:3000`. `apps/app/` is the open-saas Wasp scaffold.

**Tasks.**
1. Verify Wave 2 state: clone repo, confirm landing builds (`pnpm -F landing build`). Confirm production landing returns `HTTP/2 200` from `https://ai-worker-as-a-service.prin7r.com`.
2. Read `/docs/02-architecture.md` and `/docs/12-technical-specification.md` §1.
3. Fork `wasp-lang/open-saas` into `apps/app/`. Keep open-saas defaults — magic-link auth, Wasp routing.
4. Add `data/seed/worker-profiles.json` covering `cs-shift`, `sdr-shift`, `research-shift`, `content-shift`. Each profile has `unitPriceUsd`, `verificationRule` (structured), `baselineClearRate`.
5. Wire local env. Add `INTEGRATION_KEY` (AES-256-GCM), `DATABASE_URL`, `ADMIN_API_KEY` to `.env.example`.
6. `pnpm -F app dev` runs open-saas Wasp on `:3001` with Hello-Shiftledger placeholder.

**Dependencies.** None.

**Effort.** S — 30-50 tool-uses, 2-4h.

**DoD.**
- [x] `pnpm install` clean. Verified Phase 0 (PRI-2317).
- [ ] `pnpm -F landing build` produces standalone. ⚠️ Pre-existing Next.js 15 static gen error (Html component in pages path); dev server works.
- [x] `pnpm -F app dev` starts TypeScript Express app on `:3001` with Hello-Shiftledger placeholder (PRI-2317). Drizzle ORM + PostgreSQL, not Wasp — Phase 1 migrates to Drizzle per spec.
- [x] `data/seed/worker-profiles.json` validates against `apps/app/src/db/schema.ts`. 4 profiles (cs-shift, sdr-shift, research-shift, content-shift) with structured verification rules.
- [x] Production landing still returns 200 (verified 2026-05-08).

**Hand-off context.**
- Wave 2 landing uses `apps/landing/` only. Don't break it.
- `Dockerfile.landing` is correct; don't touch it in Phase 0.
- Open-saas defaults to PostgreSQL via Prisma; you'll migrate to Drizzle in Phase 1 (Drizzle is what doc 12 §2.2 specifies).

---

### Phase 1 — Core domain

**Goal.** The contract / shift / receipt / verifier model from doc 12 §2 is implemented and exercised end-to-end with a stub worker (no real LLM calls — placeholder verification events).

**Tasks.**
1. Implement Drizzle schema per doc 12 §2.2.
2. Migrate seed → DB on `pnpm -F app db:seed`. Idempotent.
3. `ContractService.create(args)` and `ContractService.activate(contractId)`. Activate = mark `active`, record `activatedAt`, schedule first shift.
4. `ShiftScheduler.enqueue(contractId)` — adds a shift to the BullMQ queue. Worker pulls shift, calls a stub `WorkerRunner.run(shift)` which produces N synthetic verification events.
5. `Verifier.verify(externalId, rule)` — checks the source-of-truth state against the rule. For Phase 1: integration is stubbed, returns `cleared=true` with 90% probability.
6. `LedgerService.recordLine(shiftId, externalId, status, unitPriceUsd, verificationDetails)` — creates a `receiptLines` row.
7. End-to-end test: create contract → activate → run shift → verify lines → audit ledger.

**Dependencies.** Phase 0.

**Effort.** L — 150-250 tool-uses, 3-5 days.

**DoD.**
- [ ] `ContractService.create()` + `activate()` produce a contract row in `pending` then `active` state.
- [ ] `ShiftScheduler.enqueue()` produces a shift row in `queued`, then `running`, then `completed`.
- [ ] Verifier produces 100 synthetic verification events for a 100-outcome contract; 80-95 are cleared, the rest voided.
- [ ] `LedgerService.recordLine()` produces 100 `receiptLines` rows; sum of cleared * unitPrice matches the expected revenue.
- [ ] End-to-end Vitest: `pnpm -F app test:e2e` runs full create→activate→run→verify→ledger flow without errors.

**Hand-off context.**
- BullMQ requires Redis. Add Redis to `docker-compose.yml`; persist via volume.
- Verification rules are structured JSON, not freeform — see doc 12 §2.2 schema. A future buyer-supplied rule MUST validate against the same schema.
- Worker substrate (LangGraph vs flat) is not yet decided; Phase 1 uses a flat synchronous stub. Phase 2 picks the substrate.

---

### Phase 2 — UX surfaces

**Goal.** Dashboard for contracts / shifts / receipts / integrations is usable. Integration paste-token flow works against a real Zendesk sandbox.

**Tasks.**
1. Dashboard `/app/contracts` lists contracts, statuses, totals.
2. Contract detail `/app/contracts/:id` shows linked shifts, receipt lines (cleared / voided / disputed), reconciliation status.
3. New-contract form: profile picker, outcome target slider, budget cap input, term selector. Posts to `POST /api/contracts`.
4. Integrations page: paste-token UI for Zendesk / Intercom / Salesforce / HubSpot. Validates via heartbeat call.
5. Wire real Zendesk integration: customer pastes token → server makes a `GET /api/v2/users/me.json` whoami call → stores encrypted token if 200.
6. Replace stub Verifier with real Zendesk verifier: poll `GET /api/v2/tickets/:id` and check `status == 'solved'` per rule.
7. Mobile pass: dashboard usable on 390×844 viewport.

**Dependencies.** Phase 1.

**Effort.** L — 200-350 tool-uses, 3-5 days.

**DoD.**
- [ ] Customer can create a contract via the dashboard form.
- [ ] Customer can paste a Zendesk API token; integration row created with `status='healthy'`.
- [ ] Real Zendesk shift completes against a sandbox account: tickets cleared/voided per actual ticket state.
- [ ] Receipt lines render with verification details (ticket id, resolved-by, resolution timestamp).
- [ ] Dashboard mobile passes content audit on 390×844.

**Hand-off context.**
- Zendesk OAuth would be cleaner than paste-token, but Phase 2 keeps paste-token for speed. Phase 6 may switch to OAuth.
- Wave 2 brand voice: every receipt line should read like a ledger entry, not a status badge. Use mono font on numbers.
- Don't expose dashboard to public traffic; gate with magic-link auth.

---

### Phase 3 — Payments + onboarding + Notion

**Goal.** Trial / Standard / Enterprise checkout flows are end-to-end; partner code accrues rev-share; magic-link onboarding email delivered.

**Tasks.**
1. Persist contracts in DB on `POST /api/checkout/nowpayments`.
2. Webhook handler idempotent on `(contractId, paymentStatus)`; on `finished`, mark active + enqueue first shift.
3. `POST /api/admin/contracts` for Enterprise — Bearer admin auth.
4. Magic-link onboarding email post-payment via Postmark template.
5. Partner code `referralCode` in checkout body → accrues 25% in `revShareLedger`.
6. Notion sync: paid contracts → Notion data source `Shiftledger Contracts` (data source ID stored in `NOTION_CONTRACTS_DSID`).

**Dependencies.** Phase 1, Phase 2.

**Effort.** M — 100-180 tool-uses, 2-3 days.

**DoD.**
- [ ] Trial $499 purchase end-to-end: NOWPayments unpaid invoice → simulated paid IPN → contract active → first shift enqueued.
- [ ] Standard $X with `referralCode: 'AGENCY-INDIE-007'` accrues 25% in revShareLedger.
- [ ] Enterprise via `POST /api/admin/contracts` returns hosted invoice URL within 1.5s p95.
- [ ] Notion `Shiftledger Contracts` row appears for every paid contract.
- [ ] Magic-link onboarding email delivered with dashboard link + license key.

**Hand-off context.**
- NOWPayments sandbox is `live=false` flag — DO NOT use sandbox for production. Use unpaid-invoice creation as the safe dry-run.
- `PRIN7R_NOTION_TOKEN` in `/Users/keer/.nth-kir-keys.env`. Loaded via `NOTION_TOKEN` env at container start.
- Magic-link uses open-saas defaults; configure SMTP creds via `.env`.

---

### Phase 4 — Production hardening

**Goal.** System survives traffic spikes, forged IPN, integration-token leaks, source-of-truth outages.

**Tasks.**
1. Idempotency middleware on `/api/checkout/nowpayments` keyed by `(customerEmail, workerProfile, tier, hour)`.
2. Traefik rate limits per doc 12 §7.
3. Forged-IPN simulation tests in `apps/landing/__tests__/webhooks.test.ts`.
4. Admin-key + integration-key rotation runbooks at `/docs/runbooks/rotate-{admin,integration}-key.md`.
5. Slack alerts: webhook sig failures, shifts stuck >24h, drift >5pp, daily contract anomalies.
6. PII scrub in stdout logs: token, payAddress, customer email.
7. CSP headers on landing.
8. Heartbeat job for every active integration: `GET whoami` every 5 min; pause contract on 3 consecutive failures.

**Dependencies.** Phase 3.

**Effort.** M — 80-120 tool-uses, 1-2 days.

**DoD.**
- [ ] Idempotency: same body 5x produces ONE invoice + ONE contract.
- [ ] Forged IPN bad sig → 401, no contract activated, alert fires.
- [ ] Slack `#alerts-shiftledger` receives 4 test messages (sig failures, stuck shifts, drift, anomalies).
- [ ] CSP header on every landing response.
- [ ] PII scrub regex tested with real-shaped payload.
- [ ] Heartbeat job pauses a contract within 15 min of integration token expiring.

**Hand-off context.**
- Traefik rate limits live on storage-contabo; not in app code.
- Integration tokens encrypted with `INTEGRATION_KEY`. Rotation = generate new key, decrypt-with-old → encrypt-with-new in a single transaction.
- Webhook test suite uses Vitest + Supertest. Don't hit live NOWPayments.

---

### Phase 5 — Launch ops

**Goal.** Weekly digests + eval runner + dispute / void flows + admin dashboard live.

**Tasks.**
1. BullMQ `digest-runner` weekly Monday 09:00 GMT — aggregate cleared/voided per active contract, send Postmark.
2. BullMQ `eval-runner` nightly 02:00 GMT — sample 1% of last-week cleared lines from each profile, recompute `clearRate`, write to `evalRuns`.
3. `POST /api/receipts/:lineId/dispute` opens a void request; verifier re-runs.
4. `POST /api/admin/contracts/:id/refund` records refund + voids unprocessed lines.
5. Admin dashboard `/admin` (open-saas role-gated): contracts / shifts / receipts / disputes / partner-payouts.
6. Drift-watch banner on catalog cards.

**Dependencies.** Phase 3, Phase 4.

**Effort.** L — 150-250 tool-uses, 2-3 days.

**DoD.**
- [ ] Weekly digest delivered to a test inbox at 09:00 GMT Monday.
- [ ] Eval-runner produces a fresh `evalRuns` row per profile per week.
- [ ] Disputed line: verifier re-runs against fresh source state; if confirmed void, line refunded.
- [ ] Admin dashboard at `/admin` shows full ledger.
- [ ] Drift-watch banner on a seeded `driftStatus = 'yellow'` profile.

**Hand-off context.**
- Refund flow is human-in-the-loop in Wave 3 — Concierge runs NOWPayments dashboard, then admin endpoint.
- Eval-runner sampling: 1% is enough to detect 5pp drift at p95 confidence given typical weekly volume of >100 cleared lines.
- Don't expose admin to public traffic.

---

### Phase 6 — Post-launch experiments ✅

**Goal.** White-label receipts; partner analytics; drift-watch retention measurement.

**Tasks.**
1. White-label receipts: partner-code customers can upload a logo + footer text + contact email per their `referrals` row. Receipt PDFs render with the partner brand.
2. `GET /api/admin/partners/:code/analytics` — 30/60/90-day cleared totals, accrued rev-share, top profiles.
3. Drift-cohort retention report: customers whose profile went `yellow` vs `green` — measure churn over 30 days.
4. Public `/changelog` page: profile additions, drift events, payouts (last 30 days).

**Dependencies.** All prior.

**Effort.** M — 80-120 tool-uses, 1-2 days.

**DoD.**
- [x] White-label receipt HTML renders with partner branding (logo, footer, contact email) for seeded partner `AGENCY-INDIE-007`. Print-to-PDF via browser print.
- [x] Partner analytics endpoint returns valid JSON with `overview`, `clearedByWindow` (30/60/90d), `topProfiles`, `branding`.
- [x] Drift-cohort report shows numeric churn rates per status color with aggregate by status.
- [x] `/changelog` is publicly accessible as HTML page and JSON API.

**Verification (2026-05-08).**
- Partner branding CRUD: `POST/GET /api/admin/partners/:code/branding` tested with AGENCY-INDIE-007.
- Partner analytics enhanced: 30/60/90-day windows, top profiles, branding all present in response.
- Drift-cohort: `GET /api/admin/drift-cohort?days=30` returns per-profile stats and aggregate by drift status.
- Drift status change logging: `POST /api/internal/drift/log-status-change` records to `profile_status_log` + auto-creates changelog entry.
- Changelog: `GET /changelog` (HTML) and `GET /api/changelog` (JSON) both work; admin can create entries via `POST /api/admin/changelog`.

**Hand-off context.**
- Receipt PDFs use browser print-to-PDF (no heavy server-side PDF dep). Receipt page at `/api/receipts/:lineId` renders HTML with white-label branding.
- New tables: `partner_branding`, `profile_status_log`, `changelog_entries` (migration `0002_phase6.sql`).
- Don't break public catalog with experiment-gated UI; fall back to control silently.

---

## 2. Cross-cutting concerns

| Concern | First addressed | Notes |
|---|---|---|
| Accessibility | Phase 2 | Lighthouse a11y >=95; focus-visible on dashboard interactives |
| i18n | Out of scope through Wave 4. English-only |
| Mobile | Phase 2 | Responsive dashboard; native apps NOT in scope |
| Telemetry | Phase 4 | Stdout JSON; Loki Wave 4+ |
| GDPR / DSAR | Phase 4 | Runbook in `/docs/runbooks/gdpr-dsar.md` |
| SOC 2 / HIPAA | NOT in scope (anti-persona). Wave 5+ if Enterprise pipeline > 5 |

---

## 3. Risk register

| # | Risk | Owner | Mitigation |
|---|---|---|---|
| R1 | NOWPayments outage | Phase 4 | Plisio + Reown wired in Wave 3 P3; degrade gracefully |
| R2 | Forged IPN bypassing HMAC | Phase 4 | Constant-time compare; rejection logging; alerts >5/h |
| R3 | Worker hallucinating cleared outcome | Phase 1 | Verifier MUST consume external state; no verifier event = no clear |
| R4 | Customer integration-token leak | Phase 4 | Encrypted at rest; never logged; never returned in API |
| R5 | Source-of-truth API outage | Phase 4 | Heartbeat-pause; resume on recovery; alert >24h paused |
| R6 | Drift on a popular profile causes churn | Phase 5 | Auto-pause new contracts on `red`; targeted concierge to existing customers |

---

## 5. Deploy (Phase 5/6 Live)

**Goal.** All services deployed and publicly accessible on `https://ai-worker-as-a-service.prin7r.com`.

**Status (2026-05-09).**

- [x] **Docker Compose** — services defined: postgres, redis, app (Express), landing (Next.js). No explicit networks (follows lead-enrichment pattern). `env_file: .env` on both app and landing.
- [x] **Traefik routing** — priority-based: `/api/checkout`+`/api/webhooks` → landing (pri 15), `/api/admin` → app with rate limit (pri 12), `/api`+`/app` → app (pri 10), catch-all → landing (pri 1).
- [x] **Build** — `Dockerfile.landing` (multi-stage Next.js standalone) and `Dockerfile.app` (tsx Express runner) both build clean with pnpm@9.15.4.
- [x] **DB** — PostgreSQL 16, migrations applied, seed data loaded (4 worker profiles).
- [x] **API verified** — All docs/12 endpoints responding correctly (health, contracts, workers, integrations, admin).
- [ ] **DNS** — ⚠️ `ai-worker-as-a-service.prin7r.com` currently resolves to `161.97.99.120` (old server). Must be updated to `144.91.94.91` (Prin7r VPS). All services verified working via direct IP.
- [ ] **E2E suite** — Vitest tests in `apps/app/src/__tests__/` and `apps/landing/__tests__/` to be run against live domain after DNS cutover.
- [ ] **Screenshots** — Desktop + mobile of `/app` dashboard to be committed to `screenshots/` after DNS cutover.

**Deploy location.** `/opt/prin7r-deploys/ai-worker-as-a-service` on `root@144.91.94.91`.

## 4. References

- Doc 11 — `/docs/11-user-stories-and-scenarios.md` — drives Phase 1-3 endpoints + Phase 5 ops flows.
- Doc 12 — `/docs/12-technical-specification.md` — schemas, contracts, budgets.
- DESIGN.md — `/DESIGN.md` — receipt-first visual contract.
- Wave 2 build report — `/Users/keer/projects/prin7r/wave2-reports/ai-worker-as-a-service-rebrand.md` — current production state + brand history.
- Payments prototypes — `/Users/keer/projects/prin7r/payments-prototypes/` — NOWPayments + Plisio + Reown reference.
