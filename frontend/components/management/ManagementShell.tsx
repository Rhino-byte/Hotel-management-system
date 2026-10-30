"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { canViewManagement, useRequireAuth } from "../../lib/auth";
import LoadingScreen from "../LoadingScreen";

const TABS = [
  { href: "/admin/management/analytics", label: "Analytics" },
  { href: "/admin/management/audit", label: "Audit" },
  { href: "/admin/management/cost-profit", label: "Cost & profit" },
  { href: "/admin/management/tills", label: "Tills" },
];

export default function ManagementShell({ children }: { children: ReactNode }) {
  const { user, loading } = useRequireAuth(undefined, false, true);
  const pathname = usePathname();

  if (loading) return <LoadingScreen />;
  if (!user || !canViewManagement(user.role)) return null;

  return (
    <main className="page">
      <div className="card card-wide">
        <div className="page-header">
          <div>
            <h1 className="page-title">Management</h1>
            <p className="page-subtitle">
              Sales, audit, cost, and tills in one place.
            </p>
          </div>
        </div>
        <nav className="mgmt-tabs" aria-label="Management">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={active ? "mgmt-tab active" : "mgmt-tab"}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div className="mgmt-panel">{children}</div>
      </div>
    </main>
  );
}
