"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from "@/lib/api-workbench";
import {
  DRAG_CUSTOMER,
  DRAG_SEGMENT,
  type CustomerListResponse,
  type OutreachCustomer,
  type OutreachSegment,
  type SegmentListResponse,
} from "./types";

type Props = {
  token: string | null;
  search: string;
  segmentFilter: OutreachSegment | null;
  onAddCustomer: (c: OutreachCustomer) => void;
  onAddSegment: (s: OutreachSegment & { member_count: number }) => void;
  onFilterSegment: (s: OutreachSegment | null) => void;
  selectedCustomerIds: Set<string>;
};

export function OutreachSourcePanel({
  token,
  search,
  segmentFilter,
  onAddCustomer,
  onAddSegment,
  onFilterSegment,
  selectedCustomerIds,
}: Props) {
  const [segments, setSegments] = useState<OutreachSegment[]>([]);
  const [customers, setCustomers] = useState<OutreachCustomer[]>([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  useEffect(() => {
    setPage(0);
  }, [search, segmentFilter?.id]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setCustomers([]);
      setSegments([]);
      setCustomerTotal(0);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    const segParams = new URLSearchParams({ limit: "10", offset: "0" });
    if (search.trim()) segParams.set("search", search.trim());

    const custParams = new URLSearchParams({
      limit: String(pageSize),
      offset: String(page * pageSize),
    });
    if (search.trim()) custParams.set("search", search.trim());
    if (segmentFilter?.id) custParams.set("segment_id", segmentFilter.id);

    Promise.all([
      apiFetchWithAuth<SegmentListResponse>(
        `/api/v1/workbench/segments?${segParams}`,
        token,
      ),
      apiFetchWithAuth<CustomerListResponse>(
        `/api/v1/workbench/customers?${custParams}`,
        token,
      ),
    ])
      .then(([segRes, custRes]) => {
        if (cancelled) return;
        setSegments(segRes.items);
        setCustomers(custRes.items);
        setCustomerTotal(custRes.total);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Load failed");
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, search, segmentFilter?.id, page]);

  const pageStart = customerTotal === 0 ? 0 : page * pageSize + 1;
  const pageEnd = Math.min((page + 1) * pageSize, customerTotal);

  return (
    <div className="rounded-xl border border-white/10 bg-background-card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Sources</h2>

      {segmentFilter ? (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="rounded-full border border-accent-admin/40 bg-accent-admin/10 px-2 py-1 text-accent-admin">
            In segment: {segmentFilter.name}
          </span>
          <button
            type="button"
            className="text-text-muted underline hover:text-white"
            onClick={() => onFilterSegment(null)}
          >
            Clear
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}

      {segments.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-medium text-text-muted">Segments</h3>
          <ul className="mt-2 space-y-1">
            {segments.map((seg) => (
              <li
                key={seg.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_SEGMENT, JSON.stringify(seg));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="flex items-center justify-between gap-2 rounded-md border border-white/5 bg-black/30 px-2 py-2 text-sm hover:border-white/15"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{seg.name}</div>
                  <div className="truncate text-xs text-text-muted">{seg.slug}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
                    {seg.member_count ?? "—"}
                  </span>
                  <button
                    type="button"
                    title="Add segment to recipients"
                    className="rounded bg-accent-admin/20 px-2 py-0.5 text-xs text-accent-admin"
                    onClick={() =>
                      onAddSegment({
                        ...seg,
                        member_count: seg.member_count ?? 0,
                      })
                    }
                  >
                    +
                  </button>
                  <button
                    type="button"
                    title="Filter customers by this segment"
                    className="rounded px-2 py-0.5 text-xs text-text-muted underline"
                    onClick={() => onFilterSegment(seg)}
                  >
                    Filter
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4">
        <h3 className="text-xs font-medium text-text-muted">Customers</h3>
        {loading ? (
          <p className="mt-2 text-xs text-text-muted">Loading…</p>
        ) : !token ? (
          <p className="mt-2 text-xs text-text-muted">Sign in to load customers.</p>
        ) : customers.length === 0 ? (
          <p className="mt-2 text-xs text-text-muted">
            No customers yet. Add contacts on the{" "}
            <a href="/workbench/customers" className="text-accent-admin underline">
              Customers
            </a>{" "}
            page or import a CSV.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {customers.map((c) => {
              const added = selectedCustomerIds.has(c.id);
              return (
                <li
                  key={c.id}
                  draggable={!added}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_CUSTOMER, JSON.stringify(c));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className={`flex items-center justify-between gap-2 rounded-md border px-2 py-2 text-sm ${
                    added
                      ? "border-white/5 bg-black/20 opacity-60"
                      : "border-white/5 bg-black/30 hover:border-white/15"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name || c.email}</div>
                    <div className="truncate text-xs text-text-muted">
                      {[c.company, c.email, c.website].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={added}
                    className="shrink-0 rounded bg-accent-admin/20 px-2 py-0.5 text-xs text-accent-admin disabled:opacity-30"
                    onClick={() => onAddCustomer(c)}
                  >
                    {added ? "Added" : "+"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {customerTotal > pageSize ? (
          <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
            <span>
              {pageStart}–{pageEnd} of {customerTotal}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 0}
                className="rounded border border-white/10 px-2 py-1 disabled:opacity-30"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={pageEnd >= customerTotal}
                className="rounded border border-white/10 px-2 py-1 disabled:opacity-30"
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
