"use client";

import { useCallback, useEffect, useState } from "react";
import SnacksSavePreview from "../../components/SnacksSavePreview";
import SnacksStockGrid from "../../components/SnacksStockGrid";
import LoadingScreen from "../../components/LoadingScreen";
import SaveButton from "../../components/SaveButton";
import SavingOverlay from "../../components/SavingOverlay";
import { fetchSnacksDrinks, saveSnacksDrinks, todayIso } from "../../lib/api";
import { recomputeSnacksEntry, snacksTotals } from "../../lib/snacks-utils";
import { useRequireAuth } from "../../lib/auth";
import type { SnacksEntry } from "../../lib/types";

export default function SnacksDrinksPage() {
  const { user, loading } = useRequireAuth(["snacks_drinks"]);
  const [date, setDate] = useState(todayIso());
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SnacksEntry[]>([]);
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
  const [totalSoldUnits, setTotalSoldUnits] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyTotals = useCallback((list: SnacksEntry[]) => {
    const t = snacksTotals(list);
    setTotalSoldUnits(t.totalSoldUnits);
    setTotalRevenue(t.totalRevenue);
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    setError(null);
    setDirtyIds(new Set());
    fetchSnacksDrinks(date)
      .then((d) => {
        const normalized = d.entries.map((e) => recomputeSnacksEntry(e));
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
        e.item_id === itemId ? recomputeSnacksEntry({ ...e, [field]: value }) : e
      );
      applyTotals(next);
      return next;
    });
    setDirtyIds((prev) => new Set(prev).add(itemId));
  };

  const onReviewSave = () => {
    if (dirtyIds.size === 0) {
      setError("No changes to save. Edit Add or Closing on items first.");
      return;
    }
    setError(null);
    setPreviewOpen(true);
  };

  const onConfirmSave = async () => {
    const dirtyEntries = entries.filter((e) => dirtyIds.has(e.item_id));
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await saveSnacksDrinks(date, dirtyEntries);
      setMessage(`Saved ${res.saved} entries for ${date}.`);
      setPreviewOpen(false);
      setDirtyIds(new Set());
      const refreshed = await fetchSnacksDrinks(date);
      const normalized = refreshed.entries.map((e) => recomputeSnacksEntry(e));
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
        .filter((e) => e.previous_from_date != null)
        .map((e) => e.previous_from_date as string)
    )
  ).sort();

  return (
    <main className="page">
      <div className={`card${saving ? " card-saving" : ""}`}>
        {saving && <SavingOverlay />}
        <div className="page-header">
          <div>
            <h1 className="page-title">Snacks &amp; Drinks</h1>
            <p className="page-subtitle">
              Prev closing uses yesterday&apos;s saved entry only (not older dates). Total = Prev
              closing + Add. Sales = Total − Closing (same day). Preview before save — only edited
              rows are written.
            </p>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        {carryDates.length > 0 && (
          <div className="alert success">
            Prev closing carried from{" "}
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
        <SnacksStockGrid entries={filteredEntries} onChange={onChange} />
        <SaveButton
          saving={saving}
          onClick={onReviewSave}
          label={dirtyIds.size > 0 ? `Review & save (${dirtyIds.size})` : "Review & save"}
          className="btn btn-primary"
        />
      </div>
      {previewOpen && (
        <SnacksSavePreview
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
