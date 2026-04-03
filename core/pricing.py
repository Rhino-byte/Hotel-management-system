from typing import Dict, List, Optional, Tuple


PriceMap = Dict[str, Dict[str, float]]


def get_categories(prices: PriceMap) -> List[str]:
    return sorted(list(prices.keys()))


def get_items_for_category(prices: PriceMap, category: str) -> List[str]:
    if category not in prices:
        return []
    return list(prices[category].keys())


def resolve_item_name(prices: PriceMap, category: str, item_name: str) -> Optional[str]:
    category_items = prices.get(category, {})
    if item_name in category_items:
        return item_name

    target = str(item_name).strip().lower()
    for existing_item in category_items.keys():
        if str(existing_item).strip().lower() == target:
            return existing_item
    return None


def get_item_price(prices: PriceMap, category: str, item_name: str, default: float = 0.0) -> float:
    resolved_item = resolve_item_name(prices, category, item_name)
    if not resolved_item:
        return float(default)
    return float(prices.get(category, {}).get(resolved_item, default))


def find_item_category_and_price(prices: PriceMap, item_name: str) -> Tuple[str, float]:
    target = str(item_name).strip().lower()
    for category, items in prices.items():
        for item, price in items.items():
            if str(item).strip().lower() == target:
                return category, float(price)
    return "", 0.0
