-- Remove zero-quantity food_kuku_daily rows (sparse storage: only qty > 0).

DELETE FROM food_kuku_daily WHERE quantity = 0;
