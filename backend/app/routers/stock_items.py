from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.deps import CurrentUser, require_module
from app.schemas.daily import DailyStockPayload
from core.roles import MODULE_STOCK_ITEMS
from db import daily as daily_db

router = APIRouter(tags=["stock-items"])


@router.get("/stock-items")
def get_stock_items(
    user: Annotated[CurrentUser, Depends(require_module(MODULE_STOCK_ITEMS))],
    entry_date: date = Query(..., alias="date"),
):
    rows = daily_db.get_stock_items_daily(entry_date)
    return {"date": str(entry_date), "entries": rows}


@router.post("/stock-items")
def save_stock_items(
    payload: DailyStockPayload,
    user: Annotated[CurrentUser, Depends(require_module(MODULE_STOCK_ITEMS))],
):
    entries = [e.model_dump() for e in payload.entries]
    saved = daily_db.save_stock_items_daily(payload.date, entries, user.user_id)
    return {"saved": saved, "date": str(payload.date)}
