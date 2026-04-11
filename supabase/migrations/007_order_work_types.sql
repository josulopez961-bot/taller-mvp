-- Migracion 007: ampliar la orden base a otras areas sin romper mantenimiento

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS work_type TEXT NOT NULL DEFAULT 'mantenimiento'
  CHECK (work_type IN ('mantenimiento', 'pintura', 'falla_puntual', 'aseguradora')),
  ADD COLUMN IF NOT EXISTS customer_concern TEXT,
  ADD COLUMN IF NOT EXISTS paint_scope TEXT,
  ADD COLUMN IF NOT EXISTS insurance_scope TEXT,
  ADD COLUMN IF NOT EXISTS insurance_company TEXT,
  ADD COLUMN IF NOT EXISTS insurance_claim_number TEXT;

UPDATE orders
SET
  work_type = COALESCE(NULLIF(work_type, ''), 'mantenimiento'),
  customer_concern = COALESCE(customer_concern, intake_reason),
  summary = COALESCE(NULLIF(summary, ''), NULLIF(intake_reason, ''), 'Mantenimiento')
WHERE work_type IS NULL
   OR customer_concern IS NULL
   OR summary IS NULL
   OR summary = '';
