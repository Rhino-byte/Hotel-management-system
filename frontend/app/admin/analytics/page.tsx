"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import LoadingScreen from "../../../components/LoadingScreen";
import {
  fetchDaySalesTotals,
  fetchItemsSold,
  fetchSalesTotals,
  todayIso,
} from "../../../lib/api";
import { useRequireAuth } from "../../../lib/auth";
import type {
  AnalyticsCategory,
  AnalyticsGroupTotal,
  AnalyticsItemSold,
  AnalyticsRange,
} from "../../../lib/types";

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "Month" },
  { value: "90d", label: "3 months" },
];

const CATEGORY_OPTIONS: { value: AnalyticsCategory; label: string }[] = [
  { value: "snacks", label: "Snacks" },
  { value: "drinks", label: "Drinks" },
  { value: "food", label: "Food" },
  { value: "kuku", label: "Kuku" },
];

const BAR_COLOR = "#3d8bfd";

function formatKsh(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function AdminAnalyticsPage() {
  const { user, loading } = useRequireAuth(undefined, true);
  const [range, setRange] = useState<AnalyticsRange>("yesterday");
  const [groups, setGroups] = useState<AnalyticsGroupTotal[]>([]);
  const [totalsMeta, setTotalsMeta] = useState<{ from: string; to: string } | null>(
    null
  );
  const [totalsLoading, setTotalsLoading] = useState(false);

  const [category, setCategory] = useState<AnalyticsCategory>("snacks");
  const [itemDate, setItemDate] = useState(todayIso());
  const [items, setItems] = useState<AnalyticsItemSold[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [dayGroups, setDayGroups] = useState<AnalyticsGroupTotal[]>([]);
  const [daySummaryLoading, setDaySummaryLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || user.role !== "admin") return;
    setTotalsLoading(true);
    setError(null);
    fetchSalesTotals(range)
      .then((d) => {
        setGroups(d.groups);
        setTotalsMeta({ from: d.date_from, to: d.date_to });
      })
      .catch((e) => setError(e.message))
      .finally(() => setTotalsLoading(false));
  }, [range, loading, user]);

  useEffect(() => {
    if (loading || !user || user.role !== "admin") return;
    setItemsLoading(true);
    setError(null);
    fetchItemsSold(category, itemDate)
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setItemsLoading(false));
  }, [category, itemDate, loading, user]);

  useEffect(() => {
    if (loading || !user || user.role !== "admin") return;
    setDaySummaryLoading(true);
    setError(null);
    fetchDaySalesTotals(itemDate)
      .then((d) => setDayGroups(d.groups))
      .catch((e) => setError(e.message))
      .finally(() => setDaySummaryLoading(false));
  }, [itemDate, loading, user]);

  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "admin") return null;

  const chartHeight = Math.max(280, items.length * 36);
  const dayGrandUnits = dayGroups.reduce((sum, g) => sum + Number(g.sold_units), 0);
  const dayGrandRevenue = dayGroups.reduce((sum, g) => sum + Number(g.revenue), 0);

  return (
    <main className="page">
      <div className="card card-wide">
        <div className="page-header">
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">
              Sales totals by group, popular items for a selected day, and a daily summary.
            </p>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}

        <section className="analytics-section">
          <div className="analytics-section-head">
            <h2 className="analytics-section-title">Total sales by group</h2>
            <div className="bar-preview-tabs">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={
                    range === opt.value ? "bar-preview-tab active" : "bar-preview-tab"
                  }
                  onClick={() => setRange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {totalsMeta && (
            <p className="analytics-meta">
              {totalsMeta.from === totalsMeta.to
                ? totalsMeta.from
                : `${totalsMeta.from} → ${totalsMeta.to}`}
            </p>
          )}
          {totalsLoading ? (
            <p className="empty-state">Loading totals…</p>
          ) : (
            <>
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groups} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" />
                    <XAxis dataKey="label" stroke="#8b9bb8" tick={{ fill: "#8b9bb8" }} />
                    <YAxis
                      stroke="#8b9bb8"
                      tick={{ fill: "#8b9bb8" }}
                      tickFormatter={(v) => formatKsh(Number(v))}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0f1b33",
                        border: "1px solid #1f2a44",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: "#e8eef8" }}
                      formatter={(value: number) => [`KSh ${formatKsh(value)}`, "Revenue"]}
                    />
                    <Bar dataKey="revenue" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="analytics-units-row">
                {groups.map((g) => (
                  <div key={g.key} className="analytics-units-cell">
                    <span>{g.label}</span>
                    <strong>{Number(g.sold_units).toLocaleString()} sold</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="analytics-section">
          <div className="analytics-section-head">
            <h2 className="analytics-section-title">Popular items</h2>
            <div className="bar-preview-tabs">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={
                    category === opt.value ? "bar-preview-tab active" : "bar-preview-tab"
                  }
                  onClick={() => setCategory(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <p className="analytics-meta">Items sold more than once on the selected day.</p>
          <div className="filters">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={itemDate}
                onChange={(e) => setItemDate(e.target.value)}
              />
            </label>
          </div>
          {itemsLoading ? (
            <p className="empty-state">Loading items…</p>
          ) : items.length === 0 ? (
            <p className="empty-state">No items sold more than once on this day.</p>
          ) : (
            <div className="analytics-chart" style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={items}
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" />
                  <XAxis
                    type="number"
                    stroke="#8b9bb8"
                    tick={{ fill: "#8b9bb8" }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    stroke="#8b9bb8"
                    tick={{ fill: "#8b9bb8", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f1b33",
                      border: "1px solid #1f2a44",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "#e8eef8" }}
                    formatter={(value: number, name: string, props) => {
                      if (name === "sold_units") {
                        const revenue = props?.payload?.revenue;
                        return [
                          `${Number(value).toLocaleString()} (KSh ${formatKsh(Number(revenue ?? 0))})`,
                          "Sold",
                        ];
                      }
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="sold_units" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="analytics-section">
          <div className="analytics-section-head">
            <h2 className="analytics-section-title">Daily sales summary</h2>
          </div>
          <p className="analytics-meta">{itemDate}</p>
          {daySummaryLoading ? (
            <p className="empty-state">Loading summary…</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Units sold</th>
                    <th>Revenue (KSh)</th>
                  </tr>
                </thead>
                <tbody>
                  {dayGroups.map((g) => (
                    <tr key={g.key}>
                      <td>{g.label}</td>
                      <td>{Number(g.sold_units).toLocaleString()}</td>
                      <td>{formatKsh(Number(g.revenue))}</td>
                    </tr>
                  ))}
                  <tr className="analytics-summary-total">
                    <td>Grand total</td>
                    <td>{dayGrandUnits.toLocaleString()}</td>
                    <td>{formatKsh(dayGrandRevenue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
