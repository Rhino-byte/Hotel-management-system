#!/usr/bin/env python3
"""Ping /api/health/ready to keep Neon from sleeping after idle.

Used by the Render Cron Job in render.yaml (every 5 minutes).
Set HEALTH_PING_URL to your deployed API ready endpoint, e.g.:
  https://hotel-api.onrender.com/api/health/ready

Ready checks hotel DATABASE_URL and, when set, TRANSACTION_DATABASE_URL
so both Neon projects stay warm.
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request


def main() -> int:
    url = (os.getenv("HEALTH_PING_URL") or "").strip().rstrip("/")
    if not url:
        print("ERROR: HEALTH_PING_URL is not set", file=sys.stderr)
        return 1
    if not url.endswith("/api/health/ready"):
        # Allow either full ready URL or API base
        if url.endswith("/api/health"):
            url = url[: -len("/api/health")] + "/api/health/ready"
        elif "/api/" not in url:
            url = f"{url}/api/health/ready"

    timeout = float(os.getenv("HEALTH_PING_TIMEOUT_SEC", "60"))
    print(f"Pinging {url} (timeout={timeout}s)...")
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            print(f"OK {resp.status}: {body}")
            return 0 if 200 <= resp.status < 300 else 1
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(f"HTTP {exc.code}: {body}", file=sys.stderr)
        # 503 means API is up but DB is waking/unavailable — still useful as a wake ping
        return 0 if exc.code == 503 else 1
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
