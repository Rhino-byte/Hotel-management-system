from typing import Dict, List

from core.pricing import get_item_price


def build_sale_entry(entry_date, item: str, quantity: float, price: float, category: str, notes: str = "") -> Dict:
    total = float(quantity) * float(price)
    return {
        "Date": f"{entry_date} 00:00:00",
        "Item": item,
        "Quantity": quantity,
        "Price": float(price),
        "Total": total,
        "Category": category,
        "Notes": notes,
    }


def group_entries_by_date_and_item(entries: List[Dict]) -> Dict[str, Dict[str, float]]:
    grouped: Dict[str, Dict[str, float]] = {}
    for entry in entries:
        date_str = str(entry.get("Date", "")).split()[0]
        item = str(entry.get("Item", ""))
        quantity = float(entry.get("Quantity", 0))

        if not date_str or not item:
            continue

        if date_str not in grouped:
            grouped[date_str] = {}
        grouped[date_str][item] = grouped[date_str].get(item, 0) + quantity
    return grouped


def build_sheet_row(column_headers: List[str], date_str: str, item_quantities: Dict[str, float], prices: Dict[str, Dict[str, float]]) -> List[float]:
    row_data: List[float] = []
    for column in column_headers:
        if column == "Date":
            row_data.append(date_str)
        elif column == "Amount":
            total_amount = 0.0
            for item, quantity in item_quantities.items():
                for category in prices.keys():
                    unit_price = get_item_price(prices, category, item, default=-1)
                    if unit_price >= 0:
                        total_amount += float(quantity) * float(unit_price)
                        break
            row_data.append(total_amount)
        else:
            quantity = 0.0
            for item, item_quantity in item_quantities.items():
                if item == column or item.lower() == column.lower():
                    quantity = float(item_quantity)
                    break
            row_data.append(quantity)
    return row_data
