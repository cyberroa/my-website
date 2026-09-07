"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Container, PageHero } from "@/components/ui";
import { apiFetch, getApiBaseUrl, withRetry, type ApiCategory, type ApiPart } from "@/lib/api";
import { IMAGES } from "@/lib/images";
import { track } from "@/lib/track";

function PartAlertForm({ partNumber }: { partNumber: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");
    try {
      await apiFetch<{ ok: boolean }>("/api/v1/inventory-alerts/subscribe", {
        method: "POST",
        body: JSON.stringify({ email, part_number: partNumber }),
      });
      void track(
        "part_alert_subscribe",
        { part_number: partNumber },
        { email },
      );
      setStatus("ok");
      setEmail("");
    } catch {
      setStatus("err");
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-2 border-t border-white/10 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        Email when back in stock
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-md bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15"
        >
          Notify me
        </button>
      </div>
      {status === "ok" ? (
        <p className="text-xs text-emerald-300">You&apos;re on the list. We&apos;ll email you when it&apos;s available.</p>
      ) : null}
      {status === "err" ? (
        <p className="text-xs text-red-300">Could not subscribe. Try again or call us.</p>
      ) : null}
    </form>
  );
}

type Filter = "all" | "in-stock" | "CT" | "PET" | "General";

type UiPartRow = {
  id: string;
  partNumber: string;
  name: string;
  category: "CT" | "PET" | "General";
  stock: number;
};

function normalizeUiCategory(labelOrSlug: string): UiPartRow["category"] {
  const l = labelOrSlug.trim().toLowerCase();
  if (l === "ct") return "CT";
  if (l === "pet") return "PET";
  return "General";
}

function filterParts(parts: UiPartRow[], search: string, filter: Filter): UiPartRow[] {
  const q = search.trim().toLowerCase();
  return parts.filter((p) => {
    const matchSearch =
      !q ||
      p.partNumber.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q);
    const matchFilter =
      filter === "all" ? true : filter === "in-stock" ? p.stock > 0 : p.category === filter;
    return matchSearch && matchFilter;
  });
}

export function InventoryBrowser({
  initialSearch = "",
  unsubscribedBanner = false,
}: {
  initialSearch?: string;
  unsubscribedBanner?: boolean;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState<Filter>("all");
  const [parts, setParts] = useState<UiPartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      void track("inventory_search", { query: q, filter });
    }, 600);
    return () => clearTimeout(t);
  }, [search, filter]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const mapped = await withRetry(
          async () => {
            const [categories, apiParts] = await Promise.all([
              apiFetch<ApiCategory[]>("/api/v1/categories"),
              apiFetch<ApiPart[]>("/api/v1/parts?limit=200"),
            ]);

            const bySlug = new Map(categories.map((c) => [c.slug, c.name] as const));
            return apiParts.map((p) => {
              const catSlug = p.category ?? "general";
              const label = bySlug.get(catSlug) ?? catSlug;

              return {
                id: p.id,
                partNumber: p.part_number,
                name: p.name,
                category: normalizeUiCategory(label),
                stock: p.stock_quantity,
              };
            });
          },
          { attempts: 3, baseDelayMs: 400 },
        );

        if (!cancelled) setParts(mapped);
      } catch {
        if (!cancelled) {
          const base = getApiBaseUrl();
          setError(
            process.env.NODE_ENV === "development"
              ? `Unable to load inventory (requested ${base}). Start the FastAPI backend and ensure NEXT_PUBLIC_API_URL in frontend/.env.local matches the uvicorn port, then restart npm run dev.`
              : "Unable to load inventory right now. Please try again soon.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => filterParts(parts, search, filter), [parts, search, filter]);

  const pills: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "in-stock", label: "In Stock" },
    { key: "CT", label: "CT" },
    { key: "PET", label: "PET" },
    { key: "General", label: "General" },
  ];

  return (
    <>
      <PageHero
        size="compact"
        image={IMAGES.prototypeParts}
        eyebrow="Live Inventory"
        title="We Have What You Need"
        subtitle={
          <>
            Search by part number or name. Call{" "}
            <a
              href="tel:9047426265"
              className="font-semibold text-white underline-offset-2 hover:text-accent-ice hover:underline"
            >
              (904) 742-6265
            </a>{" "}
            to speak with someone directly.
          </>
        }
        contentClassName="flex w-full max-w-3xl flex-col items-center"
      >
        <div className="relative z-20 mt-8 w-full max-w-xl">
          <div className="flex overflow-hidden rounded-lg border border-white/10 bg-background-raised/95 shadow-lg shadow-black/40">
            <input
              className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-base text-white outline-none placeholder:text-text-muted"
              placeholder="Search part number or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              className="bg-accent-ice px-6 py-3.5 text-sm font-semibold text-black transition hover:brightness-110"
            >
              Search
            </button>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {pills.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                  filter === key
                    ? "border-accent-ice bg-accent-ice text-black"
                    : "border-white/15 text-text-muted hover:border-white/25 hover:text-text-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </PageHero>

      <Container maxWidth="wide" className="mt-12 pb-24">
        {unsubscribedBanner ? (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-100">
            You have been unsubscribed from inventory alerts for that part.
          </div>
        ) : null}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-muted">Available Parts</h2>
          <span className="text-sm text-text-muted">
            {loading
              ? "Loading…"
              : `${filtered.length} part${filtered.length !== 1 ? "s" : ""} found`}
          </span>
        </div>

        {error ? (
          <div className="rounded-xl border border-white/10 bg-background-card px-6 py-10 text-center">
            <p className="text-text-muted">{error}</p>
            <p className="mt-3 text-sm text-text-muted">
              Or call{" "}
              <a href="tel:9047426265" className="font-semibold text-accent-ice underline">
                (904) 742-6265
              </a>{" "}
              for immediate help.
            </p>
          </div>
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="h-[128px] animate-pulse rounded-xl border border-white/10 bg-background-card"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-background-card py-16 text-center">
            <p className="text-text-muted">
              No parts match your search.{" "}
              <Link href="/contact" className="font-semibold text-accent-ice underline">
                Contact us
              </Link>
              —we may be able to source what you need.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const inStock = p.stock > 0;
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-white/10 bg-background-card p-6 transition hover:border-white/20"
                  onClick={() =>
                    void track("part_view", {
                      part_number: p.partNumber,
                      category: p.category,
                      in_stock: inStock,
                    })
                  }
                >
                  <p className="font-display text-xs tracking-wider text-accent-ice">
                    {p.partNumber}
                  </p>
                  <p className="mt-2 text-base font-semibold leading-snug">{p.name}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                      {p.category}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        inStock
                          ? "bg-accent-ice/15 text-accent-ice"
                          : "bg-white/5 text-text-muted"
                      }`}
                    >
                      {inStock ? `${p.stock} in stock` : "Out of stock"}
                    </span>
                  </div>
                  {!inStock ? <PartAlertForm partNumber={p.partNumber} /> : null}
                </div>
              );
            })}
          </div>
        )}
      </Container>
    </>
  );
}
