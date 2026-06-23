from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.deps import CurrentUser, require_admin
from app.schemas.admin import (
    HotelRoleUpdatePayload,
    PriceUpdatePayload,
    StockItemPayload,
    SubcategoryUpdatePayload,
)
from core.roles import ALL_ROLES, ROLE_ADMIN
from db import admin_audit as admin_audit_db
from db import items as items_db
from db.employees import get_employee_by_id, list_employees_with_hotel_roles, update_employee_hotel_role

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
    admin_audit_db.log_admin_action(
        action_type="price.update",
        performed_by=admin.user_id,
        target_type="item",
        target_id=payload.item_id,
        details={"price_ksh": payload.price_ksh},
    )
    return {"updated": True, "price": row}


@router.put("/prices/subcategory")
def update_subcategory(
    payload: SubcategoryUpdatePayload,
    admin: Annotated[CurrentUser, Depends(require_admin)],
):
    try:
        row = items_db.update_item_subcategory(payload.item_id, payload.subcategory)
    except LookupError:
        raise HTTPException(status_code=404, detail="Item not found or not snacks_drinks")
    admin_audit_db.log_admin_action(
        action_type="item.subcategory.update",
        performed_by=admin.user_id,
        target_type="item",
        target_id=payload.item_id,
        details={"subcategory": payload.subcategory},
    )
    return {"updated": True, "item": row}


@router.get("/items/stock")
def list_stock_catalog(_admin: Annotated[CurrentUser, Depends(require_admin)]):
    items = items_db.list_items_by_group("stock", active_only=False)
    return {"items": items}


@router.post("/items/stock")
def add_stock_item(
    payload: StockItemPayload,
    admin: Annotated[CurrentUser, Depends(require_admin)],
):
    name = payload.name.strip()
    item = items_db.create_stock_item(name, admin.user_id)
    admin_audit_db.log_admin_action(
        action_type="stock_item.create",
        performed_by=admin.user_id,
        target_type="item",
        target_id=item["id"],
        details={"name": name},
    )
    return {"item": item}


@router.get("/admin/employees")
def list_employees(_admin: Annotated[CurrentUser, Depends(require_admin)]):
    employees = list_employees_with_hotel_roles()
    return {"employees": employees}


@router.put("/admin/employees/{employee_id}/hotel-role")
def set_employee_hotel_role(
    employee_id: int,
    payload: HotelRoleUpdatePayload,
    admin: Annotated[CurrentUser, Depends(require_admin)],
):
    hotel_role = payload.hotel_role
    if hotel_role is not None and hotel_role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail="Invalid hotel_role")

    if hotel_role == ROLE_ADMIN and admin.payroll_role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Only payroll ADMIN can assign hotel admin role",
        )

    before = get_employee_by_id(employee_id)
    if not before:
        raise HTTPException(status_code=404, detail="Employee not found")

    employee = update_employee_hotel_role(employee_id, hotel_role)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    admin_audit_db.log_admin_action(
        action_type="employee.hotel_role.update",
        performed_by=admin.user_id,
        target_type="employee",
        target_id=employee_id,
        details={
            "hotel_role": hotel_role,
            "previous_hotel_role": before.get("hotel_role"),
        },
    )
    return {"employee": employee}


@router.get("/admin/actions")
def list_admin_action_log(
    _admin: Annotated[CurrentUser, Depends(require_admin)],
    limit: int = 100,
):
    capped = min(max(limit, 1), 500)
    actions = admin_audit_db.list_admin_actions(capped)
    return {"actions": actions}
