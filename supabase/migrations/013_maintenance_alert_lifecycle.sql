-- Migracion 013: ciclo de vida de alertas de mantenimiento
-- Evita que el cron repita diariamente el mismo mantenimiento en correos.

ALTER TABLE maintenance_plans
  ADD COLUMN IF NOT EXISTS alert_last_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS alert_sent_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alert_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_maintenance_plans_alert_last_sent_at
  ON maintenance_plans(alert_last_sent_at);

CREATE INDEX IF NOT EXISTS idx_maintenance_plans_alert_expires_at
  ON maintenance_plans(alert_expires_at);
