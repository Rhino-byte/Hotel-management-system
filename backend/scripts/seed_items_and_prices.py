#!/usr/bin/env python3
"""Seed items and prices from core.catalog into Neon."""

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

env_path = BACKEND_ROOT / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

from core.catalog import (  # noqa: E402
    BAR_ITEMS,
    FOOD_KUKU_CATEGORIES,
    ITEM_PRICES,
    SNACKS_DRINKS_CATEGORIES,
    STOCK_STARTER_ITEMS,
)
from db.connection import get_conn  # noqa: E402
from db.items import upsert_catalog_item  # noqa: E402


def main() -> None:
    count = 0
    for category, items in ITEM_PRICES.items():
        if category in SNACKS_DRINKS_CATEGORIES:
            group = "snacks_drinks"
        elif category in FOOD_KUKU_CATEGORIES:
            group = "food_kuku"
        else:
            continue
        for name, price in items.items():
            upsert_catalog_item(group, name, float(price))
            count += 1
            print(f"  {group}: {name} @ {price}")

    for name in STOCK_STARTER_ITEMS:
        upsert_catalog_item("stock", name, 0.0)
        count += 1
        print(f"  stock: {name}")

    for order, (name, price) in enumerate(BAR_ITEMS, start=1):
        upsert_catalog_item("bar", name, float(price), display_order=order)
        count += 1
        print(f"  bar [{order}]: {name} @ {price}")

    with get_conn() as conn:
        totals = conn.execute(
            """
            SELECT group_type, COUNT(*) AS n
            FROM items WHERE is_active = TRUE
            GROUP BY group_type ORDER BY group_type
            """
        ).fetchall()
    print(f"\nSeeded/updated {count} catalog entries.")
    print("Active items by group:")
    for row in totals:
        print(f"  {row['group_type']}: {row['n']}")


if __name__ == "__main__":
    main()
