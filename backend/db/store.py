"""Read store stock from the Google Sheet tabs Sheet1 and Transactions.

Transactions columns: A timestamp (UTC), C item name, D type, E quantity,
H destination. Cost is type out to Kitchen or Hotel. Sheet1 column B is the
item list. The Corrections tab is not read.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from db.connection import load_env_file

logger = logging.getLogger("hotel_api")

_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly"
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_SHEETS_URL = "https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range_name}"

_OUT_TYPES = frozenset({"out", "stock out", "stock_out", "stockout"})
_IN_TYPES = frozenset({"in", "stock in", "stock_in", "stockin"})

_token_lock = threading.Lock()
_token: Optional[tuple[str, float]] = None


def name_key(value: Optional[str]) -> str:
    return " ".join((value or "").strip().lower().split())


def _nairobi():
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo("Africa/Nairobi")
    except Exception:
        return timezone(timedelta(hours=3))


def _strip_quotes(value: str) -> str:
    text = value.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in ("'", '"'):
        return text[1:-1].strip()
    return text


def _pem(raw: str) -> str:
    """Accept a PEM block, a one-line key, or a JSON private_key with escaped newlines."""
    text = raw.strip().replace("\\n", "\n")
    begin = "-----BEGIN PRIVATE KEY-----"
    end = "-----END PRIVATE KEY-----"
    if "BEGIN RSA PRIVATE KEY" in text:
        begin = "-----BEGIN RSA PRIVATE KEY-----"
        end = "-----END RSA PRIVATE KEY-----"
    if begin in text and end in text:
        body = "".join(text.split(begin, 1)[1].split(end, 1)[0].split())
        lines = [body[i : i + 64] for i in range(0, len(body), 64)]
        return f"{begin}\n" + "\n".join(lines) + f"\n{end}\n"
    return text if text.endswith("\n") else text + "\n"


def _credentials() -> Optional[tuple[str, dict[str, Any]]]:
    load_env_file()
    spreadsheet_id = _strip_quotes(os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID", ""))
    raw = _strip_quotes(os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", ""))
    email = _strip_quotes(os.getenv("GOOGLE_SERVICE_ACCOUNT_EMAIL", ""))
    if not spreadsheet_id or not raw:
        return None
    if raw.lstrip().startswith("-----BEGIN") or "BEGIN PRIVATE KEY" in raw or "BEGIN RSA PRIVATE KEY" in raw:
        if not email:
            raise ValueError(
                "GOOGLE_SERVICE_ACCOUNT_EMAIL is required when GOOGLE_SERVICE_ACCOUNT_JSON is only the private key."
            )
        return spreadsheet_id, {"client_email": email, "private_key": _pem(raw)}
    try:
        info = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON")
    if not info.get("client_email"):
        if not email:
            raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email")
        info["client_email"] = email
    if not info.get("private_key"):
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON is missing private_key")
    info["private_key"] = _pem(str(info["private_key"]))
    return spreadsheet_id, info


def sheets_configured() -> bool:
    load_env_file()
    return bool(os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID", "").strip()) and bool(
        os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    )


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _access_token(info: dict[str, Any]) -> str:
    global _token
    now = time.time()
    with _token_lock:
        if _token is not None and _token[1] > now + 60:
            return _token[0]
        issued = int(now)
        header = _b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode("utf-8"))
        claim = _b64url(
            json.dumps(
                {
                    "iss": info["client_email"],
                    "scope": _SHEETS_SCOPE,
                    "aud": _TOKEN_URL,
                    "iat": issued,
                    "exp": issued + 3600,
                }
            ).encode("utf-8")
        )
        signing_input = f"{header}.{claim}".encode("ascii")
        key = serialization.load_pem_private_key(info["private_key"].encode("utf-8"), password=None)
        signature = key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
        assertion = f"{header}.{claim}.{_b64url(signature)}"
        body = urllib.parse.urlencode(
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            }
        ).encode("utf-8")
        request = urllib.request.Request(
            _TOKEN_URL,
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
        access = str(payload["access_token"])
        _token = (access, now + float(payload.get("expires_in") or 3600))
        return access


def _values(spreadsheet_id: str, token: str, range_name: str) -> list[list[str]]:
    url = _SHEETS_URL.format(
        spreadsheet_id=urllib.parse.quote(spreadsheet_id, safe=""),
        range_name=urllib.parse.quote(range_name, safe=""),
    )
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))
    rows = payload.get("values") or []
    return [[str(cell) if cell is not None else "" for cell in row] for row in rows]


def _cell(row: list[str], index: int) -> str:
    if index >= len(row):
        return ""
    return row[index].strip()


def _movement_type(raw: str) -> str:
    text = raw.strip().lower()
    if text in _OUT_TYPES:
        return "out"
    if text in _IN_TYPES:
        return "in"
    return ""


def _as_float(raw: str) -> float:
    text = raw.strip().replace(",", "")
    if not text:
        return 0.0
    return float(text)


def _nairobi_day(raw: str) -> Optional[date]:
    text = raw.strip()
    if not text or text.lower() == "timestamp":
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(_nairobi()).date()


def _empty(status: str, note: Optional[str]) -> dict[str, Any]:
    return {
        "status": status,
        "note": note,
        "days_present": set(),
        "kitchen_out": {},
        "other_out": {},
        "correction_in": {},
    }


def _add(bucket: dict, key, qty: float) -> None:
    bucket[key] = bucket.get(key, 0.0) + qty


def _open_sheet() -> tuple[str, str]:
    loaded = _credentials()
    if loaded is None:
        raise RuntimeError("unconfigured")
    spreadsheet_id, info = loaded
    return spreadsheet_id, _access_token(info)


def ping_sheet() -> str:
    """Return ok, skipped, or error for the health check."""
    if not sheets_configured():
        return "skipped"
    try:
        spreadsheet_id, token = _open_sheet()
        _values(spreadsheet_id, token, "Sheet1!B1")
        return "ok"
    except Exception:
        logger.exception("Store sheet unavailable")
        return "error"


def list_item_names() -> list[str]:
    """Item names from Sheet1 column B. Empty when the sheet is unset or down."""
    if not sheets_configured():
        return []
    try:
        spreadsheet_id, token = _open_sheet()
        rows = _values(spreadsheet_id, token, "Sheet1!B:B")
        names: list[str] = []
        seen: set[str] = set()
        for row in rows:
            name = _cell(row, 0)
            key = name_key(name)
            if not key or key == "item name" or key in seen:
                continue
            seen.add(key)
            names.append(name)
        names.sort(key=name_key)
        return names
    except Exception:
        logger.exception("Store item names unavailable")
        return []


def load_movements(date_from: date, date_to: date) -> dict[str, Any]:
    """Kitchen and other stock out from the Transactions tab."""
    if not sheets_configured():
        return _empty(
            "unconfigured",
            "Store sheet is not configured. Store-based cost is waiting.",
        )
    try:
        spreadsheet_id, token = _open_sheet()
        rows = _values(spreadsheet_id, token, "Transactions!A:H")
    except ValueError as exc:
        return _empty("unavailable", f"{exc} Store-based cost is waiting.")
    except Exception:
        logger.exception("Store movements unavailable")
        return _empty(
            "unavailable",
            "Store sheet is unavailable. Store-based cost is waiting.",
        )

    snapshot = _empty("ok", None)
    for row in rows:
        day = _nairobi_day(_cell(row, 0))
        if day is None or day < date_from or day > date_to:
            continue
        snapshot["days_present"].add(day)
        if _movement_type(_cell(row, 3)) != "out":
            continue
        item = name_key(_cell(row, 2))
        if not item or item == "item name":
            continue
        try:
            qty = _as_float(_cell(row, 4))
        except ValueError:
            continue
        destination = " ".join(_cell(row, 7).split())
        if destination.lower() in {"kitchen", "hotel"}:
            _add(snapshot["kitchen_out"], (day, item), qty)
        else:
            _add(snapshot["other_out"], (day, item, destination or "(blank)"), qty)
    return snapshot
