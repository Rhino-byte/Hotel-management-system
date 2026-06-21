"use client";

import { useEffect, useState } from "react";
import BarStockGrid from "../../components/BarStockGrid";
import LoadingScreen from "../../components/LoadingScreen";
import SaveButton from "../../components/SaveButton";
import SavingOverlay from "../../components/SavingOverlay";
import { fetchBar, saveBar, todayIso } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import type { BarEntry } from "../../lib/types";

function recomputeEntry(entry: BarEntry): BarEntry {
  const opening = Number(entry.opening_stock ?? 0);
  const added = Number(entry.added_stock ?? 0);
  const closing = Number(entry.closing_stock ?? 0);
  const total = opening + added;
  const sold = Math.max(total - closing, 0);
  const price = Number(entry.price_ksh ?? 0);
  return {
    ...entry,
    total_units: total,
    sold_units: sold,
    revenue: sold * price,
  };
}

export default function BarPage() {
  const { user, loading } = useRequireAuth(["bar"]);
  const [date, setDate] = useState(todayIso());
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<BarEntry[]>([]);
  const [totalSoldUnits, setTotalSoldUnits] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    setError(null);
    fetchBar(date)
      .then((d) => {
        setEntries(d.entries);
        setTotalSoldUnits(d.total_sold_units ?? 0);
        setTotalRevenue(d.total_revenue ?? 0);
      })
      .catch((e) => setError(e.message));
  }, [date, loading, user]);

  const onChange = (itemId: number, field: "added_stock" | "closing_stock", value: number) => {
    setEntries((prev) => {
      const next = prev.map((e) =>
        e.item_id === itemId ? recomputeEntry({ ...e, [field]: value }) : e
      );
      setTotalSoldUnits(next.reduce((sum, e) => sum + Number(e.sold_units ?? 0), 0));
      setTotalRevenue(next.reduce((sum, e) => sum + Number(e.revenue ?? 0), 0));
      return next;
    });
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await saveBar(date, entries);
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

  const carryDates = Array.from(
    new Set(
      entries
        .filter((e) => e.opening_from_date && Number(e.opening_stock) > 0)
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
              Opening stock carries from the most recent saved B.B.F (where B.B.F &gt; 0),
              not necessarily yesterday. Sales = (Opening + Add) − B.B.F closing count.
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
          onClick={onSave}
          label="Save All"
          className="btn btn-primary"
        />
      </div>
    </main>
  );
}
