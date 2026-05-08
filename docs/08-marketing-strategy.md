# 08 — Marketing strategy: Shiftledger

## Positioning (one paragraph)

Shiftledger is the **outcome-billed runtime** for AI workers. Buyers choose a pre-trained worker profile, sign a unit-priced outcome contract ("$6 per cleared ticket", "$9 per personalized lead reply"), and pay only for the cleared lines on a per-shift receipt. Hour-billed AI consultancies sell hours; per-token APIs sell compute; seat-licensed "AI agents" sell login chairs. **Shiftledger sells receipts.** Every artifact in our marketing is a receipt: the hero, the catalog, the pricing table, the trust block, the testimonials. The category we are creating is *outcome economy* — the recognition that, for AI work, the only legible price is the cleared line.

## Messaging hierarchy

### Tier 1 — the headline that earns the next click

> **Pay only when the shift ships.**
> Outcome-billed AI workers. Pre-trained, contracted, receipted. No retainers, no tokens, no seats.

Used in the hero (`HeroReceipt.tsx`), in the LinkedIn banner, in the email signature, on the conference name-badge.

### Tier 2 — the proof block

> **Last week's shift:**
>   312 of 350 tickets resolved.
>   38 voided (verification failed).
>   **$1,872.00 charged.**
>
> One receipt. No retainer. No invoice surprises.

Visible on the hero card; recurring in receipt-screenshot social posts.

### Tier 3 — the four supporting pillars

1. **The unit price is the contract.** Doc 07 §"Pricing tiers" — every worker has a per-outcome rate.
2. **Verification is built-in.** Doc 04 §P5 — no chain-of-thought theatre; line items clear against a buyer-side rule.
3. **No pilot purgatory.** Doc 04 §P4 — pre-trained profiles, first cleared receipt within 14 days.
4. **Refund = unused pool, every time.** Doc 07 §"Refund / void policy".

### Tier 4 — the audience-specific cuts

| Persona | One-line cut | Where to use |
|---|---|---|
| Maya (COO)         | "The line item your CFO can defend." | LinkedIn header, Pavilion post |
| Devon (agency)     | "White-label receipts for clients you already serve." | Indie Hackers post, agency-Slack DM |
| Procurement        | "An outcome contract priced by the line." | Comparison page H1, sales deck slide 1 |

## Content pillars

Four pillars, each yielding 1–2 pieces of content per month (not per pillar — across pillars).

### Pillar 1 — *Outcome pricing math*

Posts that show the unit-economics of an outcome-billed contract vs. token-billed vs. hour-billed. Includes the literal worked example: "200 tickets at $6 = $1,200 vs. $250/hr × 12 hr = $3,000". Strong CFO appeal.

### Pillar 2 — *Verification mechanics*

Posts that show *how* a line clears: which API call, which buyer-side state change, which audit log row. This pillar carries the technical credibility.

### Pillar 3 — *Receipt of the week*

A literal redacted screenshot of a real cleared receipt (with customer permission). Headline: "Last week's shift cleared 312 of 350 tickets — here's the receipt." Highest engagement format. This pillar is what runs in operator-leader Slacks (channel A) and on LinkedIn (channel B).

### Pillar 4 — *vs. the alternative*

Comparison posts: "Shiftledger vs. Manus", "Shiftledger vs. Lindy", "Shiftledger vs. Devin". Always honest — Shiftledger is structurally different, and the post must say what the alternative does well too. Drives search traffic from procurement (channel D).

## Content distribution map

| Pillar | LinkedIn | Slack communities | Newsletter | Comparison page | Conference |
|---|---|---|---|---|---|
| Outcome pricing math | ✓ primary | ✓ | ✓ | ✓ | – |
| Verification mechanics | ✓ | – | ✓ | ✓ primary | ✓ |
| Receipt of the week | ✓ primary | ✓ primary | ✓ | – | ✓ |
| vs. the alternative | ✓ | – | ✓ | ✓ primary | – |

## Brand voice in marketing

Reuse from doc 01 §"Voice & tone" — quoted here so writers don't have to context-switch.

> Lead with the line item ("Resolved 423 tickets, charged $X").
> Use ledger / payroll language ("shift", "receipt", "cleared", "void").
> Be exact with money. Say "$X / outcome", not "low cost".
> Don't use the words "agent", "agentic", "autonomous", "AI-powered", "AI-first" in marketing copy.
> Don't claim time-saved percentages; show outcomes.

## Copy specimen (for the landing — locked, must match `/apps/landing/`)

**Masthead.** "Shiftledger — outcome ledger for AI workers"

**Hero CTA primary.** "Open a receipt — $199 trial"
**Hero CTA secondary.** "How a shift gets paid out"

**Hero body.** "Shiftledger is the first AI worker service priced like payroll. You pick a pre-trained worker — support, SDR, research, content, ops, or QA — sign a unit-priced outcome contract, and pay only for the cleared lines. The receipt is the contract. No retainer, no tokens, no seats."

**Worker catalog header.** "Six worker profiles. One unit price each."

**Trust block header.** "How a shift gets paid out."
- 1 — *Worker runs against the queue.* "Each profile reads your source of truth at run time. No fine-tuning. No data residency in our walls."
- 2 — *Outcome is verified against the contract.* "Each line is checked against a buyer-side rule. A failed line is voided on the receipt; you never pay for it."
- 3 — *Receipt is issued; the line is charged.* "Every cleared line draws against your pool. NOWPayments settles in USDT/USDC; the invoice is USD-denominated."

**FAQ headers (and answers, abbreviated — full text in `/apps/landing/components/FAQAccordion.tsx`).**

1. *Is this an AI agent?* — "It's an AI worker. The difference is what you're billed for: agents bill compute; Shiftledger bills cleared lines."
2. *What if a line fails verification?* — "It voids on the receipt. You don't pay for it. We don't auto-retry without your approval."
3. *Can I cancel?* — "Yes, any time. Unused pool refunds at the contracted unit rate, minus a 4% settlement fee."
4. *Why crypto checkout?* — "NOWPayments issues a USD-denominated invoice; settlement is USDT or USDC. Stripe / fiat invoicing ships in 2026 H2."
5. *Do you fine-tune on our data?* — "No. The runtime reads your source of truth at run time and persists nothing model-side. See doc 02."
6. *What about SOC 2 / HIPAA?* — "Not yet. Wave 2 does not have those certifications. Enterprise customers get a written sub-processor list; certifications ship in 2026 H2."
7. *Can my agency white-label receipts?* — "Yes — Enterprise / partner program. Reply with 'partner' to the contact email and we'll send the agreement."

## Launch plan (high-level)

The full 90-day plan is in doc 09. The marketing-side milestones:

- Day 0: landing live + receipt-of-the-week #1 published.
- Day 7: comparison page `/vs/manus` shipped; first community post in Pavilion.
- Day 14: receipt-of-the-week #2; first conference 1:1s at SaaStr satellite.
- Day 30: first Standard-tier customer feature in receipt-of-the-week.
- Day 60: agency partner program announced; comparison pages 1–4 live.
- Day 90: Enterprise tier first deal closed; comparison pages 1–8 live.

## What we will not do

- **No paid ads in Wave 2.** Maya doesn't click them; Devon doesn't either.
- **No "thought leadership" without a receipt.** Every Tier-1 post must be anchored to a real (or representative) receipt.
- **No marketing testimonial that doesn't include a number.** "Shiftledger is great" is unusable; "Shiftledger cleared 312 / 350 tickets last month at $6 / line" is the format.
- **No feature-grid landing.** The receipt is the value, the receipt is the page.
