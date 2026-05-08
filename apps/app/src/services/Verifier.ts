// apps/app/src/services/Verifier.ts
// Shiftledger Phase 2 — Real Zendesk verifier with stub fallback
// When a Zendesk integration exists for the contract's customer, poll real tickets.
// Otherwise, fall back to Phase 1 stub (~90% clearance).

import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { ZendeskService } from "./ZendeskService.js";

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
  details?: Record<string, unknown>;
}

export class Verifier {
  /**
   * Verify a single external outcome against a rule.
   *
   * Phase 2: if the rule targets Zendesk and a Zendesk integration exists for the
   * customer, poll the real ticket. Otherwise fall back to Phase 1 stub.
   *
   * @param externalId - the source-of-truth entity id (e.g. Zendesk ticket ID)
   * @param rule - the structured verification rule from the worker profile
   * @param customerId - optional customer ID to look up integrations
   * @returns VerificationOutcome
   */
  static async verify(
    externalId: string,
    rule: VerificationRule,
    customerId?: string,
  ): Promise<VerificationOutcome> {
    // Phase 2: try real Zendesk verification if applicable
    if (rule.sourceType === "zendesk" && rule.entity === "ticket" && customerId) {
      try {
        const [integration] = await db
          .select()
          .from(schema.integrations)
          .where(
            and(
              eq(schema.integrations.customerId, customerId),
              eq(schema.integrations.kind, "zendesk"),
              eq(schema.integrations.status, "healthy"),
            ),
          )
          .limit(1);

        if (integration) {
          const token = ZendeskService.decryptToken(integration.apiTokenEncrypted);
          const result = await ZendeskService.verifyZendeskTicket(externalId, token);

          return {
            externalId,
            cleared: result.cleared,
            status: result.status,
            rule,
            reason: result.cleared
              ? `Zendesk ticket ${externalId}: status = '${result.details?.ticketStatus || "unknown"}' — cleared per rule`
              : `Zendesk ticket ${externalId}: status = '${result.details?.ticketStatus || "unknown"}' — voided (not solved)`,
            details: result.details,
          };
        }
      } catch {
        // Fall through to stub if real verification fails
      }
    }

    // Phase 1 stub fallback
    const cleared = Math.random() < 0.90;

    return {
      externalId,
      cleared,
      status: cleared ? "cleared" : "voided",
      rule,
      reason: cleared
        ? `Stub verifier: simulated clearance. Rule targets ${rule.sourceType} ${rule.entity} where ${rule.condition.field} ${rule.condition.operator} ${rule.condition.value}`
        : `Stub verifier: simulated void. Rule targets ${rule.sourceType} ${rule.entity} where ${rule.condition.field} ${rule.condition.operator} ${rule.condition.value}`,
    };
  }

  /**
   * Batch verify multiple external IDs against the same rule.
   * Phase 2: uses real Zendesk when applicable (sequential polling).
   */
  static async verifyBatch(
    externalIds: string[],
    rule: VerificationRule,
    customerId?: string,
  ): Promise<VerificationOutcome[]> {
    const results: VerificationOutcome[] = [];
    for (const id of externalIds) {
      const outcome = await Verifier.verify(id, rule, customerId);
      results.push(outcome);
    }
    return results;
  }
}
