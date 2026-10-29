import type { CostSetting, CostSettingsResponse, StockEntry } from "../types";
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

export async function fetchCostSettings() {
  return apiFetch<CostSettingsResponse>("/api/cost-settings");
}

export async function createCostSetting(setting: Omit<CostSetting, "id" | "display_order">) {
  return apiFetch<{ setting: CostSetting }>("/api/cost-settings", {
    method: "POST",
    body: JSON.stringify(setting),
  });
}

export async function updateCostSetting(id: number, setting: Omit<CostSetting, "id" | "display_order">) {
  return apiFetch<{ setting: CostSetting }>(`/api/cost-settings/${id}`, {
    method: "PUT",
    body: JSON.stringify(setting),
  });
}
