"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";

type Source = {
  id: string;
  name: string;
  slug: string;
  base_url: string | null;
  scrape_urls: string[];
  active: boolean;
  notes: string | null;
  last_scraped_at: string | null;
  last_error: string | null;
  listing_count?: number;
};

type Listing = {
  id: string;
  source_id: string;
  source_name: string | null;
  external_sku: string | null;
  part_number: string | null;
  title: string;
  price_cents: number | null;
  currency: string;
  availability: string | null;
  listing_url: string | null;
  scraped_at: string | null;
};

type CompareRow = {
  part_number: string;
  titan_name: string;
  titan_price_cents: number | null;
  titan_status: string;
  competitor: string;
  competitor_title: string;
  competitor_price_cents: number | null;
  currency: string;
  availability: string | null;
  listing_url: string | null;
  delta_cents: number | null;
  scraped_at: string | null;
};

function money(cents: number | null | undefined, currency = "USD") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default function AdminCompetitorsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [compare, setCompare] = useState<CompareRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"sources" | "listings" | "compare">("sources");

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [scrapeUrls, setScrapeUrls] = useState("");

  const load = useCallback(async (t: string) => {
    const [status, srcs, list, cmp] = await Promise.all([
      apiFetchWithAuth<{ firecrawl_configured: boolean }>("/api/v1/workbench/competitors/status", t),
      apiFetchWithAuth<Source[]>("/api/v1/workbench/competitors/sources", t),
      apiFetchWithAuth<Listing[]>("/api/v1/workbench/competitors/listings?limit=80", t),
      apiFetchWithAuth<CompareRow[]>("/api/v1/workbench/competitors/compare?limit=80", t),
    ]);
    setConfigured(status.firecrawl_configured);
    setSources(srcs);
    setListings(list);
    setCompare(cmp);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) {
        void load(session.access_token).catch((e) =>
          setError(e instanceof ApiError ? String(e.message) : "Failed to load"),
        );
      }
    });
  }, [load]);

  async function createSource(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setError(null);
    try {
      await apiFetchWithAuth("/api/v1/workbench/competitors/sources", token, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          base_url: baseUrl.trim() || null,
          scrape_urls: scrapeUrls
            .split("\n")
            .map((u) => u.trim())
            .filter(Boolean),
          active: false,
        }),
      });
      setName("");
      setBaseUrl("");
      setScrapeUrls("");
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body) : "Create failed");
    }
  }

  async function toggleActive(src: Source) {
    if (!token) return;
    setBusy(src.id);
    setError(null);
    try {
      await apiFetchWithAuth(`/api/v1/workbench/competitors/sources/${src.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ active: !src.active }),
      });
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body) : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function scrapeOne(id: string) {
    if (!token) return;
    setBusy(`scrape-${id}`);
    setError(null);
    try {
      await apiFetchWithAuth(`/api/v1/workbench/competitors/sources/${id}/scrape`, token, {
        method: "POST",
      });
      await load(token);
      setTab("listings");
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body) : "Scrape failed");
    } finally {
      setBusy(null);
    }
  }

  async function scrapeActive() {
    if (!token) return;
    setBusy("scrape-all");
    setError(null);
    try {
      await apiFetchWithAuth("/api/v1/workbench/competitors/scrape", token, { method: "POST" });
      await load(token);
      setTab("compare");
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body) : "Scrape failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <WorkbenchPageHeader
        eyebrow="Inventory"
        title="Competitors"
        description="Firecrawl scrape of competitor catalogs — compare prices against Titan parts and feed Market Map."
      />

      {configured === false ? (
        <p className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Set <code className="text-xs">FIRECRAWL_API_KEY</code> on the API to enable scraping. You can still manage
          source URLs offline.
        </p>
      ) : null}

      {error ? (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {(["sources", "listings", "compare"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t
                ? "bg-accent-admin text-black"
                : "border border-white/15 text-text-muted hover:border-white/30 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          disabled={!token || busy === "scrape-all"}
          onClick={() => void scrapeActive()}
          className="ml-auto rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:border-white/40 disabled:opacity-50"
        >
          {busy === "scrape-all" ? "Scraping…" : "Scrape all active"}
        </button>
      </div>

      {tab === "sources" ? (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-background-raised text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">URLs</th>
                  <th className="px-4 py-3 font-semibold">Listings</th>
                  <th className="px-4 py-3 font-semibold">Last scrape</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-text-muted" colSpan={5}>
                      No sources yet — seed defaults load on first visit, or add one.
                    </td>
                  </tr>
                ) : (
                  sources.map((s) => (
                    <tr key={s.id} className="border-b border-white/5 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{s.name}</div>
                        <div className="text-xs text-text-muted">{s.slug}</div>
                        {s.last_error ? (
                          <div className="mt-1 text-xs text-red-300">{s.last_error}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {(s.scrape_urls || []).map((u) => (
                          <div key={u} className="max-w-[220px] truncate">
                            {u}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3">{s.listing_count ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {s.last_scraped_at ? new Date(s.last_scraped_at).toLocaleString() : "—"}
                        <div className="mt-1">{s.active ? "Active" : "Inactive"}</div>
                      </td>
                      <td className="px-4 py-3 space-y-2">
                        <button
                          type="button"
                          disabled={busy === s.id}
                          onClick={() => void toggleActive(s)}
                          className="block text-xs text-accent-admin hover:underline disabled:opacity-50"
                        >
                          {s.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          disabled={busy === `scrape-${s.id}`}
                          onClick={() => void scrapeOne(s.id)}
                          className="block text-xs text-white/80 hover:underline disabled:opacity-50"
                        >
                          {busy === `scrape-${s.id}` ? "Scraping…" : "Scrape now"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <form onSubmit={createSource} className="space-y-3 rounded-xl border border-white/10 p-4">
            <h2 className="text-sm font-semibold text-white">Add source</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Competitor name"
              className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white"
              required
            />
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="Base URL (optional)"
              className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white"
            />
            <textarea
              value={scrapeUrls}
              onChange={(e) => setScrapeUrls(e.target.value)}
              placeholder="Scrape URLs (one per line)"
              rows={4}
              className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-accent-admin px-3 py-2 text-sm font-medium text-black"
            >
              Create
            </button>
          </form>
        </div>
      ) : null}

      {tab === "listings" ? (
        <div className="mt-8 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-background-raised text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Part / SKU</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Availability</th>
              </tr>
            </thead>
            <tbody>
              {listings.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-text-muted" colSpan={5}>
                    No listings yet. Activate a source and scrape.
                  </td>
                </tr>
              ) : (
                listings.map((row) => (
                  <tr key={row.id} className="border-b border-white/5">
                    <td className="px-4 py-3">{row.source_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {row.part_number || row.external_sku || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.listing_url ? (
                        <a
                          href={row.listing_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent-admin hover:underline"
                        >
                          {row.title}
                        </a>
                      ) : (
                        row.title
                      )}
                    </td>
                    <td className="px-4 py-3">{money(row.price_cents, row.currency)}</td>
                    <td className="px-4 py-3 text-text-muted">{row.availability || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "compare" ? (
        <div className="mt-8 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-background-raised text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Part</th>
                <th className="px-4 py-3 font-semibold">Titan</th>
                <th className="px-4 py-3 font-semibold">Competitor</th>
                <th className="px-4 py-3 font-semibold">Delta</th>
              </tr>
            </thead>
            <tbody>
              {compare.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-text-muted" colSpan={4}>
                    No SKU matches yet. Scraped part numbers must match Titan inventory.
                  </td>
                </tr>
              ) : (
                compare.map((row, i) => (
                  <tr key={`${row.part_number}-${row.competitor}-${i}`} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs">{row.part_number}</div>
                      <div className="text-text-muted">{row.titan_name}</div>
                    </td>
                    <td className="px-4 py-3">{money(row.titan_price_cents)}</td>
                    <td className="px-4 py-3">
                      <div>{row.competitor}</div>
                      <div className="text-text-muted">{money(row.competitor_price_cents, row.currency)}</div>
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        row.delta_cents == null
                          ? "text-text-muted"
                          : row.delta_cents > 0
                            ? "text-emerald-300"
                            : row.delta_cents < 0
                              ? "text-red-300"
                              : ""
                      }`}
                    >
                      {row.delta_cents == null
                        ? "—"
                        : `${row.delta_cents > 0 ? "+" : ""}${money(row.delta_cents)}`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
