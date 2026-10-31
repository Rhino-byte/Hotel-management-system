from typing import Any, Optional

from db.connection import get_conn
from db.price_sql import CATALOG_PRICE_EPOCH, hotel_today
from db.store import list_item_names

CATEGORIES = ("snacks", "drinks", "food", "kuku")
DATA_SOURCES = ("hotel_sold", "store_stock_out", "recipe_milk", "policy_rate")

_NUMERIC_FIELDS = (
    "purchase_price",
    "tea_cups_per_liter",
    "white_coffee_cups_per_liter",
    "bags_per_week",
    "cylinder_cost_per_month",
)
_RATE_FIELDS = _NUMERIC_FIELDS


def _clean(row: dict[str, Any]) -> dict[str, Any]:
    out = dict(row)
    for field in _NUMERIC_FIELDS:
        if out.get(field) is not None:
            out[field] = float(out[field])
    if out.get("updated_at") is not None:
        out["updated_at"] = out["updated_at"].isoformat()
    return out


def _blank(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = value.strip()
    return text or None


def _saved_store_names(conn) -> list[str]:
    rows = conn.execute(
        """
        SELECT store_item_name AS name FROM cost_settings
        WHERE store_item_name IS NOT NULL AND btrim(store_item_name) <> ''
        """
    ).fetchall()
    return [row["name"] for row in rows]


def _hotel_store_names(conn) -> list[str]:
    rows = conn.execute(
        """
        SELECT name FROM (
          SELECT name FROM items
          WHERE is_active = TRUE AND group_type = 'stock'
          UNION
          SELECT store_item_name AS name FROM cost_settings
          WHERE store_item_name IS NOT NULL AND btrim(store_item_name) <> ''
        ) names
        ORDER BY name
        """
    ).fetchall()
    return [row["name"] for row in rows]


def _merged_store_names(store_names: list[str], saved_names: list[str]) -> list[str]:
    merged: dict[str, str] = {}
    for name in store_names:
        key = " ".join(name.strip().lower().split())
        if key and key not in merged:
            merged[key] = name
    for name in saved_names:
        key = " ".join(name.strip().lower().split())
        if key and key not in merged:
            merged[key] = name
    return [merged[key] for key in sorted(merged)]


def list_cost_settings() -> dict[str, Any]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, name, category, data_source, purchase_price,
                   hotel_item_name, store_item_name,
                   tea_cups_per_liter, white_coffee_cups_per_liter,
                   bags_per_week, cylinder_cost_per_month,
                   display_order, updated_at
            FROM cost_settings
            ORDER BY display_order, name
            """
        ).fetchall()
        hotel_rows = conn.execute(
            """
            SELECT name FROM items
            WHERE is_active = TRUE
              AND group_type IN ('snacks_drinks', 'food_kuku')
            ORDER BY name
            """
        ).fetchall()
        saved_store_names = _saved_store_names(conn)
        hotel_store_names = _hotel_store_names(conn)

    store_names = list_item_names()
    if store_names:
        store_items = _merged_store_names(store_names, saved_store_names)
    else:
        store_items = hotel_store_names
    return {
        "settings": [_clean(dict(row)) for row in rows],
        "hotel_items": [row["name"] for row in hotel_rows],
        "store_items": store_items,
    }


def _normalize(payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise ValueError("Item name is required")
    category = str(payload.get("category") or "")
    data_source = str(payload.get("data_source") or "")
    if category not in CATEGORIES:
        raise ValueError("Invalid category")
    if data_source not in DATA_SOURCES:
        raise ValueError("Invalid data source")
    purchase_price = float(payload.get("purchase_price") or 0)
    if purchase_price < 0:
        raise ValueError("Purchase price cannot be negative")

    def optional_number(field: str) -> Optional[float]:
        raw = payload.get(field)
        if raw is None or raw == "":
            return None
        value = float(raw)
        if value < 0:
            raise ValueError(f"{field} cannot be negative")
        return value

    return {
        "name": name,
        "category": category,
        "data_source": data_source,
        "purchase_price": purchase_price,
        "hotel_item_name": _blank(payload.get("hotel_item_name")),
        "store_item_name": _blank(payload.get("store_item_name")),
        "tea_cups_per_liter": optional_number("tea_cups_per_liter"),
        "white_coffee_cups_per_liter": optional_number("white_coffee_cups_per_liter"),
        "bags_per_week": optional_number("bags_per_week"),
        "cylinder_cost_per_month": optional_number("cylinder_cost_per_month"),
    }


def _rate_value(row: Optional[dict[str, Any]], field: str) -> Optional[float]:
    if row is None:
        return None
    value = row.get(field)
    if value is None:
        return None
    return round(float(value), 2)


def _rates_changed(previous: Optional[dict[str, Any]], fields: dict[str, Any]) -> bool:
    if previous is None:
        return True
    return any(_rate_value(previous, field) != _rate_value(fields, field) for field in _RATE_FIELDS)


def _insert_rate_snapshot(conn, setting_id: int, fields: dict[str, Any], effective_from, user_id: int) -> None:
    conn.execute(
        """
        INSERT INTO cost_setting_prices (
          cost_setting_id, purchase_price,
          tea_cups_per_liter, white_coffee_cups_per_liter,
          bags_per_week, cylinder_cost_per_month,
          effective_from, updated_by
        ) VALUES (
          %(cost_setting_id)s, %(purchase_price)s,
          %(tea_cups_per_liter)s, %(white_coffee_cups_per_liter)s,
          %(bags_per_week)s, %(cylinder_cost_per_month)s,
          %(effective_from)s, %(updated_by)s
        )
        """,
        {
            "cost_setting_id": setting_id,
            "purchase_price": fields["purchase_price"],
            "tea_cups_per_liter": fields["tea_cups_per_liter"],
            "white_coffee_cups_per_liter": fields["white_coffee_cups_per_liter"],
            "bags_per_week": fields["bags_per_week"],
            "cylinder_cost_per_month": fields["cylinder_cost_per_month"],
            "effective_from": effective_from,
            "updated_by": user_id,
        },
    )


def _latest_rate_snapshot(conn, setting_id: int) -> Optional[dict[str, Any]]:
    row = conn.execute(
        """
        SELECT purchase_price, tea_cups_per_liter, white_coffee_cups_per_liter,
               bags_per_week, cylinder_cost_per_month
        FROM cost_setting_prices
        WHERE cost_setting_id = %s
        ORDER BY effective_from DESC, id DESC
        LIMIT 1
        """,
        (setting_id,),
    ).fetchone()
    return None if row is None else dict(row)


def create_cost_setting(payload: dict[str, Any], user_id: int) -> dict[str, Any]:
    fields = _normalize(payload)
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM cost_settings WHERE lower(name) = lower(%s)",
            (fields["name"],),
        ).fetchone()
        if existing:
            raise ValueError("An item with this name already exists")
        order_row = conn.execute(
            "SELECT COALESCE(MAX(display_order), 0) + 10 AS next_order FROM cost_settings"
        ).fetchone()
        row = conn.execute(
            """
            INSERT INTO cost_settings (
              name, category, data_source, purchase_price,
              hotel_item_name, store_item_name,
              tea_cups_per_liter, white_coffee_cups_per_liter,
              bags_per_week, cylinder_cost_per_month,
              display_order, updated_by
            ) VALUES (
              %(name)s, %(category)s, %(data_source)s, %(purchase_price)s,
              %(hotel_item_name)s, %(store_item_name)s,
              %(tea_cups_per_liter)s, %(white_coffee_cups_per_liter)s,
              %(bags_per_week)s, %(cylinder_cost_per_month)s,
              %(display_order)s, %(updated_by)s
            )
            RETURNING id, name, category, data_source, purchase_price,
                      hotel_item_name, store_item_name,
                      tea_cups_per_liter, white_coffee_cups_per_liter,
                      bags_per_week, cylinder_cost_per_month,
                      display_order, updated_at
            """,
            {**fields, "display_order": int(order_row["next_order"]), "updated_by": user_id},
        ).fetchone()
        _insert_rate_snapshot(conn, int(row["id"]), fields, CATALOG_PRICE_EPOCH, user_id)
    return _clean(dict(row))


def update_cost_setting(setting_id: int, payload: dict[str, Any], user_id: int) -> dict[str, Any]:
    fields = _normalize(payload)
    with get_conn() as conn:
        clash = conn.execute(
            """
            SELECT id FROM cost_settings
            WHERE lower(name) = lower(%s) AND id <> %s
            """,
            (fields["name"], setting_id),
        ).fetchone()
        if clash:
            raise ValueError("An item with this name already exists")
        previous = _latest_rate_snapshot(conn, setting_id)
        row = conn.execute(
            """
            UPDATE cost_settings SET
              name = %(name)s,
              category = %(category)s,
              data_source = %(data_source)s,
              purchase_price = %(purchase_price)s,
              hotel_item_name = %(hotel_item_name)s,
              store_item_name = %(store_item_name)s,
              tea_cups_per_liter = %(tea_cups_per_liter)s,
              white_coffee_cups_per_liter = %(white_coffee_cups_per_liter)s,
              bags_per_week = %(bags_per_week)s,
              cylinder_cost_per_month = %(cylinder_cost_per_month)s,
              updated_by = %(updated_by)s,
              updated_at = NOW()
            WHERE id = %(id)s
            RETURNING id, name, category, data_source, purchase_price,
                      hotel_item_name, store_item_name,
                      tea_cups_per_liter, white_coffee_cups_per_liter,
                      bags_per_week, cylinder_cost_per_month,
                      display_order, updated_at
            """,
            {**fields, "updated_by": user_id, "id": setting_id},
        ).fetchone()
        if row is None:
            raise LookupError("Cost setting not found")
        if _rates_changed(previous, fields):
            _insert_rate_snapshot(conn, setting_id, fields, hotel_today(), user_id)
    return _clean(dict(row))
