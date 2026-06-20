import type { QuantityEntry } from "../types";
import { apiFetch } from "./client";

export async function fetchFoodKuku(date: string) {
  return apiFetch<{
    date: string;
    entries: QuantityEntry[];
    total_revenue: number;
  }>(`/api/food-kuku?date=${encodeURIComponent(date)}`);
}

export async function saveFoodKuku(date: string, entries: QuantityEntry[]) {
  return apiFetch<{ saved: number; total_revenue: number }>("/api/food-kuku", {
    method: "POST",
    body: JSON.stringify({
      date,
      entries: entries.map((e) => ({
        item_id: e.item_id,
        quantity: e.quantity ?? 0,
      })),
    }),
  });
}
