"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from "@/lib/api-workbench";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

type LiveSession = {
  id: string;
  first_seen_at: string;
  last_seen_at: string;
  score: number;
  current_url: string | null;
  latest_search: string | null;
  parts_viewed: string[];
  customer: {
    id: string;
    email: string;
    name: string | null;
    company: string | null;
  } | null;
};

type HotLead = {
  customer_id: string;
  email: string;
  name: string | null;
  company: string | null;
  score: number;
  last_seen_at: string | null;
};

type Progression = {
  type: string;
  title: string;
  detail: string;
  customer_id?: string;
  customer_email?: string;
  engagement_id?: string;
  current_stage?: string;
  suggested_stage?: string;
  actions: { id: string; label: string; href?: string }[];
};

type AnalyticsOverview = {
  pipeline: Record<string, number>;
  conversion_rate: number;
  open_leads: number;
  won: number;
  recent_engagements: {
    id: string;
    customer_email: string;
    customer_company: string | null;
    channel: string;
    outcome: string;
    summary: string;
    customer_lead_stage: string;
    occurred_at: string | null;
  }[];
  progressions: Progression[];
  generated_at: string;
};

const STAGES = ["new", "contacted", "engaged", "qualified", "proposal", "won", "lost"] as const;

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatRelative(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.max(0, Math.round(diffMs / 60_000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? "1 hr ago" : `${hours} hr ago`;
}

export default function AdminAnalyticsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [stageCustomers, setStageCustomers] = useState<
    { id: string; email: string; name: string | null; company: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (t: string, showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const [live, leads, ov] = await Promise.all([
        apiFetchWithAuth<LiveSession[]>("/api/v1/workbench/sessions/live?minutes=15", t),
        apiFetchWithAuth<HotLead[]>("/api/v1/workbench/sessions/hot-leads?hours=24", t),
        apiFetchWithAuth<AnalyticsOverview>("/api/v1/workbench/analytics/overview", t),
      ]);
      setSessions(live);
      setHotLeads(leads);
      setOverview(ov);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Failed to load");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) void load(session.access_token, true);
      else setLoading(false);
    });
  }, [load]);

  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => {
      void load(token);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [token, load]);

  async function openStage(stage: string) {
    if (!token) return;
    setStageFilter(stage);
    try {
      const res = await apiFetchWithAuth<{
        items: { id: string; email: string; name: string | null; company: string | null }[];
      }>(`/api/v1/workbench/analytics/pipeline/${stage}/customers`, token);
      setStageCustomers(res.items);
    } catch {
      setStageCustomers([]);
    }
  }

  async function applyStage(engagementId: string) {
    if (!token) return;
    try {
      await apiFetchWithAuth(`/api/v1/workbench/engagements/${engagementId}/apply-stage`, token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load(token);
    } catch (e) {
      setError(e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Failed to apply stage");
    }
  }

  const pipeline = overview?.pipeline ?? {};

  return (
    <>
      <WorkbenchPageHeader
        eyebrow="Analytics"
        title="Analytics"
        description="Live visitors, lead-stage pipeline, and actionable progressions from email and call engagements."
        actions={
          lastRefresh ? (
            <p className="text-xs text-text-muted">Updated {formatRelative(lastRefresh.toISOString())}</p>
          ) : null
        }
        align="start"
      />

      {error ? (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Pipeline</h2>
            <p className="mt-1 text-sm text-text-muted">
              Conversion rate {(overview ? overview.conversion_rate * 100 : 0).toFixed(1)}% ·{" "}
              {overview?.open_leads ?? 0} open · {overview?.won ?? 0} won
            </p>
          </div>
          <Link
            href="/workbench/studio?mode=agent"
            className="text-sm text-accent-admin hover:underline"
          >
            Log engagement in Studio Agent →
          </Link>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {STAGES.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => void openStage(stage)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition",
                stageFilter === stage
                  ? "border-accent-admin/50 bg-accent-admin/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20",
              )}
            >
              <p className="text-[11px] uppercase tracking-wide text-text-muted">{stage}</p>
              <p className="mt-1 font-mono text-xl text-white">{pipeline[stage] ?? 0}</p>
            </button>
          ))}
        </div>
        {stageFilter ? (
          <div className="mt-4 rounded-xl border border-white/10 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/80">Stage: {stageFilter}</h3>
              <button
                type="button"
                className="text-xs text-text-muted hover:text-white"
                onClick={() => {
                  setStageFilter(null);
                  setStageCustomers([]);
                }}
              >
                Close
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {stageCustomers.length === 0 ? (
                <li className="text-text-muted">No customers in this stage.</li>
              ) : (
                stageCustomers.map((c) => (
                  <li key={c.id}>
                    <Link href={`/workbench/customers/${c.id}`} className="text-accent-admin hover:underline">
                      {c.company || c.name || c.email}
                    </Link>
                    <span className="text-text-muted"> · {c.email}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Progressions</h2>
        <p className="mt-1 text-sm text-text-muted">
          Clickable workflows from email AI, call logs, and stalled leads.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(overview?.progressions ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">
              {loading ? "Loading…" : "No open progressions. Log a call in Studio Agent or paste an email thread."}
            </p>
          ) : (
            (overview?.progressions ?? []).map((p, i) => (
              <article
                key={`${p.type}-${p.customer_id}-${i}`}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <h3 className="text-sm font-semibold text-white">{p.title}</h3>
                <p className="mt-1 line-clamp-3 text-xs text-text-muted">{p.detail}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.engagement_id && p.suggested_stage ? (
                    <button
                      type="button"
                      onClick={() => void applyStage(p.engagement_id!)}
                      className="rounded-full bg-accent-admin px-3 py-1 text-xs font-semibold text-black"
                    >
                      Apply {p.suggested_stage}
                    </button>
                  ) : null}
                  {p.actions.map((a) =>
                    a.href ? (
                      <Link
                        key={a.id}
                        href={a.href}
                        className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/80 hover:border-accent-admin/40"
                      >
                        {a.label}
                      </Link>
                    ) : null,
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Recent engagements</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-background-raised text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Channel</th>
                <th className="px-4 py-3 font-semibold">Outcome</th>
                <th className="px-4 py-3 font-semibold">Stage</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.recent_engagements ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-text-muted" colSpan={5}>
                    No engagements yet.
                  </td>
                </tr>
              ) : (
                (overview?.recent_engagements ?? []).map((e) => (
                  <tr key={e.id} className="border-b border-white/5">
                    <td className="px-4 py-3 text-text-muted">
                      {e.occurred_at ? formatRelative(e.occurred_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {e.customer_company || e.customer_email}
                      <p className="text-xs text-text-muted line-clamp-1">{e.summary}</p>
                    </td>
                    <td className="px-4 py-3">{e.channel}</td>
                    <td className="px-4 py-3">{e.outcome}</td>
                    <td className="px-4 py-3">{e.customer_lead_stage}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Live</h2>
        <p className="mt-1 text-sm text-text-muted">
          Active browsing sessions (15m) and hot leads (24h). Refreshes every 10 seconds.
        </p>

        <h3 className="mt-6 text-sm font-semibold text-white/80">Hot leads (24h)</h3>
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-background-raised text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {loading && hotLeads.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-text-muted" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              ) : hotLeads.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-text-muted" colSpan={4}>
                    No hot leads in the last 24 hours.
                  </td>
                </tr>
              ) : (
                hotLeads.map((lead) => (
                  <tr key={lead.customer_id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-accent-admin">{lead.score.toFixed(1)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/workbench/customers/${lead.customer_id}`}
                        className="font-semibold text-white hover:text-accent-admin"
                      >
                        {lead.name ?? lead.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{lead.company ?? "—"}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {lead.last_seen_at ? formatTime(lead.last_seen_at) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <h3 className="mt-8 text-sm font-semibold text-white/80">Active sessions</h3>
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-background-raised text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Visitor</th>
                <th className="px-4 py-3 font-semibold">Search</th>
                <th className="px-4 py-3 font-semibold">Parts viewed</th>
                <th className="px-4 py-3 font-semibold">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-text-muted" colSpan={5}>
                    No active visitors right now.
                  </td>
                </tr>
              ) : (
                sessions.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-accent-admin">{row.score.toFixed(1)}</td>
                    <td className="px-4 py-3">
                      {row.customer ? (
                        <Link
                          href={`/workbench/customers/${row.customer.id}`}
                          className="font-semibold text-white hover:text-accent-admin"
                        >
                          {row.customer.name ?? row.customer.email}
                        </Link>
                      ) : (
                        <span className="text-text-muted">Anonymous</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{row.latest_search ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-accent-admin">
                      {row.parts_viewed.length ? row.parts_viewed.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{formatRelative(row.last_seen_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
