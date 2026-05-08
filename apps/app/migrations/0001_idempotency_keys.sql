-- Phase 4 (PRI-2323): Idempotency keys table for checkout dedup + webhook sig failure tracking
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idem_hash" text NOT NULL,
	"idem_key" text NOT NULL,
	"response_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idem_hash_created_idx" ON "idempotency_keys" USING btree ("idem_hash","created_at");
