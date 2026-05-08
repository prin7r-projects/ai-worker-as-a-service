# 07 — Sales strategy: Tally

## Motion

**Hybrid PLG + lightweight sales-led**. The Trial and Standard tiers are entirely self-serve via NOWPayments hosted invoice (the landing's BUY CTAs). The Enterprise tier is sales-led with a one-call security review and a custom outcome pool.

PLG carries Wave 2 because:
- The buyer — Maya, Devon — wants to evaluate the receipt before talking to anyone.
- Outcome billing means the first cleared receipt is its own demo.
- A sales call before the first receipt is friction that loses Devon-shaped buyers.

Sales-led layers on at Enterprise because:
- A 1,200-person fintech needs a vendor matrix, a data flow review, and a PO term.
- Their compliance team will not click a "Buy" button without a counter-signature.
- The unit economics carry the human cost of one sales conversation.

## Pricing tiers

| Tier | What you buy | Deposit (USD, NOWPayments) | Unit prices | Scope per shift |
|---|---|---:|---:|---|
| **Trial**      | 25 outcome receipts in any one worker profile | **$199** | Capped at $199 total — "first shift on us up to $199" | 1 channel, 1 worker profile, ≤ 25 outcomes, no SLA |
| **Standard**   | 200 outcome receipts in any one worker profile (refillable) | **$999** | $5–$12 / cleared outcome depending on profile | 1–2 channels, 1 worker profile, 200 outcomes / month, 8-hour response on shift exceptions |
| **Enterprise** | Custom pool, multiple worker profiles, partner / white-label terms | from **$5,000** | Negotiated per profile; partner discount for agencies | Up to 6 worker profiles concurrent, white-labeled receipts, dedicated Slack, named CSM |

Per-profile unit reference rates (locked across tiers, the receipt pricing on the landing matches):

| Worker profile | Unit | Reference unit price | Verification rule |
|---|---|---:|---|
| Customer Support  | Cleared ticket          | $6 / outcome | Customer-set resolution status |
| SDR (outbound)    | Personalized message + reply or non-bounce | $9 / outcome | CRM activity log |
| Researcher        | Source-grounded brief (≥ 600 words, ≥ 5 cites) | $12 / outcome | Cite-check pass |
| Writer            | First-draft article (≥ 800 words, on brief) | $11 / outcome | Plagiarism + brief-fit check |
| Ops Coordinator   | Form / spreadsheet line completed against contract | $5 / outcome | Schema-match + checksum |
| QA Auditor        | Bug or compliance issue logged with reproducer | $8 / outcome | Reproducer reproduces |

These rates appear in the Outcome Pricing Table on the landing and must be kept in sync with `/apps/landing/components/OutcomePricingTable.tsx`.

## Refund / void policy

- The deposit is paid into a **pool**. Only cleared outcomes draw down the pool.
- An outcome that fails the verification rule **voids** on the receipt and does not draw against the pool.
- Unused pool refunds **on cancellation** at the contracted unit rate, minus a 4 % NOWPayments settlement fee. This is the buyer-visible refund line.
- A voided line is never re-attempted without buyer approval (avoids the "infinite-retry token burn" failure mode).

## Objection handling

| Objection | Response |
|---|---|
| "Token / API pricing is cheaper." | The buyer carries 100 % of the variance in token pricing. Our unit price absorbs that variance. Compare $X / cleared ticket with your token forecast plus your token-overrun history; we typically come in under at the line-item level. |
| "We can build this ourselves." | Yes — the runtime is not the moat. The moat is the verification rule and the receipt. If you build, ship the receipt. We sell you 6 receipts on Day 1 instead of 6 weeks of build. |
| "We don't pay vendors in stablecoin." | NOWPayments issues USD-denominated invoices; settlement is in USDT/USDC. The receipt is the audit artifact, not the rail. We are adding fiat invoicing in 2026 H2; until then, stablecoin or no contract. |
| "Six worker profiles is too few." | Each profile has been chosen because it has a clean per-outcome unit (CS = ticket, SDR = personalized message, etc.). Adding fuzzier profiles dilutes the receipt. We will publish a Profile Roadmap (Q3) once we have 50+ Standard customers. |
| "What if your worker is wrong?" | Every line is verifiable against the rule. A failed verification voids the line. You see the void on the receipt and never pay for it. (Demonstrate via the landing's Verification Trust Block.) |
| "What about hallucination / brand risk?" | Outcomes that involve external communication (SDR, writer) are sandboxed: drafts are queued for human approval before sending unless the buyer opts in to auto-send. We log every external action against the receipt id. |
| "We need SOC 2 / HIPAA / EU residency." | Wave 2 does not have those certifications. We will tell you so on the first call. The Enterprise track gets a written sub-processor list; ATTEST docs ship in 2026 H2. We will not ship a non-compliant deal. |

## Sales process

**PLG (Trial → Standard):**
1. Buyer lands on `ai-worker-as-a-service.prin7r.com`.
2. Buyer clicks BUY on Trial → NOWPayments hosted invoice → pays $199 in USDT/USDC.
3. Buyer is redirected back; receives an onboarding email with the intake form.
4. Worker is configured with the verification rule; first shift starts within 48 hours.
5. First receipt clears; if cleared lines are ≥ 60 % of attempted, prompt to upgrade to Standard.

**Sales-led (Enterprise):**
1. Buyer fills the contact link in the footer (next wave) or replies to a comparison-content email.
2. Tally founder runs a 30-minute call: data flow, sub-processors, verification rules, pool size.
3. Tally sends a NOWPayments invoice for the deposit + a one-page contract amendment for white-label/partner terms (if applicable).
4. Pool seeded; first cleared receipts within 7 business days.

## Key metrics (sales)

- **First cleared receipt < 14 days** from first landing visit (PLG) or first call (sales-led).
- **Trial → Standard conversion**: target 30 %.
- **Standard 90-day retention** (% of accounts with at least one cleared shift in month 3): target 75 %.
- **Pool burn rate**: cleared outcomes / pool capacity per month.
- **Refund ratio** (refunded $ / total deposits): target < 8 %.
