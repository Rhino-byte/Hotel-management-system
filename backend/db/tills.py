from datetime import date, timedelta
from typing import Any

from db.audit_sales import sales_report
from db.connection import get_tills_phone_number, get_transaction_conn


class TillsConfigError(Exception):
    """Raised when TRANSACTION_DATABASE_URL or PHONE_NUMBER is missing."""


def _mask_phone(phone: str) -> str:
    digits = phone.strip()
    if len(digits) <= 4:
        return "****"
    return f"{digits[:3]}****{digits[-2:]}"


def _pct(tills: float, sales: float) -> float:
    if sales <= 0:
        return 0.0
    return (tills / sales) * 100.0


def tills_report(date_from: date, date_to: date) -> dict[str, Any]:
    phone = get_tills_phone_number()
    if not phone:
        raise TillsConfigError("PHONE_NUMBER is not set")

    try:
        with get_transaction_conn() as conn:
            rows = conn.execute(
                """
                SELECT value_date::date AS day,
                       COALESCE(SUM(credit), 0) AS total_credit
                FROM transactions
                WHERE phone_number = %s
                  AND value_date >= %s
                  AND value_date <= %s
                  AND credit IS NOT NULL
                  AND credit > 0
                GROUP BY 1
                ORDER BY 1
                """,
                (phone, date_from, date_to),
            ).fetchall()
    except RuntimeError as exc:
        raise TillsConfigError(str(exc)) from exc

    by_day = {row["day"]: float(row["total_credit"]) for row in rows}

    hotel = sales_report(date_from, date_to)
    sales_by_day = {
        row["entry_date"]: float(row["total"]) for row in hotel["timeseries"]
    }

    timeseries: list[dict[str, Any]] = []
    cursor = date_from
    period_total = 0.0
    sales_period_total = 0.0
    while cursor <= date_to:
        day_key = cursor.isoformat()
        tills = float(by_day.get(cursor, 0.0))
        sales = float(sales_by_day.get(day_key, 0.0))
        period_total += tills
        sales_period_total += sales
        timeseries.append(
            {
                "day": day_key,
                "total": tills,
                "sales_total": sales,
                "pct": _pct(tills, sales),
            }
        )
        cursor += timedelta(days=1)

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "phone_number": _mask_phone(phone),
        "period_total": period_total,
        "sales_period_total": sales_period_total,
        "tills_pct": _pct(period_total, sales_period_total),
        "timeseries": timeseries,
    }
