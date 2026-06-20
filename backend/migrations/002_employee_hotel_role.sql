-- Hotel-specific roles on employee (payroll role enum unchanged).

DO $$ BEGIN
  CREATE TYPE hotel_role AS ENUM ('snacks_clerk', 'food_clerk', 'stock_clerk', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE employee
  ADD COLUMN IF NOT EXISTS hotel_role hotel_role NULL;
