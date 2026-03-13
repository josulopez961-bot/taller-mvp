-- Migración 005: KM y fecha del servicio anterior en planes de mantenimiento
-- Permite calcular km/día cuando hay un solo registro de orden
-- Ejecutar en: Supabase > SQL Editor

ALTER TABLE maintenance_plans
  ADD COLUMN IF NOT EXISTS prev_service_km INTEGER,
  ADD COLUMN IF NOT EXISTS prev_service_date DATE;
