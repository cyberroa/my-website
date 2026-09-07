"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OperationsCenter } from "@/components/workbench/OperationsCenter";
import { WorkbenchSitemap } from "@/components/workbench/WorkbenchSitemap";
import { apiFetchWithAuth } from "@/lib/api-workbench";
import { WORKBENCH_NAV_GROUPS, filterNavGroups, type StaffAccess } from "@/lib/workbench-nav";
import { scoreHeatColor } from "@/lib/score-heat";
import { createClient } from "@/lib/supabase/client";

type MeResponse = {
  staff_tier?: string;
  effective_capabilities?: string[];
  staff?: { staff_tier?: string; effective_capabilities?: string[] };
};

type RankRow = {
  customer_id: string;
  email: string;
  name: string | null;
  company: string | null;
  score: number;
  offer_family: string;
};

type Rankings = {
  audit_candidates: RankRow[];
  system_buyers_used: RankRow[];
  system_buyers_new: RankRow[];
  parts_warmth: RankRow[];
  sell_to_titan: RankRow[];
};

function RankingCards() {
  const [rankings, setRankings] = useState<Rankings | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      void apiFetchWithAuth<Rankings>("/api/v1/workbench/ai/rankings", session.access_token)
        .then(setRankings)
        .catch(() => undefined);
    });
  }, []);

  if (!rankings) return null;

  const cards: { title: string; rows: RankRow[]; href: string }[] = [
    {
      title: "Top audit candidates",
      rows: rankings.audit_candidates || [],
      href: "/workbench/customers?opportunity=audit",
    },
    {
      title: "System buyers (used)",
      rows: rankings.system_buyers_used || [],
      href: "/workbench/customers?opportunity=used_system",
    },
    {
      title: "System buyers (new)",
      rows: rankings.system_buyers_new || [],
      href: "/workbench/customers?opportunity=new_system",
    },
    {
      title: "Parts warmth / at-risk",
      rows: rankings.parts_warmth || [],
      href: "/workbench/customers?opportunity=parts",
    },
  ];

  if (cards.every((c) => c.rows.length === 0)) return null;

  return (
    <section className="mx-auto max-w-7xl space-y-3 px-6 pt-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
        Live opportunity rankings
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border border-white/10 bg-[#101314] p-4">
            <div className="flex items-center justify-between gap-2">
              <Link href={card.href} className="text-sm font-semibold text-white hover:text-accent-admin">
                {card.title}
              </Link>
              <Link href={card.href} className="text-xs text-accent-admin hover:underline">
                View list
              </Link>
            </div>
            {card.rows.length === 0 ? (
              <p className="mt-3 text-xs text-text-muted">No ranked accounts yet.</p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {card.rows.slice(0, 5).map((r) => (
                  <li key={`${card.title}-${r.customer_id}`}>
                    <Link
                      href={`/workbench/customers/${r.customer_id}`}
                      className="flex justify-between gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-white/[0.04]"
                    >
                      <span className="truncate text-text-secondary">{r.company || r.name || r.email}</span>
                      <span
                        className="shrink-0 text-xs font-semibold tabular-nums"
                        style={{ color: scoreHeatColor(r.score) }}
                      >
                        {r.score}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function WorkbenchHomePage() {
  const [access, setAccess] = useState<StaffAccess | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      void apiFetchWithAuth<MeResponse>("/api/v1/workbench/staff/me", session.access_token)
        .then((me) => {
          setAccess({
            staffTier: me.staff_tier || me.staff?.staff_tier || "staff",
            effectiveCapabilities:
              me.effective_capabilities || me.staff?.effective_capabilities || [],
          });
        })
        .catch(() => undefined);
    });
  }, []);

  const groups = useMemo(() => filterNavGroups(WORKBENCH_NAV_GROUPS, access), [access]);

  return (
    <>
      <OperationsCenter />
      <RankingCards />
      <WorkbenchSitemap groups={groups} />
    </>
  );
}
