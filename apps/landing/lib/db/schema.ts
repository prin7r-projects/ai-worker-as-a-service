// apps/landing/lib/db/schema.ts — Minimal schema for landing app
// The landing app needs read/write access to customers, contracts, paymentEvents, and workerProfiles.
// This mirrors the authoritative schema in apps/app/src/db/schema.ts.
import { pgTable, uuid, text, integer, numeric, jsonb, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  orgName: text("org_name"),
  agencyPartnerCode: text("agency_partner_code"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workerProfiles = pgTable("worker_profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  category: text("category").notNull(),
  unitPriceUsd: numeric("unit_price_usd", { precision: 10, scale: 2 }).notNull(),
  verificationRule: jsonb("verification_rule").notNull(),
  baselineClearRate: numeric("baseline_clear_rate", { precision: 5, scale: 4 }),
  driftStatus: text("drift_status").default("green"),
});

export const contracts = pgTable("contracts", {
  id: text("id").primaryKey(),
  customerId: uuid("customer_id").references(() => customers.id),
  workerProfileId: text("worker_profile_id").references(() => workerProfiles.id),
  tier: text("tier").notNull(),
  status: text("status").default("pending"),
  outcomeTarget: integer("outcome_target").notNull(),
  unitPriceUsd: numeric("unit_price_usd", { precision: 10, scale: 2 }).notNull(),
  budgetCapUsd: numeric("budget_cap_usd", { precision: 10, scale: 2 }),
  termMonths: integer("term_months").default(1),
  autoRenew: boolean("auto_renew").default(false),
  referralCode: text("referral_code"),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: text("contract_id").references(() => contracts.id).notNull(),
    paymentStatus: text("payment_status").notNull(),
    nowpaymentsInvoiceId: text("nowpayments_invoice_id"),
    rawPayload: jsonb("raw_payload"),
    processedAt: timestamp("processed_at").defaultNow(),
  },
  (table) => [
    index("payment_events_contract_status_idx").on(table.contractId, table.paymentStatus),
  ],
);

// Phase 4: Idempotency keys for checkout dedup
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idemHash: text("idem_hash").notNull(),
    idemKey: text("idem_key").notNull(),
    responsePayload: jsonb("response_payload").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idem_hash_created_idx").on(table.idemHash, table.createdAt),
  ],
);

// Phase 3: Partner referral rev-share ledger
export const revShareLedger = pgTable(
  "rev_share_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: text("contract_id").references(() => contracts.id).notNull(),
    referralCode: text("referral_code").notNull(),
    shareRate: numeric("share_rate", { precision: 5, scale: 4 }).notNull().default("0.2500"),
    contractRevenueUsd: numeric("contract_revenue_usd", { precision: 10, scale: 2 }),
    accruedUsd: numeric("accrued_usd", { precision: 10, scale: 2 }).default("0"),
    paidOutUsd: numeric("paid_out_usd", { precision: 10, scale: 2 }).default("0"),
    status: text("status").default("accruing"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("rev_share_contract_idx").on(table.contractId),
    index("rev_share_code_idx").on(table.referralCode),
  ],
);
