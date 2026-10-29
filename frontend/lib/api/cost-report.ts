import { apiFetch } from "./client";
import type { CostReport } from "../types";

export async function fetchCostReport(dateFrom: string, dateTo: string) {
  const params = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
  });
  return apiFetch<CostReport>(`/api/cost-report?${params.toString()}`);
}
