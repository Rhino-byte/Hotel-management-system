"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth";

const MODULE_LINKS = [
  { href: "/snacks-drinks", label: "Snacks & Drinks", module: "snacks_drinks" },
  { href: "/food-kuku", label: "Food & Kuku", module: "food_kuku" },
  { href: "/stock-items", label: "Stock Items", module: "stock_items" },
];

const ADMIN_LINKS = [
  { href: "/admin/prices", label: "Prices" },
  { href: "/admin/stock-items", label: "Stock Catalog" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/audit", label: "Audit" },
];

const CLERK_AUDIT_LINK = { href: "/admin/audit", label: "Audit" };

export default function Nav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user || pathname === "/login") return null;

  const isAdmin = user.role === "admin";
  const showClerkAudit = !isAdmin && user.modules.length > 0;

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href={user.default_route || "/"} className="nav-brand">
          Hotel Ops
        </Link>
        <nav className="nav-links">
          {MODULE_LINKS.filter((l) => user.modules.includes(l.module)).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href ? "nav-link active" : "nav-link"}
            >
              {l.label}
            </Link>
          ))}
          {showClerkAudit && (
            <Link
              href={CLERK_AUDIT_LINK.href}
              className={
                pathname.startsWith(CLERK_AUDIT_LINK.href) ? "nav-link active" : "nav-link"
              }
            >
              {CLERK_AUDIT_LINK.label}
            </Link>
          )}
          {isAdmin &&
            ADMIN_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={pathname.startsWith(l.href) ? "nav-link active" : "nav-link"}
              >
                {l.label}
              </Link>
            ))}
        </nav>
        <div className="nav-user">
          <span className="nav-email">{user.display_name}</span>
          <span className="nav-role">{user.role}</span>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
