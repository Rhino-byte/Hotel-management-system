import type {
  AnalyticsCategory,
  AnalyticsGroupTotal,
  AnalyticsItemSold,
  AnalyticsRange,
} from "../types";
import { apiFetch } from "./client";

export async function fetchSalesTotals(range: AnalyticsRange) {
  return apiFetch<{
    range: AnalyticsRange | "day";
    date_from: string;
    date_to: string;
    groups: AnalyticsGroupTotal[];
  }>(`/api/analytics/sales-totals?range=${encodeURIComponent(range)}`);
}

export async function fetchDaySalesTotals(date: string) {
  return apiFetch<{
    range: "day";
    date_from: string;
    date_to: string;
    groups: AnalyticsGroupTotal[];
  }>(`/api/analytics/sales-totals?date=${encodeURIComponent(date)}`);
}

export async function fetchItemsSold(category: AnalyticsCategory, date: string) {
  return apiFetch<{
    category: AnalyticsCategory;
    date: string;
    items: AnalyticsItemSold[];
  }>(
    `/api/analytics/items-sold?category=${encodeURIComponent(category)}&date=${encodeURIComponent(date)}`
  );
}
