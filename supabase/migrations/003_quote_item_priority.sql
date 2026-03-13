-- Migración 003: Prioridad por item de cotización
-- Ejecutar en: Supabase > SQL Editor

ALTER TABLE order_quote_items
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'urgente'
  CHECK (priority IN ('urgente', 'recomendado', 'opcional'));
