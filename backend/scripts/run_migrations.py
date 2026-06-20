#!/usr/bin/env python3
"""Apply SQL migrations in migrations/."""

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
    migrations_dir = BACKEND_ROOT / "migrations"
    files = sorted(migrations_dir.glob("*.sql"))
    if not files:
        print("No migration files found.")
        return

    with get_conn() as conn:
        for path in files:
            sql = path.read_text(encoding="utf-8")
            print(f"Applying {path.name}...")
            conn.execute(sql)
            conn.commit()
            print(f"  OK: {path.name}")
    print("Migrations complete.")


if __name__ == "__main__":
    main()
