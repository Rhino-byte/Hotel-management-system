"use client";

import { useState } from "react";
import { fetchInventoryAudit, todayIso } from "../../../lib/api";
import { useRequireAuth } from "../../../lib/auth";
import type { AuditRow } from "../../../lib/types";
import LoadingScreen from "../../../components/LoadingScreen";
import SearchableSelect from "../../../components/SearchableSelect";

const GROUPS = [
  { value: "snacks_drinks", label: "Snacks & Drinks" },
  { value: "food_kuku", label: "Food & Kuku" },
  { value: "stock", label: "Stock Items" },
];

export default function AdminAuditPage() {
  const { user, loading } = useRequireAuth();
  const [group, setGroup] = useState("snacks_drinks");
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onLoad = async () => {
    setError(null);
    try {
      const res = await fetchInventoryAudit(group, dateFrom, dateTo);
      setRows(res.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit");
    }
  };

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  const isSnacksGroup = group === "snacks_drinks";
  const isStockGroup = group === "stock";
  const groupOptions = GROUPS.filter((g) =>
    user.role === "admin"
      ? true
      : (g.value === "snacks_drinks" && user.modules.includes("snacks_drinks")) ||
        (g.value === "food_kuku" && user.modules.includes("food_kuku")) ||
        (g.value === "stock" && user.modules.includes("stock_items"))
  );
  const filteredRows = rows.filter((r) =>
    r.item_name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <main className="page">
      <div className="card card-wide">
        <div className="page-header">
          <div>
            <h1 className="page-title">Inventory Audit</h1>
            <p className="page-subtitle">
              Review daily records for auditing. Opening stock equals previous day closing.
            </p>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="filters">
          <SearchableSelect
            label="Module"
            value={group}
            options={groupOptions}
            onChange={setGroup}
            placeholder="Search module..."
          />
          <label className="field">
            <span>From</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
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
          <button type="button" className="btn btn-primary" onClick={onLoad}>
            Load
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                {isSnacksGroup ? (
                  <>
                    <th>Opening</th>
                    <th>Added</th>
                    <th>Closing</th>
                    <th>Price</th>
                    <th>Sold Units</th>
                    <th>Revenue</th>
                  </>
                ) : isStockGroup ? (
                  <>
                    <th>Opening</th>
                    <th>Added</th>
                    <th>Closing</th>
                  </>
                ) : (
                  <>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Revenue</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, i) => (
                <tr key={`${r.item_id}-${r.entry_date}-${i}`}>
                  <td>{r.entry_date}</td>
                  <td>{r.item_name}</td>
                  {isSnacksGroup ? (
                    <>
                      <td>{r.opening_stock ?? 0}</td>
                      <td>{r.added_stock ?? 0}</td>
                      <td>{r.closing_stock ?? 0}</td>
                      <td>{Number(r.price_ksh ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>{r.sold_units ?? 0}</td>
                      <td>{(r.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </>
                  ) : isStockGroup ? (
                    <>
                      <td>{r.opening_stock ?? 0}</td>
                      <td>{r.added_stock ?? 0}</td>
                      <td>{r.closing_stock ?? 0}</td>
                    </>
                  ) : (
                    <>
                      <td>{r.quantity ?? 0}</td>
                      <td>{r.price_ksh ?? 0}</td>
                      <td>{(r.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRows.length === 0 && <p className="empty-state">No rows match current filters.</p>}
        </div>
      </div>
    </main>
  );
}
