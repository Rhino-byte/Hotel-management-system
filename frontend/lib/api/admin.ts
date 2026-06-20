import type { AuditRow, PriceItem } from "../types";
import { apiFetch } from "./client";

export async function fetchPrices() {
  return apiFetch<{ items: PriceItem[] }>("/api/prices");
}

export async function updatePrice(itemId: number, priceKsh: number) {
  return apiFetch<{ updated: boolean }>("/api/prices", {
    method: "PUT",
    body: JSON.stringify({ item_id: itemId, price_ksh: priceKsh }),
  });
}

export async function fetchStockCatalog() {
  return apiFetch<{ items: { id: number; name: string; is_active: boolean }[] }>(
    "/api/items/stock"
  );
}

export async function addStockCatalogItem(name: string) {
  return apiFetch<{ item: { id: number; name: string } }>("/api/items/stock", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function fetchInventoryAudit(
  group: string,
  dateFrom: string,
  dateTo: string
) {
  return apiFetch<{ rows: AuditRow[] }>(
    `/api/inventory/audit?group=${group}&date_from=${dateFrom}&date_to=${dateTo}`
  );
}

export async function fetchEmployees() {
  return apiFetch<{ employees: import("../types").EmployeeRow[] }>("/api/admin/employees");
}

export async function updateEmployeeHotelRole(employeeId: number, hotelRole: string | null) {
  return apiFetch<{ employee: import("../types").EmployeeRow }>(
    `/api/admin/employees/${employeeId}/hotel-role`,
    {
      method: "PUT",
      body: JSON.stringify({ hotel_role: hotelRole }),
    }
  );
}
