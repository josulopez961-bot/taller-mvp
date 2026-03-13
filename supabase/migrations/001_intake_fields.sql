-- Migración 001: Campos de ingreso de vehículo
-- Ejecutar en: Supabase > SQL Editor

-- Motor del vehículo
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS engine TEXT;

-- Motivo de ingreso reportado por el cliente
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS intake_reason TEXT;
