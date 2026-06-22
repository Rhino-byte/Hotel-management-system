from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.deps import CurrentUser, require_module
from app.schemas.admin import FoodDishPayload
from app.schemas.daily import DailyQuantityPayload
from core.roles import MODULE_FOOD_KUKU, ROLE_FOOD_CLERK
from db import admin_audit as admin_audit_db
from db import daily as daily_db
from db import items as items_db

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
        "locked": daily_db.is_food_kuku_day_locked(entry_date),
    }


@router.post("/food-kuku/dishes")
def add_food_dish(
    payload: FoodDishPayload,
    user: Annotated[CurrentUser, Depends(require_module(MODULE_FOOD_KUKU))],
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Dish name is required")
    item = items_db.create_food_item(name, payload.price_ksh, user.user_id)
    admin_audit_db.log_admin_action(
        action_type="food_dish.create",
        performed_by=user.user_id,
        target_type="item",
        target_id=item["id"],
        details={"name": name, "price_ksh": payload.price_ksh},
    )
    return {"item": item}


@router.post("/food-kuku")
def save_food_kuku(
    payload: DailyQuantityPayload,
    user: Annotated[CurrentUser, Depends(require_module(MODULE_FOOD_KUKU))],
):
    if not payload.entries:
        raise HTTPException(status_code=400, detail="No entries to save")
    if (
        user.role == ROLE_FOOD_CLERK
        and daily_db.is_food_kuku_day_locked(payload.date)
    ):
        raise HTTPException(
            status_code=403,
            detail="This day is finalized and cannot be edited.",
        )
    entries = [e.model_dump() for e in payload.entries]
    result = daily_db.save_food_kuku_daily(
        payload.date,
        entries,
        user.user_id,
        finalize=payload.finalize,
    )
    locked = daily_db.is_food_kuku_day_locked(payload.date)
    return {"date": str(payload.date), **result, "locked": locked}
