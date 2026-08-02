import type { SnacksEntry } from "../types";
import { apiFetch } from "./client";

export async function fetchSnacksDrinks(date: string) {
  return apiFetch<{
    date: string;
    entries: SnacksEntry[];
    total_sold_units: number;
    total_revenue: number;
    locked: boolean;
  }>(`/api/snacks-drinks?date=${encodeURIComponent(date)}`);
}

export async function saveSnacksDrinks(
  date: string,
  entries: SnacksEntry[],
  options?: { finalize?: boolean }
) {
  return apiFetch<{ saved: number; locked: boolean; date: string }>("/api/snacks-drinks", {
    method: "POST",
    body: JSON.stringify({
      date,
      finalize: options?.finalize ?? false,
      entries: entries
        .filter((e) => e.closing_stock !== null && e.closing_stock !== undefined)
        .map((e) => ({
          item_id: e.item_id,
          closing_stock: Number(e.closing_stock),
          added_stock: e.added_stock ?? 0,
        })),
    }),
  });
}
