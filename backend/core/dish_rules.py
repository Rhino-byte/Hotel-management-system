"""Shared name-based rules for the sales audit report."""

from typing import Final


CHAPATIS_PER_DISH: Final[int] = 2

CATEGORY_RULES: Final[dict[str, tuple[str, ...]]] = {
    "ugali": ("ugali",),
    "rice": ("rice", "wali", "mchele"),
    "matumbo": ("matumbo",),
    "kuku": ("kuku",),
    "mix": ("mix", "beans", "minji", "matoke"),
    "fries": ("fry", "fries", "beef"),
    "managu": ("managu",),
}

CATEGORY_LABELS: Final[dict[str, str]] = {
    "ugali": "Ugali",
    "rice": "Rice",
    "matumbo": "Matumbo",
    "kuku": "Kuku",
    "mix": "Mix",
    "fries": "Fries",
    "managu": "Managu",
}

CHAPATI_DISH_KEYWORDS: Final[tuple[str, ...]] = ("chapo", "chapati")


def classify(name: str) -> set[str]:
    """Return every audit category matched by a dish name."""
    normalized = name.casefold()
    return {
        key
        for key, keywords in CATEGORY_RULES.items()
        if any(keyword in normalized for keyword in keywords)
    }


def is_chapati_dish(name: str) -> bool:
    normalized = name.casefold()
    return any(keyword in normalized for keyword in CHAPATI_DISH_KEYWORDS)
