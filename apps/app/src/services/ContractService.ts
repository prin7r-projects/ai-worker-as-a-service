// apps/app/src/services/ContractService.ts
// Shiftledger Phase 1 — Contract lifecycle (create, activate)
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";

export interface CreateContractArgs {
  customerId: string;
  workerProfileId: string;
  tier: "trial" | "standard" | "enterprise";
  outcomeTarget: number;
  unitPriceUsd: string;
  budgetCapUsd?: string;
  termMonths?: number;
  autoRenew?: boolean;
  referralCode?: string;
}

export class ContractService {
  /**
   * Create a new contract in `pending` status.
   * Contract ID format: `shiftledger_<tier>_<ts>_<rand>`
   */
  static async create(args: CreateContractArgs) {
    const id = [
      "shiftledger",
      args.tier,
      Date.now(),
      Math.random().toString(36).slice(2, 8),
    ].join("_");

    await db.insert(schema.contracts).values({
      id,
      customerId: args.customerId,
      workerProfileId: args.workerProfileId,
      tier: args.tier,
      status: "pending",
      outcomeTarget: args.outcomeTarget,
      unitPriceUsd: args.unitPriceUsd,
      budgetCapUsd: args.budgetCapUsd ?? null,
      termMonths: args.termMonths ?? 1,
      autoRenew: args.autoRenew ?? false,
      referralCode: args.referralCode ?? null,
      expiresAt: args.termMonths
        ? new Date(Date.now() + args.termMonths * 30 * 24 * 60 * 60 * 1000)
        : null,
    });

    const contract = await db
      .select()
      .from(schema.contracts)
      .where(eq(schema.contracts.id, id))
      .limit(1);

    return contract[0];
  }

  /**
   * Activate a contract: mark `active`, record `activatedAt`, schedule first shift.
   * Returns the updated contract.
   */
  static async activate(contractId: string) {
    const now = new Date();

    await db
      .update(schema.contracts)
      .set({
        status: "active",
        activatedAt: now,
      })
      .where(eq(schema.contracts.id, contractId));

    const contract = await db
      .select()
      .from(schema.contracts)
      .where(eq(schema.contracts.id, contractId))
      .limit(1);

    if (!contract.length) {
      throw new Error(`Contract not found: ${contractId}`);
    }

    return contract[0];
  }

  /**
   * Fetch a contract by ID.
   */
  static async getById(contractId: string) {
    const rows = await db
      .select()
      .from(schema.contracts)
      .where(eq(schema.contracts.id, contractId))
      .limit(1);

    return rows[0] ?? null;
  }
}
