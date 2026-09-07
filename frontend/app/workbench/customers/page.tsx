"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { WorkbenchMultiSelect } from "@/components/workbench/WorkbenchMultiSelect";
import { WorkbenchSelect } from "@/components/workbench/WorkbenchSelect";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth, apiUploadWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  role: string | null;
  website: string | null;
  tags: string[];
  source: string | null;
  notes: string | null;
  consent_marketing: boolean;
  consent_source: string | null;
  created_at: string;
  fit_score?: number | null;
};

type CustomerListResponse = {
  items: Customer[];
  total: number;
};

type SegmentOpt = { id: string; name: string };

const OPPORTUNITY_OPTIONS = [
  { value: "", label: "All opportunities" },
  { value: "audit", label: "Audit candidates" },
  { value: "used_system", label: "System buyers (used)" },
  { value: "new_system", label: "System buyers (new)" },
  { value: "parts", label: "Parts warmth / at-risk" },
  { value: "sell_to_titan", label: "Sell to Titan" },
];

type ImportResult = {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
};

const emptyForm = {
  email: "",
  name: "",
  company: "",
  phone: "",
  role: "",
  website: "",
  tags: "",
  source: "",
  notes: "",
  consent_marketing: false,
};

export default function AdminCustomersPage() {
  return (
    <Suspense fallback={<p className="mt-10 text-text-muted">Loading customers…</p>}>
      <CustomersPageInner />
    </Suspense>
  );
}

function CustomersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const opportunity = searchParams.get("opportunity") ?? "";
  const segmentIds = searchParams.getAll("segment_ids");
  const queryKey = searchParams.toString();
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(urlSearch);
  const [segments, setSegments] = useState<SegmentOpt[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const applyFilters = useCallback(
    (next: { search?: string; opportunity?: string; segmentIds?: string[] }) => {
      const q = (next.search ?? search).trim();
      const opp = next.opportunity ?? opportunity;
      const segs = next.segmentIds ?? segmentIds;
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      if (opp) params.set("opportunity", opp);
      segs.forEach((id) => params.append("segment_ids", id));
      const qs = params.toString();
      router.replace(qs ? `/workbench/customers?${qs}` : "/workbench/customers", { scroll: false });
    },
    [router, search, opportunity, queryKey],
  );

  const load = useCallback(
    async (t: string) => {
      setLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams(queryKey);
        const params = new URLSearchParams({ limit: "100" });
        const q = (sp.get("search") ?? "").trim();
        const opp = sp.get("opportunity") ?? "";
        if (q) params.set("search", q);
        if (opp) params.set("opportunity", opp);
        sp.getAll("segment_ids").forEach((id) => params.append("segment_ids", id));
        const r = await apiFetchWithAuth<CustomerListResponse>(
          `/api/v1/workbench/customers?${params}`,
          t,
        );
        setRows(r.items);
        setTotal(r.total);
      } catch (e) {
        setError(
          e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Failed to load",
        );
      } finally {
        setLoading(false);
      }
    },
    [queryKey],
  );

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) {
        void load(session.access_token);
        void apiFetchWithAuth<{ items: SegmentOpt[] }>(
          "/api/v1/workbench/segments?limit=100",
          session.access_token,
        )
          .then((r) => setSegments(r.items ?? []))
          .catch(() => undefined);
      } else setLoading(false);
    });
  }, [load]);

  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    const payload = {
      email: form.email.trim(),
      name: form.name.trim() || null,
      company: form.company.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role.trim() || null,
      website: form.website.trim() || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      source: form.source.trim() || null,
      notes: form.notes.trim() || null,
      consent_marketing: form.consent_marketing,
      consent_source: form.consent_marketing ? "admin" : null,
    };
    try {
      await apiFetchWithAuth<Customer>("/api/v1/workbench/customers", token, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setForm(emptyForm);
      await load(token);
    } catch (err) {
      setError(
        err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Save failed",
      );
    }
  }

  async function removeCustomer(id: string) {
    if (!token || !confirm("Delete this customer? Their campaign history is kept.")) return;
    try {
      await apiFetchWithAuth(`/api/v1/workbench/customers/${id}`, token, { method: "DELETE" });
      await load(token);
    } catch (err) {
      setError(
        err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Delete failed",
      );
    }
  }

  async function runImport(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !file) return;
    setError(null);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUploadWithAuth<ImportResult>(
        "/api/v1/workbench/customers/import",
        token,
        fd,
        { dry_run: dryRun },
      );
      setImportResult(res);
      if (!dryRun) await load(token);
    } catch (err) {
      setError(
        err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Import failed",
      );
    }
  }

  return (
    <>
      <WorkbenchPageHeader
        eyebrow="CRM"
        title="Customers"
        description="Ingest contacts from Titan Imaging's spreadsheets, manage tags and consent, and view a per-customer timeline of email and site activity."
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-background-card p-6">
          <h2 className="text-lg font-semibold">Add customer</h2>
          <form onSubmit={(e) => void saveCustomer(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="text-text-muted">Email *</span>
              <input
                type="email"
                required
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-text-muted">Name</span>
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-text-muted">Company</span>
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-text-muted">Phone</span>
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-text-muted">Role</span>
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-text-muted">Website</span>
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://example.com"
              />
            </label>
            <label className="block text-sm">
              <span className="text-text-muted">Source</span>
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                placeholder="manual, referral, import"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-text-muted">Tags (comma separated)</span>
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="hospital, repeat, warm"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-text-muted">Notes</span>
              <textarea
                className="mt-1 min-h-[70px] w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.consent_marketing}
                onChange={(e) =>
                  setForm((f) => ({ ...f, consent_marketing: e.target.checked }))
                }
              />
              <span className="text-text-muted">Marketing consent on file</span>
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-accent-admin px-6 py-2 text-sm font-semibold text-black"
              >
                Add customer
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-white/10 bg-background-card p-6">
          <h2 className="text-lg font-semibold">Bulk import (.csv / .xlsx)</h2>
          <p className="mt-2 text-sm text-text-muted">
            Columns: email, name, company, phone, role, website, tags, source, notes, consent_marketing.
            Upsert by email.
          </p>
          <form onSubmit={(e) => void runImport(e)} className="mt-4 space-y-3 text-sm">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-text-secondary"
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
              <span className="text-text-muted">Dry run (preview counts only)</span>
            </label>
            <button
              type="submit"
              disabled={!file}
              className="rounded-lg bg-accent-admin px-6 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              Upload
            </button>
          </form>
          {importResult ? (
            <div className="mt-4 rounded-md border border-white/10 bg-black/30 p-3 text-sm">
              <p className="text-text-secondary">
                Created: {importResult.created} &middot; Updated: {importResult.updated} &middot;
                Errors: {importResult.errors.length}
              </p>
              {importResult.errors.length ? (
                <ul className="mt-2 list-disc pl-5 text-red-200">
                  {importResult.errors.slice(0, 20).map((err, i) => (
                    <li key={i}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="mt-10 flex flex-wrap items-end gap-3">
        <label className="block min-w-[12rem] flex-1 text-sm">
          <span className="text-text-muted">Search</span>
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-accent-admin/40"
            placeholder="Email / name / company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters({ search });
            }}
          />
        </label>
        <label className="block w-full min-w-[12rem] text-sm sm:w-56">
          <span className="text-text-muted">Opportunity</span>
          <WorkbenchSelect
            className="mt-1"
            value={opportunity}
            onChange={(v) => applyFilters({ opportunity: v })}
            options={OPPORTUNITY_OPTIONS}
            placeholder="All opportunities"
          />
        </label>
        <label className="block w-full min-w-[12rem] text-sm sm:w-56">
          <span className="text-text-muted">Segments</span>
          <WorkbenchMultiSelect
            className="mt-1"
            values={segmentIds}
            onChange={(ids) => applyFilters({ segmentIds: ids })}
            options={segments.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Any segment"
          />
        </label>
        <button
          type="button"
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-text-secondary hover:border-accent-admin hover:text-accent-admin"
          onClick={() => applyFilters({ search })}
        >
          Search
        </button>
        {urlSearch || opportunity || segmentIds.length ? (
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm text-text-muted hover:text-white"
            onClick={() => {
              setSearch("");
              router.replace("/workbench/customers", { scroll: false });
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {loading ? "Loading…" : `${total} matching customer${total === 1 ? "" : "s"}`}
        {opportunity ? " · ordered by fit score" : ""}
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-background-raised text-text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Tags</th>
              {opportunity ? <th className="px-4 py-3 font-semibold">Score</th> : null}
              <th className="px-4 py-3 font-semibold">Consent</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={opportunity ? 7 : 6}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={opportunity ? 7 : 6}>
                  No customers match these filters.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/workbench/customers/${c.id}`}
                      className="text-accent-admin hover:underline"
                    >
                      {c.email}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{c.name ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {[c.company, c.website].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {c.tags.length ? c.tags.join(", ") : "—"}
                  </td>
                  {opportunity ? (
                    <td className="px-4 py-3 font-medium text-accent-admin">
                      {c.fit_score != null ? c.fit_score.toFixed(1) : "—"}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-text-muted">
                    {c.consent_marketing ? "yes" : "no"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-red-300 hover:underline"
                      onClick={() => void removeCustomer(c.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
