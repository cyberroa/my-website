"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkbenchSelect } from "@/components/workbench/WorkbenchSelect";
import { MOCK_TEAM_ACTIONS, TEAM_ACTION_STATE_STYLE, teamActionPath } from "@/lib/workbench-team-actions";

const workspaces = [
  {
    href: "/workbench/studio",
    title: "AI Studio",
    detail: "Draft account-specific outreach",
    cta: "Open AI Studio",
  },
  {
    href: "/workbench/campaigns",
    title: "Campaigns",
    detail: "Plan and measure email programs",
    cta: "Open campaigns",
  },
  {
    href: "/workbench/customers",
    title: "Account CRM",
    detail: "See relationship context before sending",
    cta: "Open customers",
  },
  {
    href: "/workbench/briefings",
    title: "Daily Briefing",
    detail: "Prioritize the team’s next actions",
    cta: "Open briefings",
  },
];

type SignalKind = "up" | "stale";
type Priority = "High" | "Medium" | "Low";

const opportunities: {
  account: string;
  need: string;
  signal: string;
  signalDetail: string;
  signalKind: SignalKind;
  owner: string;
  initials: string;
  priority: Priority;
  href: string;
}[] = [
  {
    account: "Cityview Medical Center",
    need: "PET/CT system upgrade",
    signal: "High website activity",
    signalDetail: "3 pricing page views",
    signalKind: "up",
    owner: "Jessica Alvarez",
    initials: "JA",
    priority: "High",
    href: "/workbench/customers?search=Cityview+Medical+Center",
  },
  {
    account: "Northshore Imaging Associates",
    need: "Service agreement renewal",
    signal: "Email link clicked",
    signalDetail: "Re: AI in PET/CT",
    signalKind: "up",
    owner: "Michael Reynolds",
    initials: "MR",
    priority: "High",
    href: "/workbench/customers?search=Northshore+Imaging",
  },
  {
    account: "Saint Mary’s Hospital",
    need: "New PET/CT system",
    signal: "Multiple content views",
    signalDetail: "Workflow & dosimetry",
    signalKind: "up",
    owner: "Priya Shah",
    initials: "PS",
    priority: "Medium",
    href: "/workbench/customers?search=Saint+Mary",
  },
  {
    account: "Western Radiology Group",
    need: "Preventive maintenance",
    signal: "No recent engagement",
    signalDetail: "Last touch 21 days ago",
    signalKind: "stale",
    owner: "Daniel Cho",
    initials: "DC",
    priority: "Low",
    href: "/workbench/customers?search=Western+Radiology",
  },
  {
    account: "Bayridge Oncology",
    need: "Used system evaluation",
    signal: "Email not opened",
    signalDetail: "Re: System options",
    signalKind: "stale",
    owner: "Jessica Alvarez",
    initials: "JA",
    priority: "Medium",
    href: "/workbench/customers?search=Bayridge+Oncology",
  },
];

const KPI_RANGES = [
  { id: "6m", label: "Last 6 months", points: 26 },
  { id: "90d", label: "Last 90 days", points: 45 },
  { id: "30d", label: "Last 30 days", points: 30 },
  { id: "7d", label: "Last 7 days", points: 7 },
  { id: "24h", label: "Last 24 hours", points: 24 },
] as const;

type KpiRangeId = (typeof KPI_RANGES)[number]["id"];

const RANGE_SCALE: Record<KpiRangeId, { volume: number; delta: number }> = {
  "24h": { volume: 0.04, delta: 0.2 },
  "7d": { volume: 0.28, delta: 0.48 },
  "30d": { volume: 1, delta: 1 },
  "90d": { volume: 2.55, delta: 1.32 },
  "6m": { volume: 4.7, delta: 1.65 },
};

function ramp(start: number, end: number, n: number) {
  const steps = Math.max(n, 2);
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    const base = start + (end - start) * t;
    const w = Math.sin(i * 1.17) * (end - start) * 0.045;
    return { i, v: Math.round((base + w) * 10) / 10 };
  });
}

const ELECTRIC = "#2BB4FF";
const EMERALD = "#34D399";
const TERRACOTTA = "#E07A5F";

function formatDelta(pct: number) {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

function deltaColor(kind: "workflow" | "outcome", pct: number) {
  if (kind === "workflow") return ELECTRIC;
  return pct >= 0 ? EMERALD : TERRACOTTA;
}

const KPI_BASE = [
  {
    label: "Workflow impact",
    end: 512,
    start: 398,
    deltaPct: 22,
    kind: "workflow" as const,
    href: "/workbench/analytics",
    format: (n: number) => String(Math.round(n)),
  },
  {
    label: "Pipeline influenced",
    end: 48.7,
    start: 39.8,
    deltaPct: 18,
    kind: "outcome" as const,
    href: "/workbench/sales",
    format: (n: number) => `$${n.toFixed(1)}M`,
  },
  {
    label: "Engaged accounts",
    end: 142,
    start: 108,
    deltaPct: 24,
    kind: "outcome" as const,
    href: "/workbench/customers",
    format: (n: number) => String(Math.round(n)),
  },
  {
    label: "Meetings booked",
    end: 37,
    start: 29,
    deltaPct: 16,
    kind: "outcome" as const,
    href: "/workbench/outreach",
    format: (n: number) => String(Math.round(n)),
  },
];

function kpisForRange(rangeId: KpiRangeId) {
  const range = KPI_RANGES.find((r) => r.id === rangeId) ?? KPI_RANGES[2];
  const scale = RANGE_SCALE[range.id];
  return KPI_BASE.map((kpi) => {
    const end = kpi.end * scale.volume;
    const start = kpi.start * scale.volume;
    return {
      label: kpi.label,
      value: kpi.format(end),
      deltaPct: Math.round(kpi.deltaPct * scale.delta),
      kind: kpi.kind,
      href: kpi.href,
      data: ramp(start, end, range.points),
    };
  });
}

function Sparkline({ data, color }: { data: { i: number; v: number }[]; color: string }) {
  const vals = data.map((d) => d.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const w = 160;
  const h = 48;
  const points = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - 4 - ((v - min) / (max - min || 1)) * (h - 8);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function SignalIcon({ kind }: { kind: SignalKind }) {
  if (kind === "up") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-accent-signal" aria-hidden>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12.5V3.5m0 0 3.5 3.5M8 3.5 4.5 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-accent-caution" aria-hidden>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" d="M3.5 8h9" />
      </svg>
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "High") {
    return (
      <span className="rounded border border-accent-alert/45 bg-accent-alert/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-alert">
        High
      </span>
    );
  }
  if (priority === "Medium") {
    return (
      <span className="rounded border border-accent-caution/45 bg-accent-caution/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-caution">
        Medium
      </span>
    );
  }
  return (
    <span className="rounded border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
      Low
    </span>
  );
}

export function OperationsCenter() {
  const router = useRouter();
  const [rangeId, setRangeId] = useState<KpiRangeId>("30d");
  const range = KPI_RANGES.find((r) => r.id === rangeId) ?? KPI_RANGES[2];
  const kpis = useMemo(() => kpisForRange(rangeId), [rangeId]);
  return (
    <section className="mx-auto max-w-7xl px-6 pt-10 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-admin">
        Titan Workbench
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-3xl font-bold md:text-5xl">Operations Center</h1>
          <p className="mt-3 max-w-2xl text-base text-white/65">
            Turn PET/CT expertise into trusted next steps for hospitals, imaging centers, and
            private practices.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/workbench/studio"
            className="rounded-lg bg-accent-admin px-4 py-2.5 text-sm font-bold text-black transition hover:brightness-110"
          >
            Open AI Studio
          </Link>
          <Link
            href="/workbench/customers"
            className="rounded-lg border border-white/25 px-4 py-2.5 text-sm font-semibold transition hover:border-white/40"
          >
            Open account CRM
          </Link>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <label className="flex w-max items-center gap-2.5 text-xs">
          <span className="shrink-0 text-white/45">Time range:</span>
          <WorkbenchSelect
            className="min-w-0"
            fitToOptions
            value={rangeId}
            onChange={(v) => setRangeId(v as KpiRangeId)}
            options={KPI_RANGES.map((r) => ({ value: r.id, label: r.label }))}
          />
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const tone = deltaColor(kpi.kind, kpi.deltaPct);
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="rounded-2xl border border-white/10 bg-[#101314] p-4 transition hover:border-accent-admin/40"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                {kpi.label}
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="font-display text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs font-semibold" style={{ color: tone }}>
                  {formatDelta(kpi.deltaPct)}
                </p>
              </div>
              <div className="mt-3 h-12">
                <Sparkline data={kpi.data} color={tone} />
              </div>
              <p className="mt-1 text-[10px] text-white/35">{range.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.45fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1519]">
          <div className="border-b border-white/10 px-6 py-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-admin">
              AI-assisted outreach
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Start the right conversation</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
              Build a clinically credible message using the account record, service history, and
              audience playbook.
            </p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {workspaces.map((w) => (
              <Link
                key={w.title}
                href={w.href}
                className="rounded-xl border border-white/10 bg-[#161616] p-4 transition hover:border-accent-admin hover:bg-[#1a1a1a]"
              >
                <p className="text-sm font-semibold text-white">{w.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/55">{w.detail}</p>
                <p className="mt-4 text-xs font-semibold text-accent-admin">{w.cta} →</p>
              </Link>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-white/10 bg-[#101314] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Today’s team actions</h2>
            <Link href="/workbench/actions" className="text-xs text-accent-admin hover:underline">
              View all
            </Link>
          </div>
          <ol className="mt-5 space-y-5">
            {MOCK_TEAM_ACTIONS.map((item) => {
              const tone = TEAM_ACTION_STATE_STYLE[item.state];
              return (
                <li key={item.n} className="border-b border-white/10 pb-5 last:border-0 last:pb-0">
                  <Link
                    href={teamActionPath(item.id)}
                    aria-label={`${item.action} — ${item.account}`}
                    className="flex gap-3 rounded-lg transition hover:bg-white/[0.03]"
                  >
                    <span
                      className={`inline-flex h-6 shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-bold tabular-nums ${tone.mark}`}
                    >
                      {item.n}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.action}</p>
                      <p className={`mt-1 text-sm ${tone.account}`}>{item.account}</p>
                      <p
                        className={`mt-2 inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone.badge}`}
                      >
                        {item.state}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#101314]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="font-semibold">Opportunity ranking</h2>
            <p className="mt-1 text-xs text-white/50">
              AI-ranked accounts based on engagement and service potential.
            </p>
          </div>
          <Link href="/workbench/customers" className="text-xs text-accent-admin hover:underline">
            View full list →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-[0.16em] text-white/45">
              <tr>
                <th className="px-5 py-3">Account</th>
                <th className="px-5 py-3">Engagement signal</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Priority</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((row) => (
                <tr
                  key={row.account}
                  role="link"
                  tabIndex={0}
                  className="cursor-pointer border-t border-white/10 transition hover:bg-white/[0.03]"
                  onClick={() => router.push(row.href)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(row.href);
                    }
                  }}
                >
                  <td className="px-5 py-4">
                    <p className="font-medium">{row.account}</p>
                    <p className="mt-0.5 text-xs text-white/45">{row.need}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <SignalIcon kind={row.signalKind} />
                      <div>
                        <p className="font-medium">{row.signal}</p>
                        <p className="mt-0.5 text-xs text-white/45">{row.signalDetail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[10px] font-semibold text-accent-titanium">
                        {row.initials}
                      </span>
                      <span className="text-white/80">{row.owner}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <PriorityBadge priority={row.priority} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
