"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchCostReport,
  fetchSalesAudit,
  fetchSalesTotals,
  fetchTillsReport,
} from "../../../lib/api";

type Snapshot = {
  value: string;
  detail: string | null;
};

const EMPTY = "—";

function yesterdayIso(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

export default function ManagementLandingPage() {
  const day = yesterdayIso();
  const [sales, setSales] = useState<Snapshot | null>(null);
  const [audit, setAudit] = useState<Snapshot | null>(null);
  const [cost, setCost] = useState<Snapshot | null>(null);
  const [tills, setTills] = useState<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchSalesTotals("yesterday")
      .then((data) => {
        if (cancelled) return;
        const revenue = data.groups.reduce((sum, group) => sum + Number(group.revenue), 0);
        setSales({ value: `KSh ${formatKsh(revenue)}`, detail: "Yesterday's sales" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSales({
          value: EMPTY,
          detail: err instanceof Error ? err.message : "Sales unavailable",
        });
      });

    fetchSalesAudit(day, day)
      .then((data) => {
        if (cancelled) return;
        const plates = data.food_plates.reduce((sum, row) => sum + Number(row.plates), 0);
        const revenue = data.timeseries.reduce((sum, row) => sum + Number(row.total), 0);
        setAudit({
          value: `${plates.toLocaleString()} plates`,
          detail: `Revenue KSh ${formatKsh(revenue)}`,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAudit({
          value: EMPTY,
          detail: err instanceof Error ? err.message : "Audit unavailable",
        });
      });

    fetchCostReport(day, day)
      .then((data) => {
        if (cancelled) return;
        const profit = data.groups.reduce((sum, group) => sum + Number(group.profit), 0);
        const waiting =
          data.store_status === "ok" ? null : data.note || "Store cost is waiting";
        setCost({ value: `KSh ${formatKsh(profit)}`, detail: waiting || "Yesterday's profit" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCost({
          value: EMPTY,
          detail: err instanceof Error ? err.message : "Cost report unavailable",
        });
      });

    fetchTillsReport(day, day)
      .then((data) => {
        if (cancelled) return;
        setTills({
          value: `KSh ${formatKsh(data.period_total)}`,
          detail: `${formatPct(data.tills_pct)} of sales`,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setTills({
          value: EMPTY,
          detail: err instanceof Error ? err.message : "Tills unavailable",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [day]);

  const cards = [
    {
      href: "/admin/management/analytics",
      title: "Analytics",
      copy: "Sales totals by group, popular items, and a daily summary.",
      snapshot: sales,
    },
    {
      href: "/admin/management/audit",
      title: "Audit",
      copy: "Plate sales, chapati use, snacks and drinks added, and daily revenue.",
      snapshot: audit,
    },
    {
      href: "/admin/management/cost-profit",
      title: "Cost & profit",
      copy: "Sales, store use, and the Stock Items rates for any date range.",
      snapshot: cost,
    },
    {
      href: "/admin/management/tills",
      title: "Tills",
      copy: "Daily till credits compared with hotel sales.",
      snapshot: tills,
    },
  ];

  return (
    <div className="mgmt-grid">
      {cards.map((card) => (
        <Link key={card.href} href={card.href} className="mgmt-card">
          <p className="mgmt-card-kicker">Yesterday</p>
          <h2>{card.title}</h2>
          <p>{card.copy}</p>
          <strong className="mgmt-card-value">
            {card.snapshot ? card.snapshot.value : "Loading…"}
          </strong>
          {card.snapshot?.detail ? (
            <span className="mgmt-card-detail">{card.snapshot.detail}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
