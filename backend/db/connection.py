import os
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Optional

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

_pool: Optional[ConnectionPool] = None
_env_loaded = False


def load_env_file() -> None:
    """Load backend/.env into os.environ (does not override existing vars)."""
    global _env_loaded
    if _env_loaded:
        return
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    _env_loaded = True


def get_database_url() -> str:
    load_env_file()
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return normalize_database_url(url)


def normalize_database_url(url: str) -> str:
    """Accept raw postgresql:// URLs or Neon-style `psql 'postgresql://...'` commands."""
    cleaned = url.strip().strip('"').strip("'")
    if cleaned.lower().startswith("psql"):
        parts = cleaned.split()
        for part in parts[1:]:
            candidate = part.strip().strip('"').strip("'")
            if candidate.startswith("postgresql://") or candidate.startswith("postgres://"):
                return candidate
        raise RuntimeError(
            "DATABASE_URL looks like a psql command but contains no postgresql:// URL. "
            "Use only the connection string from Neon (postgresql://...)."
        )
    return cleaned


def init_pool(min_size: int = 1, max_size: int = 10) -> None:
    global _pool
    if _pool is not None:
        return
    _pool = ConnectionPool(
        conninfo=get_database_url(),
        min_size=min_size,
        max_size=max_size,
        kwargs={"row_factory": dict_row},
    )


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def get_pool() -> ConnectionPool:
    if _pool is None:
        init_pool()
    assert _pool is not None
    return _pool


@contextmanager
def get_conn() -> Generator[psycopg.Connection, None, None]:
    with get_pool().connection() as conn:
        yield conn
