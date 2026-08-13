-- Enforce shared id: every user_auth row must reference an employee.
-- Run scripts/fix_auth_employee_orphans.py --apply first if orphans exist.

DO $$ BEGIN
  ALTER TABLE user_auth
    ADD CONSTRAINT user_auth_id_fkey
    FOREIGN KEY (id) REFERENCES employee(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
