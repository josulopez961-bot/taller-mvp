-- Migración 002: Fotos de recepción y observaciones
-- Ejecutar en: Supabase > SQL Editor

-- Observaciones del técnico al recibir el vehículo
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS reception_notes TEXT;

-- Tabla de fotos de entrada del vehículo
CREATE TABLE IF NOT EXISTS order_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Índice para buscar fotos por orden
CREATE INDEX IF NOT EXISTS order_photos_order_id_idx ON order_photos(order_id);

-- IMPORTANTE: También debes crear el bucket en Supabase Storage:
-- Supabase > Storage > New bucket > Nombre: "order-photos" > Public: ON
