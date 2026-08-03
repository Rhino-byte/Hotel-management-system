import os
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Optional

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

_pool: Optional[ConnectionPool] = None
_transaction_pool: Optional[ConnectionPool] = None
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


def get_transaction_database_url() -> Optional[str]:
    """Return TRANSACTION_DATABASE_URL if configured, else None."""
    load_env_file()
    url = os.getenv("TRANSACTION_DATABASE_URL", "").strip()
    if not url:
        return None
    return normalize_database_url(url)


def get_tills_phone_number() -> Optional[str]:
    load_env_file()
    phone = os.getenv("PHONE_NUMBER", "").strip()
    return phone or None


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


def _pool_kwargs() -> dict:
    # Neon / poolers drop idle SSL sockets; TCP keepalives reduce surprise closes.
    return {
        "row_factory": dict_row,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 3,
    }


def init_pool(min_size: int = 1, max_size: int = 10) -> None:
    global _pool
    if _pool is not None:
        return
    _pool = ConnectionPool(
        conninfo=get_database_url(),
        min_size=min_size,
        max_size=max_size,
        # Discard connections idle too long (Neon often closes ~5m).
        max_idle=300,
        # Verify connection is alive before handing it to the app.
        check=ConnectionPool.check_connection,
        kwargs=_pool_kwargs(),
    )


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def init_transaction_pool(min_size: int = 1, max_size: int = 5) -> None:
    """Init optional pool for TRANSACTION_DATABASE_URL (Tills). No-op if unset."""
    global _transaction_pool
    if _transaction_pool is not None:
        return
    url = get_transaction_database_url()
    if not url:
        return
    _transaction_pool = ConnectionPool(
        conninfo=url,
        min_size=min_size,
        max_size=max_size,
        max_idle=300,
        check=ConnectionPool.check_connection,
        kwargs=_pool_kwargs(),
    )


def close_transaction_pool() -> None:
    global _transaction_pool
    if _transaction_pool is not None:
        _transaction_pool.close()
        _transaction_pool = None


def get_pool() -> ConnectionPool:
    if _pool is None:
        init_pool()
    assert _pool is not None
    return _pool


def get_transaction_pool() -> Optional[ConnectionPool]:
    if _transaction_pool is None:
        init_transaction_pool()
    return _transaction_pool


@contextmanager
def get_conn() -> Generator[psycopg.Connection, None, None]:
    with get_pool().connection() as conn:
        yield conn


@contextmanager
def get_transaction_conn() -> Generator[psycopg.Connection, None, None]:
    pool = get_transaction_pool()
    if pool is None:
        raise RuntimeError("TRANSACTION_DATABASE_URL is not set")
    with pool.connection() as conn:
        yield conn
