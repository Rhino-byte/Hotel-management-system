"use client";

export type StockEntryCardRow = {
  item_id: number;
  name: string;
  startLabel: string;
  startValue: number | null | undefined;
  endFieldLabel: string;
  added_stock: number | null;
  closing_stock: number | null;
  total_units?: number | null;
  sold_units?: number | null;
  price_ksh?: number;
  revenue?: number | null;
  over_closing?: boolean;
};

type Props = {
  rows: StockEntryCardRow[];
  formatCell: (value: number | null | undefined) => string;
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

function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function StockEntryCards({ rows, formatCell, onChange }: Props) {
  return (
    <div className="stock-entry-cards">
      {rows.map((row) => (
        <article key={row.item_id} className="stock-entry-card">
          <h3 className="stock-entry-card-title">{row.name}</h3>
          <dl className="stock-entry-card-stats">
            <div>
              <dt>{row.startLabel}</dt>
              <dd>{formatCell(row.startValue)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatCell(row.total_units)}</dd>
            </div>
            <div>
              <dt>Sales</dt>
              <dd>{formatCell(row.sold_units)}</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>{formatMoney(row.price_ksh)}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>{formatMoney(row.revenue)}</dd>
            </div>
          </dl>
          <div className="stock-entry-card-fields">
            <label className="stock-entry-field">
              <span>Add</span>
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
            </label>
            <label className="stock-entry-field">
              <span>{row.endFieldLabel}</span>
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
            </label>
          </div>
        </article>
      ))}
    </div>
  );
}
