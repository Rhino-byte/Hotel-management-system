from typing import Any, Optional

from db.connection import get_conn


def list_items_by_group(group_type: str, active_only: bool = True) -> list[dict[str, Any]]:
    query = """
        SELECT i.id, i.name, i.group_type, i.is_active,
               COALESCE(
                 (SELECT ip.price_ksh FROM item_prices ip
                  WHERE ip.item_id = i.id
                  ORDER BY ip.effective_from DESC, ip.id DESC
                  LIMIT 1),
                 0
               ) AS price_ksh
        FROM items i
        WHERE i.group_type = %s
    """
    params: list[Any] = [group_type]
    if active_only:
        query += " AND i.is_active = TRUE"
    query += " ORDER BY i.name"
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def get_item(item_id: int) -> Optional[dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, name, group_type, is_active FROM items WHERE id = %s",
            (item_id,),
        ).fetchone()
        return dict(row) if row else None


def create_stock_item(name: str, user_id: Optional[int] = None) -> dict[str, Any]:
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO items (name, group_type, is_active)
            VALUES (%s, 'stock', TRUE)
            ON CONFLICT (group_type, name) DO UPDATE SET is_active = TRUE
            RETURNING id, name, group_type, is_active
            """,
            (name,),
        ).fetchone()
        item = dict(row)
        conn.execute(
            """
            INSERT INTO item_prices (item_id, price_ksh, updated_by)
            VALUES (%s, 0, %s)
            """,
            (item["id"], user_id),
        )
        conn.commit()
        return item


def deactivate_stock_item(item_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE items SET is_active = FALSE WHERE id = %s AND group_type = 'stock'",
            (item_id,),
        )
        conn.commit()
        return cur.rowcount > 0


def list_all_items_with_prices() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT i.id, i.name, i.group_type, i.is_active,
                   COALESCE(
                     (SELECT ip.price_ksh FROM item_prices ip
                      WHERE ip.item_id = i.id
                      ORDER BY ip.effective_from DESC, ip.id DESC
                      LIMIT 1),
                     0
                   ) AS price_ksh,
                   (SELECT ip.id FROM item_prices ip
                    WHERE ip.item_id = i.id
                    ORDER BY ip.effective_from DESC, ip.id DESC
                    LIMIT 1) AS price_id
            FROM items i
            WHERE i.is_active = TRUE
              AND i.group_type IN ('snacks_drinks', 'food_kuku')
            ORDER BY i.group_type, i.name
            """
        ).fetchall()
        return [dict(r) for r in rows]


def update_item_price(item_id: int, price_ksh: float, user_id: int) -> dict[str, Any]:
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO item_prices (item_id, price_ksh, updated_by)
            VALUES (%s, %s, %s)
            RETURNING id, item_id, price_ksh, effective_from
            """,
            (item_id, price_ksh, user_id),
        ).fetchone()
        conn.commit()
        return dict(row)


def upsert_catalog_item(group_type: str, name: str, price_ksh: float) -> int:
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO items (name, group_type, is_active)
            VALUES (%s, %s, TRUE)
            ON CONFLICT (group_type, name) DO UPDATE SET is_active = TRUE
            RETURNING id
            """,
            (name, group_type),
        ).fetchone()
        item_id = row["id"]
        existing = conn.execute(
            """
            SELECT id FROM item_prices
            WHERE item_id = %s
            ORDER BY effective_from DESC, id DESC
            LIMIT 1
            """,
            (item_id,),
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE item_prices SET price_ksh = %s, updated_at = NOW() WHERE id = %s",
                (price_ksh, existing["id"]),
            )
        else:
            conn.execute(
                "INSERT INTO item_prices (item_id, price_ksh) VALUES (%s, %s)",
                (item_id, price_ksh),
            )
        conn.commit()
        return item_id
