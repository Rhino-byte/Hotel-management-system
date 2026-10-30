from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.deps import CurrentUser, require_management
from db import cost_report as cost_report_db

router = APIRouter(tags=["cost-report"])


@router.get("/cost-report")
def get_cost_report(
    _user: Annotated[CurrentUser, Depends(require_management)],
    date_from: date = Query(...),
    date_to: date = Query(...),
):
    if date_from > date_to:
        raise HTTPException(
            status_code=400,
            detail="date_from must be on or before date_to.",
        )
    return cost_report_db.cost_report(date_from, date_to)
