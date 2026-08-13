#!/usr/bin/env python3
"""Report and fix user_auth ↔ employee shared-id orphans.

Dry-run by default. Use --apply to write.

Actions on --apply:
  - DELETE user_auth rows with no matching employee
  - INSERT user_auth for employees missing auth when FIX_AUTH_PINS is set
    (format: employee_id:pin,employee_id:pin  e.g. FIX_AUTH_PINS=8:1234)

Examples:
  python scripts/fix_auth_employee_orphans.py
  FIX_AUTH_PINS=8:1234 python scripts/fix_auth_employee_orphans.py --apply
"""

from __future__ import annotations

import argparse
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

from db.connection import close_pool, get_conn  # noqa: E402


def _parse_pin_map(raw: str) -> dict[int, int]:
    result: dict[int, int] = {}
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if ":" not in part:
            raise ValueError(f"Invalid FIX_AUTH_PINS entry (expected id:pin): {part!r}")
        id_str, pin_str = part.split(":", 1)
        result[int(id_str.strip())] = int(pin_str.strip())
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply deletes/inserts (default is dry-run)",
    )
    args = parser.parse_args()
    apply = args.apply

    pin_map: dict[int, int] = {}
    raw_pins = os.getenv("FIX_AUTH_PINS", "").strip()
    if raw_pins:
        try:
            pin_map = _parse_pin_map(raw_pins)
        except ValueError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1

    with get_conn() as conn:
        auth_orphans = conn.execute(
            """
            SELECT ua.id, ua.first_name, ua.pin
            FROM user_auth ua
            WHERE NOT EXISTS (SELECT 1 FROM employee e WHERE e.id = ua.id)
            ORDER BY ua.id
            """
        ).fetchall()
        emp_orphans = conn.execute(
            """
            SELECT e.id, e.first_name, e.last_name, e.hotel_role::text AS hotel_role
            FROM employee e
            WHERE NOT EXISTS (SELECT 1 FROM user_auth ua WHERE ua.id = e.id)
            ORDER BY e.id
            """
        ).fetchall()
        name_mismatches = conn.execute(
            """
            SELECT e.id, e.first_name AS employee_first_name, ua.first_name AS auth_first_name
            FROM employee e
            JOIN user_auth ua ON ua.id = e.id
            WHERE LOWER(e.first_name) <> LOWER(ua.first_name)
            ORDER BY e.id
            """
        ).fetchall()

        print("=== user_auth without employee ===")
        if not auth_orphans:
            print("  (none)")
        else:
            for row in auth_orphans:
                print(f"  id={row['id']} first_name={row['first_name']!r}")

        print("=== employee without user_auth ===")
        if not emp_orphans:
            print("  (none)")
        else:
            for row in emp_orphans:
                print(
                    f"  id={row['id']} name={row['first_name']} {row['last_name']} "
                    f"hotel_role={row['hotel_role']}"
                )
                print(
                    f"    SQL template: INSERT INTO user_auth (id, first_name, pin) "
                    f"VALUES ({row['id']}, '{row['first_name']}', <PIN>);"
                )
                if row["id"] not in pin_map:
                    print(
                        f"    Provide PIN via FIX_AUTH_PINS={row['id']}:<pin> "
                        "(comma-separated for multiple)"
                    )

        print("=== first_name mismatches (manual review) ===")
        if not name_mismatches:
            print("  (none)")
        else:
            for row in name_mismatches:
                print(
                    f"  id={row['id']} employee={row['employee_first_name']!r} "
                    f"auth={row['auth_first_name']!r}"
                )

        if not apply:
            print()
            print("Dry-run only. Re-run with --apply to write changes.")
            if emp_orphans and not all(r["id"] in pin_map for r in emp_orphans):
                print(
                    "Note: employee orphans still need FIX_AUTH_PINS before FK migration 010."
                )
            return 0

        deleted = 0
        for row in auth_orphans:
            conn.execute("DELETE FROM user_auth WHERE id = %s", (row["id"],))
            deleted += 1
            print(f"Deleted orphan user_auth id={row['id']}")

        inserted = 0
        still_missing: list[int] = []
        for row in emp_orphans:
            emp_id = int(row["id"])
            if emp_id not in pin_map:
                still_missing.append(emp_id)
                continue
            pin = pin_map[emp_id]
            conn.execute(
                """
                INSERT INTO user_auth (id, first_name, pin)
                VALUES (%s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (emp_id, row["first_name"], pin),
            )
            inserted += 1
            print(f"Inserted user_auth id={emp_id} first_name={row['first_name']!r}")

        conn.commit()
        print(f"Applied: deleted={deleted} inserted={inserted}")

        if still_missing:
            print(
                f"ERROR: Still missing auth for employee ids {still_missing}. "
                "Set FIX_AUTH_PINS and re-run --apply before migration 010.",
                file=sys.stderr,
            )
            return 1

        remaining_auth = conn.execute(
            """
            SELECT COUNT(*) AS n FROM user_auth ua
            WHERE NOT EXISTS (SELECT 1 FROM employee e WHERE e.id = ua.id)
            """
        ).fetchone()["n"]
        remaining_emp = conn.execute(
            """
            SELECT COUNT(*) AS n FROM employee e
            WHERE NOT EXISTS (SELECT 1 FROM user_auth ua WHERE ua.id = e.id)
            """
        ).fetchone()["n"]
        if remaining_auth or remaining_emp:
            print(
                f"ERROR: Orphans remain (auth={remaining_auth}, employee={remaining_emp}).",
                file=sys.stderr,
            )
            return 1

        print("Orphans cleared. Safe to apply migrations/010_user_auth_employee_fk.sql")
        return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    finally:
        close_pool()
