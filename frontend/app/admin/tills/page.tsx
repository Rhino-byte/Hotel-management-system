"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import LoadingScreen from "../../../components/LoadingScreen";
import { fetchTillsReport, todayIso } from "../../../lib/api";
import { useRequireAuth } from "../../../lib/auth";
import type { TillsReport } from "../../../lib/types";

const LINE_COLOR = "#3d8bfd";
const PCT_COLOR = "#22c55e";

function formatKsh(value: number): string {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatPct(value: number): string {
  return `${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function localIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localIso(date);
}

export default function AdminTillsPage() {
  const { user, loading } = useRequireAuth(undefined, true);
  const [dateFrom, setDateFrom] = useState(daysAgo(6));
  const [dateTo, setDateTo] = useState(todayIso());
  const [report, setReport] = useState<TillsReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (dateFrom > dateTo) {
      setError("From date must be on or before To date.");
      return;
    }
    setReportLoading(true);
    setError(null);
    try {
      const result = await fetchTillsReport(dateFrom, dateTo);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tills report");
    } finally {
      setReportLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (!loading && user?.role === "admin") {
      loadReport();
    }
  }, [loading, user, loadReport]);

  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "admin") return null;

  const setPreset = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  return (
    <main className="page">
      <div className="card card-wide">
        <div className="page-header">
          <div>
            <h1 className="page-title">Tills</h1>
            <p className="page-subtitle">
              Daily till credits vs hotel sales (snacks, drinks, food, kuku).
            </p>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        <div className="filters">
          <label className="field">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
          <div className="audit-preset-group" aria-label="Date range presets">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPreset(daysAgo(1), daysAgo(1))}
            >
              Yesterday
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPreset(daysAgo(6), todayIso())}
            >
              7 days
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPreset(daysAgo(29), todayIso())}
            >
              Month
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={reportLoading}
            onClick={loadReport}
          >
            {reportLoading ? "Loading…" : "Load"}
          </button>
        </div>

        {reportLoading && !report ? (
          <p className="empty-state">Loading tills…</p>
        ) : report ? (
          <>
            <div className="revenue-banner">
              <span>
                {report.date_from === report.date_to
                  ? report.date_from
                  : `${report.date_from} → ${report.date_to}`}
                {report.phone_number ? ` · ${report.phone_number}` : ""}
              </span>
              <div className="revenue-banner-metrics">
                <strong>Total tills: KSh {formatKsh(report.period_total)}</strong>
                <strong>
                  Total sales: KSh {formatKsh(report.sales_period_total ?? 0)}
                </strong>
                <strong>Tills %: {formatPct(report.tills_pct ?? 0)}</strong>
              </div>
            </div>

            <section className="analytics-section">
              <div className="analytics-section-head">
                <div>
                  <h2 className="analytics-section-title">Tills over time</h2>
                  <p className="analytics-meta">
                    Daily sum of credit payments for the till phone number.
                  </p>
                </div>
              </div>
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.timeseries}>
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
                      formatter={(value) => [
                        `KSh ${formatKsh(Number(value ?? 0))}`,
                        "Tills",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Tills"
                      stroke={LINE_COLOR}
                      strokeWidth={2}
                      dot={{ r: 3, fill: LINE_COLOR }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="analytics-section">
              <div className="analytics-section-head">
                <div>
                  <h2 className="analytics-section-title">
                    Tills share of sales (%)
                  </h2>
                  <p className="analytics-meta">
                    Daily tills ÷ hotel sales (snacks + drinks + food + kuku). May
                    exceed 100% when till credits exceed recorded sales.
                  </p>
                </div>
              </div>
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.timeseries}>
                    <CartesianGrid stroke="#1f2a44" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#8b9bb8", fontSize: 12 }}
                      stroke="#1f2a44"
                    />
                    <YAxis
                      tick={{ fill: "#8b9bb8", fontSize: 12 }}
                      stroke="#1f2a44"
                      tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                      domain={[0, "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0f1b33",
                        border: "1px solid #1f2a44",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: "#8b9bb8" }}
                      formatter={(value, _name, item) => {
                        const row = item?.payload as
                          | { sales_total?: number; total?: number }
                          | undefined;
                        return [
                          `${formatPct(Number(value ?? 0))} (tills KSh ${formatKsh(
                            Number(row?.total ?? 0)
                          )} / sales KSh ${formatKsh(Number(row?.sales_total ?? 0))})`,
                          "Share",
                        ];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="pct"
                      name="Tills %"
                      stroke={PCT_COLOR}
                      strokeWidth={2}
                      dot={{ r: 3, fill: PCT_COLOR }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
