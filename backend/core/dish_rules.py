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

# Mix keywords alone count as Mix; if any of these appear too, drop Mix
# (e.g. "matoke beef" is Fries, not Mix).
MIX_EXCLUDE: Final[tuple[str, ...]] = ("beef", "managu", "kuku", "matumbo")

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
    matched = {
        key
        for key, keywords in CATEGORY_RULES.items()
        if any(keyword in normalized for keyword in keywords)
    }
    if "mix" in matched and any(ex in normalized for ex in MIX_EXCLUDE):
        matched.discard("mix")
    return matched


def is_chapati_dish(name: str) -> bool:
    normalized = name.casefold()
    return any(keyword in normalized for keyword in CHAPATI_DISH_KEYWORDS)
