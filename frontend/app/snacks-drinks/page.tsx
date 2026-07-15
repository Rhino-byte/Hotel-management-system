"use client";

import { useEffect, useRef, useState } from "react";
import SnacksSavePreview from "../../components/SnacksSavePreview";
import SnacksStockGrid from "../../components/SnacksStockGrid";
import LoadingScreen from "../../components/LoadingScreen";
import SaveButton from "../../components/SaveButton";
import SavingOverlay from "../../components/SavingOverlay";
import { fetchSnacksDrinks, saveSnacksDrinks, todayIso } from "../../lib/api";
import { recomputeSnacksEntry, snacksTotals, overClosingDirtyEntries } from "../../lib/snacks-utils";
import { useRequireAuth } from "../../lib/auth";
import type { SnacksEntry, ItemSubcategory } from "../../lib/types";

type SnacksTab = ItemSubcategory | "all";

export default function SnacksDrinksPage() {
  const { user, loading } = useRequireAuth(["snacks_drinks"]);
  const [date, setDate] = useState(todayIso());
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SnacksTab>("all");
  const [entries, setEntries] = useState<SnacksEntry[]>([]);
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fetchGenRef = useRef(0);

  useEffect(() => {
    if (loading || !user) return;
    const gen = ++fetchGenRef.current;
    setEntries([]);
    setLoadedDate(null);
    setDirtyIds(new Set());
    setError(null);
    setMessage(null);
    setPreviewOpen(false);
    setEntriesLoading(true);
    fetchSnacksDrinks(date)
      .then((d) => {
        if (gen !== fetchGenRef.current) return;
        const normalized = d.entries.map((e) => recomputeSnacksEntry(e));
        setEntries(normalized);
        setLoadedDate(date);
      })
      .catch((e) => {
        if (gen !== fetchGenRef.current) return;
        setError(e.message);
        setEntries([]);
        setLoadedDate(null);
      })
      .finally(() => {
        if (gen === fetchGenRef.current) setEntriesLoading(false);
      });
  }, [date, loading, user]);

  const canEdit = !entriesLoading && loadedDate === date;

  const onChange = (
    itemId: number,
    field: "added_stock" | "closing_stock",
    value: number | null
  ) => {
    if (!canEdit) return;
    setEntries((prev) => {
      const next = prev.map((e) =>
        e.item_id === itemId ? recomputeSnacksEntry({ ...e, [field]: value }) : e
      );
      return next;
    });
    setDirtyIds((prev) => new Set(prev).add(itemId));
  };

  const onReviewSave = () => {
    if (!canEdit) return;
    if (dirtyIds.size === 0) {
      setError("No changes to save. Edit Add or Closing on items first.");
      return;
    }
    const overRows = overClosingDirtyEntries(
      entries.filter((e) => dirtyIds.has(e.item_id)),
      dirtyIds
    );
    if (overRows.length > 0) {
      setError(
        `${overRows.length} item(s) have Closing greater than Total. Fix highlighted rows before saving.`
      );
    } else {
      setError(null);
    }
    setPreviewOpen(true);
  };

  const onConfirmSave = async () => {
    if (!canEdit || loadedDate !== date) return;
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
      setLoadedDate(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const tabEntries =
    activeTab === "all"
      ? entries
      : entries.filter((e) => e.subcategory === activeTab);

  const filteredEntries = tabEntries.filter((e) =>
    e.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const tabTotals = snacksTotals(tabEntries);

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
          <span>Total items sold: {tabTotals.totalSoldUnits.toLocaleString()}</span>
          <strong>
            Total sales (KSh):{" "}
            {tabTotals.totalRevenue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>
        <div className="bar-preview-tabs">
          <button
            type="button"
            className={activeTab === "snacks" ? "bar-preview-tab active" : "bar-preview-tab"}
            onClick={() => setActiveTab("snacks")}
          >
            Snacks
          </button>
          <button
            type="button"
            className={activeTab === "drinks" ? "bar-preview-tab active" : "bar-preview-tab"}
            onClick={() => setActiveTab("drinks")}
          >
            Drinks
          </button>
          <button
            type="button"
            className={activeTab === "all" ? "bar-preview-tab active" : "bar-preview-tab"}
            onClick={() => setActiveTab("all")}
          >
            All
          </button>
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
        {entriesLoading ? (
          <p className="empty-state">Loading entries…</p>
        ) : (
          <SnacksStockGrid entries={filteredEntries} onChange={onChange} />
        )}
        <SaveButton
          saving={saving}
          disabled={!canEdit}
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
