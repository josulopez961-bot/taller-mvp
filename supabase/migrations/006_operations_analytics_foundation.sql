-- Migración 006: base operativa y analítica sin romper el MVP
-- Objetivo:
-- 1) Mantener compatibilidad con tablas actuales
-- 2) Agregar trazabilidad de estados e ítems
-- 3) Preparar feedback, técnicos y snapshots analíticos

-- =========================
-- CAMPOS ADITIVOS EXISTENTES
-- =========================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'particular'
  CHECK (customer_type IN ('particular', 'aseguradora', 'flota'));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS promised_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS imported_history BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_rework BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rework_source_order_id UUID REFERENCES orders(id),
  ADD COLUMN IF NOT EXISTS final_sale_total NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS final_cost_total NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS final_margin_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS final_margin_pct NUMERIC(7,2);

ALTER TABLE order_quote_items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'labor'
  CHECK (item_type IN ('labor', 'part', 'supply', 'misc')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'approved', 'in_progress', 'used', 'cancelled')),
  ADD COLUMN IF NOT EXISTS sale_unit_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cost_unit_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS is_additional BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS added_after_approval BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Backfill mínimo y seguro para no dejar nulos evitables en campos nuevos.
UPDATE orders
SET promised_at = NULLIF(estimated_delivery_date::TEXT, '')::TIMESTAMPTZ
WHERE promised_at IS NULL
  AND NULLIF(estimated_delivery_date::TEXT, '') IS NOT NULL;

UPDATE order_quote_items
SET sale_unit_price = COALESCE(sale_unit_price, unit_price)
WHERE sale_unit_price IS NULL;

-- =========================
-- TABLAS NUEVAS
-- =========================

CREATE TABLE IF NOT EXISTS technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES technicians(id),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_technicians_unique
  ON order_technicians(order_id, technician_id);

CREATE INDEX IF NOT EXISTS idx_order_technicians_order_id
  ON order_technicians(order_id);

CREATE INDEX IF NOT EXISTS idx_order_technicians_technician_id
  ON order_technicians(technician_id);

CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by TEXT,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id
  ON order_status_history(order_id);

CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at
  ON order_status_history(changed_at DESC);

CREATE TABLE IF NOT EXISTS order_item_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by TEXT,
  before_data JSONB,
  after_data JSONB,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_item_changes_order_id
  ON order_item_changes(order_id);

CREATE INDEX IF NOT EXISTS idx_order_item_changes_order_item_id
  ON order_item_changes(order_item_id);

CREATE INDEX IF NOT EXISTS idx_order_item_changes_changed_at
  ON order_item_changes(changed_at DESC);

CREATE TABLE IF NOT EXISTS customer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  vehicle_id UUID REFERENCES vehicles(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  service_rating SMALLINT NOT NULL CHECK (service_rating BETWEEN 1 AND 5),
  on_time BOOLEAN,
  would_recommend BOOLEAN,
  improvement_comment TEXT,
  channel TEXT NOT NULL DEFAULT 'in_person'
    CHECK (channel IN ('in_person', 'whatsapp', 'sms', 'web_link', 'phone'))
);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_submitted_at
  ON customer_feedback(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_customer_id
  ON customer_feedback(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_vehicle_id
  ON customer_feedback(vehicle_id);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_period
  ON analytics_snapshots(period_start, period_end);

CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES analytics_snapshots(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_summary JSONB NOT NULL,
  output_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_snapshot_id
  ON ai_insights(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at
  ON ai_insights(created_at DESC);

-- =========================
-- TRIGGERS DE AUDITORÍA
-- =========================

CREATE OR REPLACE FUNCTION fn_log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_history (
      order_id,
      from_status,
      to_status,
      changed_at
    )
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      now()
    );

    IF NEW.status = 'entregado' AND NEW.delivered_at IS NULL THEN
      NEW.delivered_at = now();
    END IF;

    IF NEW.status = 'listo' AND NEW.ready_at IS NULL THEN
      NEW.ready_at = now();
    END IF;

    IF NEW.status = 'entregado' AND NEW.closed_at IS NULL THEN
      NEW.closed_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_order_status_change ON orders;

CREATE TRIGGER trg_log_order_status_change
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION fn_log_order_status_change();

CREATE OR REPLACE FUNCTION fn_log_order_item_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO order_item_changes (
      order_item_id,
      order_id,
      change_type,
      changed_at,
      after_data
    )
    VALUES (
      NEW.id,
      NEW.order_id,
      'create',
      now(),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO order_item_changes (
      order_item_id,
      order_id,
      change_type,
      changed_at,
      before_data,
      after_data
    )
    VALUES (
      NEW.id,
      NEW.order_id,
      'update',
      now(),
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO order_item_changes (
      order_item_id,
      order_id,
      change_type,
      changed_at,
      before_data
    )
    VALUES (
      OLD.id,
      OLD.order_id,
      'delete',
      now(),
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_order_item_change ON order_quote_items;

CREATE TRIGGER trg_log_order_item_change
AFTER INSERT OR UPDATE OR DELETE ON order_quote_items
FOR EACH ROW
EXECUTE FUNCTION fn_log_order_item_change();

-- =========================
-- VISTA BASE DE KPIS
-- =========================

CREATE OR REPLACE VIEW v_order_operational_metrics AS
SELECT
  o.id AS order_id,
  o.public_code,
  o.vehicle_id,
  v.customer_id,
  c.customer_type,
  o.service_type,
  o.status,
  o.is_rework,
  o.rework_source_order_id,
  COALESCE(o.promised_at, NULLIF(o.estimated_delivery_date::TEXT, '')::TIMESTAMPTZ) AS promised_at,
  o.ready_at,
  o.delivered_at,
  o.closed_at,
  CASE
    WHEN COALESCE(o.promised_at, NULLIF(o.estimated_delivery_date::TEXT, '')::TIMESTAMPTZ) IS NOT NULL
      AND o.delivered_at IS NOT NULL
      AND o.delivered_at <= COALESCE(o.promised_at, NULLIF(o.estimated_delivery_date::TEXT, '')::TIMESTAMPTZ)
    THEN true
    WHEN COALESCE(o.promised_at, NULLIF(o.estimated_delivery_date::TEXT, '')::TIMESTAMPTZ) IS NOT NULL
      AND o.delivered_at IS NOT NULL
    THEN false
    ELSE NULL
  END AS delivered_on_time,
  CASE
    WHEN o.created_at IS NOT NULL AND o.delivered_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 3600.0
    ELSE NULL
  END AS cycle_time_hours,
  COALESCE(
    o.final_sale_total,
    item_totals.sale_total
  ) AS sale_total,
  COALESCE(
    o.final_cost_total,
    item_totals.cost_total
  ) AS cost_total,
  COALESCE(
    o.final_margin_amount,
    COALESCE(o.final_sale_total, item_totals.sale_total) - COALESCE(o.final_cost_total, item_totals.cost_total)
  ) AS margin_amount,
  CASE
    WHEN COALESCE(o.final_sale_total, item_totals.sale_total) > 0 THEN
      ROUND(
        (
          COALESCE(
            o.final_margin_amount,
            COALESCE(o.final_sale_total, item_totals.sale_total) - COALESCE(o.final_cost_total, item_totals.cost_total)
          )
          / COALESCE(o.final_sale_total, item_totals.sale_total)
        ) * 100.0,
        2
      )
    ELSE NULL
  END AS margin_pct,
  feedback.service_rating,
  feedback.on_time AS feedback_on_time,
  feedback.would_recommend,
  feedback.improvement_comment,
  feedback.submitted_at AS feedback_submitted_at
FROM orders o
JOIN vehicles v
  ON v.id = o.vehicle_id
LEFT JOIN customers c
  ON c.id = v.customer_id
LEFT JOIN customer_feedback feedback
  ON feedback.order_id = o.id
LEFT JOIN (
  SELECT
    order_id,
    SUM(COALESCE(qty, 1) * COALESCE(sale_unit_price, unit_price, 0)) AS sale_total,
    SUM(COALESCE(qty, 1) * COALESCE(cost_unit_price, 0)) AS cost_total
  FROM order_quote_items
  WHERE deleted_at IS NULL
    AND status <> 'cancelled'
  GROUP BY order_id
) item_totals
  ON item_totals.order_id = o.id;
