"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { WorkbenchSelect } from "@/components/workbench/WorkbenchSelect";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";

type Goal = {
  id: string;
  name: string;
  description: string | null;
  opportunity_types: string[];
  channel: string;
  segment_id: string | null;
  segment_name: string | null;
  pending_segment_id: string | null;
  pending_segment_name: string | null;
  auto_refresh: boolean;
  draft_on_threshold: number | null;
  active: boolean;
  segment_link_status: string;
  last_member_count: number | null;
  last_refreshed_at: string | null;
};

type OppTypes = { types: string[]; labels: Record<string, string> };

const CHANNELS = ["email", "social", "outreach"] as const;

export default function AdminGoalsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [types, setTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ goal: string; body: Record<string, unknown> } | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [channel, setChannel] = useState<string>("email");

  const load = useCallback(async (t: string) => {
    const [g, ot] = await Promise.all([
      apiFetchWithAuth<Goal[]>("/api/v1/workbench/goals", t),
      apiFetchWithAuth<OppTypes>("/api/v1/workbench/goals/opportunity-types", t),
    ]);
    setGoals(g);
    setTypes(ot.types);
    setLabels(ot.labels);
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

  function toggleType(t: string) {
    setSelectedTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !name.trim() || !selectedTypes.length) return;
    setError(null);
    try {
      await apiFetchWithAuth("/api/v1/workbench/goals", token, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          opportunity_types: selectedTypes,
          channel,
          auto_refresh: true,
        }),
      });
      setName("");
      setDescription("");
      setSelectedTypes([]);
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body) : "Create failed");
    }
  }

  async function runDetect() {
    if (!token) return;
    setBusy("detect");
    setError(null);
    try {
      await apiFetchWithAuth("/api/v1/workbench/ai/jobs/opportunities/manual", token, {
        method: "POST",
      });
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body) : "Detect failed");
    } finally {
      setBusy(null);
    }
  }

  async function act(goalId: string, path: string, label: string) {
    if (!token) return;
    setBusy(`${label}-${goalId}`);
    setError(null);
    try {
      const res = await apiFetchWithAuth<Record<string, unknown>>(
        `/api/v1/workbench/goals/${goalId}/${path}`,
        token,
        { method: "POST" },
      );
      if (path === "draft-campaign" && res.draft) {
        setDraft({ goal: goalId, body: res.draft as Record<string, unknown> });
      }
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body) : `${label} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="space-y-8">
      <WorkbenchPageHeader
        eyebrow="CRM"
        title="Goals"
        align="start"
        description="Bind opportunity types to marketing goals. Generate a segment once, approve it, then auto-refresh membership."
        actions={
          <button
            type="button"
            disabled={busy === "detect"}
            onClick={() => void runDetect()}
            className="rounded-lg border border-accent-admin/40 px-4 py-2 text-sm font-semibold text-accent-admin disabled:opacity-50"
          >
            {busy === "detect" ? "Detecting…" : "Run opportunity detect"}
          </button>
        }
      />

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => void createGoal(e)}
        className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5"
      >
        <h2 className="font-display text-sm font-bold text-white">New goal</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Goal name"
          required
          className="w-full rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white"
        />
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                selectedTypes.includes(t)
                  ? "border-accent-admin/50 bg-accent-admin/15 text-accent-admin"
                  : "border-white/15 text-text-secondary"
              }`}
            >
              {labels[t] || t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <WorkbenchSelect
            value={channel}
            onChange={setChannel}
            options={CHANNELS.map((c) => ({ value: c, label: c }))}
          />
          <button
            type="submit"
            className="rounded-lg bg-accent-admin px-4 py-2 text-sm font-semibold text-black"
          >
            Create goal
          </button>
        </div>
      </form>

      <ul className="space-y-4">
        {goals.map((g) => (
          <li
            key={g.id}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-white">{g.name}</h3>
                {g.description && (
                  <p className="mt-1 text-sm text-text-secondary">{g.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.opportunity_types.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-text-muted"
                    >
                      {labels[t] || t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right text-sm text-text-secondary">
                <div>
                  Status:{" "}
                  <span className="text-accent-admin">{g.segment_link_status}</span>
                </div>
                <div>
                  Members:{" "}
                  <span className="font-semibold text-white">
                    {g.last_member_count ?? "—"}
                  </span>
                </div>
                {g.segment_name && (
                  <div>
                    Segment:{" "}
                    <Link href="/workbench/segments" className="text-accent-admin underline">
                      {g.segment_name}
                    </Link>
                  </div>
                )}
                {g.pending_segment_name && (
                  <div className="text-amber-200">Pending: {g.pending_segment_name}</div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void act(g.id, "generate-segment", "gen")}
                className="rounded border border-white/20 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Generate segment
              </button>
              {g.segment_link_status === "pending" && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void act(g.id, "approve-segment", "approve")}
                  className="rounded border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-50"
                >
                  Approve segment
                </button>
              )}
              {g.segment_link_status === "approved" && (
                <>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void act(g.id, "refresh", "refresh")}
                    className="rounded border border-white/20 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Refresh membership
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void act(g.id, "draft-campaign", "draft")}
                    className="rounded border border-accent-admin/40 px-3 py-1.5 text-xs font-semibold text-accent-admin disabled:opacity-50"
                  >
                    Draft campaign copy
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
        {!goals.length && (
          <li className="text-sm text-text-muted">No goals yet — create one or they seed on first load.</li>
        )}
      </ul>

      {draft && (
        <section className="rounded-xl border border-accent-admin/30 bg-accent-admin/5 p-5">
          <h2 className="mb-2 font-display text-sm font-bold text-accent-admin">Campaign draft</h2>
          <pre className="whitespace-pre-wrap text-sm text-text-secondary">
            {JSON.stringify(draft.body, null, 2)}
          </pre>
          <p className="mt-2 text-xs text-text-muted">
            Copy into Templates / Campaigns when ready — Send stays human.
          </p>
        </section>
      )}
    </main>
  );
}
