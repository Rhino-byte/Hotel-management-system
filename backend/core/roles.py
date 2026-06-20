from typing import FrozenSet, List

ROLE_ADMIN = "admin"
ROLE_SNACKS_CLERK = "snacks_clerk"
ROLE_FOOD_CLERK = "food_clerk"
ROLE_STOCK_CLERK = "stock_clerk"

ALL_ROLES = frozenset(
    {ROLE_ADMIN, ROLE_SNACKS_CLERK, ROLE_FOOD_CLERK, ROLE_STOCK_CLERK}
)

MODULE_SNACKS_DRINKS = "snacks_drinks"
MODULE_FOOD_KUKU = "food_kuku"
MODULE_STOCK_ITEMS = "stock_items"

ROLE_MODULES: dict[str, FrozenSet[str]] = {
    ROLE_ADMIN: frozenset({MODULE_SNACKS_DRINKS, MODULE_FOOD_KUKU, MODULE_STOCK_ITEMS}),
    ROLE_SNACKS_CLERK: frozenset({MODULE_SNACKS_DRINKS}),
    ROLE_FOOD_CLERK: frozenset({MODULE_FOOD_KUKU}),
    ROLE_STOCK_CLERK: frozenset({MODULE_STOCK_ITEMS}),
}


def allowed_modules(role: str) -> List[str]:
    modules = ROLE_MODULES.get(role, frozenset())
    return sorted(modules)


def can_access_module(role: str, module: str) -> bool:
    return module in ROLE_MODULES.get(role, frozenset())


def is_admin(role: str) -> bool:
    return role == ROLE_ADMIN


def default_route_for_role(role: str) -> str:
    modules = allowed_modules(role)
    if not modules:
        return "/login"
    route_map = {
        MODULE_SNACKS_DRINKS: "/snacks-drinks",
        MODULE_FOOD_KUKU: "/food-kuku",
        MODULE_STOCK_ITEMS: "/stock-items",
    }
    if is_admin(role):
        return "/snacks-drinks"
    return route_map.get(modules[0], "/login")
