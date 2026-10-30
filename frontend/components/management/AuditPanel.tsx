"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
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
import { fetchSalesAudit, todayIso } from "../../lib/api";
import { canViewManagement, useRequireAuth } from "../../lib/auth";
import type {
  SalesAuditCategoryKey,
  SalesAuditDay,
  SalesAuditReport,
  SalesAuditSnackRow,
} from "../../lib/types";

const COLORS = {
  snacks: "#f59e0b",
  drinks: "#38bdf8",
  food: "#8b5cf6",
  kuku: "#22c55e",
  total: "#f8fafc",
  plates: "#3d8bfd",
};

type TimeseriesGroup = "snacks" | "drinks" | "food" | "kuku";

const TIMESERIES_GROUPS: { key: TimeseriesGroup; label: string }[] = [
  { key: "snacks", label: "Snacks" },
  { key: "drinks", label: "Drinks" },
  { key: "food", label: "Food" },
  { key: "kuku", label: "Kuku" },
];

const ALL_TIMESERIES_GROUPS = new Set<TimeseriesGroup>(
  TIMESERIES_GROUPS.map((g) => g.key)
);

const CATEGORY_COLUMNS: { key: SalesAuditCategoryKey; label: string }[] = [
  { key: "ugali", label: "Ugali" },
  { key: "rice", label: "Rice" },
  { key: "matumbo", label: "Matumbo" },
  { key: "kuku", label: "Kuku" },
  { key: "mix", label: "Mix" },
  { key: "fries", label: "Fries" },
  { key: "managu", label: "Managu" },
];

function formatNumber(value: number): string {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatKsh(value: number): string {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
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

function csvEscape(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function dailySalesCsv(rows: SalesAuditDay[]): string {
  const header = ["entry_date", "snacks", "drinks", "food", "kuku", "total"];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.entry_date,
        row.snacks,
        row.drinks,
        row.food,
        row.kuku,
        row.total,
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];
  return lines.join("\n");
}

function snacksDrinksAddedCsv(rows: SalesAuditSnackRow[]): string {
  const header = ["item_id", "item_name", "entry_date", "added", "sold", "revenue"];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [row.item_id, row.item_name, row.entry_date, row.added, row.sold, row.revenue]
        .map(csvEscape)
        .join(",")
    ),
  ];
  return lines.join("\n");
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  downloadBlob(filename, new Blob([content], { type: mime }));
}

async function buildPlatesWorkbook(report: SalesAuditReport) {
  const ExcelJSMod = await import("exceljs");
  const ExcelJS = ExcelJSMod.default ?? ExcelJSMod;
  const workbook = new ExcelJS.Workbook();

  const categoriesSheet = workbook.addWorksheet("Categories");
  categoriesSheet.columns = [
    { header: "entry_date", key: "entry_date", width: 14 },
    ...CATEGORY_COLUMNS.map((column) => ({
      header: column.label,
      key: column.key,
      width: 12,
    })),
  ];
  for (const row of report.category_daily ?? []) {
    const values: Record<string, string | number> = { entry_date: row.entry_date };
    for (const column of CATEGORY_COLUMNS) {
      values[column.key] = row[column.key] ?? 0;
    }
    categoriesSheet.addRow(values);
  }

  const dishesSheet = workbook.addWorksheet("Dishes");
  dishesSheet.columns = [
    { header: "entry_date", key: "entry_date", width: 14 },
    { header: "item_id", key: "item_id", width: 10 },
    { header: "item_name", key: "item_name", width: 28 },
    { header: "plates", key: "plates", width: 10 },
    { header: "revenue", key: "revenue", width: 12 },
  ];
  for (const row of report.food_plates ?? []) {
    dishesSheet.addRow(row);
  }

  return workbook.xlsx.writeBuffer();
}

export default function AuditPanel() {
  const { user, loading } = useRequireAuth(undefined, false, true);
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [report, setReport] = useState<SalesAuditReport | null>(null);
  const [activeCategory, setActiveCategory] = useState<SalesAuditCategoryKey | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleGroups, setVisibleGroups] = useState<Set<TimeseriesGroup>>(
    () => new Set(ALL_TIMESERIES_GROUPS)
  );

  const toggleGroup = (key: TimeseriesGroup) => {
    setVisibleGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        if (next.size === 1) return current;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const loadReport = useCallback(async () => {
    if (dateFrom > dateTo) {
      setError("From date must be on or before To date.");
      return;
    }
    setReportLoading(true);
    setError(null);
    try {
      const result = await fetchSalesAudit(dateFrom, dateTo);
      setReport(result);
      setActiveCategory(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales audit");
    } finally {
      setReportLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (!loading && canViewManagement(user?.role)) {
      loadReport();
    }
  }, [loading, user, loadReport]);

  const snackGroups = useMemo(() => {
    const groups = new Map<number, SalesAuditSnackRow[]>();
    for (const row of report?.snacks_added ?? []) {
      const rows = groups.get(row.item_id) ?? [];
      rows.push(row);
      groups.set(row.item_id, rows);
    }
    return Array.from(groups.entries());
  }, [report]);

  const drinkGroups = useMemo(() => {
    const groups = new Map<number, SalesAuditSnackRow[]>();
    for (const row of report?.drinks_added ?? []) {
      const rows = groups.get(row.item_id) ?? [];
      rows.push(row);
      groups.set(row.item_id, rows);
    }
    return Array.from(groups.entries());
  }, [report]);

  if (loading) return <LoadingScreen />;
  if (!user || !canViewManagement(user.role)) return null;

  const selectedCategory = report?.categories.find((item) => item.key === activeCategory);
  const chartHeight = Math.max(300, (report?.categories.length ?? 0) * 42);

  const setPreset = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const downloadDailySalesCsv = () => {
    if (!report) return;
    const csv = dailySalesCsv(report.timeseries);
    downloadTextFile(
      `daily-sales-${report.date_from}-to-${report.date_to}.csv`,
      csv
    );
  };

  const downloadPlatesExcel = async () => {
    if (!report) return;
    try {
      const buffer = await buildPlatesWorkbook(report);
      downloadBlob(
        `plates-${report.date_from}-to-${report.date_to}.xlsx`,
        new Blob([buffer as ArrayBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build plates Excel");
    }
  };

  const downloadSnacksAddedCsv = () => {
    if (!report) return;
    downloadTextFile(
      `snacks-added-${report.date_from}-to-${report.date_to}.csv`,
      snacksDrinksAddedCsv(report.snacks_added)
    );
  };

  const downloadDrinksAddedCsv = () => {
    if (!report) return;
    downloadTextFile(
      `drinks-added-${report.date_from}-to-${report.date_to}.csv`,
      snacksDrinksAddedCsv(report.drinks_added)
    );
  };

  return (
    <>
        <p className="page-subtitle mgmt-panel-lead">
          Track plate sales, chapati use, snacks and drinks added, and daily revenue.
        </p>

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
              onClick={() => setPreset(todayIso(), todayIso())}
            >
              Today
            </button>
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
              30 days
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
          <p className="empty-state">Loading sales audit…</p>
        ) : report ? (
          <>
            <section className="analytics-section">
              <div className="analytics-section-head">
                <div>
                  <h2 className="analytics-section-title">Plates sold</h2>
                  <p className="analytics-meta">
                    {report.date_from === report.date_to
                      ? report.date_from
                      : `${report.date_from} → ${report.date_to}`}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={downloadPlatesExcel}
                >
                  Plates Excel
                </button>
              </div>
              <div className="sales-audit-grid">
                {report.categories.map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    className={
                      activeCategory === category.key
                        ? "sales-audit-tile active"
                        : "sales-audit-tile"
                    }
                    onClick={() =>
                      setActiveCategory((current) =>
                        current === category.key ? null : category.key
                      )
                    }
                  >
                    <span>{category.label}</span>
                    <strong>{formatNumber(category.plates)} plates</strong>
                    <small>KSh {formatKsh(category.revenue)}</small>
                  </button>
                ))}
              </div>
              <p className="analytics-meta sales-audit-note">
                A dish can appear in more than one category. For example, Ugali Kuku Managu
                contributes to Ugali, Kuku and Managu, so category totals should not be added
                together.
              </p>

              {selectedCategory && (
                <div className="sales-audit-drilldown">
                  <h3>{selectedCategory.label} dishes</h3>
                  {selectedCategory.dishes.length === 0 ? (
                    <p className="empty-state">No matching dishes were sold in this range.</p>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Dish</th>
                            <th>Plates</th>
                            <th>Revenue (KSh)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCategory.dishes.map((dish) => (
                            <tr key={dish.item_id}>
                              <td>{dish.item_name}</td>
                              <td>{formatNumber(dish.plates)}</td>
                              <td>{formatKsh(dish.revenue)}</td>
                            </tr>
                          ))}
                          <tr className="analytics-summary-total">
                            <td>Total</td>
                            <td>{formatNumber(selectedCategory.plates)}</td>
                            <td>{formatKsh(selectedCategory.revenue)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="analytics-section">
              <div className="analytics-section-head">
                <h2 className="analytics-section-title">Chapati use in dishes</h2>
              </div>
              <div className="chapati-audit-card">
                <div className="chapati-audit-stats">
                  <div>
                    <span>Chapo sold (comparison base)</span>
                    <strong>{formatNumber(report.chapati.cooked)}</strong>
                  </div>
                  <div>
                    <span>Chapo dishes sold</span>
                    <strong>{formatNumber(report.chapati.dish_plates)}</strong>
                  </div>
                  <div>
                    <span>Chapatis used (2 per dish)</span>
                    <strong>{formatNumber(report.chapati.chapatis_used)}</strong>
                  </div>
                  <div>
                    <span>Used in dishes</span>
                    <strong>{formatNumber(report.chapati.pct)}%</strong>
                  </div>
                </div>
                <div
                  className="chapati-progress"
                  role="progressbar"
                  aria-label="Chapatis used in dishes"
                  aria-valuenow={Math.round(report.chapati.pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${Math.min(report.chapati.pct, 100)}%` }} />
                </div>
                {report.chapati.cooked === 0 && (
                  <p className="analytics-meta">
                    No chapo snack sales were recorded, so the percentage is shown as zero.
                  </p>
                )}
              </div>
            </section>

            <section className="analytics-section">
              <div className="analytics-section-head">
                <div>
                  <h2 className="analytics-section-title">Total sales over time</h2>
                  <p className="analytics-meta">
                    Daily revenue for Snacks, Drinks, Food and Kuku. Hide a group to
                    compare lines; Total stays the full day amount. Bar sales are not
                    included.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={downloadDailySalesCsv}
                >
                  Download daily sales CSV
                </button>
              </div>
              <div
                className="bar-preview-tabs"
                aria-label="Show or hide sales groups"
              >
                {TIMESERIES_GROUPS.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    className={
                      visibleGroups.has(group.key)
                        ? "bar-preview-tab active"
                        : "bar-preview-tab"
                    }
                    aria-pressed={visibleGroups.has(group.key)}
                    onClick={() => toggleGroup(group.key)}
                    style={{
                      borderColor: visibleGroups.has(group.key)
                        ? COLORS[group.key]
                        : undefined,
                    }}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
              <div className="analytics-chart sales-audit-line-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={report.timeseries}
                    margin={{ top: 8, right: 20, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" />
                    <XAxis
                      dataKey="entry_date"
                      stroke="#8b9bb8"
                      tick={{ fill: "#8b9bb8", fontSize: 12 }}
                    />
                    <YAxis
                      stroke="#8b9bb8"
                      tick={{ fill: "#8b9bb8" }}
                      tickFormatter={(value) => formatKsh(Number(value))}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0f1b33",
                        border: "1px solid #1f2a44",
                        borderRadius: 8,
                      }}
                      formatter={(value: number, name: string) => [
                        `KSh ${formatKsh(value)}`,
                        name.charAt(0).toUpperCase() + name.slice(1),
                      ]}
                    />
                    <Legend />
                    {TIMESERIES_GROUPS.filter((group) =>
                      visibleGroups.has(group.key)
                    ).map((group) => (
                      <Line
                        key={group.key}
                        type="monotone"
                        dataKey={group.key}
                        name={group.label}
                        stroke={COLORS[group.key]}
                        strokeWidth={2}
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Total"
                      stroke={COLORS.total}
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="analytics-section">
              <div className="analytics-section-head">
                <h2 className="analytics-section-title">Plate categories compared</h2>
              </div>
              <div className="analytics-chart" style={{ height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={report.categories}
                    margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      stroke="#8b9bb8"
                      tick={{ fill: "#8b9bb8" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={80}
                      stroke="#8b9bb8"
                      tick={{ fill: "#8b9bb8" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0f1b33",
                        border: "1px solid #1f2a44",
                        borderRadius: 8,
                      }}
                      formatter={(value: number) => [
                        `${formatNumber(value)} plates`,
                        "Plates",
                      ]}
                    />
                    <Bar dataKey="plates" fill={COLORS.plates} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="analytics-section">
              <div className="analytics-section-head">
                <div>
                  <h2 className="analytics-section-title">Snacks added</h2>
                  <p className="analytics-meta">
                    Snack stock additions during the selected range, with range totals per
                    item.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={downloadSnacksAddedCsv}
                >
                  Download CSV
                </button>
              </div>
              {snackGroups.length === 0 ? (
                <p className="empty-state">No snacks were added in this range.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Date</th>
                        <th>Added</th>
                        <th>Sold</th>
                        <th>Revenue (KSh)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snackGroups.flatMap(([itemId, rows]) => {
                        const rangeTotal = report.snack_totals.find(
                          (row) => row.item_id === itemId
                        );
                        return [
                          ...rows.map((row) => (
                            <tr key={`${row.item_id}-${row.entry_date}`}>
                              <td>{row.item_name}</td>
                              <td>{row.entry_date}</td>
                              <td>{formatNumber(row.added)}</td>
                              <td>{formatNumber(row.sold)}</td>
                              <td>{formatKsh(row.revenue)}</td>
                            </tr>
                          )),
                          <tr
                            key={`${itemId}-total`}
                            className="analytics-summary-total"
                          >
                            <td>{rows[0].item_name} total</td>
                            <td>{report.date_from} → {report.date_to}</td>
                            <td>{formatNumber(rangeTotal?.added ?? 0)}</td>
                            <td>{formatNumber(rangeTotal?.sold ?? 0)}</td>
                            <td>{formatKsh(rangeTotal?.revenue ?? 0)}</td>
                          </tr>,
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="analytics-section">
              <div className="analytics-section-head">
                <div>
                  <h2 className="analytics-section-title">Drinks added</h2>
                  <p className="analytics-meta">
                    Drink stock additions during the selected range, with range totals per
                    item.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={downloadDrinksAddedCsv}
                >
                  Download CSV
                </button>
              </div>
              {drinkGroups.length === 0 ? (
                <p className="empty-state">No drinks were added in this range.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Date</th>
                        <th>Added</th>
                        <th>Sold</th>
                        <th>Revenue (KSh)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drinkGroups.flatMap(([itemId, rows]) => {
                        const rangeTotal = report.drink_totals.find(
                          (row) => row.item_id === itemId
                        );
                        return [
                          ...rows.map((row) => (
                            <tr key={`drink-${row.item_id}-${row.entry_date}`}>
                              <td>{row.item_name}</td>
                              <td>{row.entry_date}</td>
                              <td>{formatNumber(row.added)}</td>
                              <td>{formatNumber(row.sold)}</td>
                              <td>{formatKsh(row.revenue)}</td>
                            </tr>
                          )),
                          <tr
                            key={`drink-${itemId}-total`}
                            className="analytics-summary-total"
                          >
                            <td>{rows[0].item_name} total</td>
                            <td>
                              {report.date_from} → {report.date_to}
                            </td>
                            <td>{formatNumber(rangeTotal?.added ?? 0)}</td>
                            <td>{formatNumber(rangeTotal?.sold ?? 0)}</td>
                            <td>{formatKsh(rangeTotal?.revenue ?? 0)}</td>
                          </tr>,
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
    </>
  );
}
