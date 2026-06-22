import type { SnacksEntry } from "../types";
import { apiFetch } from "./client";

export async function fetchSnacksDrinks(date: string) {
  return apiFetch<{
    date: string;
    entries: SnacksEntry[];
    total_sold_units: number;
    total_revenue: number;
  }>(`/api/snacks-drinks?date=${encodeURIComponent(date)}`);
}

export async function saveSnacksDrinks(date: string, entries: SnacksEntry[]) {
  return apiFetch<{ saved: number }>("/api/snacks-drinks", {
    method: "POST",
    body: JSON.stringify({
      date,
      entries: entries.map((e) => ({
        item_id: e.item_id,
        closing_stock: e.closing_stock ?? 0,
        added_stock: e.added_stock ?? 0,
      })),
    }),
  });
}
