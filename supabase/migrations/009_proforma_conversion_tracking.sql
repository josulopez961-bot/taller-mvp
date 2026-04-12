-- Migracion 009: trazabilidad simple de conversion proforma -> trabajo

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS proforma_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_decided_at TIMESTAMPTZ;
