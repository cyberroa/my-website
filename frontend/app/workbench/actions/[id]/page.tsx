"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { apiFetchWithAuth } from "@/lib/api-workbench";
import { createClient } from "@/lib/supabase/client";
import {
  getTeamAction,
  TEAM_ACTION_KIND_STYLE,
  TEAM_ACTION_STATE_STYLE,
} from "@/lib/workbench-team-actions";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type CustomerHit = { id: string; company: string | null; name: string | null; email: string };

function slugEmail(company: string) {
  const slug = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
  return `${slug || "account"}@example.com`;
}

async function findOrCreateCustomer(token: string, company: string): Promise<string | null> {
  const res = await apiFetchWithAuth<{ items: CustomerHit[] }>(
    `/api/v1/workbench/customers?search=${encodeURIComponent(company)}&limit=20`,
    token,
  );
  const needle = company.toLowerCase();
  const rows = res.items ?? [];
  const match = rows.find(
    (c) =>
      (c.company || "").toLowerCase() === needle ||
      (c.company || "").toLowerCase().includes(needle) ||
      (c.name || "").toLowerCase().includes(needle),
  );
  if (match) return match.id;
  try {
    const created = await apiFetchWithAuth<CustomerHit>("/api/v1/workbench/customers", token, {
      method: "POST",
      body: JSON.stringify({
        email: slugEmail(company),
        name: company,
        company,
        source: "team_action",
        tags: ["action-queue"],
        notes: "Created from a Workbench team action so staff can open a dossier.",
      }),
    });
    return created.id;
  } catch {
    return rows[0]?.id ?? null;
  }
}

function destination(itemWorkHref: string, customerId: string | null) {
  if (customerId && itemWorkHref.startsWith("/workbench/customers")) {
    return `/workbench/customers/${customerId}`;
  }
  if (customerId && itemWorkHref.startsWith("/workbench/studio")) {
    return `/workbench/studio?mode=agent&customer=${customerId}`;
  }
  return itemWorkHref;
}

export default function WorkbenchActionStreamPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const item = getTeamAction(id);
  const tone = item ? TEAM_ACTION_STATE_STYLE[item.state] : null;
  const [token, setToken] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id && !item) router.replace("/workbench/actions");
  }, [id, item, router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const t = session?.access_token ?? null;
      setToken(t);
      if (!t || !item?.customerSearch) return;
      void findOrCreateCustomer(t, item.customerSearch).then(setCustomerId);
    });
  }, [item?.customerSearch]);

  async function openWorkspace() {
    if (!item) return;
    setBusy(true);
    try {
      let cid = customerId;
      if (item.customerSearch && token && !cid) {
        cid = await findOrCreateCustomer(token, item.customerSearch);
        setCustomerId(cid);
      }
      router.push(destination(item.workHref, cid));
    } finally {
      setBusy(false);
    }
  }

  if (!item || !tone) {
    return <p className="text-sm text-text-muted">Opening actions…</p>;
  }

  return (
    <div className="space-y-8">
      <WorkbenchPageHeader
        eyebrow="Actions"
        title={item.action}
        align="start"
        description={
          <span>
            Event stream for <span className={tone.account}>{item.account}</span>. Read the workflow,
            then continue in the workspace.
          </span>
        }
        actions={
          <span
            className={`rounded border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone.badge}`}
          >
            {item.state}
          </span>
        }
      />

      <Link href="/workbench/actions" className="inline-block text-sm text-accent-admin hover:underline">
        ← All actions
      </Link>

      <ol className="relative space-y-0 border-l border-white/15 pl-6">
        {item.events.map((ev, i) => {
          const last = i === item.events.length - 1;
          const kindTone = TEAM_ACTION_KIND_STYLE[ev.kind];
          return (
            <li key={`${ev.at}-${ev.title}`} className="relative pb-8 last:pb-0">
              <span
                className={`absolute -left-[1.6rem] top-1.5 h-3 w-3 rounded-full border ${
                  last ? "border-accent-admin bg-accent-admin" : "border-white/30 bg-[#101314]"
                }`}
              />
              <p className="text-xs text-text-muted">{formatWhen(ev.at)}</p>
              <div className="mt-2 rounded-xl border border-white/10 bg-[#101314] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${kindTone}`}
                  >
                    {ev.kind}
                  </span>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${TEAM_ACTION_STATE_STYLE[ev.stateAfter].badge}`}
                  >
                    {ev.stateAfter}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{ev.title}</p>
                <p className="mt-1 text-sm text-text-muted">{ev.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        disabled={busy}
        onClick={() => void openWorkspace()}
        className="inline-flex rounded-lg bg-accent-admin px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
      >
        {busy ? "Opening…" : item.workCta}
      </button>
    </div>
  );
}
