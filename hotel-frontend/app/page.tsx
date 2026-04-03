"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export default function Home() {
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [item, setItem] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = quantity * price;

  useEffect(() => {
    fetch(`${API_BASE}/api/categories`)
      .then((r) => r.json())
      .then((d) => {
        const cats = d.categories || [];
        setCategories(cats);
        if (cats.length) setCategory(cats[0]);
      })
      .catch(() => setError("Failed to load categories"));
  }, []);

  useEffect(() => {
    if (!category) return;
    fetch(`${API_BASE}/api/items?category=${encodeURIComponent(category)}`)
      .then((r) => r.json())
      .then((d) => {
        const its = d.items || [];
        setItems(its);
        if (its.length) setItem(its[0]);
      })
      .catch(() => setError("Failed to load items"));
  }, [category]);

  useEffect(() => {
    if (!category || !item) return;
    fetch(
      `${API_BASE}/api/price?category=${encodeURIComponent(
        category
      )}&item=${encodeURIComponent(item)}`
    )
      .then((r) => r.json())
      .then((d) => setPrice(d.price ?? 0))
      .catch(() => setError("Failed to load price"));
  }, [category, item]);

  const submitSale = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          item,
          quantity,
          price,
          notes,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      alert("Sale saved!");
    } catch {
      setError("Failed to save sale");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "2rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          background: "#fff",
          borderRadius: 16,
          padding: "2rem",
          boxShadow: "0 10px 30px rgba(15,23,42,0.12)",
        }}
      >
        <h1 style={{ marginBottom: "1.5rem" }}>🏨 Hotel Sales Entry</h1>

        {error && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              background: "#fef2f2",
              color: "#b91c1c",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: 8,
                border: "1px solid #d4d4d8",
                fontSize: 14,
              }}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Item</span>
            <select
              value={item}
              onChange={(e) => setItem(e.target.value)}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: 8,
                border: "1px solid #d4d4d8",
                fontSize: 14,
              }}
            >
              {items.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <label
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
              <span style={{ fontSize: 14, fontWeight: 500 }}>Quantity</span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Number(e.target.value) || 1))
                }
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: 8,
                  border: "1px solid #d4d4d8",
                  fontSize: 14,
                }}
              />
            </label>

            <label
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                Price per unit (KSh)
              </span>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) =>
                  setPrice(Math.max(0, Number(e.target.value) || 0))
                }
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: 8,
                  border: "1px solid #d4d4d8",
                  fontSize: 14,
                }}
              />
            </label>
          </div>

          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#eff6ff",
              borderRadius: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "0.5rem",
            }}
          >
            <span style={{ fontSize: 14, color: "#4b5563" }}>Total (KSh)</span>
            <strong style={{ fontSize: 20 }}>
              {total.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </strong>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              Notes (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: 8,
                border: "1px solid #d4d4d8",
                fontSize: 14,
                resize: "vertical",
              }}
            />
          </label>

          <button
            onClick={submitSale}
            disabled={
              saving || !category || !item || quantity <= 0 || price <= 0
            }
            style={{
              marginTop: "0.5rem",
              padding: "0.75rem 1rem",
              borderRadius: 999,
              border: "none",
              background:
                saving || !category || !item || quantity <= 0 || price <= 0
                  ? "#9ca3af"
                  : "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor:
                saving || !category || !item || quantity <= 0 || price <= 0
                  ? "not-allowed"
                  : "pointer",
              transition: "background 0.15s ease",
            }}
          >
            {saving ? "Saving..." : "Save Sale"}
          </button>
        </div>
      </div>
    </main>
  );
}

