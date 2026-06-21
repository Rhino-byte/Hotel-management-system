from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.deps import CurrentUser, require_module
from app.schemas.daily import DailyBarPayload
from core.roles import MODULE_BAR
from db import daily as daily_db

router = APIRouter(tags=["bar"])


@router.get("/bar")
def get_bar(
    user: Annotated[CurrentUser, Depends(require_module(MODULE_BAR))],
    entry_date: date = Query(..., alias="date"),
):
    rows = daily_db.get_bar_daily(entry_date)
    total_sold_units = sum(float(r.get("sold_units", 0)) for r in rows)
    total_revenue = sum(float(r.get("revenue", 0)) for r in rows)
    return {
        "date": str(entry_date),
        "entries": rows,
        "total_sold_units": total_sold_units,
        "total_revenue": total_revenue,
    }


@router.post("/bar")
def save_bar(
    payload: DailyBarPayload,
    user: Annotated[CurrentUser, Depends(require_module(MODULE_BAR))],
):
    entries = [e.model_dump() for e in payload.entries]
    saved = daily_db.save_bar_daily(payload.date, entries, user.user_id)
    return {"saved": saved, "date": str(payload.date)}
