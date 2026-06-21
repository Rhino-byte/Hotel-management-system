import json
from typing import Any, Optional

from db.connection import get_conn


def log_admin_action(
    *,
    action_type: str,
    performed_by: int,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    details: Optional[dict[str, Any]] = None,
) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO admin_action_log
              (action_type, target_type, target_id, details, performed_by)
            VALUES (%s, %s, %s, %s::jsonb, %s)
            """,
            (
                action_type,
                target_type,
                target_id,
                json.dumps(details) if details is not None else None,
                performed_by,
            ),
        )
        conn.commit()


def list_admin_actions(limit: int = 100) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT a.id,
                   a.action_type,
                   a.target_type,
                   a.target_id,
                   a.details,
                   a.performed_by,
                   a.performed_at,
                   TRIM(e.first_name || ' ' || e.last_name) AS performed_by_name
            FROM admin_action_log a
            LEFT JOIN employee e ON e.id = a.performed_by
            ORDER BY a.performed_at DESC
            LIMIT %s
            """,
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
