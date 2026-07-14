"""Admin analytics aggregations for snacks, drinks, food, and kuku sales."""

from datetime import date
from typing import Any

from db.connection import get_conn

GROUP_LABELS = {
    "snacks": "Snacks",
    "drinks": "Drinks",
    "food": "Food",
    "kuku": "Kuku",
}

VALID_CATEGORIES = frozenset(GROUP_LABELS.keys())


def _empty_groups() -> list[dict[str, Any]]:
    return [
        {"key": key, "label": label, "sold_units": 0.0, "revenue": 0.0}
        for key, label in GROUP_LABELS.items()
    ]


def sales_totals(date_from: date, date_to: date) -> dict[str, Any]:
    groups = {g["key"]: g for g in _empty_groups()}

    with get_conn() as conn:
        snacks_rows = conn.execute(
            """
            SELECT i.subcategory AS category,
                   SUM(
                     GREATEST(
                       COALESCE(prev.closing_stock, 0)
                         + COALESCE(cur.added_stock, 0)
                         - cur.closing_stock,
                       0
                     )
                   ) AS sold_units,
                   SUM(
                     GREATEST(
                       COALESCE(prev.closing_stock, 0)
                         + COALESCE(cur.added_stock, 0)
                         - cur.closing_stock,
                       0
                     )
                     * COALESCE(
                       (SELECT ip.price_ksh FROM item_prices ip
                        WHERE ip.item_id = i.id
                        ORDER BY ip.effective_from DESC, ip.id DESC
                        LIMIT 1),
                       0
                     )
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
            GROUP BY i.subcategory
            """,
            (date_from, date_to),
        ).fetchall()

        for row in snacks_rows:
            key = row["category"]
            if key in groups:
                groups[key]["sold_units"] = float(row["sold_units"] or 0)
                groups[key]["revenue"] = float(row["revenue"] or 0)

        food_rows = conn.execute(
            """
            SELECT
              CASE
                WHEN LOWER(i.name) LIKE '%%kuku%%' THEN 'kuku'
                ELSE 'food'
              END AS category,
              SUM(COALESCE(f.quantity, 0)) AS sold_units,
              SUM(
                COALESCE(f.quantity, 0)
                * COALESCE(
                  (SELECT ip.price_ksh FROM item_prices ip
                   WHERE ip.item_id = i.id
                   ORDER BY ip.effective_from DESC, ip.id DESC
                   LIMIT 1),
                  0
                )
              ) AS revenue
            FROM food_kuku_daily f
            JOIN items i ON i.id = f.item_id
            WHERE f.entry_date BETWEEN %s AND %s
              AND i.group_type = 'food_kuku'
              AND COALESCE(f.quantity, 0) > 0
            GROUP BY 1
            """,
            (date_from, date_to),
        ).fetchall()

        for row in food_rows:
            key = row["category"]
            if key in groups:
                groups[key]["sold_units"] = float(row["sold_units"] or 0)
                groups[key]["revenue"] = float(row["revenue"] or 0)

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "groups": list(groups.values()),
    }


def items_sold(category: str, entry_date: date) -> dict[str, Any]:
    if category not in VALID_CATEGORIES:
        raise ValueError(f"Invalid category: {category}")

    with get_conn() as conn:
        if category in ("snacks", "drinks"):
            rows = conn.execute(
                """
                SELECT i.id AS item_id, i.name,
                       GREATEST(
                         COALESCE(prev.closing_stock, 0)
                           + COALESCE(cur.added_stock, 0)
                           - cur.closing_stock,
                         0
                       ) AS sold_units,
                       GREATEST(
                         COALESCE(prev.closing_stock, 0)
                           + COALESCE(cur.added_stock, 0)
                           - cur.closing_stock,
                         0
                       )
                       * COALESCE(
                         (SELECT ip.price_ksh FROM item_prices ip
                          WHERE ip.item_id = i.id
                          ORDER BY ip.effective_from DESC, ip.id DESC
                          LIMIT 1),
                         0
                       ) AS revenue
                FROM snacks_drinks_daily cur
                JOIN items i ON i.id = cur.item_id
                LEFT JOIN snacks_drinks_daily prev
                  ON prev.item_id = cur.item_id
                 AND prev.entry_date = (cur.entry_date - INTERVAL '1 day')::date
                WHERE cur.entry_date = %s
                  AND cur.closing_stock IS NOT NULL
                  AND i.group_type = 'snacks_drinks'
                  AND i.subcategory = %s
                  AND GREATEST(
                        COALESCE(prev.closing_stock, 0)
                          + COALESCE(cur.added_stock, 0)
                          - cur.closing_stock,
                        0
                      ) > 1
                ORDER BY sold_units DESC, i.name
                """,
                (entry_date, category),
            ).fetchall()
        else:
            kuku_filter = (
                "AND LOWER(i.name) LIKE '%%kuku%%'"
                if category == "kuku"
                else "AND LOWER(i.name) NOT LIKE '%%kuku%%'"
            )
            rows = conn.execute(
                f"""
                SELECT i.id AS item_id, i.name,
                       COALESCE(f.quantity, 0) AS sold_units,
                       COALESCE(f.quantity, 0)
                       * COALESCE(
                         (SELECT ip.price_ksh FROM item_prices ip
                          WHERE ip.item_id = i.id
                          ORDER BY ip.effective_from DESC, ip.id DESC
                          LIMIT 1),
                         0
                       ) AS revenue
                FROM food_kuku_daily f
                JOIN items i ON i.id = f.item_id
                WHERE f.entry_date = %s
                  AND i.group_type = 'food_kuku'
                  AND COALESCE(f.quantity, 0) > 1
                  {kuku_filter}
                ORDER BY sold_units DESC, i.name
                """,
                (entry_date,),
            ).fetchall()

        items = [
            {
                "item_id": int(r["item_id"]),
                "name": r["name"],
                "sold_units": float(r["sold_units"] or 0),
                "revenue": float(r["revenue"] or 0),
            }
            for r in rows
        ]

    return {
        "category": category,
        "date": str(entry_date),
        "items": items,
    }
