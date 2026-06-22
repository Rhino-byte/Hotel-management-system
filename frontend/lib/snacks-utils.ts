import type { SnacksEntry } from "./types";

export function isClosingSet(entry: SnacksEntry): boolean {
  return entry.closing_stock !== null && entry.closing_stock !== undefined;
}

export function recomputeSnacksEntry(entry: SnacksEntry): SnacksEntry {
  const previous = Number(entry.previous_closing ?? 0);
  const added = entry.added_stock ?? 0;
  const total = previous + added;
  const price = Number(entry.price_ksh ?? 0);
  if (!isClosingSet(entry)) {
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

export function snacksTotals(entries: SnacksEntry[]) {
  let totalSoldUnits = 0;
  let totalRevenue = 0;
  for (const e of entries) {
    if (e.sold_units != null) totalSoldUnits += Number(e.sold_units);
    if (e.revenue != null) totalRevenue += Number(e.revenue);
  }
  return { totalSoldUnits, totalRevenue };
}

export function countClosingSet(entries: SnacksEntry[]): number {
  return entries.filter(isClosingSet).length;
}

export function unsetClosingWithStock(entries: SnacksEntry[]): SnacksEntry[] {
  return entries.filter((e) => {
    if (isClosingSet(e)) return false;
    const previous = Number(e.previous_closing ?? 0);
    const added = e.added_stock ?? 0;
    return previous + added > 0;
  });
}

export function soldOutDirtyEntries(
  entries: SnacksEntry[],
  dirtyIds: Set<number>
): SnacksEntry[] {
  return entries.filter((e) => {
    if (!dirtyIds.has(e.item_id)) return false;
    if (!isClosingSet(e) || Number(e.closing_stock) !== 0) return false;
    const previous = Number(e.previous_closing ?? 0);
    const added = e.added_stock ?? 0;
    return previous + added > 0;
  });
}

export function formatSnacksCell(value: number | null | undefined, dash = true): string {
  if (value === null || value === undefined) return dash ? "—" : "";
  return Number(value).toLocaleString();
}
