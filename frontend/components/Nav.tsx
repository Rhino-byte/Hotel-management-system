"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "../lib/auth";

const MODULE_LINKS = [
  { href: "/snacks-drinks", label: "Snacks & Drinks", module: "snacks_drinks" },
  { href: "/food-kuku", label: "Food & Kuku", module: "food_kuku" },
  { href: "/stock-items", label: "Stock Items", module: "stock_items" },
  { href: "/bar", label: "Bar Stock", module: "bar" },
];

const ADMIN_LINKS = [
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/prices", label: "Prices" },
  { href: "/admin/stock-items", label: "Stock Catalog" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/audit", label: "Audit" },
];

const CLERK_AUDIT_LINK = { href: "/admin/audit", label: "Audit" };

export default function Nav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerId = useId();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  // React 18 typings omit `inert`; set it on the DOM node instead.
  useEffect(() => {
    const el = drawerRef.current;
    if (!el) return;
    if (!menuOpen) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }, [menuOpen]);

  if (!user || pathname === "/login") return null;

  const isAdmin = user.role === "admin";
  const showClerkAudit = !isAdmin && user.modules.length > 0;
  const closeMenu = () => setMenuOpen(false);

  const moduleLinks = MODULE_LINKS.filter((l) => user.modules.includes(l.module));

  const renderLinks = (onNavigate?: () => void) => (
    <>
      {moduleLinks.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={pathname === l.href ? "nav-link active" : "nav-link"}
          onClick={onNavigate}
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
          onClick={onNavigate}
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
            onClick={onNavigate}
          >
            {l.label}
          </Link>
        ))}
    </>
  );

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href={user.default_route || "/"} className="nav-brand">
          Hotel Ops
        </Link>
        <nav className="nav-links" aria-label="Main">
          {renderLinks()}
        </nav>
        <div className="nav-user">
          <span className="nav-email">{user.display_name}</span>
          <span className="nav-role">{user.role}</span>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Logout
          </button>
        </div>
        <button
          type="button"
          className={`nav-toggle${menuOpen ? " open" : ""}`}
          aria-expanded={menuOpen}
          aria-controls={drawerId}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>
      </div>

      <div
        className={`nav-overlay${menuOpen ? " open" : ""}`}
        aria-hidden={!menuOpen}
        onClick={closeMenu}
      />
      <div
        ref={drawerRef}
        id={drawerId}
        className={`nav-drawer${menuOpen ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!menuOpen}
      >
        <nav className="nav-drawer-links" aria-label="Main">
          {renderLinks(closeMenu)}
        </nav>
        <div className="nav-drawer-user">
          <span className="nav-email">{user.display_name}</span>
          <span className="nav-role">{user.role}</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              closeMenu();
              logout();
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
