#!/usr/bin/env python3
import sys

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__))))

from app.security import hash_password  # noqa: E402

if __name__ == "__main__":
    pwd = sys.argv[1] if len(sys.argv) > 1 else "changeme"
    print(hash_password(pwd))
