"use client";

import { formatKsh, isKukuDish } from "../lib/food-utils";
import type { AuditRow } from "../lib/types";

type SummaryKind = "snacks_drinks" | "food_kuku";

type Props = {
  kind: SummaryKind;
  date: string;
  rows: AuditRow[];
  onClose: () => void;
};

type SummaryLine = {
  key: string;
  item_name: string;
  units: number;
  revenue: number;
};

function GroupTable({
  label,
  lines,
  unitsLabel,
}: {
  label: string;
  lines: SummaryLine[];
  unitsLabel: string;
}) {
  if (lines.length === 0) return null;
  const revenue = lines.reduce((sum, r) => sum + r.revenue, 0);

  return (
    <section className="food-preview-group">
      <h3 className="food-preview-group-title">{label}</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>{unitsLabel}</th>
              <th>Revenue (KSh)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((row) => (
              <tr key={row.key} className="bar-preview-row-dirty">
                <td>{row.item_name}</td>
                <td>{row.units.toLocaleString()}</td>
                <td>{formatKsh(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="food-preview-group-revenue">
        Revenue: <strong>KSh {formatKsh(revenue)}</strong>
      </p>
    </section>
  );
}

function snacksLines(rows: AuditRow[]): { snacks: SummaryLine[]; drinks: SummaryLine[] } {
  const snacks: SummaryLine[] = [];
  const drinks: SummaryLine[] = [];
  for (const row of rows) {
    const units = Number(row.sold_units ?? 0);
    if (!(units > 0)) continue;
    const line: SummaryLine = {
      key: `${row.item_id}-${row.entry_date}-snacks`,
      item_name: row.item_name,
      units,
      revenue: Number(row.revenue ?? 0),
    };
    if (row.subcategory === "drinks") drinks.push(line);
    else snacks.push(line);
  }
  return { snacks, drinks };
}

function foodLines(rows: AuditRow[]): { kuku: SummaryLine[]; food: SummaryLine[] } {
  const kuku: SummaryLine[] = [];
  const food: SummaryLine[] = [];
  for (const row of rows) {
    const units = Number(row.quantity ?? 0);
    if (!(units > 0)) continue;
    const line: SummaryLine = {
      key: `${row.item_id}-${row.entry_date}-food`,
      item_name: row.item_name,
      units,
      revenue: Number(row.revenue ?? units * Number(row.price_ksh ?? 0)),
    };
    if (isKukuDish(row.item_name)) kuku.push(line);
    else food.push(line);
  }
  return { kuku, food };
}

export default function AuditSalesSummaryPreview({
  kind,
  date,
  rows,
  onClose,
}: Props) {
  const groups =
    kind === "snacks_drinks"
      ? (() => {
          const { snacks, drinks } = snacksLines(rows);
          return [
            { label: "Snacks", lines: snacks, unitsLabel: "Sold units" },
            { label: "Drinks", lines: drinks, unitsLabel: "Sold units" },
          ];
        })()
      : (() => {
          const { kuku, food } = foodLines(rows);
          return [
            { label: "Kuku", lines: kuku, unitsLabel: "Qty" },
            { label: "Food", lines: food, unitsLabel: "Qty" },
          ];
        })();

  const allLines = groups.flatMap((g) => g.lines);
  const grandTotal = allLines.reduce((sum, r) => sum + r.revenue, 0);
  const title = kind === "snacks_drinks" ? "Snacks & Drinks summary" : "Food & Kuku summary";

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-summary-title"
    >
      <div className="modal-panel modal-panel-wide">
        <div className="modal-header">
          <div>
            <h2 id="audit-summary-title" className="modal-title">
              {title}
            </h2>
            <p className="modal-subtitle">
              {date} · {allLines.length} sold line
              {allLines.length === 1 ? "" : "s"}
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        {allLines.length === 0 ? (
          <p className="empty-state">No sold items in the current filter.</p>
        ) : (
          <>
            {groups.map((g) => (
              <GroupTable
                key={g.label}
                label={g.label}
                lines={g.lines}
                unitsLabel={g.unitsLabel}
              />
            ))}
            <p className="food-preview-grand-total">
              Total revenue: <strong>KSh {formatKsh(grandTotal)}</strong>
            </p>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
