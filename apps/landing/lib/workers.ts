/**
 * [TALLY_WORKERS] Catalog of pre-trained worker profiles.
 * Source of truth for /docs/07-sales-strategy.md "Per-profile unit reference rates"
 * and the Worker Catalog + Outcome Pricing Table on the landing.
 */

export type WorkerProfile = {
  id: string;
  name: string;
  unit: string; // what the cleared line represents
  unitPriceUsd: number; // USD per cleared outcome
  verificationRule: string; // brief; full text in docs
  exampleOutcome: string; // sample line item for the receipt
  oneLiner: string; // marketing one-liner
};

export const WORKERS: WorkerProfile[] = [
  {
    id: "support",
    name: "Customer Support",
    unit: "Cleared ticket",
    unitPriceUsd: 6,
    verificationRule: "Customer-set resolution status",
    exampleOutcome: "Resolved ticket #84621 — refund issued, customer marked closed.",
    oneLiner: "Reads your help-desk. Resolves tickets. Voids the line if the customer doesn't close it."
  },
  {
    id: "sdr",
    name: "SDR (outbound)",
    unit: "Personalized message + reply or non-bounce",
    unitPriceUsd: 9,
    verificationRule: "CRM activity log: outbound + inbound or non-bounce",
    exampleOutcome: "Contacted contact_881 with personalized message — reply received in CRM 2026-05-07.",
    oneLiner: "Writes the personalized note. Logs the reply. No reply, no charge."
  },
  {
    id: "researcher",
    name: "Researcher",
    unit: "Source-grounded brief (>=600 words, >=5 cites)",
    unitPriceUsd: 12,
    verificationRule: "Cite-check pass",
    exampleOutcome: "Brief 'EU AI Act, Q1 2026' delivered with 7 citations, all live.",
    oneLiner: "Pulls the sources. Writes the brief. Voids if a cite 404s."
  },
  {
    id: "writer",
    name: "Writer",
    unit: "First-draft article (>=800 words, on brief)",
    unitPriceUsd: 11,
    verificationRule: "Plagiarism + brief-fit check",
    exampleOutcome: "First-draft 'Outcome economy 101' delivered, 1,140 words, originality pass.",
    oneLiner: "Reads your brief. Drafts the article. Voids if originality fails."
  },
  {
    id: "ops",
    name: "Ops Coordinator",
    unit: "Form / spreadsheet line completed against contract",
    unitPriceUsd: 5,
    verificationRule: "Schema-match + checksum",
    exampleOutcome: "Vendor onboarding row #443 completed, all required fields populated, checksum stable.",
    oneLiner: "Fills the form. Pushes the row. Voids if the schema doesn't match."
  },
  {
    id: "qa",
    name: "QA Auditor",
    unit: "Bug or compliance issue logged with reproducer",
    unitPriceUsd: 8,
    verificationRule: "Reproducer reproduces",
    exampleOutcome: "Bug #1102 logged in Linear with reproducer; reproducer reproduces in CI.",
    oneLiner: "Tries the flow. Files the bug with a reproducer. Voids if the repro doesn't reproduce."
  }
];

export function totalProfiles(): number {
  return WORKERS.length;
}
