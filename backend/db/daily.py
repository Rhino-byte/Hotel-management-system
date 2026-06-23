from datetime import date
from typing import Any, Optional

from db.connection import get_conn


def log_audit(
    conn,
    *,
    table_name: str,
    record_id: int,
    item_id: Optional[int],
    entry_date: Optional[date],
    field_name: str,
    old_value: Any,
    new_value: Any,
    changed_by: int,
) -> None:
    conn.execute(
        """
        INSERT INTO inventory_audit_log
          (table_name, record_id, item_id, entry_date, field_name, old_value, new_value, changed_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            table_name,
            record_id,
            item_id,
            entry_date,
            field_name,
            None if old_value is None else str(old_value),
            str(new_value),
            changed_by,
        ),
    )


def _compute_snacks_metrics(record: dict[str, Any]) -> dict[str, Any]:
    previous_closing = float(record.get("previous_closing") or 0)
    added_raw = record.get("added_stock")
    closing_raw = record.get("closing_stock")
    added = float(added_raw) if added_raw is not None else 0.0
    total_units = previous_closing + added
    price_ksh = float(record.get("price_ksh") or 0)
    record["total_units"] = total_units
    if closing_raw is None:
        record["sold_units"] = None
        record["revenue"] = None
    else:
        closing = float(closing_raw)
        sold_units = max(total_units - closing, 0.0)
        record["sold_units"] = sold_units
        record["revenue"] = sold_units * price_ksh
    if record.get("previous_from_date") is not None:
        record["previous_from_date"] = str(record["previous_from_date"])
    return record


def get_snacks_drinks_daily(entry_date: date) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT i.id AS item_id, i.name, i.subcategory,
                   COALESCE(prev.closing_stock, 0) AS previous_closing,
                   prev.entry_date AS previous_from_date,
                   cur.added_stock,
                   cur.closing_stock,
                   COALESCE(
                     (SELECT ip.price_ksh FROM item_prices ip
                      WHERE ip.item_id = i.id
                      ORDER BY ip.effective_from DESC, ip.id DESC
                      LIMIT 1),
                     0
                   ) AS price_ksh,
                   cur.id AS record_id
            FROM items i
            LEFT JOIN snacks_drinks_daily cur
              ON cur.item_id = i.id AND cur.entry_date = %s
            LEFT JOIN snacks_drinks_daily prev
              ON prev.item_id = i.id
             AND prev.entry_date = (%s::date - INTERVAL '1 day')::date
            WHERE i.group_type = 'snacks_drinks' AND i.is_active = TRUE
            ORDER BY i.subcategory NULLS LAST, i.display_order, i.name
            """,
            (entry_date, entry_date),
        ).fetchall()
        return [_compute_snacks_metrics(dict(row)) for row in rows]


def save_snacks_drinks_daily(
    entry_date: date, entries: list[dict[str, Any]], user_id: int
) -> int:
    saved = 0
    with get_conn() as conn:
        for entry in entries:
            item_id = int(entry["item_id"])
            closing = float(entry.get("closing_stock") or 0)
            added = float(entry.get("added_stock") or 0)
            existing = conn.execute(
                """
                SELECT id, closing_stock, added_stock
                FROM snacks_drinks_daily
                WHERE entry_date = %s AND item_id = %s
                """,
                (entry_date, item_id),
            ).fetchone()
            if existing:
                record_id = existing["id"]
                if float(existing["closing_stock"]) != closing:
                    log_audit(
                        conn,
                        table_name="snacks_drinks_daily",
                        record_id=record_id,
                        item_id=item_id,
                        entry_date=entry_date,
                        field_name="closing_stock",
                        old_value=existing["closing_stock"],
                        new_value=closing,
                        changed_by=user_id,
                    )
                if float(existing["added_stock"]) != added:
                    log_audit(
                        conn,
                        table_name="snacks_drinks_daily",
                        record_id=record_id,
                        item_id=item_id,
                        entry_date=entry_date,
                        field_name="added_stock",
                        old_value=existing["added_stock"],
                        new_value=added,
                        changed_by=user_id,
                    )
                conn.execute(
                    """
                    UPDATE snacks_drinks_daily
                    SET closing_stock = %s, added_stock = %s,
                        submitted_by = %s, submitted_at = NOW()
                    WHERE id = %s
                    """,
                    (closing, added, user_id, record_id),
                )
            else:
                row = conn.execute(
                    """
                    INSERT INTO snacks_drinks_daily
                      (entry_date, item_id, closing_stock, added_stock, submitted_by)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (entry_date, item_id, closing, added, user_id),
                ).fetchone()
                record_id = row["id"]
                for field, val in [("closing_stock", closing), ("added_stock", added)]:
                    log_audit(
                        conn,
                        table_name="snacks_drinks_daily",
                        record_id=record_id,
                        item_id=item_id,
                        entry_date=entry_date,
                        field_name=field,
                        old_value=None,
                        new_value=val,
                        changed_by=user_id,
                    )
            saved += 1
        conn.commit()
    return saved


def is_food_kuku_day_locked(entry_date: date) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM food_kuku_day_lock WHERE entry_date = %s",
            (entry_date,),
        ).fetchone()
        return row is not None


def lock_food_kuku_day(entry_date: date, user_id: int) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO food_kuku_day_lock (entry_date, locked_by)
            VALUES (%s, %s)
            ON CONFLICT (entry_date) DO NOTHING
            """,
            (entry_date, user_id),
        )
        conn.commit()


def get_food_kuku_daily(entry_date: date) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT i.id AS item_id, i.name,
                   COALESCE(d.quantity, 0) AS quantity,
                   COALESCE(
                     (SELECT ip.price_ksh FROM item_prices ip
                      WHERE ip.item_id = i.id
                      ORDER BY ip.effective_from DESC, ip.id DESC
                      LIMIT 1),
                     0
                   ) AS price_ksh,
                   d.id AS record_id
            FROM items i
            LEFT JOIN food_kuku_daily d
              ON d.item_id = i.id AND d.entry_date = %s
            WHERE i.group_type = 'food_kuku' AND i.is_active = TRUE
            ORDER BY i.name
            """,
            (entry_date,),
        ).fetchall()
        return [dict(r) for r in rows]


def save_food_kuku_daily(
    entry_date: date,
    entries: list[dict[str, Any]],
    user_id: int,
    *,
    finalize: bool = False,
) -> dict[str, Any]:
    saved = 0
    total_revenue = 0.0
    with get_conn() as conn:
        for entry in entries:
            item_id = int(entry["item_id"])
            quantity = float(entry.get("quantity") or 0)
            price_row = conn.execute(
                """
                SELECT COALESCE(
                  (SELECT ip.price_ksh FROM item_prices ip
                   WHERE ip.item_id = %s
                   ORDER BY ip.effective_from DESC, ip.id DESC
                   LIMIT 1),
                  0
                ) AS price_ksh
                """,
                (item_id,),
            ).fetchone()
            price = float(price_row["price_ksh"])
            total_revenue += quantity * price
            existing = conn.execute(
                """
                SELECT id, quantity FROM food_kuku_daily
                WHERE entry_date = %s AND item_id = %s
                """,
                (entry_date, item_id),
            ).fetchone()
            if existing:
                record_id = existing["id"]
                if float(existing["quantity"]) != quantity:
                    log_audit(
                        conn,
                        table_name="food_kuku_daily",
                        record_id=record_id,
                        item_id=item_id,
                        entry_date=entry_date,
                        field_name="quantity",
                        old_value=existing["quantity"],
                        new_value=quantity,
                        changed_by=user_id,
                    )
                conn.execute(
                    """
                    UPDATE food_kuku_daily
                    SET quantity = %s, submitted_by = %s, submitted_at = NOW()
                    WHERE id = %s
                    """,
                    (quantity, user_id, record_id),
                )
            else:
                row = conn.execute(
                    """
                    INSERT INTO food_kuku_daily
                      (entry_date, item_id, quantity, submitted_by)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                    """,
                    (entry_date, item_id, quantity, user_id),
                ).fetchone()
                log_audit(
                    conn,
                    table_name="food_kuku_daily",
                    record_id=row["id"],
                    item_id=item_id,
                    entry_date=entry_date,
                    field_name="quantity",
                    old_value=None,
                    new_value=quantity,
                    changed_by=user_id,
                )
            saved += 1
        if finalize:
            conn.execute(
                """
                INSERT INTO food_kuku_day_lock (entry_date, locked_by)
                VALUES (%s, %s)
                ON CONFLICT (entry_date) DO NOTHING
                """,
                (entry_date, user_id),
            )
        conn.commit()
    return {"saved": saved, "total_revenue": total_revenue, "locked": finalize}


def get_stock_items_daily(entry_date: date) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT i.id AS item_id, i.name,
                   COALESCE(d.closing_stock, 0) AS closing_stock,
                   COALESCE(d.added_stock, 0) AS added_stock,
                   d.id AS record_id
            FROM items i
            LEFT JOIN stock_items_daily d
              ON d.item_id = i.id AND d.entry_date = %s
            WHERE i.group_type = 'stock' AND i.is_active = TRUE
            ORDER BY i.name
            """,
            (entry_date,),
        ).fetchall()
        return [dict(r) for r in rows]


def save_stock_items_daily(
    entry_date: date, entries: list[dict[str, Any]], user_id: int
) -> int:
    saved = 0
    with get_conn() as conn:
        for entry in entries:
            item_id = int(entry["item_id"])
            closing = float(entry.get("closing_stock") or 0)
            added = float(entry.get("added_stock") or 0)
            existing = conn.execute(
                """
                SELECT id, closing_stock, added_stock
                FROM stock_items_daily
                WHERE entry_date = %s AND item_id = %s
                """,
                (entry_date, item_id),
            ).fetchone()
            if existing:
                record_id = existing["id"]
                if float(existing["closing_stock"]) != closing:
                    log_audit(
                        conn,
                        table_name="stock_items_daily",
                        record_id=record_id,
                        item_id=item_id,
                        entry_date=entry_date,
                        field_name="closing_stock",
                        old_value=existing["closing_stock"],
                        new_value=closing,
                        changed_by=user_id,
                    )
                if float(existing["added_stock"]) != added:
                    log_audit(
                        conn,
                        table_name="stock_items_daily",
                        record_id=record_id,
                        item_id=item_id,
                        entry_date=entry_date,
                        field_name="added_stock",
                        old_value=existing["added_stock"],
                        new_value=added,
                        changed_by=user_id,
                    )
                conn.execute(
                    """
                    UPDATE stock_items_daily
                    SET closing_stock = %s, added_stock = %s,
                        submitted_by = %s, submitted_at = NOW()
                    WHERE id = %s
                    """,
                    (closing, added, user_id, record_id),
                )
            else:
                row = conn.execute(
                    """
                    INSERT INTO stock_items_daily
                      (entry_date, item_id, closing_stock, added_stock, submitted_by)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (entry_date, item_id, closing, added, user_id),
                ).fetchone()
                record_id = row["id"]
                for field, val in [("closing_stock", closing), ("added_stock", added)]:
                    log_audit(
                        conn,
                        table_name="stock_items_daily",
                        record_id=record_id,
                        item_id=item_id,
                        entry_date=entry_date,
                        field_name=field,
                        old_value=None,
                        new_value=val,
                        changed_by=user_id,
                    )
            saved += 1
        conn.commit()
    return saved


def _compute_bar_metrics(record: dict[str, Any]) -> dict[str, Any]:
    opening = float(record.get("opening_stock") or 0)
    added_raw = record.get("added_stock")
    closing_raw = record.get("closing_stock")
    added = float(added_raw) if added_raw is not None else 0.0
    total_units = opening + added
    price_ksh = float(record.get("price_ksh") or 0)
    record["total_units"] = total_units
    if closing_raw is None:
        record["sold_units"] = None
        record["revenue"] = None
    else:
        closing = float(closing_raw)
        sold_units = max(total_units - closing, 0.0)
        record["sold_units"] = sold_units
        record["revenue"] = sold_units * price_ksh
    if record.get("opening_from_date") is not None:
        record["opening_from_date"] = str(record["opening_from_date"])
    return record


def get_bar_daily(entry_date: date) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT i.id AS item_id, i.name, i.display_order,
                   COALESCE(prev.closing_stock, 0) AS opening_stock,
                   prev.opening_from_date,
                   cur.added_stock,
                   cur.closing_stock,
                   COALESCE(
                     (SELECT ip.price_ksh FROM item_prices ip
                      WHERE ip.item_id = i.id
                      ORDER BY ip.effective_from DESC, ip.id DESC
                      LIMIT 1),
                     0
                   ) AS price_ksh,
                   cur.id AS record_id
            FROM items i
            LEFT JOIN bar_daily cur
              ON cur.item_id = i.id AND cur.entry_date = %s
            LEFT JOIN LATERAL (
              SELECT p.closing_stock, p.entry_date AS opening_from_date
              FROM bar_daily p
              WHERE p.item_id = i.id
                AND p.entry_date < %s
              ORDER BY p.entry_date DESC
              LIMIT 1
            ) prev ON true
            WHERE i.group_type = 'bar' AND i.is_active = TRUE
            ORDER BY i.display_order, i.name
            """,
            (entry_date, entry_date),
        ).fetchall()
        return [_compute_bar_metrics(dict(row)) for row in rows]


def save_bar_daily(entry_date: date, entries: list[dict[str, Any]], user_id: int) -> int:
    saved = 0
    with get_conn() as conn:
        for entry in entries:
            item_id = int(entry["item_id"])
            added = float(entry.get("added_stock") or 0)
            closing = float(entry.get("closing_stock") or 0)
            existing = conn.execute(
                """
                SELECT id, added_stock, closing_stock
                FROM bar_daily
                WHERE entry_date = %s AND item_id = %s
                """,
                (entry_date, item_id),
            ).fetchone()
            if existing:
                record_id = existing["id"]
                if float(existing["added_stock"]) != added:
                    log_audit(
                        conn,
                        table_name="bar_daily",
                        record_id=record_id,
                        item_id=item_id,
                        entry_date=entry_date,
                        field_name="added_stock",
                        old_value=existing["added_stock"],
                        new_value=added,
                        changed_by=user_id,
                    )
                if float(existing["closing_stock"]) != closing:
                    log_audit(
                        conn,
                        table_name="bar_daily",
                        record_id=record_id,
                        item_id=item_id,
                        entry_date=entry_date,
                        field_name="closing_stock",
                        old_value=existing["closing_stock"],
                        new_value=closing,
                        changed_by=user_id,
                    )
                conn.execute(
                    """
                    UPDATE bar_daily
                    SET added_stock = %s, closing_stock = %s,
                        submitted_by = %s, submitted_at = NOW()
                    WHERE id = %s
                    """,
                    (added, closing, user_id, record_id),
                )
            else:
                row = conn.execute(
                    """
                    INSERT INTO bar_daily
                      (entry_date, item_id, added_stock, closing_stock, submitted_by)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (entry_date, item_id, added, closing, user_id),
                ).fetchone()
                record_id = row["id"]
                for field, val in [("added_stock", added), ("closing_stock", closing)]:
                    log_audit(
                        conn,
                        table_name="bar_daily",
                        record_id=record_id,
                        item_id=item_id,
                        entry_date=entry_date,
                        field_name=field,
                        old_value=None,
                        new_value=val,
                        changed_by=user_id,
                    )
            saved += 1
        conn.commit()
    return saved


TABLE_BY_GROUP = {
    "snacks_drinks": "snacks_drinks_daily",
    "food_kuku": "food_kuku_daily",
    "stock": "stock_items_daily",
    "bar": "bar_daily",
}


def get_audit_timeline(
    group: str,
    date_from: Optional[date],
    date_to: Optional[date],
) -> list[dict[str, Any]]:
    table_name = TABLE_BY_GROUP.get(group)
    if not table_name:
        return []
    query = """
        SELECT a.id, a.table_name, a.record_id, a.item_id, i.name AS item_name,
               a.entry_date, a.field_name, a.old_value, a.new_value,
               a.changed_by, a.changed_at,
               TRIM(e.first_name || ' ' || e.last_name) AS changed_by_name
        FROM inventory_audit_log a
        LEFT JOIN items i ON i.id = a.item_id
        LEFT JOIN employee e ON e.id = a.changed_by
        WHERE a.table_name = %s
    """
    params: list[Any] = [table_name]
    if date_from:
        query += " AND a.entry_date >= %s"
        params.append(date_from)
    if date_to:
        query += " AND a.entry_date <= %s"
        params.append(date_to)
    query += " ORDER BY a.changed_at DESC LIMIT 500"
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def get_inventory_audit(
    group: str,
    date_from: date,
    date_to: date,
) -> list[dict[str, Any]]:
    """Per-item timeline with opening (prev closing), added, closing."""
    if group == "snacks_drinks":
        daily_table = "snacks_drinks_daily"
        item_group = "snacks_drinks"
    elif group == "food_kuku":
        return _food_kuku_audit(date_from, date_to)
    elif group == "stock":
        daily_table = "stock_items_daily"
        item_group = "stock"
    elif group == "bar":
        return _bar_audit(date_from, date_to)
    else:
        return []

    with get_conn() as conn:
        rows = conn.execute(
            f"""
            WITH dates AS (
              SELECT generate_series(%s::date, %s::date, '1 day'::interval)::date AS entry_date
            ),
            items_list AS (
              SELECT id, name FROM items
              WHERE group_type = %s AND is_active = TRUE
            )
            SELECT il.id AS item_id, il.name AS item_name, d.entry_date,
                   COALESCE(cur.closing_stock, 0) AS closing_stock,
                   COALESCE(cur.added_stock, 0) AS added_stock,
                   COALESCE(prev.closing_stock, 0) AS opening_stock,
                   COALESCE(nxt.closing_stock, 0) AS next_closing_units,
                   COALESCE(
                     (SELECT ip.price_ksh FROM item_prices ip
                      WHERE ip.item_id = il.id
                      ORDER BY ip.effective_from DESC, ip.id DESC
                      LIMIT 1),
                     0
                   ) AS price_ksh
            FROM items_list il
            CROSS JOIN dates d
            LEFT JOIN {daily_table} cur
              ON cur.item_id = il.id AND cur.entry_date = d.entry_date
            LEFT JOIN {daily_table} prev
              ON prev.item_id = il.id
             AND prev.entry_date = (d.entry_date - INTERVAL '1 day')::date
            LEFT JOIN {daily_table} nxt
              ON nxt.item_id = il.id
             AND nxt.entry_date = (d.entry_date + INTERVAL '1 day')::date
            ORDER BY il.name, d.entry_date
            """,
            (date_from, date_to, item_group),
        ).fetchall()
        result = [dict(r) for r in rows]
        if group == "snacks_drinks":
            for row in result:
                total_units = float(row["opening_stock"]) + float(row["added_stock"])
                sold_units = max(total_units - float(row["closing_stock"]), 0.0)
                row["total_units"] = total_units
                row["sold_units"] = sold_units
                row["revenue"] = sold_units * float(row["price_ksh"])
        return result


def _food_kuku_audit(date_from: date, date_to: date) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            WITH dates AS (
              SELECT generate_series(%s::date, %s::date, '1 day'::interval)::date AS entry_date
            ),
            items_list AS (
              SELECT id, name FROM items
              WHERE group_type = 'food_kuku' AND is_active = TRUE
            )
            SELECT il.id AS item_id, il.name AS item_name, d.entry_date,
                   COALESCE(f.quantity, 0) AS quantity,
                   COALESCE(
                     (SELECT ip.price_ksh FROM item_prices ip
                      WHERE ip.item_id = il.id
                      ORDER BY ip.effective_from DESC, ip.id DESC
                      LIMIT 1),
                     0
                   ) AS price_ksh,
                   COALESCE(f.quantity, 0) * COALESCE(
                     (SELECT ip.price_ksh FROM item_prices ip
                      WHERE ip.item_id = il.id
                      ORDER BY ip.effective_from DESC, ip.id DESC
                      LIMIT 1),
                     0
                   ) AS revenue
            FROM items_list il
            CROSS JOIN dates d
            LEFT JOIN food_kuku_daily f
              ON f.item_id = il.id AND f.entry_date = d.entry_date
            ORDER BY il.name, d.entry_date
            """,
            (date_from, date_to),
        ).fetchall()
        return [dict(r) for r in rows]


def _bar_audit(date_from: date, date_to: date) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            WITH dates AS (
              SELECT generate_series(%s::date, %s::date, '1 day'::interval)::date AS entry_date
            ),
            items_list AS (
              SELECT id, name, display_order FROM items
              WHERE group_type = 'bar' AND is_active = TRUE
            )
            SELECT il.id AS item_id, il.name AS item_name, d.entry_date,
                   COALESCE(prev.closing_stock, 0) AS opening_stock,
                   prev.opening_from_date,
                   cur.added_stock,
                   cur.closing_stock,
                   COALESCE(
                     (SELECT ip.price_ksh FROM item_prices ip
                      WHERE ip.item_id = il.id
                      ORDER BY ip.effective_from DESC, ip.id DESC
                      LIMIT 1),
                     0
                   ) AS price_ksh
            FROM items_list il
            CROSS JOIN dates d
            LEFT JOIN bar_daily cur
              ON cur.item_id = il.id AND cur.entry_date = d.entry_date
            LEFT JOIN LATERAL (
              SELECT p.closing_stock, p.entry_date AS opening_from_date
              FROM bar_daily p
              WHERE p.item_id = il.id
                AND p.entry_date < d.entry_date
              ORDER BY p.entry_date DESC
              LIMIT 1
            ) prev ON true
            ORDER BY il.display_order, il.name, d.entry_date
            """,
            (date_from, date_to),
        ).fetchall()
        return [_compute_bar_metrics(dict(r)) for r in rows]
