# 11 — User Stories and Scenarios

This document is the canonical input contract for Shiftledger's Phase 2 implementation (the worker runtime behind the receipts). It enumerates personas, primary user stories, end-to-end scenarios (happy paths, edge cases, anti-scenarios), and ties each flow to the frontend touch-points and backend services that doc 12 specifies. Every API endpoint in doc 12 must trace back to at least one story here; no orphan endpoints, no orphan stories.

Shiftledger's product is **outcome-billed AI workers**: the buyer specifies a contracted outcome (`X tickets resolved`, `Y leads contacted`, `N articles drafted`); the runtime executes a "shift" against the outcome; the system bills only on cleared line items, all reconciled against a verifiable per-outcome receipt.

---

## 1. Personas summary

### P1 — Maya, COO at a 240-person SaaS (primary; deep dive in `05-audience-profile.md` §Persona 1)

41, runs CS + Sales Ops + Vendor Management. Already burned a budget on hour-billed AI consultancies. Will pay a deposit; refuses retainers without a clear deliverable. Voice cue: "show me the line items first." Buys when she can defend spend in plain English to the CFO. Trigger event: Q1 backlog reports landed.

### P2 — Devon, founder/CEO of a 28-person agency (secondary; deep dive in `05-audience-profile.md` §Persona 2)

36, sells productized SaaS to clients. Wants white-label outcome workers he can mark up. Voice cue: "give me a partner unit price." Won't accept seat-licensed pricing. Trigger event: a retainer client asking him to "do AI."

### P3 — Procurement Gate at an 850-headcount org (tertiary; deep dive in `05-audience-profile.md` §Persona 3)

Not the buyer. Cares about USD-denominated invoice, data-flow diagram, refund policy, annual PO with a fixed pool of outcome receipts (Enterprise tier). Voice cue: "what's your sub-processor list?" Will not block a sub-$10K deal where the COO has signing authority.

### Anti-personas (out of scope — see doc 05 §Anti-personas)

The hobbyist/no-code maker (free-tier seeker), the "rent the model" buyer (wants tokens at a discount), the "want a custom agent" buyer (expects 6 weeks fine-tuning), the crypto-sceptical procurement gate, the hyper-regulated buyer (SOC 2 / HIPAA / FedRAMP). No flows in this doc serve these segments.

---

## 2. Primary user stories

12 stories that cover the core product loop end-to-end (discovery → contract → shift execution → receipt clearance → recurring shifts → escalation). Each maps to ≥1 scenario in §3 and ≥1 endpoint in doc 12 §3.

1. **As Maya, I want to see a sample receipt with real line items on the landing, so that I know within 60 seconds whether this is a real outcome service or a token reseller in disguise.** *(US-01)*
2. **As Maya, I want to specify a contracted outcome ("clear up to 350 tickets next week, $X each, voided if unresolved") and pay only on cleared receipts, so that I can defend the spend to my CFO without forecasting tokens.** *(US-02)*
3. **As Maya, I want a per-shift verification rule baked into the contract (e.g. "ticket has resolution-status set by customer" for CS), so that I don't have to manually audit cleared lines.** *(US-03)*
4. **As Maya, I want a weekly settlement digest summarizing cleared shifts + voided lines, so that I can route the line item to the right cost center without rebuilding the math.** *(US-04)*
5. **As Devon, I want a partner code that gives me a markup-friendly unit price and white-labels the receipt to my agency, so that I can resell shifts as a productized retainer add-on.** *(US-05)*
6. **As Devon, I want every receipt to be footer-customizable with my logo + agency name, so that my client doesn't see Shiftledger's brand.** *(US-06)*
7. **As Procurement, I want a USD-denominated invoice tied to a PO number for a quarterly pool of receipts, so that the spend fits the standard AP workflow.** *(US-07)*
8. **As any buyer, I want to void a cleared receipt within 30 days if the outcome was not actually achieved (failed verification post-clearance), so that I'm not billed for ghost work.** *(US-08)*
9. **As any buyer, I want shifts to pause automatically when my budget cap is reached, so that I'm never surprised by overbilling.** *(US-09)*
10. **As Maya, I want shifts to integrate with Zendesk/Intercom/Salesforce via my existing API token, so that the worker does not require a new system of record.** *(US-10)*
11. **As Maya, I want a public eval log per worker profile (last 90 days of cleared/voided ratios), so that I can audit drift before contracting more shifts.** *(US-11)*
12. **As Maya, I want to escalate a stuck shift to a human reviewer (Concierge), so that a complex queue doesn't block the rest of the contract.** *(US-12)*

---

## 3. Main scenarios (happy paths)

### Scenario 1 — Trial-shift purchase with CS worker (Maya, ticket backlog)

**Trigger.** Maya clicks a LinkedIn DM from an Operations Nation peer recommending Shiftledger. She lands on `https://ai-worker-as-a-service.prin7r.com`.

**Steps.**
1. Maya reads the masthead ("outcomes are billable, hours are not"). Scrolls to the sample receipt. *Frontend: `Masthead`, `SampleReceipt` on `apps/landing/app/page.tsx`.*
2. Sample receipt shows `312 of 350 tickets cleared, $X each, $Y voided`. She gets the model in 30 seconds.
3. Scrolls to the Catalog. Sees worker profiles: `CS-shift`, `SDR-shift`, `Research-shift`, `Content-shift`. Each card has a per-outcome unit price and a verification rule. *Frontend: `WorkerCatalog`, `WorkerCard` per profile.*
4. Clicks `CS-shift`. The card expands to show the verification rule ("ticket has resolution status set by customer") and the typical clear-rate (`30-day mean: 89%`). *Backend: `GET /api/workers/cs-shift` returns the profile + recent eval ratio.*
5. Scrolls to the Pricing tier. Picks **Trial — $499 deposit, up to 100 outcomes, $X/outcome, voided lines refunded**. *Frontend: `PricingTier`.*
6. Browser POSTs to `/api/checkout/nowpayments` with `{ plan: 'trial', workerProfile: 'cs-shift' }`. *Backend: `POST /api/checkout/nowpayments` (doc 12 §3.2) builds NOWPayments hosted invoice, returns `{ invoice_url, invoice_id, contractId }`.*
7. Browser redirects to NOWPayments hosted page. Maya pays $499 in USDC-Polygon.
8. NOWPayments POSTs IPN to `/api/webhooks/nowpayments`. Server verifies HMAC-SHA512. *Backend: `POST /api/webhooks/nowpayments` → `ContractService.activate(contractId)` → `ShiftScheduler.enqueue(contractId)`.*
9. (Wave 3) Maya receives an email: "Trial activated. Connect Zendesk in your dashboard to start the shift."
10. (Wave 3) Maya pastes her Zendesk API token in the dashboard. The worker pool starts working tickets, posting verification events back to Shiftledger as each ticket clears.
11. End of trial period (or 100 outcomes, whichever first): cleared receipt is mailed to Maya. Voided lines (those that failed the verification rule) are itemized and refunded.

**Success criteria.** Contract activated within 5s of IPN. First ticket cleared within 1h of API token connection. Receipt arrives within 24h of trial completion. Voided lines refunded automatically.

**Frontend touch-points.** `Masthead`, `SampleReceipt`, `WorkerCatalog`, `WorkerCard`, `PricingTier`, dashboard onboarding (Wave 3).
**Backend touch-points.** `GET /api/workers/:profile`, `POST /api/checkout/nowpayments`, `POST /api/webhooks/nowpayments`, `ContractService`, `ShiftScheduler`, `Verifier`, `LedgerService`.

### Scenario 2 — Standard tier with budget cap (Maya, recurring contract)

**Trigger.** Maya's trial cleared. She wants to scale to recurring CS shifts.

**Steps.**
1. Dashboard → Contracts → **New contract**. Form: profile=`cs-shift`, target=`weekly, up to 500 outcomes`, budget cap=`$3,000/week`, term=`monthly auto-renew`.
2. Submit → `POST /api/contracts` creates a Standard contract. *Backend: `ContractService.create()`.*
3. Maya reviews the contract preview (verification rule, unit price, weekly cap). Confirms.
4. `POST /api/checkout/nowpayments` builds an invoice for a $3,000 weekly deposit (held against actual cleared receipts).
5. Each week: shifts run, receipts clear, weekly deposit is reconciled. If actual cleared < deposit, surplus is credited to the next week. If cap is reached mid-week, the scheduler auto-pauses.
6. Friday digest email summarizes the week's cleared + voided lines.

**Success criteria.** Auto-pause triggers within 1 outcome of cap. Weekly digest delivered by Monday 09:00 GMT. Month-over-month renewal happens without manual intervention.

**Frontend touch-points.** Contract form, preview, dashboard digest email.
**Backend touch-points.** `POST /api/contracts`, `ContractService`, `ShiftScheduler.budgetGuard()`, `LedgerService.reconcile()`, `DigestRunner` (BullMQ).

### Scenario 3 — Agency white-label (Devon, partner code)

**Trigger.** Devon's partner code is `AGENCY-INDIE-007`. He onboards a retainer client at his agency.

**Steps.**
1. Client lands on Shiftledger via Devon's tracking link `?ref=AGENCY-INDIE-007`.
2. Client buys Standard tier. Checkout body includes `referralCode: 'AGENCY-INDIE-007'`. *Backend: `POST /api/checkout/nowpayments` records the code.*
3. Receipt rendering uses the partner's customizations: agency logo, agency footer text, agency contact email.
4. Devon's `RevShareService` accrues 25% on each cleared line.
5. Monthly payout: Devon receives a USDT invoice for accrued amount.

**Success criteria.** Partner code persists from landing → checkout → recurring receipts. White-label customizations honored on every receipt PDF.

### Scenario 4 — Enterprise PO (Procurement gate)

**Trigger.** Procurement at an 850-headcount org wants to issue a PO against a quarterly pool of 5,000 outcomes.

**Steps.**
1. Maya (Persona 1) emails `desk@ai-worker-as-a-service.prin7r.com` from the landing's "Talk to desk" CTA.
2. Concierge agent scopes the contract: profile=`research-shift`, pool=`5,000 outcomes`, $X per outcome, $250K deposit, term=`quarterly`.
3. Concierge issues the contract via `POST /api/admin/contracts` (admin auth). USD-denominated invoice generated through NOWPayments fiat-on-ramp partner.
4. Procurement issues PO. Payment lands. Contract activates.
5. Quarterly settlement: receipt-pool report mailed to Procurement + Maya.

**Success criteria.** Procurement receives USD-denominated invoice + sub-processor list within 24h of scoping call. Quarterly receipt-pool report fits in standard AP workflow.

### Scenario 5 — Eval-log audit before scaling (Maya, week 4)

**Trigger.** Maya is considering doubling her contract. She wants to verify drift before signing.

**Steps.**
1. Dashboard → Worker profiles → `cs-shift` → **Eval log**.
2. `GET /api/workers/cs-shift/evals?since=90d` returns clear/void ratios per week.
3. Maya sees `89% → 91% → 88% → 90% → 92%` over the last 5 weeks. No drift.
4. She confirms her doubled-contract intent and proceeds.

**Success criteria.** Eval data is publicly visible (no auth) per worker profile. Sparkline + table shows 90-day history.

### Scenario 6 — Stuck-shift escalation (Maya, complex ticket)

**Trigger.** A ticket has been pending verification for >48h. The shift scheduler flags it as stuck.

**Steps.**
1. Dashboard → Active shifts → `cs-shift #4291` shows status=`stuck (no verification event in 48h)`.
2. Maya clicks **Escalate to Concierge**. *Backend: `POST /api/shifts/:id/escalate`.*
3. Concierge reviewer (human-in-the-loop, Wave 3) inspects the ticket, either confirms cleared (charges line) or void (refunds line).
4. Resolution is logged on the receipt with `escalation: true` flag.

**Success criteria.** Escalation resolved within 24h. Receipt line marked with the escalation flag.

---

## 4. Edge case scenarios

### EC-1 — IPN arrives before browser returns from NOWPayments

`ContractService.activate()` is idempotent on `(contractId, status)`. Replay of the same IPN is a no-op.

### EC-2 — Buyer drops off after `/api/checkout/nowpayments` but before payment

Contract persists as `status='pending'`. Daily sweeper expires pending contracts >7 days old. If the buyer returns within 7 days with the same `contractId` cookie, the same invoice is shown rather than a new one created.

### EC-3 — Verification post-clearance disputes (US-08)

If a customer disputes a cleared line within 30 days, `POST /api/receipts/:lineId/dispute` opens a void request. The verifier re-runs against fresh source-of-truth state. If void confirmed, the line is refunded via NOWPayments admin path and removed from the customer's receipt.

### EC-4 — Source-of-truth API outage (Zendesk/Intercom)

Shifts auto-pause when the integration's heartbeat fails. Heartbeat = a no-op `GET` on the integration's whoami endpoint every 5 min. If 3 consecutive failures, the contract pauses; Slack alert fires; automatic resume on heartbeat recovery.

### EC-5 — Outcome quality drops below threshold

If a worker profile's 30-day clear-rate drops >5pp below baseline, the catalog page shows a yellow `Drift watch` badge. Active contracts continue but new buyers see the badge. The next batch of cleared receipts is sampled 100% by Concierge until the rate recovers.

### EC-6 — Customer's API token expires mid-shift

Shift pauses on `401 Unauthorized` from the integration. Customer is emailed to refresh. Active receipts in flight are completed against the stale token's last-known state; new receipts wait for token refresh.

---

## 5. Anti-scenarios

### AS-1 — No "build your own worker"

The catalog of worker profiles is curated. There is no UI to fine-tune a worker from the buyer side. Custom-trained workers require a 6+ week engagement that's explicitly out of Wave 2 scope (and explicitly anti-persona — see doc 05).

### AS-2 — No free tier

The Trial tier is $499 deposit (refundable on voided lines). Shiftledger has no $0 mode.

### AS-3 — No per-token / per-seat / per-hour pricing

The product IS the outcome-billed model. Implementing token / seat / hour pricing breaks the product. The contract object only supports `unitPrice = $/outcome`.

### AS-4 — No SOC 2 / HIPAA / FedRAMP attestation in Wave 2/3

Hyper-regulated buyers are explicitly anti-persona. The implementation must NOT add compliance UI surfaces (audit log dashboard, BAA signing flow, FedRAMP rev-control list). Wave 5+ may revisit.

### AS-5 — No fiat-rail invoicing without a NOWPayments fiat-on-ramp partner

USD-denominated invoices flow through NOWPayments' partner. Direct ACH / wire is NOT in scope. If a buyer demands ACH, Concierge declines and offers the Reown wallet path (Wave 3) as an alternative.

---

## 6. Cross-references to docs 12 and 13

- §2 stories US-01..US-12 → doc 12 §3 endpoints.
- §3 scenarios → doc 12 §1 architecture services + doc 13 phase Definitions of Done.
- §4 edge cases → doc 12 §7 security + idempotency + doc 13 phase 5 (production hardening).
- §5 anti-scenarios → doc 12 §10 non-goals.
