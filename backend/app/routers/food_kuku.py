from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.deps import CurrentUser, require_module
from app.schemas.daily import DailyQuantityPayload
from core.roles import MODULE_FOOD_KUKU
from db import daily as daily_db

router = APIRouter(tags=["food-kuku"])


@router.get("/food-kuku")
def get_food_kuku(
    user: Annotated[CurrentUser, Depends(require_module(MODULE_FOOD_KUKU))],
    entry_date: date = Query(..., alias="date"),
):
    rows = daily_db.get_food_kuku_daily(entry_date)
    total_revenue = sum(float(r["quantity"]) * float(r["price_ksh"]) for r in rows)
    return {
        "date": str(entry_date),
        "entries": rows,
        "total_revenue": total_revenue,
    }


@router.post("/food-kuku")
def save_food_kuku(
    payload: DailyQuantityPayload,
    user: Annotated[CurrentUser, Depends(require_module(MODULE_FOOD_KUKU))],
):
    entries = [e.model_dump() for e in payload.entries]
    result = daily_db.save_food_kuku_daily(payload.date, entries, user.user_id)
    return {"date": str(payload.date), **result}
