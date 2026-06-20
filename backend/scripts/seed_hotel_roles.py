#!/usr/bin/env python3
"""Optional initial hotel_role assignments on employee rows."""

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

# Edit this map to assign roles by employee first_name (case-insensitive).
# Payroll ADMIN gets hotel admin automatically; entries here are optional overrides.
INITIAL_ROLES: dict[str, str | None] = {
    # "Savins": "snacks_clerk",
    # "Stephen": "food_clerk",
}


def main() -> None:
    if not INITIAL_ROLES:
        print("No roles configured in INITIAL_ROLES. Edit scripts/seed_hotel_roles.py to assign.")
        return

    with get_conn() as conn:
        for first_name, hotel_role in INITIAL_ROLES.items():
            if hotel_role is None:
                conn.execute(
                    """
                    UPDATE employee SET hotel_role = NULL
                    WHERE LOWER(first_name) = LOWER(%s)
                    """,
                    (first_name,),
                )
            else:
                conn.execute(
                    """
                    UPDATE employee SET hotel_role = %s::hotel_role
                    WHERE LOWER(first_name) = LOWER(%s)
                    """,
                    (hotel_role, first_name),
                )
            print(f"  {first_name} -> {hotel_role or 'NULL'}")
        conn.commit()
    print("Hotel role seed complete.")


if __name__ == "__main__":
    main()
