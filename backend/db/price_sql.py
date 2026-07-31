"""Shared SQL fragments for as-of item price lookups.

Food/kuku (and other modules) resolve prices with:
  effective_from <= entry_date

New price rows used to default to the DB session CURRENT_DATE (often UTC).
When that date is after the selected entry date (timezone skew or backdated
entry), the lookup returned NULL and COALESCE forced price to 0.

Fallback: if no as-of match exists, use the earliest known price for the item
so newly added dishes still show their catalog price on any entry date.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

HOTEL_TZ = ZoneInfo("Africa/Nairobi")

# First price for a brand-new dish applies from this date so any entry date works.
CATALOG_PRICE_EPOCH = date(2000, 1, 1)


def hotel_today() -> date:
    return datetime.now(HOTEL_TZ).date()


def price_as_of_expr(item_id_sql: str, as_of_sql: str) -> str:
    """SQL expression returning price_ksh (as-of, else earliest, else 0)."""
    return f"""COALESCE(
  (SELECT ip.price_ksh FROM item_prices ip
   WHERE ip.item_id = {item_id_sql}
     AND ip.effective_from <= {as_of_sql}
   ORDER BY ip.effective_from DESC, ip.id DESC
   LIMIT 1),
  (SELECT ip.price_ksh FROM item_prices ip
   WHERE ip.item_id = {item_id_sql}
   ORDER BY ip.effective_from ASC, ip.id ASC
   LIMIT 1),
  0
)"""
