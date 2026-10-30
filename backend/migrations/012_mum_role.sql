-- Management-only hotel role. Idempotent: migrations are reapplied as a set.

DO $$ BEGIN
  ALTER TYPE hotel_role ADD VALUE 'mum';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
