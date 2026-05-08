# 03 — User journeys: Tally

Three named journeys, all of them anchored on the receipt as the artifact of value.

## Journey 1 — "Maya hires Tally for the support backlog"

**Persona.** Maya, COO at a 240-person SaaS. (Primary persona — see doc 05.)

**Discovery.** She's at a CFO/COO Slack hangout where someone forwards the Tally launch post. She clicks through to `ai-worker-as-a-service.prin7r.com`. The hero shows a stylized payday stub with "Shift complete: 312 / 350 tickets resolved — $1,872 charged." She reads the line and the brand promise: "you only pay when it shipped."

**First value.** She scrolls to the Worker Catalog, finds the **Customer Support** worker, sees a unit price ($6 / cleared ticket) and a click-to-spec link. She picks the **Standard** tier ($999 deposit / 200 ticket-receipts), clicks **Buy**, is redirected to the NOWPayments hosted invoice, pays the deposit in USDT.

**Onboarding (next wave).** Tally's intake form asks for the help-desk URL, an inbound API token, and the resolution rule (Maya picks "ticket marked Closed by customer"). The first shift starts at 09:00 the next morning.

**Recurring use.** Each Friday Maya gets a one-page receipt: shift dates, line items, amounts cleared, amounts voided. The receipt lives in `apps/app/` (next wave) and as a PDF in her inbox. She forwards the receipt to her CFO; the spend is auditable to the line.

**Exit.** Maya can pause the shift any time. There is no minimum term — she has paid only for cleared tickets.

## Journey 2 — "Devon white-labels Tally into his agency's contracts"

**Persona.** Devon, founder/CEO at a 28-person bootstrapped agency. (Secondary persona — see doc 05.)

**Discovery.** Devon's already-buying-AI clients are asking him to "put AI" into their support and SDR. He's googling for "outcome-priced AI agents" and lands on the Tally page from a competitor-comparison post. The brand reads as a financial instrument, not a tech demo. Trust signal: the "How outcomes are verified" block.

**First value.** Devon clicks **Buy** on the Trial tier ($199 deposit / 25 outcome receipts). He uses the trial to run a 3-day SDR shift on his own agency's outbound list. The receipt shows 18 of 25 leads contacted with personalized messages; he is charged $199 (the cap).

**Onboarding (next wave).** Devon contacts the Tally team for a partner agreement — Tally allows partner-priced unit rates and white-labeled receipts (the receipt PDF carries the agency's logo, not Tally's, in the partner program).

**Recurring use.** Devon resells SDR shifts and CS shifts to his clients at a 30 % markup. Each client gets a monthly receipt, white-labeled. Devon settles with Tally via the same NOWPayments rail.

**Exit.** Devon can churn out at any time; partner credits are honored on a 30-day refund basis for unused outcome receipts.

## Journey 3 — "Procurement evaluates Tally as a vendor"

**Persona.** Vendor-management lead at a 1,200-person fintech. (Anti-persona for self-serve, **primary persona for the Enterprise tier**.)

**Discovery.** Procurement is filling a vendor-evaluation matrix for "AI ops automation". Tally appears alongside Manus, Lindy, Devin, Cognition. Tally is the only entry in the matrix with a per-outcome unit price.

**First value.** They click into the landing's **Verification trust block** and the **Outcome pricing table**, which is structured exactly like a vendor sheet: deliverable / verification rule / unit price / refund policy. They forward the page URL to legal.

**Onboarding (next wave).** Tally's enterprise track does a one-call security review (data flow diagram from this doc, tax + invoice handling under NOWPayments, EU hosting option). Contract = annual purchase order with a fixed pool of outcome receipts.

**Recurring use.** They draw down against the pool. The receipt is the GAAP artifact — finance posts each line as a service expense. Quarterly reviews compare cleared lines against the pool burn rate.

**Exit.** The pool's unused balance refunds at the contracted unit rate; Tally never holds customer cash beyond cleared receipts.

## Cross-journey notes

- The receipt is the unit of trust in **all** three journeys. It is the single artifact that survives onboarding, monthly review, and termination.
- The hero on the landing **must show** a receipt, because that is what every persona is buying. (See `/apps/landing/components/HeroReceipt.tsx`.)
- Verification is a feature, not a footnote. Each persona evaluates Tally against the question: *can I trust the line item?* Doc 04 (pain points) and the landing's verification block are the answers.
