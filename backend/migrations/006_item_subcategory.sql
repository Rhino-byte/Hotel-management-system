-- Snacks vs drinks subcategory on catalog items (snacks_drinks group only).

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS subcategory TEXT
  CHECK (subcategory IS NULL OR subcategory IN ('snacks', 'drinks'));

UPDATE items SET subcategory = 'snacks'
WHERE group_type = 'snacks_drinks'
  AND name IN (
    'chapo', 'Ndazi', 'Tm', 'cake', 'Hcake', 'Eggs', 'Omelet', 'Sausage/Smokie'
  );

UPDATE items SET subcategory = 'drinks'
WHERE group_type = 'snacks_drinks'
  AND name IN (
    'Tea', 'BlackCoffee', 'WhiteCofee', 'LemonTea', 'Concusion', 'Predator',
    'Soda', 'PlasticSoda', 'Dasani_.5ltr', 'Dasani_1ltr', 'Water_.5ltr',
    'Water_1ltr', 'MinuteMaid'
  );

DO $$ BEGIN
  ALTER TABLE items ADD CONSTRAINT items_snacks_drinks_subcategory
    CHECK (group_type <> 'snacks_drinks' OR subcategory IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
