from typing import Optional

from core.roles import ROLE_ADMIN


def resolve_hotel_role(payroll_role: str, hotel_role: Optional[str]) -> Optional[str]:
    """Resolve effective hotel app role from payroll role + optional hotel_role column."""
    if payroll_role == "ADMIN":
        return ROLE_ADMIN
    if hotel_role:
        return hotel_role
    return None
