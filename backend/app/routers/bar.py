from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

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
    total_sold_units = sum(
        float(r["sold_units"]) for r in rows if r.get("sold_units") is not None
    )
    total_revenue = sum(
        float(r["revenue"]) for r in rows if r.get("revenue") is not None
    )
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
    if not payload.entries:
        raise HTTPException(status_code=400, detail="No entries to save")
    entries = [e.model_dump() for e in payload.entries]
    try:
        saved = daily_db.save_bar_daily(payload.date, entries, user.user_id)
    except ValueError as exc:
        msg = str(exc)
        if msg.startswith("closing_exceeds_total:"):
            raise HTTPException(
                status_code=400,
                detail="Closing cannot exceed Total for one or more items. Fix highlighted rows.",
            ) from exc
        raise HTTPException(status_code=400, detail=msg) from exc
    return {"saved": saved, "date": str(payload.date)}
