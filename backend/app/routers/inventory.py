from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.deps import CurrentUser, get_current_user
from core.roles import (
    MODULE_FOOD_KUKU,
    MODULE_SNACKS_DRINKS,
    MODULE_STOCK_ITEMS,
    can_access_module,
)
from db import daily as daily_db

router = APIRouter(tags=["inventory"])

GROUP_MODULE_MAP = {
    "snacks_drinks": MODULE_SNACKS_DRINKS,
    "food_kuku": MODULE_FOOD_KUKU,
    "stock": MODULE_STOCK_ITEMS,
}


def _check_group_access(user: CurrentUser, group: str) -> None:
    module = GROUP_MODULE_MAP.get(group)
    if not module:
        raise HTTPException(status_code=400, detail="Invalid group")
    if not can_access_module(user.role, module):
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("/inventory/audit")
def inventory_audit(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    group: str = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
):
    _check_group_access(user, group)
    rows = daily_db.get_inventory_audit(group, date_from, date_to)
    return {"group": group, "date_from": str(date_from), "date_to": str(date_to), "rows": rows}


@router.get("/inventory/changelog")
def inventory_changelog(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    group: str = Query(...),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    _check_group_access(user, group)
    rows = daily_db.get_audit_timeline(group, date_from, date_to)
    return {"group": group, "entries": rows}
