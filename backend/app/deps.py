from typing import Annotated, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.security import safe_decode_token
from core.roles import can_access_module, is_admin
from db.employees import get_employee_by_id

security = HTTPBearer(auto_error=False)


class CurrentUser:
    def __init__(
        self,
        user_id: int,
        role: str,
        first_name: str,
        display_name: str,
        payroll_role: str,
        hotel_role: str | None,
    ):
        self.user_id = user_id
        self.role = role
        self.first_name = first_name
        self.display_name = display_name
        self.payroll_role = payroll_role
        self.hotel_role = hotel_role


def _employee_to_current_user(employee: dict) -> CurrentUser:
    effective = employee.get("effective_hotel_role")
    if not effective:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No hotel access assigned",
        )
    return CurrentUser(
        user_id=int(employee["id"]),
        role=str(effective),
        first_name=str(employee["first_name"]),
        display_name=str(employee["display_name"]),
        payroll_role=str(employee["payroll_role"]),
        hotel_role=employee.get("hotel_role"),
    )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> CurrentUser:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = safe_decode_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    employee_id = int(payload["sub"])
    employee = get_employee_by_id(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Employee not found",
        )
    return _employee_to_current_user(employee)


def require_module(module: str) -> Callable:
    async def _guard(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if not can_access_module(user.role, module):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied for module: {module}",
            )
        return user

    return _guard


async def require_admin(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
    if not is_admin(user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
