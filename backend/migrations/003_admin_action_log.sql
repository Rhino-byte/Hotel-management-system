CREATE TABLE IF NOT EXISTS admin_action_log (
  id            SERIAL PRIMARY KEY,
  action_type   TEXT NOT NULL,
  target_type   TEXT,
  target_id     INT,
  details       JSONB,
  performed_by  INT NOT NULL REFERENCES employee(id),
  performed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_action_log_performed_at
  ON admin_action_log (performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_action_log_action_type
  ON admin_action_log (action_type);
