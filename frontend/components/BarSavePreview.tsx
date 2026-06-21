"use client";

import { useState } from "react";
import {
  countBbfSet,
  formatBarCell,
  soldOutDirtyEntries,
  unsetBbfWithStock,
} from "../lib/bar-utils";
import type { BarEntry } from "../lib/types";

type Props = {
  date: string;
  entries: BarEntry[];
  dirtyIds: Set<number>;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function ReportTable({
  rows,
  highlightIds,
  warnUnset,
}: {
  rows: BarEntry[];
  highlightIds?: Set<number>;
  warnUnset?: boolean;
}) {
  return (
    <div className="table-wrap bar-preview-table">
      <table className="data-table">
        <thead>
          <tr>
            <th>No</th>
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
          {rows.map((row, idx) => {
            const opening = Number(row.opening_stock ?? 0);
            const added = row.added_stock ?? 0;
            const unsetWarn =
              warnUnset && !isRowBbfSet(row) && opening + added > 0;
            const highlight = highlightIds?.has(row.item_id);
            return (
              <tr
                key={row.item_id}
                className={
                  highlight
                    ? "bar-preview-row-dirty"
                    : unsetWarn
                      ? "bar-preview-row-warn"
                      : undefined
                }
              >
                <td>{row.display_order ?? idx + 1}</td>
                <td>{row.name}</td>
                <td>{formatBarCell(row.opening_stock)}</td>
                <td>{formatBarCell(row.added_stock)}</td>
                <td>{formatBarCell(row.total_units)}</td>
                <td>{formatBarCell(row.closing_stock)}</td>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function isRowBbfSet(row: BarEntry): boolean {
  return row.closing_stock !== null && row.closing_stock !== undefined;
}

export default function BarSavePreview({
  date,
  entries,
  dirtyIds,
  saving,
  onCancel,
  onConfirm,
}: Props) {
  const [tab, setTab] = useState<"changes" | "full">("changes");
  const [soldOutAck, setSoldOutAck] = useState(false);

  const soldOutRows = soldOutDirtyEntries(entries, dirtyIds);
  const dirtyEntries = entries.filter((e) => dirtyIds.has(e.item_id));
  const dirtyMissingBbf = dirtyEntries.filter((e) => !isRowBbfSet(e));
  const bbfSet = countBbfSet(entries);
  const unsetWithStock = unsetBbfWithStock(entries);
  const needsSoldOutAck = soldOutRows.length > 0;
  const canConfirm =
    dirtyIds.size > 0 &&
    dirtyMissingBbf.length === 0 &&
    (!needsSoldOutAck || soldOutAck);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="bar-preview-title">
      <div className="modal-panel modal-panel-wide">
        <div className="modal-header">
          <div>
            <h2 id="bar-preview-title" className="modal-title">
              Review before save
            </h2>
            <p className="modal-subtitle">
              {date} · {bbfSet}/{entries.length} B.B.F set · {dirtyIds.size} row
              {dirtyIds.size === 1 ? "" : "s"} to save
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>

        {dirtyIds.size === 0 && (
          <div className="alert error">No changes to save. Edit Add or B.B.F on items first.</div>
        )}

        {dirtyMissingBbf.length > 0 && (
          <div className="alert error">
            {dirtyMissingBbf.length} edited row(s) still need B.B.F before saving:{" "}
            {dirtyMissingBbf.map((r) => r.name).join(", ")}
          </div>
        )}

        {unsetWithStock.length > 0 && (
          <div className="alert error">
            {unsetWithStock.length} item(s) still have no B.B.F but stock is available — they will
            not be saved and won&apos;t carry forward tomorrow.
          </div>
        )}

        {soldOutRows.length > 0 && (
          <div className="alert error">
            {soldOutRows.length} item(s) marked sold out (B.B.F = 0 with stock remaining):{" "}
            {soldOutRows.map((r) => r.name).join(", ")}
          </div>
        )}

        <div className="bar-preview-tabs">
          <button
            type="button"
            className={tab === "changes" ? "bar-preview-tab active" : "bar-preview-tab"}
            onClick={() => setTab("changes")}
          >
            Changes ({dirtyIds.size})
          </button>
          <button
            type="button"
            className={tab === "full" ? "bar-preview-tab active" : "bar-preview-tab"}
            onClick={() => setTab("full")}
          >
            Full report ({entries.length})
          </button>
        </div>

        {tab === "changes" ? (
          dirtyEntries.length > 0 ? (
            <ReportTable rows={dirtyEntries} highlightIds={dirtyIds} />
          ) : (
            <p className="empty-state">No edited rows.</p>
          )
        ) : (
          <ReportTable rows={entries} highlightIds={dirtyIds} warnUnset />
        )}

        {needsSoldOutAck && (
          <label className="bar-preview-ack">
            <input
              type="checkbox"
              checked={soldOutAck}
              onChange={(e) => setSoldOutAck(e.target.checked)}
            />
            I confirm sold-out counts (B.B.F = 0) for {soldOutRows.length} item(s)
          </label>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
            Back to entry
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={!canConfirm || saving}
          >
            {saving ? "Saving…" : "Confirm & save"}
          </button>
        </div>
      </div>
    </div>
  );
}
