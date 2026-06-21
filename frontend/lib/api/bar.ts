import type { BarEntry } from "../types";
import { apiFetch } from "./client";

export async function fetchBar(date: string) {
  return apiFetch<{
    date: string;
    entries: BarEntry[];
    total_sold_units: number;
    total_revenue: number;
  }>(`/api/bar?date=${encodeURIComponent(date)}`);
}

export async function saveBar(date: string, entries: BarEntry[]) {
  return apiFetch<{ saved: number }>("/api/bar", {
    method: "POST",
    body: JSON.stringify({
      date,
      entries: entries
        .filter((e) => e.closing_stock !== null && e.closing_stock !== undefined)
        .map((e) => ({
          item_id: e.item_id,
          added_stock: e.added_stock ?? 0,
          closing_stock: Number(e.closing_stock),
        })),
    }),
  });
}
