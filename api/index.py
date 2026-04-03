import json
import os
from datetime import date
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from google.oauth2 import service_account
from googleapiclient.discovery import build

from core.pricing import get_categories, get_item_price, get_items_for_category
from core.sales import build_sale_entry


SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
DEFAULT_SPREADSHEET_ID = os.getenv(
    "SPREADSHEET_ID", "1rEZbc1CroKxW99H7AtsISZMY2wWK6430W2GAKfV2J3M"
)
DEFAULT_SALES_SHEET = os.getenv("SALES_SHEET", "Sales_data")

app = FastAPI(title="Hotel Management API", version="1.0.0")


class SalePayload(BaseModel):
    category: str
    item: str
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)
    notes: str = ""
    entry_date: date = Field(default_factory=date.today)


def _service_account_info() -> Dict[str, Any]:
    json_blob = os.getenv("GCP_SERVICE_ACCOUNT_JSON") or os.getenv("GCP_SERVICE_ACCOUNT")
    if json_blob:
        return json.loads(json_blob)

    credentials_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "credentials.json")
    if os.path.exists(credentials_path):
        with open(credentials_path, "r", encoding="utf-8") as f:
            return json.load(f)
    raise ValueError("Missing Google credentials. Set GCP_SERVICE_ACCOUNT_JSON env variable.")


def _load_prices() -> Dict[str, Dict[str, float]]:
    prices_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "item_prices.json")
    if os.path.exists(prices_path):
        with open(prices_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _get_sheets_service():
    info = _service_account_info()
    credentials = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("sheets", "v4", credentials=credentials)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/categories")
def categories():
    prices = _load_prices()
    return {"categories": get_categories(prices)}


@app.get("/api/items")
def items(category: str):
    prices = _load_prices()
    return {"category": category, "items": get_items_for_category(prices, category)}


@app.get("/api/price")
def price(category: str, item: str):
    prices = _load_prices()
    return {
        "category": category,
        "item": item,
        "price": get_item_price(prices, category, item, default=0.0),
    }


@app.post("/api/sales")
def create_sale(payload: SalePayload):
    sale_entry = build_sale_entry(
        payload.entry_date, payload.item, payload.quantity, payload.price, payload.category, payload.notes
    )
    values = [[
        str(payload.entry_date),
        payload.item,
        payload.quantity,
        payload.price,
        sale_entry["Total"],
        payload.category,
        payload.notes,
    ]]
    body = {"values": values}

    try:
        service = _get_sheets_service()
        service.spreadsheets().values().append(
            spreadsheetId=DEFAULT_SPREADSHEET_ID,
            range=f"{DEFAULT_SALES_SHEET}!A:G",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body=body,
        ).execute()
        return {"saved": True, "entry": sale_entry}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save sale: {exc}") from exc
