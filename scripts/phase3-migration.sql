CREATE TABLE IF NOT EXISTS payment_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    contract_id text NOT NULL,
    payment_status text NOT NULL,
    nowpayments_invoice_id text,
    raw_payload jsonb,
    processed_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_events_contract_status_idx ON payment_events (contract_id, payment_status);

CREATE TABLE IF NOT EXISTS rev_share_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    contract_id text NOT NULL,
    referral_code text NOT NULL,
    share_rate numeric(5, 4) DEFAULT '0.2500' NOT NULL,
    contract_revenue_usd numeric(10, 2),
    accrued_usd numeric(10, 2) DEFAULT '0',
    paid_out_usd numeric(10, 2) DEFAULT '0',
    status text DEFAULT 'accruing',
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rev_share_contract_idx ON rev_share_ledger (contract_id);
CREATE INDEX IF NOT EXISTS rev_share_code_idx ON rev_share_ledger (referral_code);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_events_contract_id_fk') THEN
        ALTER TABLE payment_events ADD CONSTRAINT payment_events_contract_id_fk FOREIGN KEY (contract_id) REFERENCES contracts(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rev_share_ledger_contract_id_fk') THEN
        ALTER TABLE rev_share_ledger ADD CONSTRAINT rev_share_ledger_contract_id_fk FOREIGN KEY (contract_id) REFERENCES contracts(id);
    END IF;
END $$;
