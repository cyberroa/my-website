"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { WorkbenchSelect } from "@/components/workbench/WorkbenchSelect";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";

type Customer = { id: string; email: string; name: string | null };

type ServiceJob = {
  id: string;
  staff_name: string | null;
  customer_email: string | null;
  job_type: string;
  summary: string;
  hours: number | null;
  part_number: string | null;
  site_notes: string | null;
  scheduled_at: string | null;
  audit_report: string | null;
  follow_up_needed: boolean;
  completed_at: string | null;
  status: string;
};

type Mode = "complete" | "schedule";

const JOB_TYPES = ["repair", "pm", "install", "calibration", "audit", "other"] as const;

export default function AdminServicePage() {
  const [token, setToken] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [scheduled, setScheduled] = useState<ServiceJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("complete");
  const [completingId, setCompletingId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [jobType, setJobType] = useState<string>("repair");
  const [summary, setSummary] = useState("");
  const [hours, setHours] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [siteNotes, setSiteNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [auditReport, setAuditReport] = useState("");
  const [followUpNeeded, setFollowUpNeeded] = useState(false);

  const [completeReport, setCompleteReport] = useState("");
  const [completeSummary, setCompleteSummary] = useState("");
  const [completeHours, setCompleteHours] = useState("");
  const [completeFollowUp, setCompleteFollowUp] = useState(true);

  const load = useCallback(async (t: string) => {
    const [c, j, s] = await Promise.all([
      apiFetchWithAuth<{ items: Customer[] }>("/api/v1/workbench/customers?limit=100", t),
      apiFetchWithAuth<ServiceJob[]>("/api/v1/workbench/service-jobs?limit=50", t),
      apiFetchWithAuth<ServiceJob[]>("/api/v1/workbench/service-jobs?status=scheduled&job_type=audit", t),
    ]);
    setCustomers(c.items);
    setJobs(j.filter((x) => x.status !== "scheduled"));
    setScheduled(s);
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

  const isAudit = jobType === "audit";

  async function submitJob(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !customerId) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "schedule") {
        if (!scheduledAt) {
          setError("Pick a scheduled date/time");
          return;
        }
        await apiFetchWithAuth("/api/v1/workbench/service-jobs", token, {
          method: "POST",
          body: JSON.stringify({
            mode: "schedule",
            customer_id: customerId,
            job_type: "audit",
            scheduled_at: new Date(scheduledAt).toISOString(),
            summary: summary.trim() || "PET/CT audit scheduled",
            part_number: partNumber.trim() || null,
            site_notes: siteNotes.trim() || null,
          }),
        });
      } else {
        if (!summary.trim()) {
          setError("Summary required");
          return;
        }
        if (isAudit && !auditReport.trim()) {
          setError("Audit report required");
          return;
        }
        await apiFetchWithAuth("/api/v1/workbench/service-jobs", token, {
          method: "POST",
          body: JSON.stringify({
            mode: "complete",
            customer_id: customerId,
            job_type: jobType,
            summary: summary.trim(),
            hours: hours ? Number(hours) : null,
            part_number: partNumber.trim() || null,
            site_notes: siteNotes.trim() || null,
            audit_report: isAudit ? auditReport.trim() : null,
            follow_up_needed: isAudit ? followUpNeeded : false,
          }),
        });
      }
      setSummary("");
      setHours("");
      setPartNumber("");
      setSiteNotes("");
      setScheduledAt("");
      setAuditReport("");
      setFollowUpNeeded(false);
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body) : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitScheduledComplete(jobId: string) {
    if (!token || !completeReport.trim()) {
      setError("Audit report required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetchWithAuth(`/api/v1/workbench/service-jobs/${jobId}/complete`, token, {
        method: "POST",
        body: JSON.stringify({
          summary: completeSummary.trim() || "PET/CT audit completed",
          audit_report: completeReport.trim(),
          hours: completeHours ? Number(completeHours) : null,
          follow_up_needed: completeFollowUp,
        }),
      });
      setCompletingId(null);
      setCompleteReport("");
      setCompleteSummary("");
      setCompleteHours("");
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body) : "Complete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <WorkbenchPageHeader
        eyebrow="Field service"
        title="Service jobs"
        align="start"
        description="Log repairs, schedule PET/CT audits, and submit audit reports for follow-on service planning."
      />
      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {(["complete", "schedule"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              if (m === "schedule") setJobType("audit");
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              mode === m
                ? "bg-accent-admin text-black"
                : "border border-white/15 text-text-muted hover:border-white/30"
            }`}
          >
            {m === "complete" ? "Log completed" : "Schedule audit"}
          </button>
        ))}
      </div>

      <form
        onSubmit={submitJob}
        className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 md:grid-cols-2"
      >
        <WorkbenchSelect
          className="md:col-span-2"
          value={customerId}
          onChange={setCustomerId}
          required
          placeholder="Customer site…"
          options={[
            { value: "", label: "Customer site…" },
            ...customers.map((c) => ({
              value: c.id,
              label: `${c.email}${c.name ? ` (${c.name})` : ""}`,
            })),
          ]}
        />

        {mode === "schedule" ? (
          <>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white md:col-span-2"
              required
            />
            <input
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder="Scanner / system ID (optional)"
              className="rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white md:col-span-2"
            />
            <textarea
              value={siteNotes}
              onChange={(e) => setSiteNotes(e.target.value)}
              placeholder="Scheduling notes (access, contact on site…)"
              rows={2}
              className="rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white md:col-span-2"
            />
          </>
        ) : (
          <>
            <WorkbenchSelect
              value={jobType}
              onChange={setJobType}
              options={JOB_TYPES.map((t) => ({ value: t, label: t }))}
            />
            <input
              type="number"
              step="0.25"
              min="0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Hours on site (optional)"
              className="rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white"
            />
            <input
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder="Part / system # (optional)"
              className="rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white md:col-span-2"
            />
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={isAudit ? "Audit scope (e.g. PET/CT quarterly review)" : "What was completed?"}
              rows={2}
              className="rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white md:col-span-2"
              required
            />
            {isAudit ? (
              <>
                <textarea
                  value={auditReport}
                  onChange={(e) => setAuditReport(e.target.value)}
                  placeholder="Audit findings & recommendations (report intake for follow-on services)"
                  rows={5}
                  className="rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white md:col-span-2"
                  required
                />
                <label className="flex items-center gap-2 text-sm text-text-secondary md:col-span-2">
                  <input
                    type="checkbox"
                    checked={followUpNeeded}
                    onChange={(e) => setFollowUpNeeded(e.target.checked)}
                  />
                  Follow-on service recommended
                </label>
              </>
            ) : (
              <textarea
                value={siteNotes}
                onChange={(e) => setSiteNotes(e.target.value)}
                placeholder="Site notes (access, follow-up, etc.)"
                rows={2}
                className="rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white md:col-span-2"
              />
            )}
          </>
        )}

        <button
          type="submit"
          disabled={busy || !token}
          className="rounded-lg bg-accent-admin px-4 py-2 text-sm font-semibold text-black disabled:opacity-50 md:col-span-2 md:justify-self-start"
        >
          {busy ? "Saving…" : mode === "schedule" ? "Schedule audit" : "Log completed job"}
        </button>
      </form>

      {scheduled.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <h2 className="text-sm font-bold text-white">Scheduled PET/CT audits</h2>
          {scheduled.map((j) => (
            <div key={j.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">{j.customer_email}</p>
                  <p className="text-xs text-text-muted">
                    {j.scheduled_at ? new Date(j.scheduled_at).toLocaleString() : "—"} · {j.staff_name}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">{j.summary}</p>
                </div>
                {completingId !== j.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCompletingId(j.id);
                      setCompleteSummary(j.summary);
                      setCompleteFollowUp(true);
                    }}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white hover:border-white/40"
                  >
                    Submit report
                  </button>
                ) : null}
              </div>
              {completingId === j.id ? (
                <div className="mt-4 grid gap-2 border-t border-white/10 pt-4">
                  <textarea
                    value={completeReport}
                    onChange={(e) => setCompleteReport(e.target.value)}
                    placeholder="Audit findings & recommendations"
                    rows={4}
                    className="rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={completeHours}
                    onChange={(e) => setCompleteHours(e.target.value)}
                    placeholder="Hours on site"
                    className="rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white"
                  />
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={completeFollowUp}
                      onChange={(e) => setCompleteFollowUp(e.target.checked)}
                    />
                    Follow-on service recommended
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void submitScheduledComplete(j.id)}
                      className="rounded-lg bg-accent-admin px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                    >
                      Complete audit
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompletingId(null)}
                      className="text-xs text-text-muted hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-text-muted">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Summary</th>
              <th className="px-4 py-3">Follow-up</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={6}>
                  No completed service jobs yet.
                </td>
              </tr>
            ) : (
              jobs.map((j) => (
                <tr key={j.id} className="border-b border-white/5 align-top">
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {j.completed_at ? new Date(j.completed_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">{j.customer_email}</td>
                  <td className="px-4 py-3 capitalize">{j.job_type}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    <div>{j.summary}</div>
                    {j.job_type === "audit" && j.audit_report ? (
                      <p className="mt-1 line-clamp-2 text-xs text-text-muted">{j.audit_report}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{j.follow_up_needed ? "Yes" : "—"}</td>
                  <td className="px-4 py-3">{j.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
