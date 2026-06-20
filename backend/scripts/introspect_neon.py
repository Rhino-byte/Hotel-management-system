#!/usr/bin/env python3
"""Print Neon auth tables and hotel_role column."""

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

from db.connection import get_conn  # noqa: E402


def main() -> None:
    with get_conn() as conn:
        for table in ("user_auth", "employee"):
            print(f"=== {table} ===")
            rows = conn.execute(
                """
                SELECT column_name, data_type, udt_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
                """,
                (table,),
            ).fetchall()
            for row in rows:
                print(f"  - {row['column_name']}: {row['data_type']} ({row['udt_name']})")
            print()

        roles = conn.execute(
            """
            SELECT DISTINCT role::text AS payroll_role FROM employee ORDER BY 1
            """
        ).fetchall()
        print("Payroll roles:")
        for r in roles:
            print(f"  - {r['payroll_role']}")

        hotel_roles = conn.execute(
            """
            SELECT e.id, e.first_name, e.last_name, e.role::text AS payroll_role,
                   e.hotel_role::text AS hotel_role
            FROM employee e
            ORDER BY e.id
            """
        ).fetchall()
        print("\nEmployees with hotel_role:")
        for r in hotel_roles:
            print(f"  - {r['id']} {r['first_name']} {r['last_name']}: payroll={r['payroll_role']}, hotel={r['hotel_role']}")


if __name__ == "__main__":
    main()
