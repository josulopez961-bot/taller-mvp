-- Migracion 008: alcance en proceso y factura digital al cierre

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS scope_text TEXT,
  ADD COLUMN IF NOT EXISTS invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS invoice_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS invoice_file_name TEXT,
  ADD COLUMN IF NOT EXISTS invoice_uploaded_at TIMESTAMPTZ;
