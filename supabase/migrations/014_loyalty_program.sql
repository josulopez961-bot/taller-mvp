-- Programa FINECAR Beneficios
-- Niveles por visitas en una ventana movil de 12 meses y puntos sobre mano de obra pagada.

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  customer_id UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activation_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  welcome_bonus_granted BOOLEAN NOT NULL DEFAULT false,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiry_notice_stage INTEGER NOT NULL DEFAULT 0 CHECK (expiry_notice_stage IN (0, 5, 15, 30)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN ('welcome_bonus', 'earned', 'redeemed', 'refunded', 'expired', 'adjustment')
  ),
  points_delta INTEGER NOT NULL CHECK (points_delta <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_created
  ON loyalty_transactions(customer_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_transactions_order_type_unique
  ON loyalty_transactions(order_id, transaction_type)
  WHERE order_id IS NOT NULL AND transaction_type IN ('welcome_bonus', 'earned', 'redeemed');

CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (
    status IN ('requested', 'kept', 'approved', 'rejected', 'applied', 'cancelled')
  ),
  points_requested INTEGER NOT NULL DEFAULT 0 CHECK (points_requested >= 0),
  points_approved INTEGER CHECK (points_approved IS NULL OR points_approved >= 0),
  labor_subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  customer_note TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_status
  ON loyalty_redemptions(status, requested_at DESC);

CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread
  ON admin_notifications(created_at DESC)
  WHERE read_at IS NULL;

-- La aplicacion usa service-role desde el servidor. Ninguna tabla de fidelizacion
-- debe quedar expuesta directamente a anon/authenticated por PostgREST.
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE loyalty_accounts FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE loyalty_transactions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE loyalty_redemptions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE admin_notifications FROM anon, authenticated;

CREATE OR REPLACE FUNCTION loyalty_rate_for_visits(visit_count INTEGER)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN visit_count >= 4 THEN 5
    WHEN visit_count = 3 THEN 4
    WHEN visit_count = 2 THEN 3
    ELSE 0
  END;
$$;

-- Se ejecuta al marcar una orden como entregada. Es idempotente: una orden solo
-- puede generar un movimiento de canje y uno de acumulacion.
CREATE OR REPLACE FUNCTION finalize_loyalty_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_account loyalty_accounts%ROWTYPE;
  v_visit_count INTEGER := 0;
  v_rate INTEGER := 0;
  v_labor NUMERIC(12,2) := 0;
  v_redeem_points INTEGER := 0;
  v_earned_points INTEGER := 0;
  v_balance INTEGER := 0;
  v_redemption loyalty_redemptions%ROWTYPE;
  v_authorized TEXT;
BEGIN
  SELECT v.customer_id, o.authorized_priorities
    INTO v_customer_id, v_authorized
  FROM orders o
  JOIN vehicles v ON v.id = o.vehicle_id
  WHERE o.id = p_order_id AND o.status = 'entregado';

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'customer_or_delivered_order_missing');
  END IF;

  SELECT * INTO v_account
  FROM loyalty_accounts
  WHERE customer_id = v_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'loyalty_not_activated');
  END IF;

  -- Si llevaba 12 meses sin actividad, vence el saldo anterior antes de procesar la visita actual.
  IF v_account.points_balance > 0
     AND v_account.last_activity_at <= now() - interval '12 months' THEN
    INSERT INTO loyalty_transactions (
      customer_id, transaction_type, points_delta, balance_after, description
    ) VALUES (
      v_customer_id, 'expired', -v_account.points_balance, 0,
      'Puntos vencidos por 12 meses de inactividad'
    );
    UPDATE loyalty_accounts
    SET points_balance = 0, updated_at = now()
    WHERE customer_id = v_customer_id;
    v_account.points_balance := 0;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_visit_count
  FROM orders o
  JOIN vehicles v ON v.id = o.vehicle_id
  WHERE v.customer_id = v_customer_id
    AND o.status = 'entregado'
    AND COALESCE(o.delivered_at, o.created_at) >= now() - interval '12 months'
    AND COALESCE(o.imported_history, false) = false;

  v_rate := loyalty_rate_for_visits(v_visit_count);

  SELECT COALESCE(SUM(COALESCE(q.qty, 1) * COALESCE(q.unit_price, 0)), 0)
    INTO v_labor
  FROM order_quote_items q
  WHERE q.order_id = p_order_id
    AND COALESCE(q.category, q.item_type, 'labor') = 'labor'
    AND COALESCE(q.priority, 'urgente') <> 'especial'
    AND COALESCE(q.status, 'draft') <> 'cancelled'
    AND (
      NULLIF(TRIM(v_authorized), '') IS NULL
      OR COALESCE(q.priority, 'urgente') = ANY(string_to_array(v_authorized, ','))
    );

  SELECT * INTO v_redemption
  FROM loyalty_redemptions
  WHERE order_id = p_order_id AND status = 'approved'
  FOR UPDATE;

  IF FOUND AND NOT EXISTS (
    SELECT 1 FROM loyalty_transactions
    WHERE order_id = p_order_id AND transaction_type = 'redeemed'
  ) THEN
    v_redeem_points := LEAST(
      COALESCE(v_redemption.points_approved, v_redemption.points_requested),
      v_account.points_balance,
      FLOOR(v_labor * 100)::INTEGER
    );

    IF v_redeem_points > 0 THEN
      v_balance := v_account.points_balance - v_redeem_points;
      UPDATE loyalty_accounts SET points_balance = v_balance, updated_at = now()
      WHERE customer_id = v_customer_id;

      INSERT INTO loyalty_transactions (
        customer_id, order_id, transaction_type, points_delta, balance_after,
        description, metadata
      ) VALUES (
        v_customer_id, p_order_id, 'redeemed', -v_redeem_points, v_balance,
        'Puntos aplicados a mano de obra',
        jsonb_build_object('labor_subtotal', v_labor, 'usd_value', v_redeem_points / 100.0)
      );

      UPDATE loyalty_redemptions
      SET status = 'applied', points_approved = v_redeem_points,
          applied_at = now(), updated_at = now()
      WHERE id = v_redemption.id;
      v_account.points_balance := v_balance;
    END IF;
  END IF;

  IF v_rate > 0 AND NOT EXISTS (
    SELECT 1 FROM loyalty_transactions
    WHERE order_id = p_order_id AND transaction_type = 'earned'
  ) THEN
    -- Solo la mano de obra pagada con dinero genera nuevos puntos.
    v_earned_points := FLOOR(GREATEST(0, v_labor - v_redeem_points / 100.0) * v_rate)::INTEGER;

    IF v_earned_points > 0 THEN
      v_balance := v_account.points_balance + v_earned_points;
      UPDATE loyalty_accounts SET points_balance = v_balance, updated_at = now()
      WHERE customer_id = v_customer_id;

      INSERT INTO loyalty_transactions (
        customer_id, order_id, transaction_type, points_delta, balance_after,
        description, metadata
      ) VALUES (
        v_customer_id, p_order_id, 'earned', v_earned_points, v_balance,
        'Puntos ganados por mano de obra pagada',
        jsonb_build_object(
          'visit_count', v_visit_count, 'rate', v_rate,
          'labor_subtotal', v_labor, 'redeemed_points', v_redeem_points
        )
      );
      v_account.points_balance := v_balance;
    END IF;
  END IF;

  UPDATE loyalty_accounts
  SET last_activity_at = now(), expiry_notice_stage = 0, updated_at = now()
  WHERE customer_id = v_customer_id;

  RETURN jsonb_build_object(
    'ok', true,
    'customer_id', v_customer_id,
    'visit_count', v_visit_count,
    'rate', v_rate,
    'labor_subtotal', v_labor,
    'redeemed_points', v_redeem_points,
    'earned_points', v_earned_points,
    'points_balance', v_account.points_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION finalize_loyalty_order(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION loyalty_rate_for_visits(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION finalize_loyalty_order(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION loyalty_rate_for_visits(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION activate_loyalty_account(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_balance INTEGER;
  v_inserted BOOLEAN := false;
  v_rows INTEGER := 0;
BEGIN
  SELECT v.customer_id INTO v_customer_id
  FROM orders o
  JOIN vehicles v ON v.id = o.vehicle_id
  WHERE o.id = p_order_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'No se encontro el cliente de la orden';
  END IF;

  INSERT INTO loyalty_accounts (
    customer_id, points_balance, activation_order_id,
    welcome_bonus_granted, activated_at, last_activity_at
  ) VALUES (
    v_customer_id, 200, p_order_id, true, now(), now()
  )
  ON CONFLICT (customer_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_rows > 0;

  IF v_inserted THEN
    INSERT INTO loyalty_transactions (
      customer_id, order_id, transaction_type, points_delta,
      balance_after, description, metadata
    ) VALUES (
      v_customer_id, p_order_id, 'welcome_bonus', 200, 200,
      'Bono de bienvenida por activar FINECAR Beneficios',
      jsonb_build_object('usd_value', 2)
    );
  END IF;

  -- Si el cliente activa sus beneficios después de que la orden ya fue entregada,
  -- procesa esa visita de forma idempotente (la primera sigue sin generar puntos).
  IF EXISTS (SELECT 1 FROM orders WHERE id = p_order_id AND status = 'entregado') THEN
    PERFORM finalize_loyalty_order(p_order_id);
  END IF;

  SELECT points_balance INTO v_balance
  FROM loyalty_accounts WHERE customer_id = v_customer_id;

  RETURN jsonb_build_object(
    'ok', true, 'activated_now', v_inserted,
    'customer_id', v_customer_id, 'points_balance', v_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION request_loyalty_redemption(
  p_order_id UUID,
  p_decision TEXT,
  p_points INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_customer_name TEXT;
  v_public_code TEXT;
  v_approval_status TEXT;
  v_authorized TEXT;
  v_account loyalty_accounts%ROWTYPE;
  v_labor NUMERIC(12,2) := 0;
  v_reserved INTEGER := 0;
  v_available INTEGER := 0;
  v_requested INTEGER := 0;
  v_previous_visits INTEGER := 0;
  v_redemption_id UUID;
BEGIN
  IF p_decision NOT IN ('apply', 'keep') THEN
    RAISE EXCEPTION 'Decision invalida';
  END IF;

  SELECT v.customer_id, c.full_name, o.public_code, o.approval_status, o.authorized_priorities
    INTO v_customer_id, v_customer_name, v_public_code, v_approval_status, v_authorized
  FROM orders o
  JOIN vehicles v ON v.id = o.vehicle_id
  JOIN customers c ON c.id = v.customer_id
  WHERE o.id = p_order_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'No se encontro el cliente de la orden';
  END IF;

  SELECT * INTO v_account FROM loyalty_accounts
  WHERE customer_id = v_customer_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Primero activa FINECAR Beneficios';
  END IF;

  IF p_decision = 'keep' THEN
    INSERT INTO loyalty_redemptions (
      customer_id, order_id, status, points_requested, labor_subtotal,
      customer_note, requested_at, updated_at
    ) VALUES (
      v_customer_id, p_order_id, 'kept', 0, 0,
      'El cliente decidio conservar sus puntos', now(), now()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      status = 'kept', points_requested = 0, points_approved = NULL,
      customer_note = 'El cliente decidio conservar sus puntos',
      requested_at = now(), reviewed_at = NULL, updated_at = now()
    WHERE loyalty_redemptions.status NOT IN ('applied');

    INSERT INTO admin_notifications (
      notification_type, title, message, order_id, customer_id, metadata
    ) VALUES (
      'loyalty_kept', 'El cliente conservara sus puntos',
      COALESCE(v_customer_name, 'Cliente') || ' conservara sus puntos en la orden ' || v_public_code,
      p_order_id, v_customer_id, jsonb_build_object('decision', 'keep')
    );

    RETURN jsonb_build_object('ok', true, 'status', 'kept');
  END IF;

  IF v_approval_status <> 'aprobado' THEN
    RAISE EXCEPTION 'Primero autoriza la proforma';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_previous_visits
  FROM orders o
  JOIN vehicles v ON v.id = o.vehicle_id
  WHERE v.customer_id = v_customer_id
    AND o.id <> p_order_id
    AND o.status = 'entregado'
    AND COALESCE(o.delivered_at, o.created_at) >= now() - interval '12 months'
    AND COALESCE(o.imported_history, false) = false;

  IF v_previous_visits < 1 THEN
    RAISE EXCEPTION 'El bono y los puntos se pueden usar desde la segunda visita';
  END IF;

  SELECT COALESCE(SUM(COALESCE(q.qty, 1) * COALESCE(q.unit_price, 0)), 0)
    INTO v_labor
  FROM order_quote_items q
  WHERE q.order_id = p_order_id
    AND COALESCE(q.category, q.item_type, 'labor') = 'labor'
    AND COALESCE(q.priority, 'urgente') <> 'especial'
    AND COALESCE(q.status, 'draft') <> 'cancelled'
    AND (
      NULLIF(TRIM(v_authorized), '') IS NULL
      OR COALESCE(q.priority, 'urgente') = ANY(string_to_array(v_authorized, ','))
    );

  SELECT COALESCE(SUM(COALESCE(points_approved, points_requested)), 0)::INTEGER
    INTO v_reserved
  FROM loyalty_redemptions
  WHERE customer_id = v_customer_id
    AND order_id <> p_order_id
    AND status IN ('requested', 'approved');

  v_available := GREATEST(0, v_account.points_balance - v_reserved);
  v_requested := LEAST(
    COALESCE(NULLIF(p_points, 0), v_available),
    v_available,
    FLOOR(v_labor * 100)::INTEGER
  );

  IF v_requested <= 0 THEN
    RAISE EXCEPTION 'No hay puntos o mano de obra disponibles para canjear';
  END IF;

  INSERT INTO loyalty_redemptions (
    customer_id, order_id, status, points_requested, points_approved,
    labor_subtotal, customer_note, requested_at, updated_at
  ) VALUES (
    v_customer_id, p_order_id, 'requested', v_requested, NULL,
    v_labor, 'El cliente solicito aplicar sus puntos', now(), now()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    status = 'requested', points_requested = EXCLUDED.points_requested,
    points_approved = NULL, labor_subtotal = EXCLUDED.labor_subtotal,
    customer_note = EXCLUDED.customer_note, requested_at = now(),
    reviewed_at = NULL, applied_at = NULL, updated_at = now()
  WHERE loyalty_redemptions.status NOT IN ('applied')
  RETURNING id INTO v_redemption_id;

  IF v_redemption_id IS NULL THEN
    RAISE EXCEPTION 'El canje de esta orden ya fue aplicado';
  END IF;

  INSERT INTO admin_notifications (
    notification_type, title, message, order_id, customer_id, metadata
  ) VALUES (
    'loyalty_redemption_requested', 'Solicitud de canje de puntos',
    COALESCE(v_customer_name, 'Cliente') || ' solicita usar ' || v_requested ||
      ' puntos ($' || to_char(v_requested / 100.0, 'FM999999990.00') || ') en la orden ' || v_public_code,
    p_order_id, v_customer_id,
    jsonb_build_object('redemption_id', v_redemption_id, 'points', v_requested, 'labor_subtotal', v_labor)
  );

  RETURN jsonb_build_object(
    'ok', true, 'status', 'requested', 'redemption_id', v_redemption_id,
    'points_requested', v_requested, 'usd_value', v_requested / 100.0,
    'labor_subtotal', v_labor
  );
END;
$$;

REVOKE ALL ON FUNCTION activate_loyalty_account(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION request_loyalty_redemption(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION activate_loyalty_account(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION request_loyalty_redemption(UUID, TEXT, INTEGER) TO service_role;
