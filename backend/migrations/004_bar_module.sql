-- Bar clerk module: catalog group, role, display order, daily stock table.

DO $$ BEGIN
  ALTER TYPE item_group ADD VALUE 'bar';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE hotel_role ADD VALUE 'bar_clerk';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS bar_daily (
  id            SERIAL PRIMARY KEY,
  entry_date    DATE NOT NULL,
  item_id       INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  added_stock   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  closing_stock NUMERIC(10, 2) NOT NULL DEFAULT 0,
  submitted_by  INT REFERENCES employee(id),
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_date, item_id)
);

CREATE INDEX IF NOT EXISTS idx_bar_daily_date ON bar_daily(entry_date);
