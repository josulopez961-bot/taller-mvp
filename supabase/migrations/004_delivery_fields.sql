-- Migración 004: Campos de entrega
-- Ejecutar en: Supabase > SQL Editor

-- Recomendaciones al cliente al momento de entrega
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS recommendations TEXT;

-- Tipo de foto: intake (entrada) o delivery (salida)
ALTER TABLE order_photos
  ADD COLUMN IF NOT EXISTS photo_type TEXT NOT NULL DEFAULT 'intake'
  CHECK (photo_type IN ('intake', 'delivery'));
