import type { BarEntry } from "../lib/types";

type Props = {
  entries: BarEntry[];
  onChange: (itemId: number, field: "added_stock" | "closing_stock", value: number) => void;
};

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
              <td>{Number(row.opening_stock ?? 0).toLocaleString()}</td>
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
              <td>{Number(row.total_units ?? 0).toLocaleString()}</td>
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
              <td>{Number(row.sold_units ?? 0).toLocaleString()}</td>
              <td>
                {Number(row.price_ksh ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td>
                {Number(row.revenue ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
