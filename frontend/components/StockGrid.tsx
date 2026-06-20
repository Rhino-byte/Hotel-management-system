"use client";

import type { StockEntry } from "../lib/types";

type Props = {
  entries: StockEntry[];
  onChange: (itemId: number, field: "closing_stock" | "added_stock", value: number) => void;
};

export default function StockGrid({ entries, onChange }: Props) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Closing Stock</th>
            <th>Added Stock</th>
            <th>Opening Units</th>
            <th>Next Day Closing</th>
            <th>Sold Units</th>
            <th>Price</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((row) => (
            <tr key={row.item_id}>
              <td>{row.name}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="input-cell"
                  value={row.closing_stock}
                  onChange={(e) =>
                    onChange(row.item_id, "closing_stock", Number(e.target.value) || 0)
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="input-cell"
                  value={row.added_stock}
                  onChange={(e) =>
                    onChange(row.item_id, "added_stock", Number(e.target.value) || 0)
                  }
                />
              </td>
              <td>{Number(row.opening_units ?? 0).toLocaleString()}</td>
              <td>{Number(row.next_closing_units ?? 0).toLocaleString()}</td>
              <td>{Number(row.sold_units ?? 0).toLocaleString()}</td>
              <td>{Number(row.price_ksh ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td>{Number(row.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
