"use client";

import { useEffect, useState } from "react";
import { fetchPrices, updateItemSubcategory, updatePrice } from "../../../lib/api";
import { useRequireAuth } from "../../../lib/auth";
import type { ItemSubcategory, PriceItem } from "../../../lib/types";
import LoadingScreen from "../../../components/LoadingScreen";
import SaveButton from "../../../components/SaveButton";
import SavingOverlay from "../../../components/SavingOverlay";

export default function AdminPricesPage() {
  const { user, loading } = useRequireAuth(undefined, true);
  const [items, setItems] = useState<PriceItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingSubcategoryId, setSavingSubcategoryId] = useState<number | null>(null);

  useEffect(() => {
    if (loading || !user || user.role !== "admin") return;
    fetchPrices()
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, [loading, user]);

  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "admin") return null;
  const filtered = items.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()));

  const onSave = async (item: PriceItem, newPrice: number) => {
    setError(null);
    setMessage(null);
    setSavingId(item.id);
    try {
      await updatePrice(item.id, newPrice);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, price_ksh: newPrice } : i))
      );
      setMessage(`Updated price for ${item.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const onSaveSubcategory = async (item: PriceItem, subcategory: ItemSubcategory) => {
    setError(null);
    setMessage(null);
    setSavingSubcategoryId(item.id);
    try {
      await updateItemSubcategory(item.id, subcategory);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, subcategory } : i))
      );
      setMessage(`Updated subcategory for ${item.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingSubcategoryId(null);
    }
  };

  return (
    <main className="page">
      <div className={`card card-wide${savingId !== null || savingSubcategoryId !== null ? " card-saving" : ""}`}>
        {savingId !== null && <SavingOverlay />}
        <div className="page-header">
          <div>
            <h1 className="page-title">Price Management</h1>
            <p className="page-subtitle">Search and update item prices quickly.</p>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        <div className="filters">
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
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Subcategory</th>
                <th>Item</th>
                <th>Price (KSh)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <PriceRow
                  key={item.id}
                  item={item}
                  saving={savingId === item.id}
                  savingSubcategory={savingSubcategoryId === item.id}
                  onSave={onSave}
                  onSaveSubcategory={onSaveSubcategory}
                />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="empty-state">No items match this search.</p>}
        </div>
      </div>
    </main>
  );
}

function PriceRow({
  item,
  saving,
  savingSubcategory,
  onSave,
  onSaveSubcategory,
}: {
  item: PriceItem;
  saving: boolean;
  savingSubcategory: boolean;
  onSave: (item: PriceItem, price: number) => void;
  onSaveSubcategory: (item: PriceItem, subcategory: ItemSubcategory) => void;
}) {
  const [price, setPrice] = useState(item.price_ksh);
  const [subcategory, setSubcategory] = useState<ItemSubcategory>(
    item.subcategory ?? "snacks"
  );
  useEffect(() => setPrice(item.price_ksh), [item.price_ksh]);
  useEffect(() => {
    if (item.subcategory) setSubcategory(item.subcategory);
  }, [item.subcategory]);

  const isSnacksDrinks = item.group_type === "snacks_drinks";
  const subcategoryDirty = isSnacksDrinks && subcategory !== (item.subcategory ?? "snacks");

  return (
    <tr>
      <td>{item.group_type}</td>
      <td>
        {isSnacksDrinks ? (
          <div className="inline-field-row">
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value as ItemSubcategory)}
            >
              <option value="snacks">Snacks</option>
              <option value="drinks">Drinks</option>
            </select>
            {subcategoryDirty && (
              <SaveButton
                saving={savingSubcategory}
                onClick={() => onSaveSubcategory(item, subcategory)}
                label="Save"
              />
            )}
          </div>
        ) : (
          "—"
        )}
      </td>
      <td>{item.name}</td>
      <td>
        <input
          type="number"
          min={0}
          step={1}
          className="input-cell"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value) || 0)}
        />
      </td>
      <td>
        <SaveButton
          saving={saving}
          disabled={price <= 0}
          onClick={() => onSave(item, price)}
        />
      </td>
    </tr>
  );
}
