// apps/app/src/__tests__/e2e.test.ts
// Shiftledger Phase 1 — End-to-end test
// create contract → activate → run shift → verify lines → audit ledger
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { ShiftLedgerOrchestrator } from "../services/ShiftLedgerOrchestrator.js";
import { ContractService } from "../services/ContractService.js";
import { LedgerService } from "../services/LedgerService.js";

// Unique test IDs to avoid collision across runs
const TEST_RUN_ID = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TEST_CUSTOMER_ID = crypto.randomUUID();
const TEST_WORKER_PROFILE_ID = "cs-shift";
const TEST_OUTCOME_TARGET = 100;
const TEST_UNIT_PRICE_USD = "2.50";

describe("Shiftledger Phase 1 E2E", () => {
  let contractId: string;
  let shiftId: string;

  beforeAll(async () => {
    // Ensure worker profile is seeded
    const [existing] = await db
      .select()
      .from(schema.workerProfiles)
      .where(eq(schema.workerProfiles.id, TEST_WORKER_PROFILE_ID))
      .limit(1);

    if (!existing) {
      await db.insert(schema.workerProfiles).values({
        id: TEST_WORKER_PROFILE_ID,
        displayName: "CS Shift (test)",
        category: "cs",
        unitPriceUsd: TEST_UNIT_PRICE_USD,
        verificationRule: {
          sourceType: "zendesk",
          entity: "ticket",
          condition: { field: "status", operator: "eq", value: "solved" },
        },
        baselineClearRate: "0.8750",
        driftStatus: "green",
      });
    }

    // Create test customer
    await db.insert(schema.customers).values({
      id: TEST_CUSTOMER_ID,
      email: `${TEST_RUN_ID}@shiftledger-test.local`,
      orgName: `E2E Test Org ${TEST_RUN_ID}`,
    });
  });

  afterAll(async () => {
    // Cleanup all contracts/shifts for this test customer first
    const allContracts = await db
      .select()
      .from(schema.contracts)
      .where(eq(schema.contracts.customerId, TEST_CUSTOMER_ID));

    for (const c of allContracts) {
      const allShifts = await db
        .select()
        .from(schema.shifts)
        .where(eq(schema.shifts.contractId, c.id));

      for (const s of allShifts) {
        await db.delete(schema.receiptLines).where(eq(schema.receiptLines.shiftId, s.id));
      }
      await db.delete(schema.shifts).where(eq(schema.shifts.contractId, c.id));
      await db.delete(schema.contracts).where(eq(schema.contracts.id, c.id));
    }
    await db.delete(schema.customers).where(eq(schema.customers.id, TEST_CUSTOMER_ID));
  });

  it("creates a contract in pending status", async () => {
    const contract = await ContractService.create({
      customerId: TEST_CUSTOMER_ID,
      workerProfileId: TEST_WORKER_PROFILE_ID,
      tier: "trial",
      outcomeTarget: TEST_OUTCOME_TARGET,
      unitPriceUsd: TEST_UNIT_PRICE_USD,
    });

    expect(contract).toBeDefined();
    expect(contract.status).toBe("pending");
    expect(contract.customerId).toBe(TEST_CUSTOMER_ID);
    expect(contract.workerProfileId).toBe(TEST_WORKER_PROFILE_ID);
    expect(contract.outcomeTarget).toBe(TEST_OUTCOME_TARGET);
    expect(contract.unitPriceUsd).toBe(TEST_UNIT_PRICE_USD);

    contractId = contract.id;
  });

  it("activates a contract — sets status to active and records activatedAt", async () => {
    expect(contractId).toBeDefined();

    const activated = await ContractService.activate(contractId);

    expect(activated.status).toBe("active");
    expect(activated.activatedAt).toBeDefined();
    expect(new Date(activated.activatedAt!).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("runs the full ShiftLedger orchestrator end-to-end", async () => {
    const result = await ShiftLedgerOrchestrator.runE2E({
      customerId: TEST_CUSTOMER_ID,
      workerProfileId: TEST_WORKER_PROFILE_ID,
      tier: "trial",
      outcomeTarget: TEST_OUTCOME_TARGET,
      unitPriceUsd: TEST_UNIT_PRICE_USD,
    });

    // Capture shift ID for cleanup
    shiftId = result.shift.id;

    // Contract assertions
    expect(result.contract.status).toBe("active");
    expect(result.contract.activatedAt).toBeDefined();

    // Shift assertions
    expect(result.shift.status).toBe("completed");
    expect(result.shift.outcomesAttempted).toBe(TEST_OUTCOME_TARGET);

    // Shift must have cleared + voided counts that sum to outcomesAttempted
    const shiftCleared = result.shift.outcomesCleared ?? 0;
    const shiftVoided = result.shift.outcomesVoided ?? 0;
    expect(shiftCleared + shiftVoided).toBe(TEST_OUTCOME_TARGET);

    // Verification outcomes: 80-95 should be cleared per DoD
    expect(result.verificationOutcomes.length).toBe(TEST_OUTCOME_TARGET);
    const clearedOutcomes = result.verificationOutcomes.filter((o) => o.cleared);
    expect(clearedOutcomes.length).toBeGreaterThanOrEqual(80);
    expect(clearedOutcomes.length).toBeLessThanOrEqual(95);

    // Receipt summary
    expect(result.receiptSummary.totalLines).toBe(TEST_OUTCOME_TARGET);
    expect(result.receiptSummary.clearedCount).toBe(clearedOutcomes.length);
    expect(result.receiptSummary.voidedCount).toBe(
      TEST_OUTCOME_TARGET - clearedOutcomes.length,
    );

    // Revenue: sum of cleared * unitPrice should match expected
    const expectedRevenue = clearedOutcomes.length * parseFloat(TEST_UNIT_PRICE_USD);
    const actualRevenue = parseFloat(result.receiptSummary.totalRevenueUsd);
    expect(actualRevenue).toBeCloseTo(expectedRevenue, 2);
  });

  it("produces exactly 100 receipt lines in the ledger", async () => {
    // Re-fetch from DB to verify persistence
    const lines = await LedgerService.getLinesByShiftId(shiftId);
    expect(lines.length).toBe(TEST_OUTCOME_TARGET);

    const clearedLines = lines.filter((l) => l.status === "cleared");
    const voidedLines = lines.filter((l) => l.status === "voided");

    expect(clearedLines.length + voidedLines.length).toBe(TEST_OUTCOME_TARGET);
    expect(clearedLines.length).toBeGreaterThanOrEqual(80);
    expect(clearedLines.length).toBeLessThanOrEqual(95);

    // Sum of cleared * unitPrice matches expected revenue
    const revenue = clearedLines.reduce((sum, l) => {
      return sum + parseFloat(l.unitPriceUsd ?? "0");
    }, 0);
    const expectedRevenue = clearedLines.length * parseFloat(TEST_UNIT_PRICE_USD);
    expect(revenue).toBeCloseTo(expectedRevenue, 2);

    // Every line has verification details
    for (const line of lines) {
      expect(line.verificationDetails).toBeDefined();
      expect(line.unitPriceUsd).toBe(TEST_UNIT_PRICE_USD);
      expect(line.shiftId).toBe(shiftId);
    }
  });

  it("audits the shift summary correctly", async () => {
    const summary = await LedgerService.getShiftSummary(shiftId);
    expect(summary.totalLines).toBe(TEST_OUTCOME_TARGET);
    expect(summary.clearedCount + summary.voidedCount).toBe(TEST_OUTCOME_TARGET);

    // Revenue check
    const revenue = parseFloat(summary.totalRevenueUsd);
    const expectedMin = 80 * parseFloat(TEST_UNIT_PRICE_USD); // $200.00
    const expectedMax = 95 * parseFloat(TEST_UNIT_PRICE_USD); // $237.50
    expect(revenue).toBeGreaterThanOrEqual(expectedMin);
    expect(revenue).toBeLessThanOrEqual(expectedMax);
  });
});
