"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import LoadingScreen from "../LoadingScreen";
import { fetchCostReport } from "../../lib/api";
import { canViewManagement, useRequireAuth } from "../../lib/auth";
import type {
  CostCategory,
  CostDataSource,
  CostReport,
  CostReportCheck,
  CostReportLine,
} from "../../lib/types";

const REVENUE_COLOR = "#3d8bfd";
const COST_COLOR = "#f59e0b";

const CATEGORY_LABELS = {
  snacks: "Snacks",
  drinks: "Drinks",
  food: "Food",
  kuku: "Kuku",
} as const;

const SOURCE_LABELS: Record<CostDataSource, string> = {
  hotel_sold: "Units sold",
  store_stock_out: "Store stock out",
  recipe_milk: "Milk recipe",
  policy_rate: "Fixed rate",
};

const CHECK_KIND_LABELS: Record<CostReportCheck["kind"], string> = {
  water: "Water",
  makaa: "Makaa",
  gas: "Gas",
  duplicate: "Duplicate",
};

type CheckTone = "matched" | "off" | "waiting";

const CHECK_TONE_LABELS: Record<CheckTone, string> = {
  matched: "Matched",
  off: "Off",
  waiting: "Waiting",
};

function checkTone(check: CostReportCheck): CheckTone {
  if (check.ok) return "matched";
  const message = check.message.toLowerCase();
  if (
    message.includes("waiting") ||
    message.includes("unavailable") ||
    message.includes("incomplete")
  ) {
    return "waiting";
  }
  return "off";
}

type Preset = "yesterday" | "week" | "month";

function formatKsh(value: number): string {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatQty(value: number): string {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function localIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function yesterdayDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date;
}

function weekContaining(day: Date): { from: string; to: string } {
  const monday = new Date(day);
  const weekday = monday.getDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  monday.setDate(monday.getDate() + delta);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: localIso(monday), to: localIso(sunday) };
}

function monthContaining(day: Date): { from: string; to: string } {
  const start = new Date(day.getFullYear(), day.getMonth(), 1);
  const end = new Date(day.getFullYear(), day.getMonth() + 1, 0);
  return { from: localIso(start), to: localIso(end) };
}

function presetRange(preset: Preset): { from: string; to: string } {
  const anchor = yesterdayDate();
  if (preset === "yesterday") {
    const day = localIso(anchor);
    return { from: day, to: day };
  }
  if (preset === "week") return weekContaining(anchor);
  return monthContaining(anchor);
}

function CostChecks({ checks }: { checks: CostReportCheck[] }) {
  if (checks.length === 0) {
    return <p className="empty-state">No policy checks for this range.</p>;
  }

  const items = checks.map((check, index) => ({ check, index, tone: checkTone(check) }));
  const problems = items.filter((item) => item.tone !== "matched");
  const matched = items.filter((item) => item.tone === "matched");
  const offCount = items.filter((item) => item.tone === "off").length;
  const waitingCount = items.filter((item) => item.tone === "waiting").length;

  return (
    <>
      <p className="cost-check-summary">
        <span className="cost-check-count matched">{matched.length} matched</span>
        <span className="cost-check-count off">{offCount} off</span>
        <span className="cost-check-count waiting">{waitingCount} waiting</span>
      </p>
      {problems.length > 0 && (
        <ul className="cost-check-list">
          {problems.map((item) => (
            <CostCheckCard key={`${item.check.kind}-${item.index}`} check={item.check} tone={item.tone} />
          ))}
        </ul>
      )}
      {matched.length > 0 && (
        <div className="cost-check-group">
          <h3 className="cost-check-group-title">Matched</h3>
          <ul className="cost-check-list">
            {matched.map((item) => (
              <CostCheckCard key={`${item.check.kind}-${item.index}`} check={item.check} tone={item.tone} />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function CostCheckCard({ check, tone }: { check: CostReportCheck; tone: CheckTone }) {
  return (
    <li className={`cost-check ${tone}`}>
      <span className="cost-check-kind">{CHECK_KIND_LABELS[check.kind]}</span>
      <p className="cost-check-message">{check.message}</p>
      <span className="cost-check-status">{CHECK_TONE_LABELS[tone]}</span>
    </li>
  );
}

function sideText(line: CostReportLine): string {
  const parts = Object.entries(line.other_destinations).map(
    ([label, qty]) => `${label} ${formatQty(qty)}`
  );
  if (line.correction_in) {
    parts.push(`Correction in ${formatQty(line.correction_in)}`);
  }
  return parts.length ? parts.join(", ") : "—";
}

export default function CostProfitPanel() {
  const { user, loading } = useRequireAuth(undefined, false, true);
  const initial = presetRange("yesterday");
  const [preset, setPreset] = useState<Preset | null>("yesterday");
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [draftFrom, setDraftFrom] = useState(initial.from);
  const [draftTo, setDraftTo] = useState(initial.to);
  const [report, setReport] = useState<CostReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CostCategory | null>(null);

  const loadReport = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setError("Choose a From date and a To date.");
      setReport(null);
      return;
    }
    if (dateFrom > dateTo) {
      setError("From date must be on or before To date.");
      setReport(null);
      return;
    }
    setReportLoading(true);
    setError(null);
    try {
      const result = await fetchCostReport(dateFrom, dateTo);
      setReport(result);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Failed to load cost report");
    } finally {
      setReportLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (!loading && canViewManagement(user?.role)) {
      loadReport();
    }
  }, [loading, user, loadReport]);

  if (loading) return <LoadingScreen />;
  if (!user || !canViewManagement(user.role)) return null;

  const applyPreset = (next: Preset) => {
    const range = presetRange(next);
    setPreset(next);
    setCategory(null);
    setDraftFrom(range.from);
    setDraftTo(range.to);
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const applyCustomRange = () => {
    if (!draftFrom || !draftTo) {
      setError("Choose a From date and a To date.");
      return;
    }
    if (draftFrom > draftTo) {
      setError("From date must be on or before To date.");
      return;
    }
    setError(null);
    setPreset(null);
    if (draftFrom === dateFrom && draftTo === dateTo) return;
    setCategory(null);
    setDateFrom(draftFrom);
    setDateTo(draftTo);
  };

  const rangePending = draftFrom !== dateFrom || draftTo !== dateTo;

  const visibleLines = report
    ? category
      ? report.lines.filter((line) => line.category === category)
      : report.lines
    : [];

  const showChart = Boolean(report && report.date_from !== report.date_to);

  return (
    <>
        <p className="page-subtitle mgmt-panel-lead">
          Sales, store use, and the Stock Items rates for any date range.
        </p>

        {error && <div className="alert error">{error}</div>}

        <div className="filters">
          <label className="field">
            <span>From</span>
            <input
              type="date"
              value={draftFrom}
              onChange={(event) => {
                setPreset(null);
                setError(null);
                setDraftFrom(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyCustomRange();
              }}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="date"
              value={draftTo}
              onChange={(event) => {
                setPreset(null);
                setError(null);
                setDraftTo(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyCustomRange();
              }}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!rangePending}
            onClick={applyCustomRange}
          >
            Apply
          </button>
          <div className="audit-preset-group" aria-label="Date range presets">
            <button
              type="button"
              className={preset === "yesterday" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => applyPreset("yesterday")}
            >
              Yesterday
            </button>
            <button
              type="button"
              className={preset === "week" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => applyPreset("week")}
            >
              This week
            </button>
            <button
              type="button"
              className={preset === "month" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => applyPreset("month")}
            >
              This month
            </button>
          </div>
        </div>

        {reportLoading && !report ? (
          <p className="empty-state">Loading cost and profit…</p>
        ) : report ? (
          <>
            <div className="revenue-banner">
              <span>
                {report.date_from === report.date_to
                  ? report.date_from
                  : `${report.date_from} → ${report.date_to}`}
                {" · "}
                {report.status === "final" ? "Final" : "Preliminary"}
              </span>
              {report.note && <span>{report.note}</span>}
            </div>

            <div className="analytics-units-row">
              {report.groups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  className={
                    category === group.key
                      ? "analytics-units-cell selected"
                      : "analytics-units-cell"
                  }
                  aria-pressed={category === group.key}
                  onClick={() =>
                    setCategory((current) => (current === group.key ? null : group.key))
                  }
                >
                  <span>{group.label}</span>
                  <strong>Profit KSh {formatKsh(group.profit)}</strong>
                  <span>Revenue KSh {formatKsh(group.revenue)}</span>
                  <span>
                    Cost KSh {formatKsh(group.cost)}
                    {group.cost_complete ? "" : " · waiting"}
                  </span>
                </button>
              ))}
            </div>

            {showChart && (
              <section className="analytics-section">
                <div className="analytics-section-head">
                  <div>
                    <h2 className="analytics-section-title">Revenue and cost by day</h2>
                    <p className="analytics-meta">
                      Cost includes only days whose source is already in.
                    </p>
                  </div>
                </div>
                <div className="analytics-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.days}>
                      <CartesianGrid stroke="#1f2a44" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: "#8b9bb8", fontSize: 12 }}
                        stroke="#1f2a44"
                      />
                      <YAxis
                        tick={{ fill: "#8b9bb8", fontSize: 12 }}
                        stroke="#1f2a44"
                        tickFormatter={(value) => formatKsh(Number(value))}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0f1b33",
                          border: "1px solid #1f2a44",
                          borderRadius: 8,
                        }}
                        labelStyle={{ color: "#8b9bb8" }}
                        formatter={(value, name) => [
                          `KSh ${formatKsh(Number(value ?? 0))}`,
                          name === "revenue" ? "Revenue" : "Cost",
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke={REVENUE_COLOR}
                        strokeWidth={2}
                        dot={{ r: 3, fill: REVENUE_COLOR }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cost"
                        name="Cost"
                        stroke={COST_COLOR}
                        strokeWidth={2}
                        dot={{ r: 3, fill: COST_COLOR }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            <section className="analytics-section">
              <div className="analytics-section-head">
                <h2 className="analytics-section-title">
                  {category ? `Cost lines · ${CATEGORY_LABELS[category]}` : "Cost lines"}
                </h2>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Source</th>
                      <th>Quantity</th>
                      <th>Purchase price</th>
                      <th>Cost (KSh)</th>
                      <th>Status</th>
                      <th>Other destinations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLines.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          {category
                            ? `There are no cost lines for ${CATEGORY_LABELS[category]}.`
                            : "No cost lines for this range."}
                        </td>
                      </tr>
                    ) : (
                      visibleLines.map((line) => (
                        <tr key={line.id}>
                          <td>{line.name}</td>
                          <td>{CATEGORY_LABELS[line.category]}</td>
                          <td>{SOURCE_LABELS[line.data_source]}</td>
                          <td>{line.quantity == null ? "—" : formatQty(line.quantity)}</td>
                          <td>{line.purchase_price == null ? "Varies" : formatKsh(line.purchase_price)}</td>
                          <td>{line.cost == null ? "—" : formatKsh(line.cost)}</td>
                          <td className={line.status === "waiting" ? "cost-status-waiting" : undefined}>
                            {line.status === "waiting" ? "Waiting" : "Ready"}
                          </td>
                          <td>{sideText(line)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="analytics-section">
              <div className="analytics-section-head">
                <h2 className="analytics-section-title">Checks</h2>
              </div>
              <CostChecks checks={report.checks} />
            </section>
          </>
        ) : null}
    </>
  );
}
