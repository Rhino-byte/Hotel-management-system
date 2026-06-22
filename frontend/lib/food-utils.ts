import type { QuantityEntry } from "./types";

export function isKukuDish(name: string): boolean {
  return name.toLowerCase().includes("kuku");
}

export function lineRevenue(entry: QuantityEntry): number {
  return Number(entry.quantity ?? 0) * Number(entry.price_ksh ?? 0);
}

export function groupRevenue(rows: QuantityEntry[]): number {
  return rows.reduce((sum, e) => sum + lineRevenue(e), 0);
}

export function splitFoodPreview(entries: QuantityEntry[]): {
  kuku: QuantityEntry[];
  food: QuantityEntry[];
} {
  const kuku: QuantityEntry[] = [];
  const food: QuantityEntry[] = [];
  for (const entry of entries) {
    if (isKukuDish(entry.name)) {
      kuku.push(entry);
    } else {
      food.push(entry);
    }
  }
  return { kuku, food };
}

export function formatKsh(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
