"use client";

import { useState } from "react";
import {
  countClosingSet,
  formatSnacksCell,
  isClosingSet,
  soldOutDirtyEntries,
  unsetClosingWithStock,
} from "../lib/snacks-utils";
import type { SnacksEntry } from "../lib/types";

type Props = {
  date: string;
  entries: SnacksEntry[];
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
  rows: SnacksEntry[];
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
          {rows.map((row, idx) => {
            const previous = Number(row.previous_closing ?? 0);
            const added = row.added_stock ?? 0;
            const unsetWarn = warnUnset && !isClosingSet(row) && previous + added > 0;
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
                <td>{idx + 1}</td>
                <td>{row.name}</td>
                <td>{formatSnacksCell(row.previous_closing)}</td>
                <td>{formatSnacksCell(row.added_stock)}</td>
                <td>{formatSnacksCell(row.total_units)}</td>
                <td>{formatSnacksCell(row.closing_stock)}</td>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SnacksSavePreview({
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
  const dirtyMissingClosing = dirtyEntries.filter((e) => !isClosingSet(e));
  const closingSet = countClosingSet(entries);
  const unsetWithStock = unsetClosingWithStock(entries);
  const needsSoldOutAck = soldOutRows.length > 0;
  const canConfirm =
    dirtyIds.size > 0 &&
    dirtyMissingClosing.length === 0 &&
    (!needsSoldOutAck || soldOutAck);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="snacks-preview-title"
    >
      <div className="modal-panel modal-panel-wide">
        <div className="modal-header">
          <div>
            <h2 id="snacks-preview-title" className="modal-title">
              Review before save
            </h2>
            <p className="modal-subtitle">
              {date} · {closingSet}/{entries.length} closing set · {dirtyIds.size} row
              {dirtyIds.size === 1 ? "" : "s"} to save
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>

        {dirtyIds.size === 0 && (
          <div className="alert error">
            No changes to save. Edit Add or Closing on items first.
          </div>
        )}

        {dirtyMissingClosing.length > 0 && (
          <div className="alert error">
            {dirtyMissingClosing.length} edited row(s) still need Closing before saving:{" "}
            {dirtyMissingClosing.map((r) => r.name).join(", ")}
          </div>
        )}

        {unsetWithStock.length > 0 && (
          <div className="alert error">
            {unsetWithStock.length} item(s) still have no Closing but stock is available — sales
            will stay pending until Closing is entered.
          </div>
        )}

        {soldOutRows.length > 0 && (
          <div className="alert error">
            {soldOutRows.length} item(s) marked sold out (Closing = 0 with stock remaining):{" "}
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
            I confirm sold-out counts (Closing = 0) for {soldOutRows.length} item(s)
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
