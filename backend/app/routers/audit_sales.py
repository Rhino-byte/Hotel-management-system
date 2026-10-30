from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.deps import CurrentUser, require_management
from db import audit_sales as audit_sales_db


router = APIRouter(tags=["audit"])


@router.get("/audit/sales-report")
def sales_report(
    _user: Annotated[CurrentUser, Depends(require_management)],
    date_from: date = Query(...),
    date_to: date = Query(...),
):
    if date_from > date_to:
        raise HTTPException(
            status_code=400,
            detail="date_from must be on or before date_to",
        )
    return audit_sales_db.sales_report(date_from, date_to)
