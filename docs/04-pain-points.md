# 04 — Pain points: Shiftledger

Each pain is anchored to a specific failure of an existing alternative. Generic pains ("AI is hard") are excluded.

## P1 — Hour-billed AI consultancies

**Symptom.** "We hired a 3-person team at $250/hr; six weeks in we have a Notion doc, a Slack channel, and 47 hours of debugging. The bot still hands off everything to a human."

**Root cause.** Hour-billing rewards complexity, not delivery. The consultancy's incentive is to bill more hours; the buyer's incentive is fewer outcomes per dollar. The two never align.

**Shiftledger's answer.** A unit price per *cleared outcome*. The vendor (Shiftledger) is now financially aligned with the buyer — Shiftledger only earns on the line items that clear.

## P2 — Per-token API ("compute-billed agents")

**Symptom.** "The CFO asked me to forecast next month's spend on the AI agent. I have a spreadsheet of token estimates and a 4× confidence interval. He's furious."

**Root cause.** Compute-billed pricing has no economic relation to outcomes. A buggy prompt that loops 10× costs 10× without delivering anything more. The buyer carries 100% of the variance.

**Shiftledger's answer.** Outcome-priced. Shiftledger absorbs all token / runtime variance; the buyer pays the same $X per cleared ticket regardless of how many runs Shiftledger needed to clear it.

## P3 — "AI agent" platforms with seat licenses

**Symptom.** "We bought 50 seats at $40/seat/month. Three months later, six users actually log in. The CFO is asking why we paid for 44 seats of nothing."

**Root cause.** Seat licenses are the SaaS pricing model from 2015. They were already a poor fit for human knowledge work; for AI workers they are absurd, because there is no per-user marginal cost to licence — the platform is just collecting rent on the buyer's optimism.

**Shiftledger's answer.** No seats. There is no concept of "user count" in Shiftledger's pricing — only outcomes ordered and outcomes cleared.

## P4 — "Pilot" purgatory with custom-AI shops

**Symptom.** "Our 90-day pilot wrapped and we still don't have a clear sign-off. The vendor wants 12 more weeks of fine-tuning before they'll commit to a price."

**Root cause.** Custom-AI vendors price their service on the difficulty of the integration, not the value of the result. There's no hard delivery contract; the pilot can extend forever because the vendor benefits from extension.

**Shiftledger's answer.** Pre-trained worker profiles (the Worker Catalog block on the landing). The buyer picks a profile, picks a unit price, and the first cleared receipt arrives within a week. No custom training, no pilot purgatory.

## P5 — Verification gaps (the buyer can't tell what was done)

**Symptom.** "The bot says it 'handled' the ticket. The customer says nothing happened. Who's right?"

**Root cause.** Most "AI agent" platforms surface the agent's *intent log* (the LLM's chain of thought) as proof of work. Intent logs are not outcomes — they are diaries of attempts. A buyer cannot audit them at line-item granularity.

**Shiftledger's answer.** A per-profile **verification rule** (documented in doc 02 §"Open architectural questions" and rendered on the landing as the Verification Trust Block). The rule is the buyer-side criterion the worker must satisfy for the line to clear (e.g. CS = customer-set resolution status; SDR = at least one personalized outbound message logged in the CRM with a reply or a non-bounce). The receipt shows cleared lines and voided lines.

## P6 — Refund / reconciliation black box

**Symptom.** "We paid $40K up front and the contract says the work is `as delivered`. There is no mechanism to claw back unused budget."

**Root cause.** Pre-paid retainers / SOWs do not refund automatically; the buyer must initiate a dispute, which is friction enough that they don't.

**Shiftledger's answer.** No retainer. The deposit is paid into a pool; only cleared outcomes draw down the pool. Any unused pool refunds on cancellation at the contracted unit rate. No dispute, no negotiation.

## P7 — Vendor lock-in via custom training

**Symptom.** "We fine-tuned the agent on six months of our data; now switching vendors means starting over."

**Root cause.** Custom training creates **vendor lock-in by data gravity**. The buyer rationally anchors to the incumbent even when the incumbent is underperforming.

**Shiftledger's answer.** No custom training in the worker profile. Each worker reads the buyer's source-of-truth (help desk, CRM, doc store) at run time; nothing is fine-tuned to the buyer. The buyer can swap Shiftledger for any competitor that supports the same outcome contract.

## Anti-pattern — pains we do **not** address

- *"I want to chat with my own data."* That is not an outcome; it is a UI feature. Buy a chatbot tool.
- *"I want a lower per-token price."* That is the same pricing model with a smaller number. Shiftledger is structurally different, not cheaper.
- *"I want a no-code agent builder."* Shiftledger is the runtime, not the IDE.
