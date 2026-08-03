import { apiFetch } from "./client";
import type { TillsReport } from "../types";

export async function fetchTillsReport(dateFrom: string, dateTo: string) {
  const params = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
  });
  return apiFetch<TillsReport>(`/api/tills/report?${params.toString()}`);
}
