"use client";

import { useEffect, useState } from "react";
import { fetchInventoryAudit, todayIso } from "../../../lib/api";
import { useRequireAuditAccess } from "../../../lib/auth";
import type { AuditRow } from "../../../lib/types";
import AuditSalesSummaryPreview from "../../../components/AuditSalesSummaryPreview";
import LoadingScreen from "../../../components/LoadingScreen";
import SearchableSelect from "../../../components/SearchableSelect";

const GROUPS = [
  { value: "snacks_drinks", label: "Snacks & Drinks" },
  { value: "food_kuku", label: "Food & Kuku" },
  { value: "stock", label: "Stock Items" },
  { value: "bar", label: "Bar Stock" },
];

function defaultAuditGroup(modules: string[]): string {
  if (modules.includes("snacks_drinks")) return "snacks_drinks";
  if (modules.includes("food_kuku")) return "food_kuku";
  if (modules.includes("stock_items")) return "stock";
  if (modules.includes("bar")) return "bar";
  return "snacks_drinks";
}

function stockTotal(row: AuditRow): number {
  return Number(row.opening_stock ?? 0) + Number(row.added_stock ?? 0);
}

export default function AdminAuditPage() {
  const { user, loading } = useRequireAuditAccess();
  const [group, setGroup] = useState("snacks_drinks");
  const [groupInitialized, setGroupInitialized] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    if (loading || !user || groupInitialized) return;
    setGroup(defaultAuditGroup(user.modules));
    setGroupInitialized(true);
  }, [loading, user, groupInitialized]);

  useEffect(() => {
    setSummaryOpen(false);
  }, [group, date]);

  const onLoad = async () => {
    setError(null);
    setSummaryOpen(false);
    try {
      const res = await fetchInventoryAudit(group, date, date);
      setRows(res.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit");
    }
  };

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  const isSnacksGroup = group === "snacks_drinks";
  const isFoodGroup = group === "food_kuku";
  const isStockGroup = group === "stock";
  const isBarGroup = group === "bar";
  const canShowSummary = (isSnacksGroup || isFoodGroup) && rows.length > 0;
  const groupOptions = GROUPS.filter((g) =>
    user.role === "admin"
      ? true
      : (g.value === "snacks_drinks" && user.modules.includes("snacks_drinks")) ||
        (g.value === "food_kuku" && user.modules.includes("food_kuku")) ||
        (g.value === "stock" && user.modules.includes("stock_items")) ||
        (g.value === "bar" && user.modules.includes("bar"))
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
              {isSnacksGroup
                ? "Each day shows previous closing, added stock, total (prev. closing + added), and closing count. Sold units and revenue are computed from daily movement."
                : isBarGroup
                  ? "Bar stock: opening uses the most recent saved B.B.F before each date (zero counts). Sales = (Opening + Add) − B.B.F."
                  : "Review daily records. Opening equals previous day closing."}
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
          <button type="button" className="btn btn-primary" onClick={onLoad}>
            Load
          </button>
          {canShowSummary && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSummaryOpen(true)}
            >
              View summary
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                {isSnacksGroup ? (
                  <>
                    <th>Prev. Day Closing</th>
                    <th>Added</th>
                    <th>Total</th>
                    <th>Closing</th>
                    <th>Price</th>
                    <th>Sold Units</th>
                    <th>Revenue</th>
                  </>
                ) : isBarGroup ? (
                  <>
                    <th>Open</th>
                    <th>Add</th>
                    <th>Total</th>
                    <th>B.B.F</th>
                    <th>Sales</th>
                    <th>Price</th>
                    <th>Amount</th>
                  </>
                ) : isStockGroup ? (
                  <>
                    <th>Prev. Day Closing</th>
                    <th>Added</th>
                    <th>Total</th>
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
                      <td>{stockTotal(r)}</td>
                      <td>{r.closing_stock ?? 0}</td>
                      <td>
                        {Number(r.price_ksh ?? 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td>{r.sold_units ?? 0}</td>
                      <td>
                        {(r.revenue ?? 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </>
                  ) : isBarGroup ? (
                    <>
                      <td>{r.opening_stock ?? 0}</td>
                      <td>{r.added_stock ?? 0}</td>
                      <td>{Number(r.total_units ?? stockTotal(r))}</td>
                      <td>{r.closing_stock ?? 0}</td>
                      <td>{r.sold_units ?? 0}</td>
                      <td>
                        {Number(r.price_ksh ?? 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        {(r.revenue ?? 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </>
                  ) : isStockGroup ? (
                    <>
                      <td>{r.opening_stock ?? 0}</td>
                      <td>{r.added_stock ?? 0}</td>
                      <td>{stockTotal(r)}</td>
                      <td>{r.closing_stock ?? 0}</td>
                    </>
                  ) : (
                    <>
                      <td>{r.quantity ?? 0}</td>
                      <td>{r.price_ksh ?? 0}</td>
                      <td>
                        {(r.revenue ?? 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRows.length === 0 && (
            <p className="empty-state">No rows match current filters.</p>
          )}
        </div>
      </div>
      {summaryOpen && canShowSummary && (
        <AuditSalesSummaryPreview
          kind={isSnacksGroup ? "snacks_drinks" : "food_kuku"}
          date={date}
          rows={filteredRows}
          onClose={() => setSummaryOpen(false)}
        />
      )}
    </main>
  );
}
