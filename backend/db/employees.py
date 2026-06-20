from typing import Any, Optional

from core.hotel_access import resolve_hotel_role
from db.connection import get_conn


def authenticate_employee(first_name: str, pin: int) -> Optional[dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT e.id,
                   e.first_name,
                   e.last_name,
                   e.role::text AS payroll_role,
                   e.hotel_role::text AS hotel_role
            FROM user_auth ua
            JOIN employee e ON e.id = ua.id
            WHERE LOWER(ua.first_name) = LOWER(%s) AND ua.pin = %s
            LIMIT 1
            """,
            (first_name.strip(), pin),
        ).fetchone()
        if not row:
            return None
        employee = dict(row)
        employee["display_name"] = f"{employee['first_name']} {employee['last_name']}".strip()
        employee["effective_hotel_role"] = resolve_hotel_role(
            employee["payroll_role"], employee.get("hotel_role")
        )
        return employee


def get_employee_by_id(employee_id: int) -> Optional[dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT e.id,
                   e.first_name,
                   e.last_name,
                   e.role::text AS payroll_role,
                   e.hotel_role::text AS hotel_role
            FROM employee e
            WHERE e.id = %s
            LIMIT 1
            """,
            (employee_id,),
        ).fetchone()
        if not row:
            return None
        employee = dict(row)
        employee["display_name"] = f"{employee['first_name']} {employee['last_name']}".strip()
        employee["effective_hotel_role"] = resolve_hotel_role(
            employee["payroll_role"], employee.get("hotel_role")
        )
        return employee


def list_employees_with_hotel_roles() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT e.id,
                   e.first_name,
                   e.last_name,
                   e.role::text AS payroll_role,
                   e.hotel_role::text AS hotel_role
            FROM employee e
            ORDER BY e.first_name, e.last_name
            """
        ).fetchall()
        result = []
        for row in rows:
            emp = dict(row)
            emp["display_name"] = f"{emp['first_name']} {emp['last_name']}".strip()
            emp["effective_hotel_role"] = resolve_hotel_role(
                emp["payroll_role"], emp.get("hotel_role")
            )
            result.append(emp)
        return result


def update_employee_hotel_role(employee_id: int, hotel_role: Optional[str]) -> Optional[dict[str, Any]]:
    with get_conn() as conn:
        if hotel_role is None:
            conn.execute(
                "UPDATE employee SET hotel_role = NULL WHERE id = %s",
                (employee_id,),
            )
        else:
            conn.execute(
                "UPDATE employee SET hotel_role = %s::hotel_role WHERE id = %s",
                (hotel_role, employee_id),
            )
        conn.commit()
    return get_employee_by_id(employee_id)
