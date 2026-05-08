# 09 — Go-to-market: 90-day plan for Shiftledger

The plan is bias-toward-receipts: every milestone has a *cleared receipt* deliverable. Click counts and signup counts are not milestones.

## Phase 0 — Pre-launch (Day -7 to Day 0)

| Day | Action | Owner |
|---|---|---|
| -7 | Repo + DESIGN.md + 10 docs frozen | Wave 2 build agent |
| -5 | Landing deployed to staging URL | Wave 2 build agent |
| -3 | NOWPayments key + IPN secret installed on storage-contabo | Orchestrator |
| -2 | First end-to-end test (Trial tier) creates an unpaid hosted invoice | Wave 2 build agent |
| -1 | Pilot receipt-of-the-week #1 drafted (representative, not real customer yet) | Founder |
| 0  | Landing live at `ai-worker-as-a-service.prin7r.com`; receipt-of-the-week #1 posted to LinkedIn | Founder |

**Gate to enter Phase 1:** the landing returns a real `nowpayments.io/payment/?iid=...` URL when **BUY** is clicked.

## Phase 1 — Trial flywheel (Days 1–30)

**Goal.** First **5 paid Trial-tier deposits** ($199 × 5 = $995) and first **3 cleared receipts**.

| Week | Milestone | Channel mix |
|---|---|---|
| Wk 1 | Receipt-of-the-week #1 + #2 (LinkedIn). One Pavilion post. Comparison page `/vs/manus` shipped. | A + B + D |
| Wk 2 | First Trial deposit cleared. Onboarding intake form sent. First worker shift starts. | A + B |
| Wk 2 | First *real* cleared receipt. Buyer asked for permission to feature anonymized. | A |
| Wk 3 | Second + third Trial deposits cleared. First Operations Nation post. Comparison page `/vs/lindy` shipped. | A + D |
| Wk 4 | First Trial → Standard upsell. Receipt-of-the-week #3 (real). | A + B |

**Gate to enter Phase 2:** at least 3 cleared receipts (i.e. real worker shifts that drew on real pools); at least 1 Trial → Standard upgrade.

## Phase 2 — Standard tier scale (Days 31–60)

**Goal.** First **8 paid Standard-tier deposits** ($999 × 8 = $7,992) and **first agency partner**.

| Week | Milestone | Channel mix |
|---|---|---|
| Wk 5 | Comparison pages `/vs/devin` + `/vs/cognition` shipped | D |
| Wk 5 | First Indie Hackers / Agency Mavericks post on the partner program | C |
| Wk 6 | First Devon-shaped buyer signs partner agreement. White-label receipt PDF ships. | C |
| Wk 7 | Receipt-of-the-week #6 (now a 4-week run of real receipts). Newsletter #1 published (Beehiiv). | B |
| Wk 8 | Conference 1:1 work at HumanX or SaaStr satellite (whichever falls in window). 5+ Trial deposits in the bag from hallway conversations. | E |

**Gate to enter Phase 3:** Standard tier has at least 6 paying customers with cleared receipts; partner program has 1 signed agency.

## Phase 3 — Enterprise track + content multiplier (Days 61–90)

**Goal.** First **Enterprise tier deal closed** ($5K+ deposit) and **first sub-processor / vendor matrix submission** completed.

| Week | Milestone | Channel mix |
|---|---|---|
| Wk 9  | First Enterprise call (procurement gatekeeper at fintech / large SaaS) | E + F |
| Wk 10 | Sub-processor list + data flow diagram + refund policy assembled and shared (doc 02 + doc 07) | F |
| Wk 11 | Enterprise contract amendment signed; Enterprise pool deposit in NOWPayments | – |
| Wk 12 | Comparison pages 5–8 shipped (`/vs/cleric`, `/vs/sierra-ai`, `/vs/cognition`, `/vs/manus-deepresearch`); receipt-of-the-week #12 (anniversary) | D |

**Day 90 KPIs (target).**
- Trial deposits paid: ≥ 18
- Standard customers active: ≥ 8
- Enterprise customers signed: ≥ 1
- Total receipts cleared: ≥ 1,200 line items
- Total ARR (Standard + Enterprise base): ≥ $48K
- Refund ratio: < 8 %
- Median first-cleared-receipt time: ≤ 14 days

## Resource plan

| Role | Day-1 commitment | Day-90 commitment |
|---|---|---|
| Founder (sales + content) | 100% | 70% (offload to founder #2 or hire #1 around D60) |
| Founder #2 / engineer (runtime) | 100% | 100% — runs apps/app/ build for next wave |
| Contracted operator-friend (LinkedIn + Slacks) | 4 hr/week | 4 hr/week |
| Contracted writer (comparison pages) | 6 hr/week | 4 hr/week |
| Customer Success (Trial onboarding) | 0% (founder does it) | 60% (first hire) |

## Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| NOWPayments outage during launch week | low | high | Plisio backup is documented and stubbed (doc 02). Manual invoicing fallback for Enterprise. |
| First receipt voids exceed 30% of attempted | medium | high | Verification rules will be tuned with the first 3 customers (founder-led onboarding). |
| Anti-crypto procurement gate at large org | medium | medium | Honest pre-call: stablecoin invoicing only in Wave 2, fiat invoicing in 2026 H2. We do not chase deals that demand fiat now. |
| LLM provider price hike eats unit margin | medium | medium | Unit prices are buffer-priced (cleared-line price > expected token cost × 4). Contractual clause to pass through > 30% provider hike. |
| Negative receipt-of-the-week (a customer's shift fails publicly) | low | high | We post about voids honestly; the void *is* the proof of verification. Bad receipts are content too. |

## Day-1 ops checklist

- [ ] DNS resolves: `ai-worker-as-a-service.prin7r.com` → 161.97.99.120
- [ ] HTTPS green: valid Let's Encrypt cert; HSTS not set yet (Wave 2)
- [ ] BUY CTA returns a real NOWPayments invoice URL (Trial / Standard / Enterprise)
- [ ] IPN endpoint verifies HMAC-SHA512 correctly with the chatbot-agency-shared keys
- [ ] Notion opportunity updated: stage Lead → Qualified, source URL → repo, status notes appended
- [ ] Receipt-of-the-week #1 drafted and ready to post
