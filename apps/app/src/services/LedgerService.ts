// apps/app/src/services/LedgerService.ts
// Shiftledger Phase 1 — Receipt ledger
// Records receipt lines for verified outcomes.
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";

export interface RecordLineArgs {
  shiftId: string;
  externalId: string;
  status: "cleared" | "voided" | "disputed" | "escalated";
  unitPriceUsd: string;
  verificationDetails: Record<string, unknown>;
}

export class LedgerService {
  /**
   * Record a single receipt line for a verified outcome.
   */
  static async recordLine(args: RecordLineArgs) {
    const now = new Date();

    const [line] = await db
      .insert(schema.receiptLines)
      .values({
        shiftId: args.shiftId,
        externalId: args.externalId,
        status: args.status,
        unitPriceUsd: args.unitPriceUsd,
        verificationDetails: args.verificationDetails,
        clearedAt: args.status === "cleared" ? now : null,
        voidedAt: args.status === "voided" ? now : null,
      })
      .returning();

    return line;
  }

  /**
   * Get all receipt lines for a shift.
   */
  static async getLinesByShiftId(shiftId: string) {
    return db
      .select()
      .from(schema.receiptLines)
      .where(eq(schema.receiptLines.shiftId, shiftId));
  }

  /**
   * Get receipt summary for a shift: counts by status and total revenue.
   */
  static async getShiftSummary(shiftId: string) {
    const lines = await LedgerService.getLinesByShiftId(shiftId);

    const cleared = lines.filter((l) => l.status === "cleared");
    const voided = lines.filter((l) => l.status === "voided");

    const totalRevenue = cleared.reduce((sum, l) => {
      return sum + parseFloat(l.unitPriceUsd ?? "0");
    }, 0);

    return {
      shiftId,
      totalLines: lines.length,
      clearedCount: cleared.length,
      voidedCount: voided.length,
      totalRevenueUsd: totalRevenue.toFixed(2),
    };
  }
}
