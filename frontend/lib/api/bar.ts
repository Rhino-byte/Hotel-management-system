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
      entries: entries.map((e) => ({
        item_id: e.item_id,
        added_stock: e.added_stock ?? 0,
        closing_stock: e.closing_stock ?? 0,
      })),
    }),
  });
}
