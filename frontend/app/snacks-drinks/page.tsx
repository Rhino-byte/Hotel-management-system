"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "../../components/LoadingScreen";
import SaveButton from "../../components/SaveButton";
import SavingOverlay from "../../components/SavingOverlay";
import StockGrid from "../../components/StockGrid";
import {
  fetchSnacksDrinks,
  saveSnacksDrinks,
  todayIso,
} from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import type { StockEntry } from "../../lib/types";

export default function SnacksDrinksPage() {
  const { user, loading } = useRequireAuth(["snacks_drinks"]);
  const [date, setDate] = useState(todayIso());
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [totalSoldUnits, setTotalSoldUnits] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    setError(null);
    fetchSnacksDrinks(date)
      .then((d) => {
        setEntries(d.entries);
        setTotalSoldUnits(d.total_sold_units ?? 0);
        setTotalRevenue(d.total_revenue ?? 0);
      })
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
      const res = await saveSnacksDrinks(date, entries);
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
            <h1 className="page-title">Snacks &amp; Drinks</h1>
            <p className="page-subtitle">
              Enter today&apos;s closing and added stock. Sold units and revenue use
              (closing + added) minus tomorrow&apos;s closing count.
            </p>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        <div className="revenue-banner">
          <span>Total sold units: {totalSoldUnits.toLocaleString()}</span>
          <strong>
            Revenue (KSh):{" "}
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
        <StockGrid entries={filteredEntries} onChange={onChange} showRevenue />
        <SaveButton
          saving={saving}
          onClick={onSave}
          label="Save All"
          className="btn btn-primary"
        />
      </div>
    </main>
  );
}
