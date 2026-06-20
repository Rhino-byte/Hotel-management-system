"use client";

import { FormEvent, useEffect, useState } from "react";
import { addStockCatalogItem, fetchStockCatalog } from "../../../lib/api";
import { useRequireAuth } from "../../../lib/auth";
import LoadingScreen from "../../../components/LoadingScreen";

type CatalogItem = { id: number; name: string; is_active: boolean };

export default function AdminStockCatalogPage() {
  const { user, loading } = useRequireAuth(undefined, true);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    fetchStockCatalog()
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (loading || !user || user.role !== "admin") return;
    load();
  }, [loading, user]);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await addStockCatalogItem(name.trim());
      setName("");
      setMessage(`Added ${res.item.name}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    }
  };

  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "admin") return null;
  const filtered = items.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <main className="page">
      <div className="card">
        <div className="page-header">
          <div>
            <h1 className="page-title">Stock Catalog</h1>
            <p className="page-subtitle">
              Manage raw materials tracked in stock entry workflows.
            </p>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        <form onSubmit={onAdd} className="form-inline">
          <input
            type="text"
            placeholder="New material name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary">
            Add Item
          </button>
        </form>
        <div className="filters">
          <label className="field">
            <span>Search material</span>
            <input
              type="text"
              value={query}
              placeholder="Type material name..."
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
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.is_active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="empty-state">No stock items found.</p>}
        </div>
      </div>
    </main>
  );
}
