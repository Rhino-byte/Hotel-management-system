"use client";

import { FormEvent, useEffect, useState } from "react";
import LoadingScreen from "../../components/LoadingScreen";
import SaveButton from "../../components/SaveButton";
import SavingOverlay from "../../components/SavingOverlay";
import { createCostSetting, fetchCostSettings, updateCostSetting } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import type { CostCategory, CostDataSource, CostSetting } from "../../lib/types";

const CATEGORIES: { value: CostCategory; label: string }[] = [
  { value: "snacks", label: "Snacks" },
  { value: "drinks", label: "Drinks" },
  { value: "food", label: "Food" },
  { value: "kuku", label: "Kuku" },
];

const SOURCES: { value: CostDataSource; label: string }[] = [
  { value: "hotel_sold", label: "Units sold × purchase price" },
  { value: "store_stock_out", label: "Store stock out × purchase price" },
  { value: "recipe_milk", label: "Milk from tea and white coffee" },
  { value: "policy_rate", label: "Fixed rate (gas or makaa)" },
];

function labelOf<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type Draft = {
  name: string;
  category: CostCategory;
  data_source: CostDataSource;
  purchase_price: string;
  hotel_item_name: string;
  store_item_name: string;
  tea_cups_per_liter: string;
  white_coffee_cups_per_liter: string;
  bags_per_week: string;
  cylinder_cost_per_month: string;
};

function draftFrom(setting: CostSetting): Draft {
  return {
    name: setting.name,
    category: setting.category,
    data_source: setting.data_source,
    purchase_price: String(setting.purchase_price ?? 0),
    hotel_item_name: setting.hotel_item_name ?? "",
    store_item_name: setting.store_item_name ?? "",
    tea_cups_per_liter: setting.tea_cups_per_liter == null ? "" : String(setting.tea_cups_per_liter),
    white_coffee_cups_per_liter:
      setting.white_coffee_cups_per_liter == null ? "" : String(setting.white_coffee_cups_per_liter),
    bags_per_week: setting.bags_per_week == null ? "" : String(setting.bags_per_week),
    cylinder_cost_per_month:
      setting.cylinder_cost_per_month == null ? "" : String(setting.cylinder_cost_per_month),
  };
}

function payloadFrom(draft: Draft) {
  return {
    name: draft.name.trim(),
    category: draft.category,
    data_source: draft.data_source,
    purchase_price: Number(draft.purchase_price) || 0,
    hotel_item_name: blankToNull(draft.hotel_item_name),
    store_item_name: blankToNull(draft.store_item_name),
    tea_cups_per_liter: numberOrNull(draft.tea_cups_per_liter),
    white_coffee_cups_per_liter: numberOrNull(draft.white_coffee_cups_per_liter),
    bags_per_week: numberOrNull(draft.bags_per_week),
    cylinder_cost_per_month: numberOrNull(draft.cylinder_cost_per_month),
  };
}

export default function StockItemsPage() {
  const { user, loading } = useRequireAuth(["stock_items"]);
  const [settings, setSettings] = useState<CostSetting[]>([]);
  const [hotelItems, setHotelItems] = useState<string[]>([]);
  const [storeItems, setStoreItems] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<CostCategory>("food");
  const [newSource, setNewSource] = useState<CostDataSource>("store_stock_out");
  const [newPrice, setNewPrice] = useState("");

  const isAdmin = user?.role === "admin";

  const load = () => {
    setLoadingRows(true);
    fetchCostSettings()
      .then((data) => {
        setSettings(data.settings);
        setHotelItems(data.hotel_items);
        setStoreItems(data.store_items);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingRows(false));
  };

  useEffect(() => {
    if (loading || !user) return;
    load();
  }, [loading, user]);

  const onSave = async (setting: CostSetting, draft: Draft) => {
    setSavingId(setting.id);
    setError(null);
    setMessage(null);
    try {
      const res = await updateCostSetting(setting.id, payloadFrom(draft));
      setSettings((prev) => prev.map((row) => (row.id === setting.id ? res.setting : row)));
      setMessage(`Saved ${res.setting.name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) {
      setError("Enter an item name.");
      return;
    }
    setAdding(true);
    setError(null);
    setMessage(null);
    try {
      const res = await createCostSetting({
        name: newName.trim(),
        category: newCategory,
        data_source: newSource,
        purchase_price: Number(newPrice) || 0,
        hotel_item_name: null,
        store_item_name: null,
        tea_cups_per_liter: newSource === "recipe_milk" ? 6 : null,
        white_coffee_cups_per_liter: newSource === "recipe_milk" ? 3 : null,
        bags_per_week: newSource === "policy_rate" ? 3 : null,
        cylinder_cost_per_month: newSource === "policy_rate" ? 9000 : null,
      });
      setNewName("");
      setNewPrice("");
      setMessage(`Added ${res.setting.name}.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add item");
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  const filtered = settings.filter((row) =>
    row.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const busy = savingId !== null || adding;

  return (
    <main className="page">
      <div className={`card card-wide${busy ? " card-saving" : ""}`}>
        {busy && <SavingOverlay text={adding ? "Adding item" : undefined} />}
        <div className="page-header">
          <div>
            <h1 className="page-title">Stock Items</h1>
            <p className="page-subtitle">
              Cost settings for how spend turns into revenue. Cooking fat stays on snacks and sugar stays on drinks. Selling prices stay on Prices.
            </p>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        {!isAdmin && (
          <p className="muted">Reading only. An admin can change category, data source, and purchase price.</p>
        )}
        {isAdmin && (
          <form onSubmit={onAdd} className="form-inline">
            <input
              type="text"
              placeholder="New item name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as CostCategory)}>
              {CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select value={newSource} onChange={(e) => setNewSource(e.target.value as CostDataSource)}>
              {SOURCES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Purchase price"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={adding}>
              Add item
            </button>
          </form>
        )}
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
        {loadingRows ? (
          <p className="empty-state">Loading settings…</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Data source</th>
                  <th>Purchase price</th>
                  <th>Hotel item</th>
                  <th>Store item</th>
                  <th>Rate</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((setting) => (
                  <SettingRow
                    key={setting.id}
                    setting={setting}
                    hotelItems={hotelItems}
                    storeItems={storeItems}
                    canEdit={isAdmin}
                    saving={savingId === setting.id}
                    onSave={onSave}
                  />
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="empty-state">No items match this search.</p>}
          </div>
        )}
      </div>
    </main>
  );
}

function SettingRow({
  setting,
  hotelItems,
  storeItems,
  canEdit,
  saving,
  onSave,
}: {
  setting: CostSetting;
  hotelItems: string[];
  storeItems: string[];
  canEdit: boolean;
  saving: boolean;
  onSave: (setting: CostSetting, draft: Draft) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(setting));
  useEffect(() => setDraft(draftFrom(setting)), [setting]);

  const set = (field: keyof Draft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  if (!canEdit) {
    return (
      <tr>
        <td>{setting.name}</td>
        <td>{labelOf(CATEGORIES, setting.category)}</td>
        <td>{labelOf(SOURCES, setting.data_source)}</td>
        <td>{setting.purchase_price.toLocaleString()}</td>
        <td>{setting.hotel_item_name || "—"}</td>
        <td>{setting.store_item_name || "—"}</td>
        <td>{rateText(setting)}</td>
      </tr>
    );
  }

  const hotelListId = `hotel-items-${setting.id}`;
  const storeListId = `store-items-${setting.id}`;

  return (
    <tr>
      <td>
        <input className="input-cell" value={draft.name} onChange={(e) => set("name", e.target.value)} />
      </td>
      <td>
        <select value={draft.category} onChange={(e) => set("category", e.target.value)}>
          {CATEGORIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select value={draft.data_source} onChange={(e) => set("data_source", e.target.value)}>
          {SOURCES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          type="number"
          min={0}
          step="0.01"
          className="input-cell"
          value={draft.purchase_price}
          onChange={(e) => set("purchase_price", e.target.value)}
        />
      </td>
      <td>
        <input
          className="input-cell"
          list={hotelListId}
          value={draft.hotel_item_name}
          onChange={(e) => set("hotel_item_name", e.target.value)}
        />
        <datalist id={hotelListId}>
          {hotelItems.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </td>
      <td>
        <input
          className="input-cell"
          list={storeListId}
          value={draft.store_item_name}
          onChange={(e) => set("store_item_name", e.target.value)}
        />
        <datalist id={storeListId}>
          {storeItems.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </td>
      <td>
        <RateFields draft={draft} set={set} />
      </td>
      <td>
        <SaveButton saving={saving} disabled={!draft.name.trim()} onClick={() => onSave(setting, draft)} />
      </td>
    </tr>
  );
}

function RateFields({ draft, set }: { draft: Draft; set: (field: keyof Draft, value: string) => void }) {
  if (draft.data_source === "recipe_milk") {
    return (
      <div className="rate-fields">
        <label>
          Tea cups per liter
          <input
            type="number"
            min={0}
            step="0.01"
            className="input-cell"
            value={draft.tea_cups_per_liter}
            onChange={(e) => set("tea_cups_per_liter", e.target.value)}
          />
        </label>
        <label>
          White coffee cups per liter
          <input
            type="number"
            min={0}
            step="0.01"
            className="input-cell"
            value={draft.white_coffee_cups_per_liter}
            onChange={(e) => set("white_coffee_cups_per_liter", e.target.value)}
          />
        </label>
      </div>
    );
  }
  if (draft.data_source === "policy_rate") {
    return (
      <div className="rate-fields">
        <label>
          Bags per week
          <input
            type="number"
            min={0}
            step="0.01"
            className="input-cell"
            value={draft.bags_per_week}
            onChange={(e) => set("bags_per_week", e.target.value)}
          />
        </label>
        <label>
          Cylinder cost per month
          <input
            type="number"
            min={0}
            step="0.01"
            className="input-cell"
            value={draft.cylinder_cost_per_month}
            onChange={(e) => set("cylinder_cost_per_month", e.target.value)}
          />
        </label>
      </div>
    );
  }
  return <span>—</span>;
}

function rateText(setting: CostSetting): string {
  if (setting.data_source === "recipe_milk") {
    return `Tea ${setting.tea_cups_per_liter ?? "—"} cups/L, white coffee ${setting.white_coffee_cups_per_liter ?? "—"} cups/L`;
  }
  if (setting.data_source === "policy_rate") {
    const parts = [];
    if (setting.bags_per_week != null) parts.push(`${setting.bags_per_week} bags/week`);
    if (setting.cylinder_cost_per_month != null) {
      parts.push(`${setting.cylinder_cost_per_month.toLocaleString()} per month`);
    }
    return parts.join(", ") || "—";
  }
  return "—";
}
