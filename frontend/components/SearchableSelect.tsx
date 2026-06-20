"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
};

export default function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Search...",
  disabled = false,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLLabelElement | null>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", clickOutside);
    return () => window.removeEventListener("mousedown", clickOutside);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  return (
    <label className={`field searchable ${compact ? "searchable-compact" : ""}`} ref={rootRef}>
      {!compact && <span>{label}</span>}
      <input
        value={open ? query : selected?.label || ""}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          }
          if (e.key === "Enter" && filtered[activeIndex]) {
            e.preventDefault();
            onChange(filtered[activeIndex].value);
            setOpen(false);
            setQuery("");
          }
          if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
      />
      {open && (
        <div className="searchable-menu">
          {filtered.length === 0 ? (
            <div className="empty-state">No results found.</div>
          ) : (
            filtered.map((opt, idx) => (
              <button
                key={opt.value}
                type="button"
                className={`searchable-item ${idx === activeIndex ? "active" : ""}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </label>
  );
}
