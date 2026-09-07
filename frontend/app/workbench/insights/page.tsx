"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";

type GraphNode = {
  id: string;
  type: string;
  label: string;
  meta?: Record<string, unknown>;
};

type GraphEdge = { source: string; target: string; type: string };

type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

const TYPE_COLORS: Record<string, string> = {
  customer: "border-sky-500/50 bg-sky-500/10",
  segment: "border-violet-500/50 bg-violet-500/10",
  part: "border-emerald-500/50 bg-emerald-500/10",
  tag: "border-amber-500/50 bg-amber-500/10",
  competitor: "border-accent-titanium/50 bg-accent-titanium/10",
};

export default function AdminInsightsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: string) => {
    try {
      const g = await apiFetchWithAuth<Graph>("/api/v1/workbench/ai/graph?scope=market", t);
      setGraph(g);
    } catch (e) {
      setError(e instanceof ApiError ? String(e.message) : "Failed to load graph");
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) void load(session.access_token);
    });
  }, [load]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <WorkbenchPageHeader
        eyebrow="Insights"
        title="Market Map"
        align="start"
        description="Clickable CRM graph — customers, segments, parts, tags, and competitors."
      />
      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap gap-2">
            {(graph?.nodes ?? []).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelected(n)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition hover:scale-[1.02] ${TYPE_COLORS[n.type] ?? "border-white/15 bg-white/5"}`}
              >
                <div className="font-semibold text-white">{n.label}</div>
                <div className="text-text-muted">{n.type}</div>
              </button>
            ))}
          </div>
          {!graph?.nodes.length && (
            <p className="py-8 text-center text-sm text-text-muted">No graph data yet — import customers and track activity.</p>
          )}
        </div>

        <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-2 font-display text-sm font-bold text-white">Details</h2>
          {!selected && <p className="text-sm text-text-muted">Select a node to drill down.</p>}
          {selected && (
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-white">{selected.label}</p>
              <p className="text-text-secondary">Type: {selected.type}</p>
              {selected.meta && (
                <pre className="overflow-auto rounded bg-black/30 p-2 text-xs text-text-muted">
                  {JSON.stringify(selected.meta, null, 2)}
                </pre>
              )}
              {selected.type === "customer" && typeof selected.meta?.email === "string" && (
                <Link
                  href={`/workbench/customers?search=${encodeURIComponent(selected.meta.email)}`}
                  className="inline-block text-accent-admin underline"
                >
                  Open in Customers
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>

      <p className="text-xs text-text-muted">
        {graph ? `${graph.nodes.length} nodes · ${graph.edges.length} edges` : ""}
        {token && (
          <>
            {" · "}
            <button type="button" className="underline" onClick={() => token && void load(token)}>
              Refresh
            </button>
          </>
        )}
      </p>
    </main>
  );
}
