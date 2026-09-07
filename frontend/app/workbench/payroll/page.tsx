"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WorkbenchPageHeader } from "@/components/ui";
import { WorkbenchSelect } from "@/components/workbench/WorkbenchSelect";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from "@/lib/api-workbench";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import {
  workbenchBtnPrimary,
  workbenchCard,
  workbenchInput,
  workbenchTableHead,
  workbenchTableRow,
  workbenchTableWrap,
} from "@/lib/workbench-ui";

type StaffSummary = {
  staff_id: string;
  display_name: string;
  email: string;
  commission_cents: number;
  hourly_cents: number;
  adhoc_cents: number;
  service_cents: number;
  total_cents: number;
  owed_cents: number;
  paid_cents: number;
  hours_logged: number;
  sales_closed: number;
  support_logs: number;
  service_jobs: number;
};

type PayrollSummary = {
  from: string;
  to: string;
  staff: StaffSummary[];
  weekly_trend: { week_start: string; total_cents: number }[];
};

type StaffRow = { id: string; display_name: string | null; email: string; active: boolean };

type LedgerRow = {
  id: string;
  staff_id: string;
  staff_name: string;
  source_type: string;
  amount_cents: number;
  earned_at: string;
  status: string;
  note: string | null;
};

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function money(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const SERIES = {
  owed: "#2BB4FF",
  commission: "#0076E6",
  hourly: "#7DEAFF",
  service: "#4A9EFF",
  adhoc: "#FFFF84",
  trend: "#2BB4FF",
} as const;

type TipEntry = { name?: string; value?: number; color?: string; dataKey?: string };

function PayrollTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null);
  const total = rows.reduce((sum, p) => sum + Number(p.value || 0), 0);
  const showTotal = rows.length > 1;

  return (
    <div className="min-w-[11.5rem] rounded-lg border border-accent-admin/25 bg-[#12141a]/95 px-3 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((p) => (
          <li key={String(p.dataKey || p.name)} className="flex items-center justify-between gap-4 text-sm">
            <span className="inline-flex items-center gap-2 text-white/75">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: p.color || SERIES.owed }}
              />
              {p.name}
            </span>
            <span className={cn("font-semibold tabular-nums", Number(p.value) ? "text-white" : "text-white/35")}>
              {money(Number(p.value || 0))}
            </span>
          </li>
        ))}
      </ul>
      {showTotal ? (
        <p className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-sm">
          <span className="text-white/50">Total</span>
          <span className="font-semibold tabular-nums text-accent-admin">{money(total)}</span>
        </p>
      ) : null}
    </div>
  );
}

export default function AdminPayrollPage() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<PayrollSummary | null>(null);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [adhocRows, setAdhocRows] = useState<LedgerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [staffId, setStaffId] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async (t: string) => {
    try {
      const [r, staff, ledger] = await Promise.all([
        apiFetchWithAuth<PayrollSummary>("/api/v1/workbench/payroll/summary", t),
        apiFetchWithAuth<StaffRow[]>("/api/v1/workbench/staff", t),
        apiFetchWithAuth<LedgerRow[]>("/api/v1/workbench/payroll/ledger?source_type=adhoc&limit=40", t),
      ]);
      setData(r);
      const active = staff.filter((s) => s.active);
      setStaffList(active);
      setAdhocRows(ledger);
      setStaffId((prev) => prev || active[0]?.id || "");
    } catch (e) {
      setError(e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Payroll load failed (owner or accounting)");
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) void load(session.access_token);
    });
  }, [load]);

  async function submitAdhoc(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !staffId || !description.trim()) return;
    const dollarsNum = Number(amountDollars);
    if (!Number.isFinite(dollarsNum) || dollarsNum === 0) {
      setError("Enter a non-zero amount");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetchWithAuth("/api/v1/workbench/payroll/adhoc", token, {
        method: "POST",
        body: JSON.stringify({
          staff_id: staffId,
          amount_cents: Math.round(dollarsNum * 100),
          description: description.trim(),
        }),
      });
      setAmountDollars("");
      setDescription("");
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Adhoc failed");
    } finally {
      setBusy(false);
    }
  }

  async function voidAdhoc(id: string) {
    if (!token) return;
    setBusy(true);
    try {
      await apiFetchWithAuth(`/api/v1/workbench/payroll/ledger/${id}/void`, token, { method: "POST" });
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Void failed");
    } finally {
      setBusy(false);
    }
  }

  const owedChart =
    data?.staff.map((s) => ({
      name: s.display_name.split(" ")[0] || s.email.split("@")[0],
      owed: s.owed_cents / 100,
      commission: s.commission_cents / 100,
      hourly: s.hourly_cents / 100,
      adhoc: (s.adhoc_cents ?? 0) / 100,
      service: (s.service_cents ?? 0) / 100,
    })) ?? [];

  const trendChart =
    data?.weekly_trend.map((w) => ({
      week: w.week_start.slice(5),
      total: w.total_cents / 100,
    })) ?? [];

  return (
    <div className="space-y-6">
      <WorkbenchPageHeader
        eyebrow="Payroll"
        title="Payroll"
        align="start"
        description="How much to pay each admin — commission, hourly, service, adhoc (bonus / events / reimbursements)."
      />
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <form onSubmit={submitAdhoc} className={cn(workbenchCard, "grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4")}>
        <h2 className="text-sm font-bold text-white sm:col-span-2 lg:col-span-4">Add adhoc pay</h2>
        <WorkbenchSelect
          value={staffId}
          onChange={setStaffId}
          required
          placeholder="Staff…"
          options={[
            { value: "", label: "Staff…" },
            ...staffList.map((s) => ({
              value: s.id,
              label: s.display_name || s.email,
            })),
          ]}
        />
        <input
          type="number"
          step="0.01"
          value={amountDollars}
          onChange={(e) => setAmountDollars(e.target.value)}
          placeholder="Amount ($)"
          className={cn(workbenchInput, "mt-0")}
          required
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (bonus, event, expense…)"
          className={cn(workbenchInput, "mt-0 sm:col-span-2 lg:col-span-1")}
          required
        />
        <button type="submit" disabled={busy || !token} className={cn(workbenchBtnPrimary, "lg:col-span-1")}>
          {busy ? "Saving…" : "Record"}
        </button>
      </form>

      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-text-secondary">
              Period {data.from} → {data.to}
            </p>
            <p className="text-sm text-text-secondary">
              Owed{" "}
              <span className="font-semibold tabular-nums text-accent-admin">
                {dollars(data.staff.reduce((sum, s) => sum + s.owed_cents, 0))}
              </span>
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={cn(workbenchCard, "h-80 p-4")}>
              <h2 className="mb-3 text-sm font-bold text-white">Owed by admin ($)</h2>
              <ResponsiveContainer width="100%" height="88%">
                <BarChart data={owedChart} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis type="number" stroke="#777" tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" width={88} stroke="#777" tick={{ fill: "#bbb", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: "rgba(43,180,255,0.08)" }}
                    content={<PayrollTooltip />}
                  />
                  <Bar dataKey="owed" fill={SERIES.owed} name="Owed" radius={[0, 6, 6, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={cn(workbenchCard, "h-80 p-4")}>
              <h2 className="mb-3 text-sm font-bold text-white">Commission / hourly / service / adhoc ($)</h2>
              <ResponsiveContainer width="100%" height="88%">
                <BarChart data={owedChart} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" stroke="#777" tick={{ fill: "#bbb", fontSize: 12 }} />
                  <YAxis stroke="#777" tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    cursor={{ fill: "rgba(43,180,255,0.08)" }}
                    content={<PayrollTooltip />}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "#bbbbbb", paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar dataKey="commission" stackId="a" fill={SERIES.commission} name="Commission" />
                  <Bar dataKey="hourly" stackId="a" fill={SERIES.hourly} name="Hourly" />
                  <Bar dataKey="service" stackId="a" fill={SERIES.service} name="Service" />
                  <Bar dataKey="adhoc" stackId="a" fill={SERIES.adhoc} name="Adhoc" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={cn(workbenchCard, "h-80 p-4 lg:col-span-2")}>
              <h2 className="mb-3 text-sm font-bold text-white">Weekly payout liability ($)</h2>
              <ResponsiveContainer width="100%" height="88%">
                <LineChart data={trendChart} margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="week" stroke="#777" tick={{ fill: "#bbb", fontSize: 11 }} />
                  <YAxis stroke="#777" tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    cursor={{ stroke: "rgba(43,180,255,0.35)", strokeWidth: 1 }}
                    content={<PayrollTooltip />}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Liability"
                    stroke={SERIES.trend}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: SERIES.trend, stroke: "#7DEAFF", strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: "#7DEAFF", stroke: "#0B3D73", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={workbenchTableWrap}>
            <table className="w-full text-left text-sm">
              <thead className={workbenchTableHead}>
                <tr>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Commission</th>
                  <th className="px-4 py-3">Hourly</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Adhoc</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Owed</th>
                  <th className="px-4 py-3">Sales</th>
                  <th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3">Service jobs</th>
                  <th className="px-4 py-3">Support</th>
                </tr>
              </thead>
              <tbody>
                {data.staff.map((s) => (
                  <tr key={s.staff_id} className={workbenchTableRow}>
                    <td className="px-4 py-3 font-semibold text-white">{s.display_name}</td>
                    <td className="px-4 py-3 tabular-nums">{dollars(s.commission_cents)}</td>
                    <td className="px-4 py-3 tabular-nums">{dollars(s.hourly_cents)}</td>
                    <td className="px-4 py-3 tabular-nums">{dollars(s.service_cents ?? 0)}</td>
                    <td className="px-4 py-3 tabular-nums">{dollars(s.adhoc_cents ?? 0)}</td>
                    <td className="px-4 py-3 tabular-nums">{dollars(s.total_cents)}</td>
                    <td className="px-4 py-3 tabular-nums text-accent-admin">{dollars(s.owed_cents)}</td>
                    <td className="px-4 py-3">{s.sales_closed}</td>
                    <td className="px-4 py-3">{s.hours_logged.toFixed(1)}</td>
                    <td className="px-4 py-3">{s.service_jobs ?? 0}</td>
                    <td className="px-4 py-3">{s.support_logs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={workbenchTableWrap}>
            <h2 className="border-b border-white/10 px-4 py-3 text-sm font-bold text-white">
              Recent adhoc
            </h2>
            <table className="w-full text-left text-sm">
              <thead className={workbenchTableHead}>
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {adhocRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-text-muted" colSpan={6}>
                      No adhoc entries this period.
                    </td>
                  </tr>
                ) : (
                  adhocRows.map((r) => (
                    <tr key={r.id} className={workbenchTableRow}>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {new Date(r.earned_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">{r.staff_name}</td>
                      <td className="px-4 py-3 text-text-secondary">{r.note || "—"}</td>
                      <td className="px-4 py-3 tabular-nums">{dollars(r.amount_cents)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                            r.status === "owed"
                              ? "border-accent-admin/40 bg-accent-admin/10 text-accent-admin"
                              : r.status === "void"
                                ? "border-white/15 text-white/45"
                                : "border-accent-highlight/40 bg-accent-highlight/10 text-accent-highlight",
                          )}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "owed" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void voidAdhoc(r.id)}
                            className="text-xs text-accent-alert hover:underline disabled:opacity-50"
                          >
                            Void
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
