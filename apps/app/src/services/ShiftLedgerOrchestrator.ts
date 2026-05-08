// apps/app/src/services/ShiftLedgerOrchestrator.ts
// Shiftledger Phase 1 — End-to-end orchestration
// Ties ContractService → ShiftScheduler → WorkerRunner → Verifier → LedgerService
import { ContractService } from "./ContractService.js";
import { ShiftScheduler } from "./ShiftScheduler.js";
import { WorkerRunner } from "./WorkerRunner.js";
import { Verifier } from "./Verifier.js";
import { LedgerService } from "./LedgerService.js";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import type { VerificationRule } from "./Verifier.js";

export interface E2EResult {
  contract: Awaited<ReturnType<typeof ContractService["create"]>>;
  shift: Awaited<ReturnType<typeof ShiftScheduler["complete"]>>;
  verificationOutcomes: Array<{
    externalId: string;
    cleared: boolean;
    status: string;
  }>;
  receiptSummary: Awaited<ReturnType<typeof LedgerService["getShiftSummary"]>>;
}

export class ShiftLedgerOrchestrator {
  /**
   * Execute the full Phase 1 end-to-end flow:
   * create contract → activate → enqueue shift → run worker →
   * verify outcomes → record ledger lines → audit
   */
  static async runE2E(args: {
    customerId: string;
    workerProfileId: string;
    tier: "trial" | "standard" | "enterprise";
    outcomeTarget: number;
    unitPriceUsd: string;
  }): Promise<E2EResult> {
    // 1. Create contract (pending)
    const contract = await ContractService.create({
      customerId: args.customerId,
      workerProfileId: args.workerProfileId,
      tier: args.tier,
      outcomeTarget: args.outcomeTarget,
      unitPriceUsd: args.unitPriceUsd,
    });

    if (contract.status !== "pending") {
      throw new Error(`Contract creation failed: expected pending, got ${contract.status}`);
    }

    // 2. Activate contract
    const activated = await ContractService.activate(contract.id);
    if (activated.status !== "active") {
      throw new Error(`Contract activation failed: expected active, got ${activated.status}`);
    }

    // 3. Enqueue shift (creates shift in queued status)
    const shift = await ShiftScheduler.enqueue(contract.id);
    if (shift.status !== "queued") {
      throw new Error(`Shift enqueue failed: expected queued, got ${shift.status}`);
    }

    // 4. Mark shift as running
    await ShiftScheduler.markRunning(shift.id);

    // 5. WorkerRunner produces synthetic verification events
    const events = WorkerRunner.run(args.outcomeTarget);

    // 6. Load worker profile verification rule
    const [profile] = await db
      .select()
      .from(schema.workerProfiles)
      .where(eq(schema.workerProfiles.id, args.workerProfileId))
      .limit(1);

    const rule: VerificationRule = (profile?.verificationRule ?? {
      sourceType: "stub",
      entity: "outcome",
      condition: { field: "status", operator: "eq", value: "completed" },
    }) as VerificationRule;

    // 7. Verify each outcome
    let clearedCount = 0;
    let voidedCount = 0;
    const outcomes: Array<{
      externalId: string;
      cleared: boolean;
      status: string;
    }> = [];

    for (const event of events) {
      const outcome = Verifier.verify(event.externalId, rule);
      outcomes.push({
        externalId: outcome.externalId,
        cleared: outcome.cleared,
        status: outcome.status,
      });

      // 8. Record receipt line for each outcome
      await LedgerService.recordLine({
        shiftId: shift.id,
        externalId: outcome.externalId,
        status: outcome.status,
        unitPriceUsd: args.unitPriceUsd,
        verificationDetails: {
          rule: outcome.rule,
          reason: outcome.reason,
          verifierPhase: "1",
        },
      });

      if (outcome.cleared) clearedCount++;
      else voidedCount++;
    }

    // 9. Complete the shift with final counts
    const completedShift = await ShiftScheduler.complete(shift.id, {
      outcomesAttempted: args.outcomeTarget,
      outcomesCleared: clearedCount,
      outcomesVoided: voidedCount,
    });

    // 10. Get receipt summary
    const receiptSummary = await LedgerService.getShiftSummary(shift.id);

    return {
      contract: activated,
      shift: completedShift,
      verificationOutcomes: outcomes,
      receiptSummary,
    };
  }
}
