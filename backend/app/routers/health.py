from fastapi import APIRouter, Response, status

from db.connection import get_conn, get_transaction_conn, get_transaction_database_url

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/ready")
def health_ready(response: Response):
    """Ping hotel DB and, when configured, transactions DB (keeps both Neons warm)."""
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

    if database == "error" or transactions == "error":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "unavailable",
            "database": database,
            "transactions": transactions,
        }
    return {
        "status": "ok",
        "database": database,
        "transactions": transactions,
    }
