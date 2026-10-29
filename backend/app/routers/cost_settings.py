from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.deps import CurrentUser, require_admin, require_module
from app.schemas.cost_settings import CostSettingPayload
from core.roles import MODULE_STOCK_ITEMS
from db import admin_audit as admin_audit_db
from db import cost_settings as cost_settings_db

router = APIRouter(tags=["cost-settings"])


@router.get("/cost-settings")
def get_cost_settings(
    _user: Annotated[CurrentUser, Depends(require_module(MODULE_STOCK_ITEMS))],
):
    return cost_settings_db.list_cost_settings()


@router.post("/cost-settings")
def create_cost_setting(
    payload: CostSettingPayload,
    admin: Annotated[CurrentUser, Depends(require_admin)],
):
    try:
        row = cost_settings_db.create_cost_setting(payload.model_dump(), admin.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    admin_audit_db.log_admin_action(
        action_type="cost_setting.create",
        performed_by=admin.user_id,
        target_type="cost_setting",
        target_id=row["id"],
        details={"name": row["name"], "category": row["category"], "data_source": row["data_source"]},
    )
    return {"setting": row}


@router.put("/cost-settings/{setting_id}")
def update_cost_setting(
    setting_id: int,
    payload: CostSettingPayload,
    admin: Annotated[CurrentUser, Depends(require_admin)],
):
    try:
        row = cost_settings_db.update_cost_setting(setting_id, payload.model_dump(), admin.user_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    admin_audit_db.log_admin_action(
        action_type="cost_setting.update",
        performed_by=admin.user_id,
        target_type="cost_setting",
        target_id=row["id"],
        details={"name": row["name"], "category": row["category"], "data_source": row["data_source"]},
    )
    return {"setting": row}
