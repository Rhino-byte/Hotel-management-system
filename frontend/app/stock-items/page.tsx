"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "../../components/LoadingScreen";
import StockGrid from "../../components/StockGrid";
import { fetchStockItems, saveStockItems, todayIso } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import type { StockEntry } from "../../lib/types";

export default function StockItemsPage() {
  const { user, loading } = useRequireAuth(["stock_items"]);
  const [date, setDate] = useState(todayIso());
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    setError(null);
    fetchStockItems(date)
      .then((d) => setEntries(d.entries))
      .catch((e) => setError(e.message));
  }, [date, loading, user]);

  const onChange = (itemId: number, field: "closing_stock" | "added_stock", value: number) => {
    setEntries((prev) =>
      prev.map((e) => (e.item_id === itemId ? { ...e, [field]: value } : e))
    );
  };

  const onSave = async () => {
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
      <div className="card">
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
        <StockGrid entries={filteredEntries} onChange={onChange} />
        <button type="button" className="btn btn-primary" disabled={saving} onClick={onSave}>
          {saving ? "Saving..." : "Save All"}
        </button>
      </div>
    </main>
  );
}
