"""Live cost and profit for a hotel date range.

Revenue reuses the snacks, drinks, food, and kuku sold formulas. Cost uses the
rate snapshot in effect on each day. Store quantities come from the store database.
"""

from __future__ import annotations

import calendar
from datetime import date, timedelta
from typing import Any, Optional

from db.connection import get_conn
from db.store import load_movements, name_key

TEA_ITEM = "tea"
WHITE_COFFEE_ITEM = "whitecofee"
QTY_TOLERANCE = 0.001

CATEGORIES = ("snacks", "drinks", "food", "kuku")
CATEGORY_LABELS = {
    "snacks": "Snacks",
    "drinks": "Drinks",
    "food": "Food",
    "kuku": "Kuku",
}

_PRICE_FOR_DAY = """
COALESCE(
  (SELECT ip.price_ksh FROM item_prices ip
   WHERE ip.item_id = i.id
     AND ip.effective_from <= {day}
   ORDER BY ip.effective_from DESC, ip.id DESC
   LIMIT 1),
  (SELECT ip.price_ksh FROM item_prices ip
   WHERE ip.item_id = i.id
   ORDER BY ip.effective_from ASC, ip.id ASC
   LIMIT 1),
  0
)
"""


def _round(value: float) -> float:
    return round(float(value), 2)


def _qty_text(value: float) -> str:
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return text or "0"


def _iter_days(start: date, end: date):
    cursor = start
    while cursor <= end:
        yield cursor
        cursor += timedelta(days=1)


def _weeks_touching(start: date, end: date) -> list[tuple[date, date]]:
    weeks: list[tuple[date, date]] = []
    seen: set[date] = set()
    for day in _iter_days(start, end):
        monday = day - timedelta(days=day.weekday())
        if monday in seen:
            continue
        seen.add(monday)
        weeks.append((monday, monday + timedelta(days=6)))
    return weeks


def _months_touching(start: date, end: date) -> list[tuple[date, date]]:
    months: list[tuple[date, date]] = []
    seen: set[date] = set()
    for day in _iter_days(start, end):
        month_start = day.replace(day=1)
        if month_start in seen:
            continue
        seen.add(month_start)
        last = calendar.monthrange(day.year, day.month)[1]
        months.append((month_start, day.replace(day=last)))
    return months


def _store_span(start: date, end: date) -> tuple[date, date]:
    span_from, span_to = start, end
    for week_start, week_end in _weeks_touching(start, end):
        span_from = min(span_from, week_start)
        span_to = max(span_to, week_end)
    for month_start, month_end in _months_touching(start, end):
        span_from = min(span_from, month_start)
        span_to = max(span_to, month_end)
    return span_from, span_to


def _load_hotel(date_from: date, date_to: date) -> dict[str, Any]:
    snack_price = _PRICE_FOR_DAY.format(day="cur.entry_date")
    food_price = _PRICE_FOR_DAY.format(day="f.entry_date")
    with get_conn() as conn:
        snack_locks = {
            row["entry_date"]
            for row in conn.execute(
                """
                SELECT entry_date FROM snacks_drinks_day_lock
                WHERE entry_date BETWEEN %s AND %s
                """,
                (date_from, date_to),
            ).fetchall()
        }
        food_locks = {
            row["entry_date"]
            for row in conn.execute(
                """
                SELECT entry_date FROM food_kuku_day_lock
                WHERE entry_date BETWEEN %s AND %s
                """,
                (date_from, date_to),
            ).fetchall()
        }
        snack_closings = {
            row["entry_date"]
            for row in conn.execute(
                """
                SELECT DISTINCT entry_date
                FROM snacks_drinks_daily
                WHERE entry_date BETWEEN %s AND %s
                  AND closing_stock IS NOT NULL
                """,
                (date_from, date_to),
            ).fetchall()
        }
        food_entries = {
            row["entry_date"]
            for row in conn.execute(
                """
                SELECT DISTINCT entry_date
                FROM food_kuku_daily
                WHERE entry_date BETWEEN %s AND %s
                """,
                (date_from, date_to),
            ).fetchall()
        }
        snack_rows = conn.execute(
            f"""
            SELECT cur.entry_date AS day,
                   i.name AS item_name,
                   cur.closing_stock IS NOT NULL AS has_closing,
                   COALESCE(cur.added_stock, 0) AS added_stock,
                   CASE
                     WHEN cur.closing_stock IS NULL THEN NULL
                     ELSE GREATEST(
                       COALESCE(prev.closing_stock, 0)
                         + COALESCE(cur.added_stock, 0)
                         - cur.closing_stock,
                       0
                     )
                   END AS sold_units
            FROM snacks_drinks_daily cur
            JOIN items i ON i.id = cur.item_id
            LEFT JOIN snacks_drinks_daily prev
              ON prev.item_id = cur.item_id
             AND prev.entry_date = (cur.entry_date - INTERVAL '1 day')::date
            WHERE cur.entry_date BETWEEN %s AND %s
              AND i.group_type = 'snacks_drinks'
            """,
            (date_from, date_to),
        ).fetchall()
        food_rows = conn.execute(
            """
            SELECT f.entry_date AS day,
                   i.name AS item_name,
                   COALESCE(f.quantity, 0) AS sold_units
            FROM food_kuku_daily f
            JOIN items i ON i.id = f.item_id
            WHERE f.entry_date BETWEEN %s AND %s
              AND i.group_type = 'food_kuku'
            """,
            (date_from, date_to),
        ).fetchall()
        item_rows = conn.execute(
            """
            SELECT name, group_type
            FROM items
            WHERE group_type IN ('snacks_drinks', 'food_kuku')
            """
        ).fetchall()
        snack_revenue = conn.execute(
            f"""
            SELECT cur.entry_date AS day,
                   i.subcategory AS category,
                   SUM(
                     GREATEST(
                       COALESCE(prev.closing_stock, 0)
                         + COALESCE(cur.added_stock, 0)
                         - cur.closing_stock,
                       0
                     ) * ({snack_price})
                   ) AS revenue
            FROM snacks_drinks_daily cur
            JOIN items i ON i.id = cur.item_id
            LEFT JOIN snacks_drinks_daily prev
              ON prev.item_id = cur.item_id
             AND prev.entry_date = (cur.entry_date - INTERVAL '1 day')::date
            WHERE cur.entry_date BETWEEN %s AND %s
              AND cur.closing_stock IS NOT NULL
              AND i.group_type = 'snacks_drinks'
              AND i.subcategory IN ('snacks', 'drinks')
            GROUP BY 1, 2
            """,
            (date_from, date_to),
        ).fetchall()
        food_revenue = conn.execute(
            f"""
            SELECT f.entry_date AS day,
                   CASE
                     WHEN LOWER(i.name) LIKE '%%kuku%%' THEN 'kuku'
                     ELSE 'food'
                   END AS category,
                   SUM(COALESCE(f.quantity, 0) * ({food_price})) AS revenue
            FROM food_kuku_daily f
            JOIN items i ON i.id = f.item_id
            WHERE f.entry_date BETWEEN %s AND %s
              AND i.group_type = 'food_kuku'
              AND COALESCE(f.quantity, 0) > 0
            GROUP BY 1, 2
            """,
            (date_from, date_to),
        ).fetchall()
        settings = conn.execute(
            """
            SELECT id, name, category, data_source, purchase_price,
                   hotel_item_name, store_item_name,
                   tea_cups_per_liter, white_coffee_cups_per_liter,
                   bags_per_week, cylinder_cost_per_month
            FROM cost_settings
            ORDER BY display_order, name
            """
        ).fetchall()
        rate_rows = conn.execute(
            """
            SELECT cost_setting_id, purchase_price,
                   tea_cups_per_liter, white_coffee_cups_per_liter,
                   bags_per_week, cylinder_cost_per_month,
                   effective_from
            FROM cost_setting_prices
            ORDER BY cost_setting_id, effective_from ASC, id ASC
            """
        ).fetchall()

    snacks: dict[tuple[date, str], dict[str, Any]] = {}
    for row in snack_rows:
        snacks[(row["day"], name_key(row["item_name"]))] = {
            "sold": None if row["sold_units"] is None else float(row["sold_units"]),
            "added": float(row["added_stock"] or 0),
            "has_closing": bool(row["has_closing"]),
        }
    foods: dict[tuple[date, str], float] = {}
    for row in food_rows:
        foods[(row["day"], name_key(row["item_name"]))] = float(row["sold_units"] or 0)
    item_groups = {name_key(row["name"]): row["group_type"] for row in item_rows}
    revenue: dict[date, dict[str, float]] = {}
    for row in list(snack_revenue) + list(food_revenue):
        day_bucket = revenue.setdefault(row["day"], {})
        category = row["category"]
        if category in CATEGORY_LABELS:
            day_bucket[category] = day_bucket.get(category, 0.0) + float(row["revenue"] or 0)

    rates: dict[int, list[dict[str, Any]]] = {}
    for row in rate_rows:
        rates.setdefault(int(row["cost_setting_id"]), []).append(_clean_rate(dict(row)))

    return {
        "snack_days": snack_locks | snack_closings,
        "food_days": food_locks | food_entries,
        "snacks": snacks,
        "foods": foods,
        "item_groups": item_groups,
        "revenue": revenue,
        "settings": [dict(row) for row in settings],
        "rates": rates,
    }


def _hotel_sold_on(hotel: dict[str, Any], day: date, item_key: str) -> Optional[float]:
    group = hotel["item_groups"].get(item_key)
    snack = hotel["snacks"].get((day, item_key))
    food = hotel["foods"].get((day, item_key))
    if group == "food_kuku" or (group is None and food is not None and snack is None):
        if day not in hotel["food_days"]:
            return None
        return food if food is not None else 0.0
    if day not in hotel["snack_days"]:
        return None
    if snack is None:
        return 0.0
    if not snack["has_closing"]:
        return None
    return float(snack["sold"] or 0)


def _added_on(hotel: dict[str, Any], day: date, item_key: str) -> Optional[float]:
    if day not in hotel["snack_days"]:
        return None
    snack = hotel["snacks"].get((day, item_key))
    if snack is None:
        return 0.0
    return float(snack["added"])


def _store_ready(store: dict[str, Any], day: date) -> bool:
    return store["status"] == "ok" and day in store["days_present"]


def _kitchen_on(store: dict[str, Any], item_key: str, day: date) -> float:
    return float(store["kitchen_out"].get((day, item_key), 0.0))


def _side_totals(
    store: dict[str, Any], item_key: str, start: date, end: date
) -> tuple[dict[str, float], float]:
    other: dict[str, float] = {}
    correction_in = 0.0
    if not item_key or store["status"] != "ok":
        return other, correction_in
    for (day, key, label), qty in store["other_out"].items():
        if key == item_key and start <= day <= end:
            other[label] = other.get(label, 0.0) + float(qty)
    for (day, key), qty in store["correction_in"].items():
        if key == item_key and start <= day <= end:
            correction_in += float(qty)
    return other, correction_in


def _clean_rate(row: dict[str, Any]) -> dict[str, Any]:
    def optional(field: str) -> Optional[float]:
        value = row.get(field)
        return None if value is None else float(value)

    return {
        "effective_from": row["effective_from"],
        "purchase_price": float(row.get("purchase_price") or 0),
        "tea_cups_per_liter": optional("tea_cups_per_liter"),
        "white_coffee_cups_per_liter": optional("white_coffee_cups_per_liter"),
        "bags_per_week": optional("bags_per_week"),
        "cylinder_cost_per_month": optional("cylinder_cost_per_month"),
    }


def _fallback_rate(setting: dict[str, Any]) -> dict[str, Any]:
    return _clean_rate(
        {
            "effective_from": date(2000, 1, 1),
            "purchase_price": setting.get("purchase_price") or 0,
            "tea_cups_per_liter": setting.get("tea_cups_per_liter"),
            "white_coffee_cups_per_liter": setting.get("white_coffee_cups_per_liter"),
            "bags_per_week": setting.get("bags_per_week"),
            "cylinder_cost_per_month": setting.get("cylinder_cost_per_month"),
        }
    )


def _rate_on(
    rates: dict[int, list[dict[str, Any]]],
    setting: dict[str, Any],
    day: date,
) -> dict[str, Any]:
    rows = rates.get(int(setting["id"])) or [_fallback_rate(setting)]
    chosen = None
    for row in rows:
        if row["effective_from"] <= day:
            chosen = row
        else:
            break
    return chosen or rows[0]


def _uniform_rate(values: list[Optional[float]]) -> Optional[float]:
    if not values:
        return None
    first = values[0]
    for value in values[1:]:
        if first is None or value is None or round(float(first), 2) != round(float(value), 2):
            return None
    return None if first is None else float(first)


def _span(values: list[Optional[float]]) -> tuple[Optional[float], str]:
    ready = [value for value in values if value is not None]
    if not ready:
        return None, "waiting"
    status = "waiting" if len(ready) != len(values) else "ready"
    return sum(ready), status


def _apply_day_cost(day_costs: dict[date, float], day: date, amount: float) -> None:
    day_costs[day] = day_costs.get(day, 0.0) + amount


def _hotel_sold_line(
    setting: dict[str, Any],
    hotel: dict[str, Any],
    days: list[date],
    day_costs: dict[date, float],
    rates: dict[int, list[dict[str, Any]]],
) -> tuple[Optional[float], Optional[float], str, Optional[float]]:
    item_key = name_key(setting.get("hotel_item_name"))
    prices: list[Optional[float]] = []
    quantities: list[Optional[float]] = []
    cost_total = 0.0
    any_ready = False
    for day in days:
        price = float(_rate_on(rates, setting, day)["purchase_price"])
        prices.append(price)
        if not item_key:
            quantities.append(None)
            continue
        sold = _hotel_sold_on(hotel, day, item_key)
        quantities.append(sold)
        if sold is None:
            continue
        any_ready = True
        amount = sold * price
        cost_total += amount
        _apply_day_cost(day_costs, day, amount)
    quantity, status = _span(quantities)
    return quantity, cost_total if any_ready else None, status, _uniform_rate(prices)


def _store_line(
    setting: dict[str, Any],
    store: dict[str, Any],
    days: list[date],
    day_costs: dict[date, float],
    rates: dict[int, list[dict[str, Any]]],
) -> tuple[Optional[float], Optional[float], str, Optional[float]]:
    item_key = name_key(setting.get("store_item_name"))
    prices: list[Optional[float]] = []
    quantities: list[Optional[float]] = []
    cost_total = 0.0
    any_ready = False
    store_ok = bool(item_key) and store["status"] == "ok"
    for day in days:
        price = float(_rate_on(rates, setting, day)["purchase_price"])
        prices.append(price)
        if not store_ok or not _store_ready(store, day):
            quantities.append(None)
            continue
        qty = _kitchen_on(store, item_key, day)
        quantities.append(qty)
        any_ready = True
        amount = qty * price
        cost_total += amount
        _apply_day_cost(day_costs, day, amount)
    quantity, status = _span(quantities)
    return quantity, cost_total if any_ready else None, status, _uniform_rate(prices)


def _milk_line(
    setting: dict[str, Any],
    hotel: dict[str, Any],
    days: list[date],
    day_costs: dict[date, float],
    rates: dict[int, list[dict[str, Any]]],
) -> tuple[Optional[float], Optional[float], str, Optional[float]]:
    prices: list[Optional[float]] = []
    quantities: list[Optional[float]] = []
    cost_total = 0.0
    any_ready = False
    for day in days:
        rate = _rate_on(rates, setting, day)
        price = float(rate["purchase_price"])
        prices.append(price)
        tea_rate = rate.get("tea_cups_per_liter")
        white_rate = rate.get("white_coffee_cups_per_liter")
        if (
            tea_rate is None
            or white_rate is None
            or float(tea_rate) <= 0
            or float(white_rate) <= 0
        ):
            quantities.append(None)
            continue
        tea = _hotel_sold_on(hotel, day, TEA_ITEM)
        white = _hotel_sold_on(hotel, day, WHITE_COFFEE_ITEM)
        if tea is None or white is None:
            quantities.append(None)
            continue
        liters = tea / float(tea_rate) + white / float(white_rate)
        quantities.append(liters)
        any_ready = True
        amount = liters * price
        cost_total += amount
        _apply_day_cost(day_costs, day, amount)
    quantity, status = _span(quantities)
    return quantity, cost_total if any_ready else None, status, _uniform_rate(prices)


def _policy_line(
    setting: dict[str, Any],
    days: list[date],
    day_costs: dict[date, float],
    rates: dict[int, list[dict[str, Any]]],
) -> tuple[Optional[float], Optional[float], str, Optional[float]]:
    prices: list[Optional[float]] = []
    shown: list[Optional[float]] = []
    quantities: list[Optional[float]] = []
    cost_total = 0.0
    any_ready = False
    kind: Optional[str] = None
    mixed = False
    for day in days:
        rate = _rate_on(rates, setting, day)
        price = float(rate["purchase_price"])
        prices.append(price)
        cylinder = rate.get("cylinder_cost_per_month")
        bags = rate.get("bags_per_week")
        if cylinder is not None:
            if kind not in (None, "cylinder"):
                mixed = True
            kind = "cylinder"
            days_in_month = calendar.monthrange(day.year, day.month)[1]
            share = 1.0 / days_in_month
            day_cost = float(cylinder) / days_in_month
            quantities.append(share)
            shown.append(float(cylinder))
            any_ready = True
            cost_total += day_cost
            _apply_day_cost(day_costs, day, day_cost)
        elif bags is not None:
            if kind not in (None, "price"):
                mixed = True
            kind = "price"
            daily_bags = float(bags) / 7.0
            day_cost = daily_bags * price
            quantities.append(daily_bags)
            shown.append(price)
            any_ready = True
            cost_total += day_cost
            _apply_day_cost(day_costs, day, day_cost)
        else:
            quantities.append(None)
            shown.append(None)
    quantity, status = _span(quantities)
    display = _uniform_rate(prices) if not any(value is not None for value in shown) else _uniform_rate(shown)
    if mixed:
        display = None
    return quantity, cost_total if any_ready else None, status, display


def _line_payload(
    setting: dict[str, Any],
    quantity: Optional[float],
    cost: Optional[float],
    status: str,
    purchase_price: Optional[float],
    other: dict[str, float],
    correction_in: float,
) -> dict[str, Any]:
    return {
        "id": int(setting["id"]),
        "name": setting["name"],
        "category": setting["category"],
        "data_source": setting["data_source"],
        "quantity": None if quantity is None else _round(quantity),
        "purchase_price": None if purchase_price is None else _round(purchase_price),
        "cost": None if cost is None else _round(cost),
        "status": status,
        "other_destinations": {
            label: _round(qty) for label, qty in sorted(other.items()) if abs(qty) > QTY_TOLERANCE
        },
        "correction_in": _round(correction_in),
    }


def _build_lines(
    settings: list[dict[str, Any]],
    hotel: dict[str, Any],
    store: dict[str, Any],
    days: list[date],
    day_costs: dict[date, float],
    rates: dict[int, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    lines = []
    for setting in settings:
        source = setting["data_source"]
        if source == "hotel_sold":
            quantity, cost, status, price = _hotel_sold_line(setting, hotel, days, day_costs, rates)
        elif source == "store_stock_out":
            quantity, cost, status, price = _store_line(setting, store, days, day_costs, rates)
        elif source == "recipe_milk":
            quantity, cost, status, price = _milk_line(setting, hotel, days, day_costs, rates)
        elif source == "policy_rate":
            quantity, cost, status, price = _policy_line(setting, days, day_costs, rates)
        else:
            quantity, cost, status, price = None, None, "waiting", _uniform_rate(
                [float(_rate_on(rates, setting, day)["purchase_price"]) for day in days]
            )
        other, correction_in = _side_totals(
            store, name_key(setting.get("store_item_name")), days[0], days[-1]
        )
        lines.append(_line_payload(setting, quantity, cost, status, price, other, correction_in))
    return lines


def _near(left: float, right: float) -> bool:
    return abs(left - right) <= QTY_TOLERANCE


def _water_checks(
    settings: list[dict[str, Any]],
    hotel: dict[str, Any],
    store: dict[str, Any],
    days: list[date],
) -> list[dict[str, Any]]:
    checks = []
    for setting in settings:
        if setting["data_source"] != "hotel_sold":
            continue
        hotel_key = name_key(setting.get("hotel_item_name"))
        store_key = name_key(setting.get("store_item_name"))
        if not hotel_key or not store_key:
            continue
        mismatches = []
        waiting = 0
        for day in days:
            added = _added_on(hotel, day, hotel_key)
            if store["status"] != "ok" or not _store_ready(store, day) or added is None:
                waiting += 1
                continue
            kitchen = _kitchen_on(store, store_key, day)
            if not _near(kitchen, added):
                mismatches.append(
                    f"{setting['name']} on {day.isoformat()}: store stock out {_qty_text(kitchen)} vs hotel Add {_qty_text(added)}."
                )
        if mismatches:
            checks.extend(
                {"kind": "water", "ok": False, "message": message} for message in mismatches
            )
        if waiting:
            checks.append(
                {
                    "kind": "water",
                    "ok": False,
                    "message": (
                        f"{setting['name']}: store stock out or hotel Add is waiting on {waiting} day"
                        f"{'' if waiting == 1 else 's'}."
                    ),
                }
            )
        if not mismatches and not waiting:
            checks.append(
                {
                    "kind": "water",
                    "ok": True,
                    "message": (
                        f"{setting['name']}: store stock out matched hotel Add on every day in this range."
                    ),
                }
            )
    return checks


def _week_is_gas(
    rates: dict[int, list[dict[str, Any]]],
    setting: dict[str, Any],
    week_start: date,
    week_end: date,
) -> bool:
    for day in _iter_days(week_start, week_end):
        if _rate_on(rates, setting, day).get("cylinder_cost_per_month") is None:
            return False
    return True


def _week_bag_rate(
    rates: dict[int, list[dict[str, Any]]],
    setting: dict[str, Any],
    week_start: date,
    week_end: date,
) -> Optional[float]:
    """Sum of each day's bags/7. None when the week is not a single makaa rate."""
    expected = 0.0
    for day in _iter_days(week_start, week_end):
        rate = _rate_on(rates, setting, day)
        if rate.get("cylinder_cost_per_month") is not None or rate.get("bags_per_week") is None:
            return None
        expected += float(rate["bags_per_week"]) / 7.0
    return expected


def _makaa_checks(
    settings: list[dict[str, Any]],
    store: dict[str, Any],
    date_from: date,
    date_to: date,
    rates: dict[int, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    checks = []
    for setting in settings:
        if setting["data_source"] != "policy_rate":
            continue
        store_key = name_key(setting.get("store_item_name"))
        if not store_key:
            continue
        for week_start, week_end in _weeks_touching(date_from, date_to):
            label = f"{week_start.isoformat()} to {week_end.isoformat()}"
            expected = _week_bag_rate(rates, setting, week_start, week_end)
            if expected is None:
                if _week_is_gas(rates, setting, week_start, week_end):
                    continue
                checks.append(
                    {
                        "kind": "makaa",
                        "ok": False,
                        "message": (
                            f"Makaa week {label}: the bag rate is missing for part of the week, "
                            "so the bag check is waiting."
                        ),
                    }
                )
                continue
            if store["status"] != "ok":
                checks.append(
                    {
                        "kind": "makaa",
                        "ok": False,
                        "message": (
                            f"Makaa week {label}: store log is unavailable, so the {_qty_text(expected)}-bag check is waiting."
                        ),
                    }
                )
                continue
            missing = [day for day in _iter_days(week_start, week_end) if day not in store["days_present"]]
            if missing:
                checks.append(
                    {
                        "kind": "makaa",
                        "ok": False,
                        "message": (
                            f"Makaa week {label}: store log is incomplete, so the {_qty_text(expected)}-bag check is waiting."
                        ),
                    }
                )
                continue
            total = sum(_kitchen_on(store, store_key, day) for day in _iter_days(week_start, week_end))
            checks.append(
                {
                    "kind": "makaa",
                    "ok": _near(total, expected),
                    "message": (
                        f"Makaa week {label}: stock out {_qty_text(total)} vs {_qty_text(expected)} bags."
                    ),
                }
            )
    return checks


def _gas_checks(
    settings: list[dict[str, Any]],
    store: dict[str, Any],
    date_from: date,
    date_to: date,
) -> list[dict[str, Any]]:
    checks = []
    for setting in settings:
        if setting["data_source"] != "policy_rate" or setting.get("cylinder_cost_per_month") is None:
            continue
        store_key = name_key(setting.get("store_item_name"))
        if not store_key:
            continue
        for month_start, month_end in _months_touching(date_from, date_to):
            label = month_start.strftime("%B %Y")
            if store["status"] != "ok":
                checks.append(
                    {
                        "kind": "gas",
                        "ok": False,
                        "message": f"Gas {label}: store log is unavailable, so the 1-cylinder check is waiting.",
                    }
                )
                continue
            missing = [day for day in _iter_days(month_start, month_end) if day not in store["days_present"]]
            if missing:
                checks.append(
                    {
                        "kind": "gas",
                        "ok": False,
                        "message": f"Gas {label}: store log is incomplete, so the 1-cylinder check is waiting.",
                    }
                )
                continue
            total = sum(_kitchen_on(store, store_key, day) for day in _iter_days(month_start, month_end))
            checks.append(
                {
                    "kind": "gas",
                    "ok": _near(total, 1),
                    "message": f"Gas {label}: stock out {_qty_text(total)} vs 1 cylinder.",
                }
            )
    return checks


def _duplicate_checks(settings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, set[str]] = {}
    labels: dict[str, str] = {}
    for setting in settings:
        store_name = setting.get("store_item_name")
        key = name_key(store_name)
        if not key:
            continue
        grouped.setdefault(key, set()).add(setting["category"])
        labels[key] = str(store_name).strip()
    checks = []
    for key, categories in grouped.items():
        if len(categories) < 2:
            continue
        names = ", ".join(CATEGORY_LABELS.get(category, category) for category in sorted(categories))
        checks.append(
            {
                "kind": "duplicate",
                "ok": False,
                "message": f"{labels[key]} appears on {names}.",
            }
        )
    return checks


def _incomplete_days(
    hotel: dict[str, Any], store: dict[str, Any], days: list[date]
) -> list[date]:
    missing = []
    for day in days:
        store_filled = store["status"] == "ok" and day in store["days_present"]
        if day not in hotel["snack_days"] or day not in hotel["food_days"] or not store_filled:
            missing.append(day)
    return missing


def cost_report(date_from: date, date_to: date) -> dict[str, Any]:
    days = list(_iter_days(date_from, date_to))
    hotel = _load_hotel(date_from, date_to)
    span_from, span_to = _store_span(date_from, date_to)
    store = load_movements(span_from, span_to)
    day_costs: dict[date, float] = {}
    rates = hotel["rates"]
    lines = _build_lines(hotel["settings"], hotel, store, days, day_costs, rates)

    groups = []
    for key in CATEGORIES:
        revenue = sum(hotel["revenue"].get(day, {}).get(key, 0.0) for day in days)
        cost = sum(
            float(line["cost"] or 0)
            for line in lines
            if line["category"] == key
        )
        complete = all(line["status"] == "ready" for line in lines if line["category"] == key)
        groups.append(
            {
                "key": key,
                "label": CATEGORY_LABELS[key],
                "revenue": _round(revenue),
                "cost": _round(cost),
                "profit": _round(revenue - cost),
                "cost_complete": complete,
            }
        )

    series = []
    for day in days:
        revenue = sum(hotel["revenue"].get(day, {}).values())
        series.append(
            {
                "day": day.isoformat(),
                "revenue": _round(revenue),
                "cost": _round(day_costs.get(day, 0.0)),
            }
        )

    incomplete = _incomplete_days(hotel, store, days)
    notes = []
    if store.get("note"):
        notes.append(str(store["note"]))
    if incomplete:
        notes.append(
            f"Sales are shown. Cost is waiting where a source is missing ({len(incomplete)} day"
            f"{'' if len(incomplete) == 1 else 's'})."
        )

    checks = []
    checks.extend(_water_checks(hotel["settings"], hotel, store, days))
    checks.extend(_makaa_checks(hotel["settings"], store, date_from, date_to, rates))
    checks.extend(_gas_checks(hotel["settings"], store, date_from, date_to))
    checks.extend(_duplicate_checks(hotel["settings"]))

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "status": "final" if not incomplete else "preliminary",
        "store_status": store["status"],
        "note": " ".join(notes) or None,
        "groups": groups,
        "days": series,
        "lines": lines,
        "checks": checks,
    }
