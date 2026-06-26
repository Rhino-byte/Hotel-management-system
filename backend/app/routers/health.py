from fastapi import APIRouter, Response, status

from db.connection import get_conn

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/ready")
def health_ready(response: Response):
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1").fetchone()
    except Exception:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable", "database": "error"}
    return {"status": "ok", "database": "ok"}
