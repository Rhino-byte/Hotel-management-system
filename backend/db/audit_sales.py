"""Question-driven sales audit aggregations."""

from datetime import date, timedelta
from typing import Any

from core.dish_rules import (
    CATEGORY_LABELS,
    CATEGORY_RULES,
    CHAPATIS_PER_DISH,
    classify,
    is_chapati_dish,
)
from db.connection import get_conn


def _date_keys(date_from: date, date_to: date) -> list[str]:
    days = (date_to - date_from).days
    return [str(date_from + timedelta(days=offset)) for offset in range(days + 1)]


def _food_rows(date_from: date, date_to: date) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT f.entry_date, i.id AS item_id, i.name AS item_name,
                   COALESCE(f.quantity, 0) AS quantity,
                   COALESCE(
                     (SELECT ip.price_ksh FROM item_prices ip
                      WHERE ip.item_id = i.id
                        AND ip.effective_from <= f.entry_date
                      ORDER BY ip.effective_from DESC, ip.id DESC
                      LIMIT 1),
                     (SELECT ip.price_ksh FROM item_prices ip
                      WHERE ip.item_id = i.id
                      ORDER BY ip.effective_from ASC, ip.id ASC
                      LIMIT 1),
                     0
                   ) AS price_ksh
            FROM food_kuku_daily f
            JOIN items i ON i.id = f.item_id
            WHERE f.entry_date BETWEEN %s AND %s
              AND i.group_type = 'food_kuku'
              AND COALESCE(f.quantity, 0) > 0
            ORDER BY f.entry_date, i.name
            """,
            (date_from, date_to),
        ).fetchall()
    return [dict(row) for row in rows]


def _snacks_rows(date_from: date, date_to: date) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT cur.entry_date, i.id AS item_id, i.name AS item_name,
                   i.subcategory,
                   COALESCE(prev.closing_stock, 0) AS opening_stock,
                   COALESCE(cur.added_stock, 0) AS added_stock,
                   cur.closing_stock,
                   COALESCE(
                     (SELECT ip.price_ksh FROM item_prices ip
                      WHERE ip.item_id = i.id
                        AND ip.effective_from <= cur.entry_date
                      ORDER BY ip.effective_from DESC, ip.id DESC
                      LIMIT 1),
                     (SELECT ip.price_ksh FROM item_prices ip
                      WHERE ip.item_id = i.id
                      ORDER BY ip.effective_from ASC, ip.id ASC
                      LIMIT 1),
                     0
                   ) AS price_ksh
            FROM snacks_drinks_daily cur
            JOIN items i ON i.id = cur.item_id
            LEFT JOIN snacks_drinks_daily prev
              ON prev.item_id = cur.item_id
             AND prev.entry_date = (cur.entry_date - INTERVAL '1 day')::date
            WHERE cur.entry_date BETWEEN %s AND %s
              AND cur.closing_stock IS NOT NULL
              AND i.group_type = 'snacks_drinks'
              AND i.subcategory IN ('snacks', 'drinks')
            ORDER BY cur.entry_date, i.name
            """,
            (date_from, date_to),
        ).fetchall()
    return [dict(row) for row in rows]


def sales_report(date_from: date, date_to: date) -> dict[str, Any]:
    """Build the complete sales-audit response for an inclusive date range."""
    food_rows = _food_rows(date_from, date_to)
    snacks_rows = _snacks_rows(date_from, date_to)

    category_totals = {
        key: {
            "key": key,
            "label": CATEGORY_LABELS[key],
            "plates": 0.0,
            "revenue": 0.0,
            "dishes": {},
        }
        for key in CATEGORY_RULES
    }
    timeseries = {
        day: {
            "entry_date": day,
            "snacks": 0.0,
            "drinks": 0.0,
            "food": 0.0,
            "kuku": 0.0,
            "total": 0.0,
        }
        for day in _date_keys(date_from, date_to)
    }

    chapati_dish_plates = 0.0
    for row in food_rows:
        item_id = int(row["item_id"])
        item_name = str(row["item_name"])
        entry_date = str(row["entry_date"])
        quantity = float(row["quantity"] or 0)
        revenue = quantity * float(row["price_ksh"] or 0)

        chart_group = "kuku" if "kuku" in item_name.casefold() else "food"
        timeseries[entry_date][chart_group] += revenue

        if is_chapati_dish(item_name):
            chapati_dish_plates += quantity

        for category_key in classify(item_name):
            category = category_totals[category_key]
            category["plates"] += quantity
            category["revenue"] += revenue
            dish = category["dishes"].setdefault(
                item_id,
                {
                    "item_id": item_id,
                    "item_name": item_name,
                    "plates": 0.0,
                    "revenue": 0.0,
                },
            )
            dish["plates"] += quantity
            dish["revenue"] += revenue

    snacks_added: list[dict[str, Any]] = []
    chapati_cooked = 0.0
    snack_totals: dict[int, dict[str, Any]] = {}

    for row in snacks_rows:
        item_id = int(row["item_id"])
        item_name = str(row["item_name"])
        entry_date = str(row["entry_date"])
        subcategory = str(row["subcategory"])
        opening = float(row["opening_stock"] or 0)
        added = float(row["added_stock"] or 0)
        closing = float(row["closing_stock"] or 0)
        sold = max(opening + added - closing, 0.0)
        revenue = sold * float(row["price_ksh"] or 0)

        timeseries[entry_date][subcategory] += revenue

        if subcategory == "snacks":
            if item_name.casefold() == "chapo":
                chapati_cooked += sold
            total = snack_totals.setdefault(
                item_id,
                {
                    "item_id": item_id,
                    "item_name": item_name,
                    "added": 0.0,
                    "sold": 0.0,
                    "revenue": 0.0,
                },
            )
            total["added"] += added
            total["sold"] += sold
            total["revenue"] += revenue
            if added > 0:
                snacks_added.append(
                    {
                        "item_id": item_id,
                        "item_name": item_name,
                        "entry_date": entry_date,
                        "added": added,
                        "sold": sold,
                        "revenue": revenue,
                    }
                )

    category_results = []
    for category in category_totals.values():
        dishes = sorted(
            category.pop("dishes").values(),
            key=lambda dish: (-dish["plates"], dish["item_name"].casefold()),
        )
        category["dishes"] = dishes
        category_results.append(category)

    for day in timeseries.values():
        day["total"] = day["snacks"] + day["drinks"] + day["food"] + day["kuku"]

    chapatis_used = chapati_dish_plates * CHAPATIS_PER_DISH
    utilisation_pct = (chapatis_used / chapati_cooked * 100) if chapati_cooked else 0.0

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "categories": category_results,
        "chapati": {
            "cooked": chapati_cooked,
            "dish_plates": chapati_dish_plates,
            "chapatis_used": chapatis_used,
            "pct": utilisation_pct,
        },
        "snacks_added": snacks_added,
        "snack_totals": sorted(
            snack_totals.values(), key=lambda row: row["item_name"].casefold()
        ),
        "timeseries": list(timeseries.values()),
    }
