# 05 — Audience profile: Shiftledger

## ICP (Ideal Customer Profile)

A company between **50 and 1,500 employees**, with **a queue or a list that doesn't fit headcount** (support tickets, leads, research requests, content briefs, ops paperwork) and a **named operations leader** (COO, VP Ops, Head of CS, Head of Sales Ops) who has a signing limit between $10K and $250K/year for ops tooling. They have already burned **at least one budget cycle** on hour-billed AI consultancies or per-seat AI tools and are now gun-shy. They use **modern source-of-truth tools** (Salesforce / HubSpot / Intercom / Zendesk / Notion / Linear) so a worker can be wired in via API. They settle invoices in USD or stablecoin; they **do not** require a procurement portal for purchases under $10K.

**Hard-line qualifiers.**
- Has a recurring queue with measurable line items (must).
- Has a named decision-maker with the signing limit above (must).
- Already uses at least one of: Zendesk / Intercom / Salesforce / HubSpot / Notion / Linear (must).
- Annual ops-tooling budget ≥ $30K (must for Standard tier).

## Persona 1 — Maya, the COO

| | |
|---|---|
| **Role**          | COO / VP Operations |
| **Org size**      | 100–500 employees |
| **Seniority**     | 8–15 years post-grad |
| **Reports to**    | CEO |
| **Has signed off on** | $20K–$250K vendor contracts, hour-billed and SaaS |
| **Has been burned by** | A 6-month custom-AI pilot that produced no working delivery |
| **Reads**         | LinkedIn (skim daily), Lenny's Newsletter, Operations Nation, OpsStars / Operators Guild |
| **Hangs out in**  | Pavilion, RevGenius slack, Operations Nation slack, CHIEF |
| **Buys when**     | She can defend the spend in plain English to the CFO |
| **Will not buy when** | The pricing is per-token or per-seat |
| **Will refer when**   | The first receipt clears and the CFO signs off without questions |
| **Trigger event**     | Q1 ticket backlog reports landed; she has 6 weeks to clear them before the CSAT score breaks her bonus |

## Persona 2 — Devon, the agency owner

| | |
|---|---|
| **Role**          | Founder / CEO of a 10–40-person agency |
| **Org size**      | 10–40 employees |
| **Seniority**     | 5–10 years agency-side |
| **Reports to**    | Himself, a board, or co-founder |
| **Has signed off on** | $5K–$60K monthly tool spends on behalf of clients |
| **Has been burned by** | "AI agent" platforms with seat licenses that he couldn't mark up |
| **Reads**         | Indie Hackers, agency-owner newsletters (Agency Mavericks), Twitter/X (DM's open) |
| **Hangs out in**  | Agency Mavericks, GrowthHackers, Indie Hackers, Twitter |
| **Buys when**     | He sees a partner unit price he can mark up |
| **Will not buy when** | The pricing model changes mid-contract |
| **Will refer when**   | He gets a partner-program white-label receipt |
| **Trigger event**     | A retainer client is asking him to "do AI" for support and SDR |

## Persona 3 — Procurement at a larger org

Not the buyer (the COO/VP makes the buy decision) but **a gatekeeper** at the >800-headcount tier. Cares about:

- Tax / invoice handling (NOWPayments issues a USD-denominated invoice; that is acceptable)
- Data flow diagram (provided in doc 02)
- Refund policy (provided in doc 07)
- Annual purchase order with a fixed pool of outcome receipts (Enterprise tier)
- Sub-processor list (NOWPayments + the upstream LLM provider; documented in `/docs/security.md` next wave)

## Anti-personas (will not be served)

- **The hobbyist / student / no-code maker.** Shiftledger is for queues, not exploration. Free-tier seekers should use ChatGPT.
- **The "rent the model" buyer.** Wants raw API access at a discount. We are the runtime, not a token reseller.
- **The "want a custom agent" buyer.** Expects 6 weeks of fine-tuning. We do not custom-train; pre-trained profiles are the product.
- **The crypto-sceptical procurement gate.** Companies that disallow stablecoin invoices in a vendor PO. (We will add fiat invoicing in a later wave.)
- **The hyper-regulated buyer.** SOC 2 / HIPAA / FedRAMP requirements that need full audit attestation. Wave 2 does not yet have those — we'll be honest in the sales conversation.

## Where the audience already is

| Channel | Maya | Devon | Procurement |
|---|---|---|---|
| LinkedIn | ✓✓ | ✓ | ✓ |
| Operations Nation / Pavilion / Operators Guild | ✓✓ | – | ✓ |
| Indie Hackers / Agency owner Slacks | – | ✓✓ | – |
| Twitter / X DMs | – | ✓ | – |
| Vendor newsletters in inbox 0/1 | ✓ | ✓ | ✓✓ |
| RFP / vendor matrix tooling | – | – | ✓✓ |
| Conferences (SaaStr, HumanX, INBOUND) | ✓✓ | ✓ | – |

The marketing strategy (doc 08) and channel mix (doc 06) follow this map.
