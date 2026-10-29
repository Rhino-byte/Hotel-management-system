from fastapi import APIRouter, Response, status

from db.connection import get_conn, get_transaction_conn, get_transaction_database_url
from db.store import ping_sheet

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/ready")
def health_ready(response: Response):
    """Ping hotel DB, the transactions DB, and the store sheet when configured."""
    database = "ok"
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1").fetchone()
    except Exception:
        database = "error"

    if get_transaction_database_url() is None:
        transactions = "skipped"
    else:
        try:
            with get_transaction_conn() as conn:
                conn.execute("SELECT 1").fetchone()
            transactions = "ok"
        except Exception:
            transactions = "error"

    store = ping_sheet()

    if database == "error" or transactions == "error" or store == "error":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "unavailable",
            "database": database,
            "transactions": transactions,
            "store": store,
        }
    return {
        "status": "ok",
        "database": database,
        "transactions": transactions,
        "store": store,
    }
