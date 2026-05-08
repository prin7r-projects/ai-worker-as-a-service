// apps/app/src/services/ShiftScheduler.ts
// Shiftledger Phase 1 — Shift scheduling and execution
// Phase 1: synchronous stub (no BullMQ). Phase 2 adds Redis/BullMQ.
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";

/** Shift row as returned by Drizzle (matching schema.shifts columns) */
export type ShiftRow = typeof schema.shifts.$inferSelect;

export class ShiftScheduler {
  /**
   * Create a shift in `queued` status for the given contract.
   * Returns the inserted shift row.
   */
  static async enqueue(contractId: string) {
    const [shift] = await db
      .insert(schema.shifts)
      .values({
        contractId,
        status: "queued",
      })
      .returning();

    return shift;
  }

  /**
   * Mark a shift as `running`.
   */
  static async markRunning(shiftId: string) {
    const now = new Date();
    await db
      .update(schema.shifts)
      .set({ status: "running", startedAt: now })
      .where(eq(schema.shifts.id, shiftId));
  }

  /**
   * Mark a shift as `completed` with outcome counts.
   */
  static async complete(shiftId: string, counts: {
    outcomesAttempted: number;
    outcomesCleared: number;
    outcomesVoided: number;
  }) {
    const now = new Date();
    await db
      .update(schema.shifts)
      .set({
        status: "completed",
        endedAt: now,
        outcomesAttempted: counts.outcomesAttempted,
        outcomesCleared: counts.outcomesCleared,
        outcomesVoided: counts.outcomesVoided,
      })
      .where(eq(schema.shifts.id, shiftId));

    const rows = await db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.id, shiftId))
      .limit(1);

    return rows[0];
  }

  /**
   * Fetch a shift by ID.
   */
  static async getById(shiftId: string) {
    const rows = await db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.id, shiftId))
      .limit(1);

    return rows[0] ?? null;
  }
}
