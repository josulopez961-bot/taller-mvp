-- Unidad del odómetro por vehículo.
-- Por defecto todos los vehículos siguen usando kilómetros.
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS odometer_unit TEXT NOT NULL DEFAULT 'km'
  CHECK (odometer_unit IN ('km', 'mi'));

CREATE INDEX IF NOT EXISTS idx_vehicles_odometer_unit
  ON vehicles (odometer_unit);

UPDATE vehicles
SET odometer_unit = 'mi'
FROM customers
WHERE vehicles.customer_id = customers.id
  AND lower(customers.full_name) LIKE '%carlos%amaluisa%';
