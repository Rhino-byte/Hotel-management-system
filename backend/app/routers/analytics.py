from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.deps import CurrentUser, require_admin
from db import analytics as analytics_db

router = APIRouter(tags=["analytics"])

RangeKey = Literal["today", "7d", "30d", "90d"]
CategoryKey = Literal["snacks", "drinks", "food", "kuku"]


def _range_to_dates(range_key: str) -> tuple[date, date]:
    today = date.today()
    if range_key == "today":
        return today, today
    if range_key == "7d":
        return today - timedelta(days=6), today
    if range_key == "30d":
        return today - timedelta(days=29), today
    if range_key == "90d":
        return today - timedelta(days=89), today
    raise ValueError(f"Invalid range: {range_key}")


@router.get("/analytics/sales-totals")
def get_sales_totals(
    _admin: Annotated[CurrentUser, Depends(require_admin)],
    range: RangeKey = Query("today", alias="range"),
):
    try:
        date_from, date_to = _range_to_dates(range)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid range. Use today, 7d, 30d, or 90d.",
        )
    result = analytics_db.sales_totals(date_from, date_to)
    return {"range": range, **result}


@router.get("/analytics/items-sold")
def get_items_sold(
    _admin: Annotated[CurrentUser, Depends(require_admin)],
    category: CategoryKey = Query(...),
    entry_date: date = Query(..., alias="date"),
):
    try:
        return analytics_db.items_sold(category, entry_date)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid category. Use snacks, drinks, food, or kuku.",
        )
