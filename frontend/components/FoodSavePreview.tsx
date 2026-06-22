"use client";

import { formatKsh, groupRevenue, splitFoodPreview } from "../lib/food-utils";
import type { QuantityEntry } from "../lib/types";

type Props = {
  date: string;
  entries: QuantityEntry[];
  mode?: "review" | "summary";
  saving?: boolean;
  onCancel: () => void;
  onConfirm?: () => void;
};

function GroupTable({
  label,
  rows,
}: {
  label: string;
  rows: QuantityEntry[];
}) {
  if (rows.length === 0) return null;
  const revenue = groupRevenue(rows);

  return (
    <section className="food-preview-group">
      <h3 className="food-preview-group-title">{label}</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Subtotal (KSh)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.item_id} className="bar-preview-row-dirty">
                <td>{row.name}</td>
                <td>{row.quantity}</td>
                <td>{formatKsh(row.quantity * row.price_ksh)}</td>
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

export default function FoodSavePreview({
  date,
  entries,
  mode = "review",
  saving = false,
  onCancel,
  onConfirm,
}: Props) {
  const { kuku, food } = splitFoodPreview(entries);
  const grandTotal = groupRevenue(entries);
  const canConfirm = mode === "review" && entries.length > 0 && Boolean(onConfirm);
  const isSummary = mode === "summary";

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="food-preview-title"
    >
      <div className="modal-panel modal-panel-wide">
        <div className="modal-header">
          <div>
            <h2 id="food-preview-title" className="modal-title">
              {isSummary ? "Day summary" : "Review before save"}
            </h2>
            <p className="modal-subtitle">
              {date} · {entries.length} dish
              {entries.length === 1 ? "" : "es"}
              {isSummary ? " sold" : " to save"}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onCancel}
            disabled={saving}
          >
            {isSummary ? "Close" : "Cancel"}
          </button>
        </div>

        {!isSummary && !canConfirm && (
          <div className="alert error">
            No changes to save. Edit quantities on dishes first.
          </div>
        )}

        {kuku.length === 0 && food.length === 0 ? (
          <p className="empty-state">
            {isSummary ? "No sold dishes for this day." : "No edited dishes."}
          </p>
        ) : (
          <>
            <GroupTable label="Kuku" rows={kuku} />
            <GroupTable label="Food" rows={food} />
            <p className="food-preview-grand-total">
              Total revenue: <strong>KSh {formatKsh(grandTotal)}</strong>
            </p>
          </>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            {isSummary ? "Close" : "Back to entry"}
          </button>
          {!isSummary && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onConfirm}
              disabled={!canConfirm || saving}
            >
              {saving ? "Saving…" : "Confirm & save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
