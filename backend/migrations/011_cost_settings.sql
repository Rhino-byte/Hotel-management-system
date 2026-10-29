-- Cost settings for the Stock Items dashboard.
-- Idempotent: migrations are reapplied as a set.

CREATE TABLE IF NOT EXISTS cost_settings (
  id                          SERIAL PRIMARY KEY,
  name                        TEXT NOT NULL UNIQUE,
  category                    TEXT NOT NULL
    CHECK (category IN ('snacks', 'drinks', 'food', 'kuku')),
  data_source                 TEXT NOT NULL
    CHECK (data_source IN ('hotel_sold', 'store_stock_out', 'recipe_milk', 'policy_rate')),
  purchase_price              NUMERIC(12, 2) NOT NULL DEFAULT 0,
  hotel_item_name             TEXT,
  store_item_name             TEXT,
  tea_cups_per_liter          NUMERIC(10, 2),
  white_coffee_cups_per_liter NUMERIC(10, 2),
  bags_per_week               NUMERIC(10, 2),
  cylinder_cost_per_month     NUMERIC(12, 2),
  display_order               INT NOT NULL DEFAULT 0,
  updated_by                  INT REFERENCES employee(id),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cost_settings (
  name, category, data_source, purchase_price,
  hotel_item_name, store_item_name,
  tea_cups_per_liter, white_coffee_cups_per_liter,
  bags_per_week, cylinder_cost_per_month, display_order
) VALUES
  ('Baking Flour', 'snacks', 'store_stock_out', 180, NULL, 'Baking Flour', NULL, NULL, NULL, NULL, 10),
  ('Cooking Fat', 'snacks', 'store_stock_out', 252, NULL, 'Cooking Fat', NULL, NULL, NULL, NULL, 20),
  ('Baking powder', 'snacks', 'store_stock_out', 25, NULL, 'Baking powder', NULL, NULL, NULL, NULL, 30),
  ('Eggs', 'snacks', 'store_stock_out', 20, 'Eggs', 'Eggs', NULL, NULL, NULL, NULL, 40),
  ('Sugar', 'drinks', 'store_stock_out', 126, NULL, 'Sugar', NULL, NULL, NULL, NULL, 50),
  ('Nescafe', 'drinks', 'store_stock_out', 10, NULL, 'Nescafe', NULL, NULL, NULL, NULL, 60),
  ('Tea leaves', 'drinks', 'store_stock_out', 200, NULL, 'Tea leaves', NULL, NULL, NULL, NULL, 70),
  ('Milk', 'drinks', 'recipe_milk', 60, NULL, 'Milk', 6, 3, NULL, NULL, 80),
  ('Water 1 ltr', 'drinks', 'hotel_sold', 35, 'Water_1ltr', 'Water 1 ltr', NULL, NULL, NULL, NULL, 90),
  ('Water 500ml', 'drinks', 'hotel_sold', 18, 'Water_.5ltr', 'Water 500ml', NULL, NULL, NULL, NULL, 100),
  ('Predator', 'drinks', 'hotel_sold', 55, 'Predator', NULL, NULL, NULL, NULL, NULL, 110),
  ('Soda', 'drinks', 'hotel_sold', 33, 'Soda', NULL, NULL, NULL, NULL, NULL, 120),
  ('Minute Maid', 'drinks', 'hotel_sold', 71, 'MinuteMaid', NULL, NULL, NULL, NULL, NULL, 130),
  ('Dasani 1 ltr', 'drinks', 'hotel_sold', 28, 'Dasani_1ltr', NULL, NULL, NULL, NULL, NULL, 140),
  ('Dasani 500ml', 'drinks', 'hotel_sold', 49, 'Dasani_.5ltr', NULL, NULL, NULL, NULL, NULL, 150),
  ('Lemonade', 'drinks', 'hotel_sold', 35, 'Lemonade', NULL, NULL, NULL, NULL, NULL, 160),
  ('Gas', 'drinks', 'policy_rate', 9000, NULL, NULL, NULL, NULL, NULL, 9000, 170),
  ('Maize Flour', 'food', 'store_stock_out', 150, NULL, 'Maize Flour', NULL, NULL, NULL, NULL, 180),
  ('Cooking Oil', 'food', 'store_stock_out', 261, NULL, 'Cooking Oil', NULL, NULL, NULL, NULL, 190),
  ('Rice', 'food', 'store_stock_out', 130, NULL, 'Rice', NULL, NULL, NULL, NULL, 200),
  ('Matumbo', 'food', 'store_stock_out', 200, NULL, 'Matumbo', NULL, NULL, NULL, NULL, 210),
  ('Meat', 'food', 'store_stock_out', 600, NULL, 'Meat', NULL, NULL, NULL, NULL, 220),
  ('Cabbage', 'food', 'store_stock_out', 70, NULL, 'Cabbage', NULL, NULL, NULL, NULL, 230),
  ('Tomatoes', 'food', 'store_stock_out', 10, NULL, 'Tomatoes', NULL, NULL, NULL, NULL, 240),
  ('Onions', 'food', 'store_stock_out', 10, NULL, 'Onions', NULL, NULL, NULL, NULL, 250),
  ('Managu', 'food', 'store_stock_out', 200, NULL, 'Managu', NULL, NULL, NULL, NULL, 260),
  ('Salt', 'food', 'store_stock_out', 100, NULL, 'Salt', NULL, NULL, NULL, NULL, 270),
  ('Carrots', 'food', 'store_stock_out', 3, NULL, 'Carrots', NULL, NULL, NULL, NULL, 280),
  ('Minji', 'food', 'store_stock_out', 100, NULL, 'Minji', NULL, NULL, NULL, NULL, 290),
  ('Beans', 'food', 'store_stock_out', 50, NULL, 'Beans', NULL, NULL, NULL, NULL, 300),
  ('Matchbox', 'food', 'store_stock_out', 5, NULL, 'Matchbox', NULL, NULL, NULL, NULL, 310),
  ('Makaa', 'food', 'policy_rate', 1000, NULL, 'Makaa', NULL, NULL, 3, NULL, 320),
  ('Kuku', 'kuku', 'store_stock_out', 1100, NULL, 'Kuku', NULL, NULL, NULL, NULL, 330)
ON CONFLICT (name) DO NOTHING;
