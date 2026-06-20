from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.deps import CurrentUser, require_admin
from app.schemas.admin import HotelRoleUpdatePayload, PriceUpdatePayload, StockItemPayload
from core.roles import ALL_ROLES
from db import items as items_db
from db.employees import list_employees_with_hotel_roles, update_employee_hotel_role

router = APIRouter(tags=["admin"])


@router.get("/prices")
def list_prices(_admin: Annotated[CurrentUser, Depends(require_admin)]):
    items = items_db.list_all_items_with_prices()
    return {"items": items}


@router.put("/prices")
def update_price(
    payload: PriceUpdatePayload,
    admin: Annotated[CurrentUser, Depends(require_admin)],
):
    row = items_db.update_item_price(payload.item_id, payload.price_ksh, admin.user_id)
    return {"updated": True, "price": row}


@router.get("/items/stock")
def list_stock_catalog(_admin: Annotated[CurrentUser, Depends(require_admin)]):
    items = items_db.list_items_by_group("stock", active_only=False)
    return {"items": items}


@router.post("/items/stock")
def add_stock_item(
    payload: StockItemPayload,
    admin: Annotated[CurrentUser, Depends(require_admin)],
):
    item = items_db.create_stock_item(payload.name.strip(), admin.user_id)
    return {"item": item}


@router.get("/admin/employees")
def list_employees(_admin: Annotated[CurrentUser, Depends(require_admin)]):
    employees = list_employees_with_hotel_roles()
    return {"employees": employees}


@router.put("/admin/employees/{employee_id}/hotel-role")
def set_employee_hotel_role(
    employee_id: int,
    payload: HotelRoleUpdatePayload,
    _admin: Annotated[CurrentUser, Depends(require_admin)],
):
    hotel_role = payload.hotel_role
    if hotel_role is not None and hotel_role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail="Invalid hotel_role")
    employee = update_employee_hotel_role(employee_id, hotel_role)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"employee": employee}
