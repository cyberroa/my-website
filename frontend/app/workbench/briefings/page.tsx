"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";

type Briefing = {
  id: string;
  report_date: string;
  title: string;
  markdown_body: string;
  chart_payload: Record<string, unknown>;
  emailed_at: string | null;
  slacked_at: string | null;
};

export default function AdminBriefingsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<Briefing[]>([]);
  const [selected, setSelected] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: string) => {
    const list = await apiFetchWithAuth<Briefing[]>("/api/v1/workbench/ai/briefings", t);
    setRows(list);
    if (list.length && !selected) setSelected(list[0]);
  }, [selected]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) void load(session.access_token).catch(() => undefined);
    });
  }, [load]);

  async function generateNow() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetchWithAuth("/api/v1/workbench/ai/briefings/generate", token, { method: "POST" });
      await load(token);
    } catch (e) {
      setError(e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Generate failed");
    } finally {
      setLoading(false);
    }
  }

  async function deliver(id: string) {
    if (!token) return;
    await apiFetchWithAuth(`/api/v1/workbench/ai/briefings/${id}/deliver`, token, { method: "POST" });
    await load(token);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <WorkbenchPageHeader
        eyebrow="Reports"
        title="Daily Briefings"
        align="start"
        description="AI report packs for staff — email via Resend and Slack when configured."
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void generateNow()}
          className="rounded-lg bg-accent-admin px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate now"}
        </button>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <ul className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                <div className="font-semibold text-white">{r.report_date}</div>
                <div className="truncate text-text-muted">{r.title}</div>
              </button>
            </li>
          ))}
          {!rows.length && <li className="px-3 py-4 text-sm text-text-muted">No briefings yet.</li>}
        </ul>

        <div className="lg:col-span-2 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-lg font-bold text-white">{selected.title}</h2>
                <button
                  type="button"
                  onClick={() => void deliver(selected.id)}
                  className="shrink-0 rounded border border-white/20 px-3 py-1 text-xs font-semibold text-white"
                >
                  Send email + Slack
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-text-secondary">{selected.markdown_body}</pre>
            </>
          ) : (
            <p className="text-sm text-text-muted">Select a briefing or generate one.</p>
          )}
        </div>
      </div>
    </main>
  );
}
