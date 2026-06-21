import type { BarEntry } from "./types";

export function isBbfSet(entry: BarEntry): boolean {
  return entry.closing_stock !== null && entry.closing_stock !== undefined;
}

export function recomputeBarEntry(entry: BarEntry): BarEntry {
  const opening = Number(entry.opening_stock ?? 0);
  const added = entry.added_stock ?? 0;
  const total = opening + added;
  const price = Number(entry.price_ksh ?? 0);
  if (!isBbfSet(entry)) {
    return {
      ...entry,
      total_units: total,
      sold_units: null,
      revenue: null,
    };
  }
  const closing = Number(entry.closing_stock);
  const sold = Math.max(total - closing, 0);
  return {
    ...entry,
    total_units: total,
    sold_units: sold,
    revenue: sold * price,
  };
}

export function barTotals(entries: BarEntry[]) {
  let totalSoldUnits = 0;
  let totalRevenue = 0;
  for (const e of entries) {
    if (e.sold_units != null) totalSoldUnits += Number(e.sold_units);
    if (e.revenue != null) totalRevenue += Number(e.revenue);
  }
  return { totalSoldUnits, totalRevenue };
}

export function countBbfSet(entries: BarEntry[]): number {
  return entries.filter(isBbfSet).length;
}

export function unsetBbfWithStock(entries: BarEntry[]): BarEntry[] {
  return entries.filter((e) => {
    if (isBbfSet(e)) return false;
    const opening = Number(e.opening_stock ?? 0);
    const added = e.added_stock ?? 0;
    return opening + added > 0;
  });
}

export function soldOutDirtyEntries(entries: BarEntry[], dirtyIds: Set<number>): BarEntry[] {
  return entries.filter((e) => {
    if (!dirtyIds.has(e.item_id)) return false;
    if (!isBbfSet(e) || Number(e.closing_stock) !== 0) return false;
    const opening = Number(e.opening_stock ?? 0);
    const added = e.added_stock ?? 0;
    return opening + added > 0;
  });
}

export function formatBarCell(value: number | null | undefined, dash = true): string {
  if (value === null || value === undefined) return dash ? "—" : "";
  return Number(value).toLocaleString();
}
