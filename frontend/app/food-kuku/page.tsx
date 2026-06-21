"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import LoadingScreen from "../../components/LoadingScreen";
import SaveButton from "../../components/SaveButton";
import SavingOverlay from "../../components/SavingOverlay";
import QuantityGrid from "../../components/QuantityGrid";
import { addFoodDish, fetchFoodKuku, saveFoodKuku, todayIso } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import type { QuantityEntry } from "../../lib/types";

export default function FoodKukuPage() {
  const { user, loading } = useRequireAuth(["food_kuku"]);
  const [date, setDate] = useState(todayIso());
  const [query, setQuery] = useState("");
  const [dishName, setDishName] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [entries, setEntries] = useState<QuantityEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [addingDish, setAddingDish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadEntries = useCallback(() => {
    setError(null);
    return fetchFoodKuku(date)
      .then((d) => setEntries(d.entries))
      .catch((e) => setError(e.message));
  }, [date]);

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
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await saveFoodKuku(date, entries);
      setMessage(
        `Saved ${res.saved} items. Revenue: KSh ${res.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      );
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
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        <form onSubmit={onAddDish} className="form-inline">
          <input
            type="text"
            placeholder="New dish name"
            value={dishName}
            onChange={(e) => setDishName(e.target.value)}
            required
          />
          <input
            type="number"
            min={1}
            step={1}
            placeholder="Price (KSh)"
            value={dishPrice}
            onChange={(e) => setDishPrice(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={addingDish}>
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
        <QuantityGrid entries={filteredEntries} onChange={onChange} totalRevenue={filteredRevenue || totalRevenue} />
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
