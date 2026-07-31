-- Backdate each item's earliest price row so as-of lookups work for past
-- entry dates and UTC/Nairobi timezone skew (effective_from > entry_date
-- previously caused Food/Kuku prices to show as 0).

UPDATE item_prices ip
SET effective_from = DATE '2000-01-01'
WHERE ip.id IN (
  SELECT DISTINCT ON (item_id) id
  FROM item_prices
  ORDER BY item_id, effective_from ASC, id ASC
)
AND ip.effective_from > DATE '2000-01-01';
