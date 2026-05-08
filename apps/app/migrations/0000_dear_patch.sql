CREATE TABLE "contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" uuid,
	"worker_profile_id" text,
	"tier" text NOT NULL,
	"status" text DEFAULT 'pending',
	"outcome_target" integer NOT NULL,
	"unit_price_usd" numeric(10, 2) NOT NULL,
	"budget_cap_usd" numeric(10, 2),
	"term_months" integer DEFAULT 1,
	"auto_renew" boolean DEFAULT false,
	"referral_code" text,
	"activated_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"org_name" text,
	"agency_partner_code" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "customers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_profile_id" text,
	"week_start" date NOT NULL,
	"clear_rate" numeric(5, 4),
	"void_rate" numeric(5, 4),
	"sample_size" integer
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"kind" text NOT NULL,
	"api_token_encrypted" text NOT NULL,
	"status" text DEFAULT 'healthy',
	"last_heartbeat_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" text NOT NULL,
	"payment_status" text NOT NULL,
	"nowpayments_invoice_id" text,
	"raw_payload" jsonb,
	"processed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "receipt_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid,
	"external_id" text,
	"status" text NOT NULL,
	"cleared_at" timestamp,
	"voided_at" timestamp,
	"disputed_at" timestamp,
	"unit_price_usd" numeric(10, 2),
	"verification_details" jsonb
);
--> statement-breakpoint
CREATE TABLE "rev_share_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" text NOT NULL,
	"referral_code" text NOT NULL,
	"share_rate" numeric(5, 4) DEFAULT '0.2500' NOT NULL,
	"contract_revenue_usd" numeric(10, 2),
	"accrued_usd" numeric(10, 2) DEFAULT '0',
	"paid_out_usd" numeric(10, 2) DEFAULT '0',
	"status" text DEFAULT 'accruing',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" text,
	"status" text DEFAULT 'queued',
	"started_at" timestamp,
	"ended_at" timestamp,
	"outcomes_attempted" integer DEFAULT 0,
	"outcomes_cleared" integer DEFAULT 0,
	"outcomes_voided" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "worker_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"category" text NOT NULL,
	"unit_price_usd" numeric(10, 2) NOT NULL,
	"verification_rule" jsonb NOT NULL,
	"baseline_clear_rate" numeric(5, 4),
	"drift_status" text DEFAULT 'green'
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_worker_profile_id_worker_profiles_id_fk" FOREIGN KEY ("worker_profile_id") REFERENCES "public"."worker_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_worker_profile_id_worker_profiles_id_fk" FOREIGN KEY ("worker_profile_id") REFERENCES "public"."worker_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_lines" ADD CONSTRAINT "receipt_lines_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rev_share_ledger" ADD CONSTRAINT "rev_share_ledger_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eval_runs_profile_week_idx" ON "eval_runs" USING btree ("worker_profile_id","week_start");--> statement-breakpoint
CREATE INDEX "payment_events_contract_status_idx" ON "payment_events" USING btree ("contract_id","payment_status");--> statement-breakpoint
CREATE INDEX "rev_share_contract_idx" ON "rev_share_ledger" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "rev_share_code_idx" ON "rev_share_ledger" USING btree ("referral_code");