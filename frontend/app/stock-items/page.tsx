"use client";

import { useEffect, useRef, useState } from "react";
import LoadingScreen from "../../components/LoadingScreen";
import SaveButton from "../../components/SaveButton";
import SavingOverlay from "../../components/SavingOverlay";
import StockGrid from "../../components/StockGrid";
import { fetchStockItems, saveStockItems, todayIso } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import type { StockEntry } from "../../lib/types";

export default function StockItemsPage() {
  const { user, loading } = useRequireAuth(["stock_items"]);
  const [date, setDate] = useState(todayIso());
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fetchGenRef = useRef(0);

  useEffect(() => {
    if (loading || !user) return;
    const gen = ++fetchGenRef.current;
    setEntries([]);
    setLoadedDate(null);
    setError(null);
    setMessage(null);
    setEntriesLoading(true);
    fetchStockItems(date)
      .then((d) => {
        if (gen !== fetchGenRef.current) return;
        setEntries(d.entries);
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

  const canSave = !entriesLoading && loadedDate === date && entries.length > 0;

  const onChange = (itemId: number, field: "closing_stock" | "added_stock", value: number) => {
    setEntries((prev) =>
      prev.map((e) => (e.item_id === itemId ? { ...e, [field]: value } : e))
    );
  };

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await saveStockItems(date, entries);
      setMessage(`Saved ${res.saved} entries for ${date}.`);
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

  return (
    <main className="page">
      <div className={`card${saving ? " card-saving" : ""}`}>
        {saving && <SavingOverlay />}
        <div className="page-header">
          <div>
            <h1 className="page-title">Stock Items</h1>
            <p className="page-subtitle">
              Track closing and added stock for raw materials used in the kitchen.
            </p>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
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
          <StockGrid entries={filteredEntries} onChange={onChange} />
        )}
        <SaveButton
          saving={saving}
          disabled={!canSave}
          onClick={onSave}
          label="Save All"
          className="btn btn-primary"
        />
      </div>
    </main>
  );
}
