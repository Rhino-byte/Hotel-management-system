-- Dated cost rates. A later change starts a new row and leaves earlier days alone.
-- Idempotent: migrations are reapplied as a set.

CREATE TABLE IF NOT EXISTS cost_setting_prices (
  id                          SERIAL PRIMARY KEY,
  cost_setting_id             INT NOT NULL REFERENCES cost_settings(id) ON DELETE CASCADE,
  purchase_price              NUMERIC(12, 2) NOT NULL,
  tea_cups_per_liter          NUMERIC(10, 2),
  white_coffee_cups_per_liter NUMERIC(10, 2),
  bags_per_week               NUMERIC(10, 2),
  cylinder_cost_per_month     NUMERIC(12, 2),
  effective_from              DATE NOT NULL,
  updated_by                  INT REFERENCES employee(id),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_setting_prices_as_of
  ON cost_setting_prices (cost_setting_id, effective_from DESC, id DESC);

INSERT INTO cost_setting_prices (
  cost_setting_id, purchase_price,
  tea_cups_per_liter, white_coffee_cups_per_liter,
  bags_per_week, cylinder_cost_per_month,
  effective_from
)
SELECT
  cs.id, cs.purchase_price,
  cs.tea_cups_per_liter, cs.white_coffee_cups_per_liter,
  cs.bags_per_week, cs.cylinder_cost_per_month,
  DATE '2000-01-01'
FROM cost_settings cs
WHERE NOT EXISTS (
  SELECT 1 FROM cost_setting_prices p
  WHERE p.cost_setting_id = cs.id
    AND p.effective_from = DATE '2000-01-01'
);
