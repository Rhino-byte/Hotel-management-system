CREATE TABLE IF NOT EXISTS food_kuku_day_lock (
  entry_date   DATE PRIMARY KEY,
  locked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by    INT REFERENCES employee(id)
);
