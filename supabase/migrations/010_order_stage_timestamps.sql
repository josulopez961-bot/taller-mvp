-- Migracion 010: tiempos operativos base por etapa

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS diagnosis_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS testing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
