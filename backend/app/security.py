import os
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

JWT_ALGORITHM = "HS256"
DEFAULT_JWT_SECRET = "change-me-in-production"


def _jwt_secret() -> str:
    return os.getenv("JWT_SECRET", DEFAULT_JWT_SECRET)


def _jwt_expire_hours() -> int:
    return int(os.getenv("JWT_EXPIRE_HOURS", "24"))


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(
    employee_id: int,
    hotel_role: str,
    display_name: str,
    payroll_role: str,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=_jwt_expire_hours())
    payload = {
        "sub": str(employee_id),
        "role": hotel_role,
        "payroll_role": payroll_role,
        "display_name": display_name,
        "exp": expire,
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])


def safe_decode_token(token: str) -> dict[str, Any] | None:
    try:
        return decode_token(token)
    except JWTError:
        return None
