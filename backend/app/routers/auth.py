from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from app.deps import CurrentUser, get_current_user
from app.rate_limit import login_rate_limiter
from app.schemas.auth import LoginPayload
from app.security import create_access_token
from core.roles import allowed_modules, default_route_for_role
from db.employees import authenticate_employee, get_employee_by_id

router = APIRouter(tags=["auth"])


def _login_rate_key(request: Request, first_name: str) -> str:
    client_ip = request.client.host if request.client else "unknown"
    return f"{client_ip}:{first_name.strip().lower()}"


def _user_response(employee: dict) -> dict:
    effective = employee["effective_hotel_role"]
    return {
        "id": employee["id"],
        "first_name": employee["first_name"],
        "display_name": employee["display_name"],
        "payroll_role": employee["payroll_role"],
        "hotel_role": employee.get("hotel_role"),
        "role": effective,
        "modules": allowed_modules(effective),
        "default_route": default_route_for_role(effective),
    }


@router.post("/auth/login")
def login(payload: LoginPayload, request: Request):
    rate_key = _login_rate_key(request, payload.first_name)
    if login_rate_limiter.is_blocked(rate_key):
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Try again later.",
        )

    employee = authenticate_employee(payload.first_name, payload.pin)
    if not employee:
        login_rate_limiter.record_failure(rate_key)
        raise HTTPException(status_code=401, detail="Invalid first name or PIN")

    effective = employee.get("effective_hotel_role")
    if not effective:
        login_rate_limiter.record_failure(rate_key)
        raise HTTPException(status_code=403, detail="No hotel access assigned")

    login_rate_limiter.reset(rate_key)
    token = create_access_token(
        employee_id=employee["id"],
        hotel_role=effective,
        display_name=employee["display_name"],
        payroll_role=employee["payroll_role"],
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_response(employee),
    }


@router.get("/me")
def me(user: Annotated[CurrentUser, Depends(get_current_user)]):
    employee = get_employee_by_id(user.user_id)
    if not employee:
        raise HTTPException(status_code=401, detail="Employee not found")
    return _user_response(employee)
