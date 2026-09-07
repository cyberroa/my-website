"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { apiFetchWithAuth } from "@/lib/api-workbench";
import { cn } from "@/lib/cn";
import { workbenchDropdownItem, workbenchDropdownPanel } from "@/lib/workbench-ui";

export type StudioSegmentRef = {
  id: string;
  name: string;
  slug?: string | null;
  labels?: string[];
};

export type StudioCustomerRef = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
};

type SegmentListResponse = {
  items: StudioSegmentRef[];
};

type CustomerListResponse = {
  items: StudioCustomerRef[];
};

type Props = {
  token: string | null;
  segment: StudioSegmentRef | null;
  customer: StudioCustomerRef | null;
  onSegmentChange: (segment: StudioSegmentRef | null) => void;
  onCustomerChange: (customer: StudioCustomerRef | null) => void;
  className?: string;
  customerSearchQuery?: string;
};

function customerLabel(c: StudioCustomerRef): string {
  return c.company || c.name || c.email;
}

function customerDetail(c: StudioCustomerRef): string {
  const parts = [c.company, c.name, c.email].filter(Boolean);
  // Drop duplicate leading company if already used as primary
  if (c.company && parts[0] === c.company) {
    return parts.slice(1).join(" · ") || c.email;
  }
  return parts.join(" · ");
}

function Chip({
  label,
  detail,
  onClear,
}: {
  label: string;
  detail?: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-accent-admin/35 bg-accent-admin/10 px-3 py-1.5 text-left text-sm text-white">
      <span className="min-w-0 truncate">
        <span className="text-accent-admin">{label}</span>
        {detail ? <span className="text-white/70"> · {detail}</span> : null}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 rounded-full px-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </span>
  );
}

function TypeaheadField<T extends { id: string }>({
  label,
  placeholder,
  token,
  disabled,
  fetchResults,
  renderItem,
  onSelect,
  initialQuery,
}: {
  label: string;
  placeholder: string;
  token: string | null;
  disabled?: boolean;
  fetchResults: (query: string) => Promise<T[]>;
  renderItem: (item: T) => ReactNode;
  onSelect: (item: T) => void;
  initialQuery?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [debounced, setDebounced] = useState(initialQuery ?? "");
  const [open, setOpen] = useState(Boolean(initialQuery));
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!token || !open) return;
    let cancelled = false;
    setLoading(true);
    fetchResults(debounced)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, open, debounced, fetchResults]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative text-left">
      <label className="block text-xs text-white/50">
        {label}
        <input
          value={query}
          disabled={!token || disabled}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-accent-admin/40 disabled:opacity-50"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </label>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className={workbenchDropdownPanel}
        >
          {!token ? (
            <li className="px-3 py-2 text-sm text-white/45">Sign in to search</li>
          ) : loading ? (
            <li className="px-3 py-2 text-sm text-white/45">Searching…</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-white/45">No matches</li>
          ) : (
            items.map((item) => (
              <li key={item.id} role="option">
                <button
                  type="button"
                  className={workbenchDropdownItem}
                  onClick={() => {
                    onSelect(item);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  {renderItem(item)}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export function StudioContextPickers({
  token,
  segment,
  customer,
  onSegmentChange,
  onCustomerChange,
  className,
  customerSearchQuery,
}: Props) {
  const fetchSegments = useCallback(
    async (q: string) => {
      if (!token) return [];
      const params = new URLSearchParams({ limit: "20", offset: "0" });
      if (q.trim()) params.set("search", q.trim());
      const res = await apiFetchWithAuth<SegmentListResponse>(
        `/api/v1/workbench/segments?${params}`,
        token,
      );
      return res.items ?? [];
    },
    [token],
  );

  const fetchCustomers = useCallback(
    async (q: string) => {
      if (!token) return [];
      const params = new URLSearchParams({ limit: "20", offset: "0" });
      if (q.trim()) params.set("search", q.trim());
      const res = await apiFetchWithAuth<CustomerListResponse>(
        `/api/v1/workbench/customers?${params}`,
        token,
      );
      return res.items ?? [];
    },
    [token],
  );

  return (
    <div className={cn("w-full max-w-xl space-y-3", className)}>
      {(segment || customer) && (
        <div className="flex flex-wrap gap-2">
          {segment ? (
            <Chip
              label="Segment"
              detail={segment.name}
              onClear={() => onSegmentChange(null)}
            />
          ) : null}
          {customer ? (
            <Chip
              label="Customer"
              detail={customerLabel(customer)}
              onClear={() => onCustomerChange(null)}
            />
          ) : null}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <TypeaheadField<StudioSegmentRef>
          label="Attach segment (playbook)"
          placeholder="Search segments…"
          token={token}
          fetchResults={fetchSegments}
          onSelect={onSegmentChange}
          renderItem={(s) => (
            <span className="block min-w-0">
              <span className="block truncate font-medium text-white">{s.name}</span>
              <span className="block truncate text-xs text-white/45">
                {s.slug || s.id}
                {s.labels && s.labels.length > 0 ? ` · ${s.labels.slice(0, 3).join(", ")}` : ""}
              </span>
            </span>
          )}
        />
        <TypeaheadField<StudioCustomerRef>
          label="Attach customer (dossier)"
          placeholder="Search customers…"
          token={token}
          initialQuery={customerSearchQuery}
          fetchResults={fetchCustomers}
          onSelect={onCustomerChange}
          renderItem={(c) => (
            <span className="block min-w-0">
              <span className="block truncate font-medium text-white">{customerLabel(c)}</span>
              <span className="block truncate text-xs text-white/45">{customerDetail(c)}</span>
            </span>
          )}
        />
      </div>
      <p className="text-center text-[11px] text-white/35">
        Attached context is injected into text generation and campaign drafts.
      </p>
    </div>
  );
}
