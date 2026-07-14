"use client";

import { formatSnacksCell } from "../lib/snacks-utils";
import type { SnacksEntry } from "../lib/types";
import StockEntryCards from "./StockEntryCards";

type Props = {
  entries: SnacksEntry[];
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

export default function SnacksStockGrid({ entries, onChange }: Props) {
  const cardRows = entries.map((row) => ({
    item_id: row.item_id,
    name: row.name,
    startLabel: "Prev closing",
    startValue: row.previous_closing,
    endFieldLabel: "Closing",
    added_stock: row.added_stock,
    closing_stock: row.closing_stock,
    total_units: row.total_units,
    sold_units: row.sold_units,
    price_ksh: row.price_ksh,
    revenue: row.revenue,
    over_closing: row.over_closing,
  }));

  return (
    <div className="stock-entry-layout">
      <div className="table-wrap stock-entry-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Prev closing</th>
              <th>Add</th>
              <th>Total</th>
              <th>Closing</th>
              <th>Sales</th>
              <th>Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => (
              <tr key={row.item_id}>
                <td>{row.name}</td>
                <td>{formatSnacksCell(row.previous_closing)}</td>
                <td>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    className="input-cell input-cell-touch"
                    value={row.added_stock ?? ""}
                    placeholder="—"
                    onChange={(e) =>
                      onChange(row.item_id, "added_stock", parseInput(e.target.value))
                    }
                  />
                </td>
                <td>{formatSnacksCell(row.total_units)}</td>
                <td>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    className={`input-cell input-cell-touch${row.over_closing ? " input-cell-error" : ""}`}
                    value={row.closing_stock ?? ""}
                    placeholder="—"
                    onChange={(e) =>
                      onChange(row.item_id, "closing_stock", parseInput(e.target.value))
                    }
                  />
                </td>
                <td>{formatSnacksCell(row.sold_units)}</td>
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
      <StockEntryCards rows={cardRows} formatCell={formatSnacksCell} onChange={onChange} />
    </div>
  );
}
