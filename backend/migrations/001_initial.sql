-- Hotel tables integrate with existing Neon payroll schema.
-- Auth: user_auth (PIN) joined to employee on id.
-- FKs reference employee(id), not users.

DO $$ BEGIN
  CREATE TYPE item_group AS ENUM ('snacks_drinks', 'food_kuku', 'stock');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS items (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  group_type  item_group NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (group_type, name)
);

CREATE TABLE IF NOT EXISTS item_prices (
  id             SERIAL PRIMARY KEY,
  item_id        INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  price_ksh      NUMERIC(10, 2) NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_by     INT REFERENCES employee(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_prices_item_id ON item_prices(item_id);

CREATE TABLE IF NOT EXISTS snacks_drinks_daily (
  id            SERIAL PRIMARY KEY,
  entry_date    DATE NOT NULL,
  item_id       INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  closing_stock NUMERIC(10, 2) NOT NULL DEFAULT 0,
  added_stock   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  submitted_by  INT REFERENCES employee(id),
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_date, item_id)
);

CREATE TABLE IF NOT EXISTS food_kuku_daily (
  id           SERIAL PRIMARY KEY,
  entry_date   DATE NOT NULL,
  item_id      INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  submitted_by INT REFERENCES employee(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_date, item_id)
);

CREATE TABLE IF NOT EXISTS stock_items_daily (
  id            SERIAL PRIMARY KEY,
  entry_date    DATE NOT NULL,
  item_id       INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  closing_stock NUMERIC(10, 2) NOT NULL DEFAULT 0,
  added_stock   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  submitted_by  INT REFERENCES employee(id),
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_date, item_id)
);

CREATE TABLE IF NOT EXISTS inventory_audit_log (
  id          SERIAL PRIMARY KEY,
  table_name  TEXT NOT NULL,
  record_id   INT NOT NULL,
  item_id     INT REFERENCES items(id),
  entry_date  DATE,
  field_name  TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  changed_by  INT REFERENCES employee(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_table_date ON inventory_audit_log(table_name, entry_date);
CREATE INDEX IF NOT EXISTS idx_snacks_drinks_date ON snacks_drinks_daily(entry_date);
CREATE INDEX IF NOT EXISTS idx_food_kuku_date ON food_kuku_daily(entry_date);
CREATE INDEX IF NOT EXISTS idx_stock_items_date ON stock_items_daily(entry_date);
