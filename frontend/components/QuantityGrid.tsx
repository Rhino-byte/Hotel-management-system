"use client";

import type { QuantityEntry } from "../lib/types";

type Props = {
  entries: QuantityEntry[];
  onChange: (itemId: number, quantity: number) => void;
  totalRevenue: number;
  readOnly?: boolean;
};

export default function QuantityGrid({ entries, onChange, totalRevenue, readOnly = false }: Props) {
  return (
    <>
      <div className="revenue-banner">
        <span>Daily revenue (KSh)</span>
        <strong>{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Price (KSh)</th>
              <th>Quantity Sold</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => {
              const sub = row.quantity * row.price_ksh;
              return (
                <tr key={row.item_id}>
                  <td>{row.name}</td>
                  <td>{row.price_ksh}</td>
                  <td>
                    {readOnly ? (
                      row.quantity
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="input-cell"
                        value={row.quantity}
                        onChange={(e) =>
                          onChange(row.item_id, Number(e.target.value) || 0)
                        }
                      />
                    )}
                  </td>
                  <td>{sub.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
