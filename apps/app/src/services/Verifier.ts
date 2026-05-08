// apps/app/src/services/Verifier.ts
// Shiftledger Phase 1 — Stub verifier
// Integration is stubbed. Returns `cleared=true` with ~90% probability.
// Phase 2 replaces with real Zendesk / Salesforce / etc. integration.

export interface VerificationRule {
  sourceType: string;
  entity: string;
  condition: {
    field: string;
    operator: string;
    value: string;
  };
}

export interface VerificationOutcome {
  externalId: string;
  cleared: boolean;
  status: "cleared" | "voided";
  rule: VerificationRule;
  reason: string;
}

export class Verifier {
  /**
   * Verify a single external outcome against a rule.
   *
   * Phase 1 stub: ignores the rule and external state entirely.
   * Returns `cleared=true` with ~90% probability (matching the DoD spec:
   * 80-95 of 100 outcomes cleared, rest voided).
   *
   * @param externalId - the source-of-truth entity id
   * @param rule - the structured verification rule from the worker profile
   * @returns VerificationOutcome
   */
  static verify(
    externalId: string,
    rule: VerificationRule,
  ): VerificationOutcome {
    const cleared = Math.random() < 0.90;

    return {
      externalId,
      cleared,
      status: cleared ? "cleared" : "voided",
      rule,
      reason: cleared
        ? `Stub verifier: simulated clearance (Phase 1). Rule targets ${rule.sourceType} ${rule.entity} where ${rule.condition.field} ${rule.condition.operator} ${rule.condition.value}`
        : `Stub verifier: simulated void (Phase 1). Rule targets ${rule.sourceType} ${rule.entity} where ${rule.condition.field} ${rule.condition.operator} ${rule.condition.value}`,
    };
  }

  /**
   * Batch verify multiple external IDs against the same rule.
   */
  static verifyBatch(
    externalIds: string[],
    rule: VerificationRule,
  ): VerificationOutcome[] {
    return externalIds.map((id) => Verifier.verify(id, rule));
  }
}
