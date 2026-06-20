from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.deps import CurrentUser, require_module
from app.schemas.daily import DailyStockPayload
from core.roles import MODULE_SNACKS_DRINKS
from db import daily as daily_db

router = APIRouter(tags=["snacks-drinks"])


@router.get("/snacks-drinks")
def get_snacks_drinks(
    user: Annotated[CurrentUser, Depends(require_module(MODULE_SNACKS_DRINKS))],
    entry_date: date = Query(..., alias="date"),
):
    rows = daily_db.get_snacks_drinks_daily(entry_date)
    total_sold_units = sum(float(r.get("sold_units", 0)) for r in rows)
    total_revenue = sum(float(r.get("revenue", 0)) for r in rows)
    return {
        "date": str(entry_date),
        "entries": rows,
        "total_sold_units": total_sold_units,
        "total_revenue": total_revenue,
    }


@router.post("/snacks-drinks")
def save_snacks_drinks(
    payload: DailyStockPayload,
    user: Annotated[CurrentUser, Depends(require_module(MODULE_SNACKS_DRINKS))],
):
    entries = [e.model_dump() for e in payload.entries]
    saved = daily_db.save_snacks_drinks_daily(payload.date, entries, user.user_id)
    return {"saved": saved, "date": str(payload.date)}
