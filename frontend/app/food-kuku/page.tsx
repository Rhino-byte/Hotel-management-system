"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import FoodSavePreview from "../../components/FoodSavePreview";
import LoadingScreen from "../../components/LoadingScreen";
import SaveButton from "../../components/SaveButton";
import SavingOverlay from "../../components/SavingOverlay";
import QuantityGrid from "../../components/QuantityGrid";
import { addFoodDish, fetchFoodKuku, saveFoodKuku, todayIso } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import type { QuantityEntry } from "../../lib/types";

function baselineFromEntries(entries: QuantityEntry[]): Map<number, number> {
  return new Map(entries.map((e) => [e.item_id, e.quantity]));
}

export default function FoodKukuPage() {
  const { user, loading } = useRequireAuth(["food_kuku"]);
  const [date, setDate] = useState(todayIso());
  const [query, setQuery] = useState("");
  const [dishName, setDishName] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [entries, setEntries] = useState<QuantityEntry[]>([]);
  const [baseline, setBaseline] = useState<Map<number, number>>(new Map());
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
  const [locked, setLocked] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingDish, setAddingDish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isClerkLocked = locked && user?.role === "food_clerk";

  const loadEntries = useCallback(() => {
    setError(null);
    setDirtyIds(new Set());
    return fetchFoodKuku(date)
      .then((d) => {
        setEntries(d.entries);
        setBaseline(baselineFromEntries(d.entries));
        setLocked(d.locked);
        setPreviewOpen(d.locked && user?.role === "food_clerk");
      })
      .catch((e) => setError(e.message));
  }, [date, user?.role]);

  useEffect(() => {
    if (loading || !user) return;
    loadEntries();
  }, [loading, user, loadEntries]);

  const totalRevenue = useMemo(
    () => entries.reduce((sum, e) => sum + e.quantity * e.price_ksh, 0),
    [entries]
  );

  const onChange = (itemId: number, quantity: number) => {
    setEntries((prev) =>
      prev.map((e) => (e.item_id === itemId ? { ...e, quantity } : e))
    );
    setDirtyIds((prev) => {
      const next = new Set(prev);
      const baseQty = baseline.get(itemId) ?? 0;
      if (quantity !== baseQty) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  };

  const onReviewSave = () => {
    if (dirtyIds.size === 0) {
      setError("No changes to save. Edit quantities on dishes first.");
      return;
    }
    setError(null);
    setPreviewOpen(true);
  };

  const onConfirmSave = async () => {
    const dirtyEntries = entries.filter((e) => dirtyIds.has(e.item_id));
    const toPersist = dirtyEntries.filter(
      (e) => e.quantity > 0 || (baseline.get(e.item_id) ?? 0) > 0
    );
    const finalize = user?.role === "food_clerk";
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await saveFoodKuku(date, toPersist, { finalize });
      setMessage(
        `Saved ${res.saved} item(s). Revenue: KSh ${res.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}${res.locked ? " — day finalized." : ""}`
      );
      setPreviewOpen(false);
      setDirtyIds(new Set());
      const refreshed = await fetchFoodKuku(date);
      setEntries(refreshed.entries);
      setBaseline(baselineFromEntries(refreshed.entries));
      setLocked(refreshed.locked);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onAddDish = async (e: FormEvent) => {
    e.preventDefault();
    const name = dishName.trim();
    const price = Number(dishPrice);
    if (!name || price <= 0) {
      setError("Enter a dish name and a price greater than zero.");
      return;
    }
    setAddingDish(true);
    setError(null);
    setMessage(null);
    try {
      const res = await addFoodDish(name, price);
      setDishName("");
      setDishPrice("");
      setMessage(`Added ${res.item.name} at KSh ${res.item.price_ksh.toLocaleString()}.`);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add dish");
    } finally {
      setAddingDish(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const isBusy = saving || addingDish;
  const dirtyEntries = entries.filter((e) => dirtyIds.has(e.item_id));
  const lockedSummaryEntries = entries.filter((e) => e.quantity > 0);
  const previewMode = isClerkLocked ? "summary" : "review";
  const previewEntries = isClerkLocked
    ? lockedSummaryEntries
    : dirtyEntries.filter((e) => e.quantity > 0);

  const filteredEntries = entries.filter((e) =>
    e.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const filteredRevenue = filteredEntries.reduce((sum, e) => sum + e.quantity * e.price_ksh, 0);

  return (
    <main className="page">
      <div className={`card card-wide${isBusy ? " card-saving" : ""}`}>
        {isBusy && <SavingOverlay text={addingDish ? "Adding dish" : "Saving"} />}
        <div className="page-header">
          <div>
            <h1 className="page-title">Food &amp; Kuku</h1>
            <p className="page-subtitle">
              Enter quantity sold per dish. Add a new dish with name and price if it is not listed yet.
            </p>
          </div>
        </div>
        {isClerkLocked && (
          <div className="alert">
            This day is finalized. Contact admin to make changes.
          </div>
        )}
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        <form onSubmit={onAddDish} className="form-inline">
          <input
            type="text"
            placeholder="New dish name"
            value={dishName}
            onChange={(e) => setDishName(e.target.value)}
            disabled={isClerkLocked}
            required
          />
          <input
            type="number"
            min={1}
            step={1}
            placeholder="Price (KSh)"
            value={dishPrice}
            onChange={(e) => setDishPrice(e.target.value)}
            disabled={isClerkLocked}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={addingDish || isClerkLocked}>
            Add Dish
          </button>
        </form>
        <div className="filters">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Search dish</span>
            <input
              type="text"
              value={query}
              placeholder="Type dish name..."
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn-secondary" onClick={() => setQuery("")}>
            Reset
          </button>
        </div>
        <QuantityGrid
          entries={filteredEntries}
          onChange={onChange}
          totalRevenue={filteredRevenue || totalRevenue}
          readOnly={isClerkLocked}
        />
        {!isClerkLocked && (
          <SaveButton
            saving={saving}
            onClick={onReviewSave}
            label="Review & save"
            className="btn btn-primary"
          />
        )}
      </div>
      {previewOpen && (
        <FoodSavePreview
          date={date}
          entries={previewEntries}
          mode={previewMode}
          hasPendingChanges={dirtyIds.size > 0}
          saving={saving}
          onCancel={() => setPreviewOpen(false)}
          onConfirm={onConfirmSave}
        />
      )}
    </main>
  );
}
