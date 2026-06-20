#!/usr/bin/env python3
"""Full Neon schema investigation (loads backend/.env)."""

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
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)

from db.connection import get_conn, users_columns, users_table  # noqa: E402


def _print_table_schema(conn, table_name: str) -> None:
    schema = conn.execute(
        """
        SELECT column_name, data_type, udt_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
        """,
        (table_name,),
    ).fetchall()
    for row in schema:
        print(
            f"  - {row['column_name']}: {row['data_type']} "
            f"({row['udt_name']}, nullable={row['is_nullable']})"
        )


def _print_user_auth_sample(conn) -> None:
    cols = conn.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_auth'
        ORDER BY ordinal_position
        """
    ).fetchall()
    safe = [
        c["column_name"]
        for c in cols
        if not any(x in c["column_name"].lower() for x in ("password", "hash", "token", "secret"))
    ]
    if not safe:
        return
    query = f"SELECT {', '.join(safe)} FROM user_auth LIMIT 5"
    print()
    print("Sample user_auth rows (password fields omitted):")
    for row in conn.execute(query).fetchall():
        print(f"  {dict(row)}")


def main() -> None:
    if not os.getenv("DATABASE_URL"):
        print("ERROR: DATABASE_URL not found in backend/.env")
        sys.exit(1)

    print("=== Connection OK ===")
    table = users_table()
    cols = users_columns()
    print(f"Configured users table: {table}")
    print(f"Column mapping: {cols}")
    print()

    with get_conn() as conn:
        tables = conn.execute(
            """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """
        ).fetchall()
        print("=== Public tables ===")
        for t in tables:
            print(f"  - {t['table_name']}")

        enums = conn.execute(
            """
            SELECT t.typname, e.enumlabel
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
            ORDER BY t.typname, e.enumsortorder
            """
        ).fetchall()
        if enums:
            print()
            print("=== Enum types ===")
            current = None
            for row in enums:
                if row["typname"] != current:
                    current = row["typname"]
                    print(f"  {current}:")
                print(f"    - {row['enumlabel']}")

        print()
        print(f"=== Table: {table} ===")
        schema = conn.execute(
            """
            SELECT column_name, data_type, udt_name, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
            """,
            (table,),
        ).fetchall()
        if not schema:
            print("  NOT FOUND")
            similar = conn.execute(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name ILIKE '%user%'
                """
            ).fetchall()
            for s in similar:
                print(f"  candidate: {s['table_name']}")

            if table != "user_auth":
                print()
                print("=== Table: user_auth (actual auth table) ===")
                _print_table_schema(conn, "user_auth")
                _print_user_auth_sample(conn)
        else:
            for row in schema:
                print(
                    f"  - {row['column_name']}: {row['data_type']} "
                    f"({row['udt_name']}, nullable={row['is_nullable']})"
                )
            try:
                roles = conn.execute(
                    f"SELECT DISTINCT {cols['role']} AS role FROM {table} ORDER BY 1"
                ).fetchall()
                print()
                print("Distinct roles:")
                for r in roles:
                    print(f"  - {r['role']}")
                count = conn.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()
                print(f"Total users: {count['n']}")
            except Exception as exc:
                print(f"Role query failed: {exc}")

        expected = [
            "items",
            "item_prices",
            "snacks_drinks_daily",
            "food_kuku_daily",
            "stock_items_daily",
            "inventory_audit_log",
        ]
        existing = {t["table_name"] for t in tables}
        print()
        print("=== Migration tables status ===")
        for name in expected:
            status = "EXISTS" if name in existing else "MISSING"
            print(f"  {name}: {status}")

        if "items" in existing:
            counts = conn.execute(
                """
                SELECT group_type::text AS group_type, COUNT(*) AS n
                FROM items WHERE is_active = TRUE
                GROUP BY group_type ORDER BY 1
                """
            ).fetchall()
            print()
            print("Active items by group:")
            for c in counts:
                print(f"  - {c['group_type']}: {c['n']}")

        for extra in ("employee", "bill"):
            if extra in existing:
                print()
                print(f"=== Table: {extra} ===")
                _print_table_schema(conn, extra)
                if extra == "employee":
                    sample = conn.execute(
                        """
                        SELECT id, first_name, last_name, role::text AS role
                        FROM employee LIMIT 5
                        """
                    ).fetchall()
                    print()
                    print("Sample employee rows:")
                    for row in sample:
                        print(f"  {dict(row)}")


if __name__ == "__main__":
    main()
