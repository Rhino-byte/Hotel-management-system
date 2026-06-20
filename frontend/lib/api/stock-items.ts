import type { StockEntry } from "../types";
import { apiFetch } from "./client";

export async function fetchStockItems(date: string) {
  return apiFetch<{ date: string; entries: StockEntry[] }>(
    `/api/stock-items?date=${encodeURIComponent(date)}`
  );
}

export async function saveStockItems(date: string, entries: StockEntry[]) {
  return apiFetch<{ saved: number }>("/api/stock-items", {
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
