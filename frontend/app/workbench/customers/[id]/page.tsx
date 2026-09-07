"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";
import { CustomerLogoControl } from "@/components/workbench/CustomerLogoControl";

type Customer = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  role: string | null;
  tags: string[];
  source: string | null;
  notes: string | null;
  website?: string | null;
  logo_url?: string | null;
  consent_marketing: boolean;
  consent_source: string | null;
  consent_at: string | null;
  lead_stage?: string;
  created_at: string;
  updated_at: string;
};

type TimelineItem = {
  kind: string;
  occurred_at: string;
  label: string;
  data: Record<string, unknown>;
};

type Timeline = {
  customer: Customer;
  items: TimelineItem[];
};

type Briefing = {
  customer_id: string;
  content: string;
  model: string;
  timeline_hash: string;
  generated_at: string;
  cached: boolean;
  score: number | null;
  disabled?: boolean;
  message?: string | null;
};

type Opportunity = {
  opportunity_type: string;
  score: number;
  reasons: string[];
  as_of_date: string;
};

const OPP_LABELS: Record<string, string> = {
  warm_parts_inquiry: "Warm parts inquiry",
  cooling_engaged: "Cooling engaged",
  sell_equipment: "Sell to Titan",
  consent_ready_nurture: "Consent-ready nurture",
  hot_lead: "Hot lead",
  buy_used_petct: "Buy used PET/CT",
  buy_new_petct: "Buy new PET/CT",
  audit_candidate: "Audit candidate",
  service_contract_gap: "Service contract gap",
};

type EvidenceItem = {
  id: string;
  observation: string;
  strength: string;
  status: string;
  suggested_field: string | null;
  suggested_value: string | null;
  observed_at: string | null;
};

type AgentTask = {
  id: string;
  kind: string;
  status: string;
  reason: string | null;
  result_summary: string | null;
  open_questions: string[];
  created_at: string | null;
};

type FitScore = {
  offer_family: string;
  score: number;
  reasons: string[];
  as_of_date: string;
};

function urgencyClass(urgency: unknown): string {
  if (urgency === "high") return "bg-red-500/20 text-red-200 border-red-500/30";
  if (urgency === "medium") return "bg-amber-500/20 text-amber-100 border-amber-500/30";
  return "bg-white/10 text-text-muted border-white/15";
}

export default function AdminCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Timeline | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [fitScores, setFitScores] = useState<FitScore[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [agentBusy, setAgentBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editTags, setEditTags] = useState("");
  const [consent, setConsent] = useState(false);

  const loadBriefing = useCallback(
    async (t: string, regenerate = false) => {
      if (!id) return;
      setBriefingLoading(true);
      setBriefingError(null);
      try {
        const path = regenerate
          ? `/api/v1/workbench/customers/${id}/briefing/regenerate`
          : `/api/v1/workbench/customers/${id}/briefing`;
        const r = await apiFetchWithAuth<Briefing>(path, t, {
          method: regenerate ? "POST" : "GET",
        });
        setBriefing(r);
      } catch (e) {
        setBriefingError(
          e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Briefing failed",
        );
      } finally {
        setBriefingLoading(false);
      }
    },
    [id],
  );

  const load = useCallback(
    async (t: string) => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiFetchWithAuth<Timeline>(`/api/v1/workbench/customers/${id}/timeline`, t);
        setData(r);
        setEditNotes(r.customer.notes ?? "");
        setEditTags(r.customer.tags.join(", "));
        setConsent(r.customer.consent_marketing);
        void loadBriefing(t);
        try {
          const opp = await apiFetchWithAuth<{
            opportunities: Opportunity[];
            fit_scores?: FitScore[];
          }>(`/api/v1/workbench/customers/${id}/opportunities`, t);
          setOpportunities(opp.opportunities ?? []);
          setFitScores(opp.fit_scores ?? []);
        } catch {
          setOpportunities([]);
          setFitScores([]);
        }
        try {
          const ev = await apiFetchWithAuth<{ items: EvidenceItem[] }>(
            `/api/v1/workbench/customers/${id}/evidence`,
            t,
          );
          setEvidence(ev.items ?? []);
        } catch {
          setEvidence([]);
        }
        try {
          const tasks = await apiFetchWithAuth<AgentTask[]>(
            `/api/v1/workbench/customers/${id}/agent/tasks`,
            t,
          );
          setAgentTasks(tasks ?? []);
        } catch {
          setAgentTasks([]);
        }
      } catch (e) {
        setError(e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [id, loadBriefing],
  );

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) void load(session.access_token);
      else setLoading(false);
    });
  }, [id, load]);

  async function save() {
    if (!token || !id) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetchWithAuth(`/api/v1/workbench/customers/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          notes: editNotes || null,
          tags: editTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          consent_marketing: consent,
          consent_source: consent ? "admin" : null,
        }),
      });
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="text-sm">
        <Link href="/workbench/customers" className="text-accent-admin hover:underline">
          &larr; All customers
        </Link>
      </p>

      {loading ? (
        <p className="mt-6 text-text-muted">Loading…</p>
      ) : !data ? (
        <p className="mt-6 text-red-200">{error ?? "Not found"}</p>
      ) : (
        <>
          <section className="mt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <CustomerLogoControl
                  token={token}
                  customer={data.customer}
                  onUpdated={(logo_url) =>
                    setData((cur) =>
                      cur ? { ...cur, customer: { ...cur.customer, logo_url } } : cur,
                    )
                  }
                />
                <div>
                <h1 className="text-2xl font-bold md:text-3xl">
                  {data.customer.name || data.customer.email}
                </h1>
                <p className="mt-1 text-sm text-text-muted">
                  {data.customer.email}
                  {data.customer.company ? ` · ${data.customer.company}` : null}
                  {data.customer.website ? ` · ${data.customer.website}` : null}
                  {data.customer.role ? ` · ${data.customer.role}` : null}
                  {data.customer.lead_stage ? ` · stage ${data.customer.lead_stage}` : null}
                </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/workbench/studio?mode=agent&customer=${id}`}
                  className="rounded-lg border border-accent-admin/40 bg-accent-admin/10 px-3 py-2 text-sm font-semibold text-accent-admin"
                >
                  Log engagement
                </Link>
                <Link
                  href={`/workbench/studio?customer=${id}`}
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm text-text-secondary hover:border-accent-admin hover:text-accent-admin"
                >
                  Open in Studio
                </Link>
              </div>
            </div>
          </section>

          <div className="mt-6 rounded-xl border border-white/10 bg-background-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">AI briefing</h2>
                <p className="mt-1 text-xs text-text-muted">
                  OpenRouter summary for call prep — cached until activity changes.
                </p>
              </div>
              <button
                type="button"
                disabled={!token || briefingLoading}
                onClick={() => token && void loadBriefing(token, true)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-text-secondary transition hover:border-accent-admin hover:text-accent-admin disabled:opacity-50"
              >
                {briefingLoading ? "Generating…" : "Regenerate"}
              </button>
            </div>

            {briefingLoading && !briefing ? (
              <p className="mt-4 text-sm text-text-muted">Generating briefing…</p>
            ) : briefing?.disabled ? (
              <p className="mt-4 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-text-muted">
                AI is not configured. Set <code className="text-accent-admin">OPENROUTER_API_KEY</code>{" "}
                and keep <code className="text-accent-admin">AI_ENABLED=true</code> on the API.
                {briefing.message ? ` (${briefing.message})` : null}
              </p>
            ) : briefing?.content ? (
              <div className="mt-4 space-y-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                  {briefing.content}
                </p>
                <p className="text-xs text-text-muted">
                  {briefing.score != null ? `Engagement score ${briefing.score} · ` : null}
                  {briefing.cached ? "Cached · " : "Fresh · "}
                  {briefing.model || "unknown model"} ·{" "}
                  {new Date(briefing.generated_at).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-text-muted">No briefing yet.</p>
            )}
            {briefingError ? (
              <p className="mt-3 text-sm text-red-200">{briefingError}</p>
            ) : null}
          </div>

          {opportunities.length > 0 && (
            <div className="mt-6 rounded-xl border border-white/10 bg-background-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Opportunities</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/workbench/studio?customer=${id}`}
                    className="text-sm text-accent-admin hover:underline"
                  >
                    Open in Studio
                  </Link>
                  <Link href="/workbench/goals" className="text-sm text-accent-admin hover:underline">
                    Goals →
                  </Link>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {opportunities.map((o) => (
                  <div
                    key={o.opportunity_type}
                    className="max-w-xs rounded-lg border border-accent-admin/30 bg-accent-admin/10 px-3 py-2"
                    title={(o.reasons || []).join("; ")}
                  >
                    <div className="text-sm font-semibold text-accent-admin">
                      {OPP_LABELS[o.opportunity_type] || o.opportunity_type}
                    </div>
                    <div className="text-xs text-text-muted">
                      score {o.score} · {o.as_of_date}
                    </div>
                  </div>
                ))}
              </div>
              {fitScores.length > 0 ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Offer fit scores
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fitScores.map((f) => (
                      <span
                        key={f.offer_family}
                        className="rounded-md border border-white/15 px-2 py-1 text-xs text-text-secondary"
                        title={(f.reasons || []).join("; ")}
                      >
                        {f.offer_family}: {f.score}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-white/10 bg-background-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Agent</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/workbench/studio?customer=${id}`}
                  className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
                >
                  Open in Studio
                </Link>
                <button
                  type="button"
                  disabled={!token || agentBusy}
                  className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:border-white/30 disabled:opacity-50"
                  onClick={async () => {
                    if (!token || !id) return;
                    setAgentBusy(true);
                    try {
                      await apiFetchWithAuth(`/api/v1/workbench/customers/${id}/agent/research`, token, {
                        method: "POST",
                        body: JSON.stringify({ reason: "Manual research from customer 360" }),
                      });
                      await load(token);
                    } catch (e) {
                      setError(
                        e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Research enqueue failed",
                      );
                    } finally {
                      setAgentBusy(false);
                    }
                  }}
                >
                  {agentBusy ? "Queuing…" : "Queue research"}
                </button>
              </div>
            </div>
            {agentTasks.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No research tasks yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {agentTasks.slice(0, 5).map((t) => (
                  <li key={t.id} className="rounded-lg border border-white/10 px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-white">
                        {t.kind} · {t.status}
                      </span>
                      <span className="text-xs text-text-muted">
                        {t.created_at ? new Date(t.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                    {t.reason ? <p className="mt-1 text-text-muted">{t.reason}</p> : null}
                    {t.result_summary ? (
                      <p className="mt-1 text-text-secondary">{t.result_summary}</p>
                    ) : null}
                    {(t.open_questions || []).length > 0 ? (
                      <ul className="mt-1 list-disc pl-4 text-xs text-amber-100">
                        {t.open_questions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-background-card p-6">
            <h2 className="text-lg font-semibold">Evidence</h2>
            {evidence.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No evidence rows yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {evidence.map((e) => (
                  <li key={e.id} className="rounded-lg border border-white/10 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-wider text-text-muted">
                        {e.strength} · {e.status}
                      </span>
                      {e.status === "suggested" && token ? (
                        <span className="flex gap-2">
                          <button
                            type="button"
                            className="text-xs text-emerald-300 hover:underline"
                            onClick={async () => {
                              await apiFetchWithAuth(
                                `/api/v1/workbench/customers/${id}/evidence/${e.id}/resolve`,
                                token,
                                { method: "POST", body: JSON.stringify({ action: "accept" }) },
                              );
                              await load(token);
                            }}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="text-xs text-red-300 hover:underline"
                            onClick={async () => {
                              await apiFetchWithAuth(
                                `/api/v1/workbench/customers/${id}/evidence/${e.id}/resolve`,
                                token,
                                { method: "POST", body: JSON.stringify({ action: "reject" }) },
                              );
                              await load(token);
                            }}
                          >
                            Reject
                          </button>
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-text-secondary">{e.observation}</p>
                    {e.suggested_field ? (
                      <p className="mt-1 text-xs text-text-muted">
                        Suggest {e.suggested_field}: {e.suggested_value}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-background-card p-6">
              <h2 className="text-lg font-semibold">Details</h2>
              <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                <dt className="text-text-muted">Phone</dt>
                <dd>{data.customer.phone ?? "—"}</dd>
                <dt className="text-text-muted">Source</dt>
                <dd>{data.customer.source ?? "—"}</dd>
                <dt className="text-text-muted">Added</dt>
                <dd>{new Date(data.customer.created_at).toLocaleString()}</dd>
                <dt className="text-text-muted">Consent</dt>
                <dd>
                  {data.customer.consent_marketing
                    ? `yes (${data.customer.consent_source ?? "unknown"})`
                    : "no"}
                </dd>
              </dl>

              <div className="mt-4 space-y-3 text-sm">
                <label className="block">
                  <span className="text-text-muted">Tags (comma separated)</span>
                  <input
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-text-muted">Notes</span>
                  <textarea
                    className="mt-1 min-h-[100px] w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span className="text-text-muted">Marketing consent</span>
                </label>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="rounded-lg bg-accent-admin px-6 py-2 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-background-card p-6">
              <h2 className="text-lg font-semibold">Timeline</h2>
              {data.items.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">No recorded activity yet.</p>
              ) : (
                <ul className="mt-3 space-y-3 text-sm">
                  {data.items.map((it, i) => {
                    const sentiment = it.data.ai_sentiment;
                    const urgency = it.data.ai_urgency;
                    const summary = it.data.ai_summary;
                    return (
                      <li
                        key={i}
                        className="rounded-md border border-white/10 bg-black/20 px-3 py-2"
                      >
                        <p className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-accent-admin">{it.label}</span>
                          <span className="text-xs text-text-muted">
                            {new Date(it.occurred_at).toLocaleString()}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-text-muted">{it.kind}</p>
                        {typeof sentiment === "string" ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${urgencyClass(urgency)}`}
                            >
                              {String(sentiment)}
                              {urgency ? ` · ${String(urgency)}` : ""}
                            </span>
                            {typeof it.data.ai_intent === "string" ? (
                              <span className="text-[11px] text-text-muted">
                                {String(it.data.ai_intent).replaceAll("_", " ")}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {typeof summary === "string" && summary ? (
                          <p className="mt-1 text-xs text-text-secondary">{summary}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {error ? (
            <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
