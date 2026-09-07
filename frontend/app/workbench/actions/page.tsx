"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from "@/lib/api-workbench";
import { createClient } from "@/lib/supabase/client";
import {
  MOCK_TEAM_ACTIONS,
  TEAM_ACTION_STATE_STYLE,
  teamActionPath,
  type TeamActionState,
} from "@/lib/workbench-team-actions";
import { cn } from "@/lib/cn";

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

type Overview = { progressions: Progression[] };

function stateForType(type: string): TeamActionState {
  if (type === "stage_suggestion") return "In progress";
  if (type === "stalled") return "Scheduled";
  return "Pending";
}

function primaryHref(p: Progression): string {
  if (p.customer_id) return `/workbench/customers/${p.customer_id}`;
  return p.actions.find((a) => a.href)?.href || "/workbench/studio?mode=agent";
}

export default function WorkbenchActionsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [progressions, setProgressions] = useState<Progression[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: string) => {
    const ov = await apiFetchWithAuth<Overview>("/api/v1/workbench/analytics/overview", t);
    setProgressions(ov.progressions ?? []);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) {
        void load(session.access_token).catch((e) => {
          setError(e instanceof ApiError ? "Could not load live actions" : "Could not load live actions");
        });
      }
    });
  }, [load]);

  return (
    <div className="space-y-10">
      <WorkbenchPageHeader
        eyebrow="AI"
        title="Actions"
        align="start"
        description="Today’s team queue. Open an action to see its event stream, then continue in the workspace. Live items come from Analytics progressions."
      />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-text-muted">
          Pinned today
        </h2>
        <ol className="mt-4 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-[#101314]">
          {MOCK_TEAM_ACTIONS.map((item) => {
            const tone = TEAM_ACTION_STATE_STYLE[item.state];
            return (
              <li key={item.n}>
                <Link
                  href={teamActionPath(item.id)}
                  className="flex gap-3 px-5 py-4 transition hover:bg-white/[0.03]"
                >
                  <span
                    className={`inline-flex h-6 shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-bold tabular-nums ${tone.mark}`}
                  >
                    {item.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{item.action}</p>
                    <p className={`mt-1 text-sm ${tone.account}`}>{item.account}</p>
                  </div>
                  <span
                    className={`h-fit shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone.badge}`}
                  >
                    {item.state}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-text-muted">
          Live from CRM
        </h2>
        {error ? <p className="mt-3 text-sm text-accent-alert">{error}</p> : null}
        {!token ? (
          <p className="mt-3 text-sm text-text-muted">Sign in to load live actions.</p>
        ) : progressions.length === 0 && !error ? (
          <p className="mt-3 text-sm text-text-muted">
            No open progressions yet. Log a call in Studio Agent or paste an email thread.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {progressions.map((p, i) => {
              const state = stateForType(p.type);
              const tone = TEAM_ACTION_STATE_STYLE[state];
              const href = primaryHref(p);
              return (
                <li key={`${p.type}-${p.customer_id}-${i}`}>
                  <Link
                    href={href}
                    className="block rounded-xl border border-white/10 bg-[#101314] p-4 transition hover:border-accent-admin hover:bg-[#1a1a1a]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{p.title}</p>
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone.badge}`}
                      >
                        {state}
                      </span>
                    </div>
                    {p.detail ? (
                      <p className="mt-1 line-clamp-2 text-sm text-text-muted">{p.detail}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.actions.filter((a) => a.href).map((a) => (
                        <span
                          key={a.id}
                          className={cn(
                            "rounded-lg border border-accent-admin/40 bg-accent-admin/10 px-2.5 py-1 text-xs font-semibold text-accent-admin",
                          )}
                        >
                          {a.label}
                        </span>
                      ))}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
