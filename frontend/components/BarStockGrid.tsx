"use client";

import { formatBarCell } from "../lib/bar-utils";
import type { BarEntry } from "../lib/types";

type Props = {
  entries: BarEntry[];
  onChange: (
    itemId: number,
    field: "added_stock" | "closing_stock",
    value: number | null
  ) => void;
};

function parseInput(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export default function BarStockGrid({ entries, onChange }: Props) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Open</th>
            <th>Add</th>
            <th>Total</th>
            <th>B.B.F</th>
            <th>Sales</th>
            <th>Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((row) => (
            <tr key={row.item_id}>
              <td>{row.name}</td>
              <td>{formatBarCell(row.opening_stock)}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="input-cell"
                  value={row.added_stock ?? ""}
                  placeholder="—"
                  onChange={(e) =>
                    onChange(row.item_id, "added_stock", parseInput(e.target.value))
                  }
                />
              </td>
              <td>{formatBarCell(row.total_units)}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="input-cell"
                  value={row.closing_stock ?? ""}
                  placeholder="—"
                  onChange={(e) =>
                    onChange(row.item_id, "closing_stock", parseInput(e.target.value))
                  }
                />
              </td>
              <td>{formatBarCell(row.sold_units)}</td>
              <td>
                {Number(row.price_ksh ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td>
                {row.revenue != null
                  ? Number(row.revenue).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
