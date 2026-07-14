"use client";

import { useCallback, useEffect, useState } from "react";
import BarSavePreview from "../../components/BarSavePreview";
import BarStockGrid from "../../components/BarStockGrid";
import LoadingScreen from "../../components/LoadingScreen";
import SaveButton from "../../components/SaveButton";
import SavingOverlay from "../../components/SavingOverlay";
import { fetchBar, saveBar, todayIso } from "../../lib/api";
import { barTotals, overClosingDirtyEntries, recomputeBarEntry } from "../../lib/bar-utils";
import { useRequireAuth } from "../../lib/auth";
import type { BarEntry } from "../../lib/types";

export default function BarPage() {
  const { user, loading } = useRequireAuth(["bar"]);
  const [date, setDate] = useState(todayIso());
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<BarEntry[]>([]);
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
  const [totalSoldUnits, setTotalSoldUnits] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyTotals = useCallback((list: BarEntry[]) => {
    const t = barTotals(list);
    setTotalSoldUnits(t.totalSoldUnits);
    setTotalRevenue(t.totalRevenue);
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    setError(null);
    setDirtyIds(new Set());
    fetchBar(date)
      .then((d) => {
        const normalized = d.entries.map((e) => recomputeBarEntry(e));
        setEntries(normalized);
        applyTotals(normalized);
      })
      .catch((e) => setError(e.message));
  }, [date, loading, user, applyTotals]);

  const onChange = (
    itemId: number,
    field: "added_stock" | "closing_stock",
    value: number | null
  ) => {
    setEntries((prev) => {
      const next = prev.map((e) =>
        e.item_id === itemId ? recomputeBarEntry({ ...e, [field]: value }) : e
      );
      applyTotals(next);
      return next;
    });
    setDirtyIds((prev) => new Set(prev).add(itemId));
  };

  const onReviewSave = () => {
    if (dirtyIds.size === 0) {
      setError("No changes to save. Edit Add or B.B.F on items first.");
      return;
    }
    const overRows = overClosingDirtyEntries(
      entries.filter((e) => dirtyIds.has(e.item_id)),
      dirtyIds
    );
    if (overRows.length > 0) {
      setError(
        `${overRows.length} item(s) have B.B.F greater than Total. Fix highlighted rows before saving.`
      );
    } else {
      setError(null);
    }
    setPreviewOpen(true);
  };

  const onConfirmSave = async () => {
    const dirtyEntries = entries.filter((e) => dirtyIds.has(e.item_id));
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await saveBar(date, dirtyEntries);
      setMessage(`Saved ${res.saved} entries for ${date}.`);
      setPreviewOpen(false);
      setDirtyIds(new Set());
      const refreshed = await fetchBar(date);
      const normalized = refreshed.entries.map((e) => recomputeBarEntry(e));
      setEntries(normalized);
      applyTotals(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const filteredEntries = entries.filter((e) =>
    e.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const carryDates = Array.from(
    new Set(
      entries
        .filter((e) => e.opening_from_date != null)
        .map((e) => e.opening_from_date as string)
    )
  ).sort();

  return (
    <main className="page">
      <div className={`card${saving ? " card-saving" : ""}`}>
        {saving && <SavingOverlay />}
        <div className="page-header">
          <div>
            <h1 className="page-title">Bar Stock</h1>
            <p className="page-subtitle">
              Opening carries from the most recent saved B.B.F before this date (zero counts).
              Preview before save — only edited rows are written. Sales = (Opening + Add) − B.B.F.
            </p>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        {carryDates.length > 0 && (
          <div className="alert success">
            Opening stock carried from last B.B.F on{" "}
            {carryDates.length === 1
              ? carryDates[0]
              : `${carryDates.slice(0, -1).join(", ")} and ${carryDates[carryDates.length - 1]}`}
            .
          </div>
        )}
        <div className="revenue-banner">
          <span>Total items sold: {totalSoldUnits.toLocaleString()}</span>
          <strong>
            Total sales (KSh):{" "}
            {totalRevenue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>
        <div className="filters">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Search item</span>
            <input
              type="text"
              value={query}
              placeholder="Type item name..."
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn-secondary" onClick={() => setQuery("")}>
            Reset
          </button>
        </div>
        <BarStockGrid entries={filteredEntries} onChange={onChange} />
        <SaveButton
          saving={saving}
          onClick={onReviewSave}
          label={dirtyIds.size > 0 ? `Review & save (${dirtyIds.size})` : "Review & save"}
          className="btn btn-primary"
        />
      </div>
      {previewOpen && (
        <BarSavePreview
          date={date}
          entries={entries}
          dirtyIds={dirtyIds}
          saving={saving}
          onCancel={() => setPreviewOpen(false)}
          onConfirm={onConfirmSave}
        />
      )}
    </main>
  );
}
