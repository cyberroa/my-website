"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WorkbenchPageHeader } from "@/components/ui";
import { WorkbenchSelect } from "@/components/workbench/WorkbenchSelect";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from "@/lib/api-workbench";
import { createClient } from "@/lib/supabase/client";

type Conversion = {
  id: string;
  customer_email: string | null;
  amount_cents: number;
  closed_at: string;
  status: string;
  source_type: string | null;
  source_id: string | null;
  closer_staff_id: string | null;
  lead_owner_staff_id: string | null;
};

type Customer = { id: string; email: string; name: string | null };
type Staff = { id: string; email: string; display_name: string | null };
type EngagementOpt = {
  id: string;
  summary: string;
  channel: string;
  outcome: string;
  occurred_at: string | null;
};
type CampaignOpt = { campaign_id: string; campaign_name: string; recipient_id: string };

export default function AdminSalesPage() {
  return (
    <Suspense fallback={<main className="px-6 py-8 text-sm text-text-muted">Loading…</main>}>
      <AdminSalesPageInner />
    </Suspense>
  );
}

function AdminSalesPageInner() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<Conversion[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [closerId, setCloserId] = useState("");
  const [leadOwnerId, setLeadOwnerId] = useState("");
  const [sourceType, setSourceType] = useState<"" | "campaign" | "engagement">("");
  const [sourceId, setSourceId] = useState("");
  const [engagements, setEngagements] = useState<EngagementOpt[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOpt[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: string) => {
    const [c, conv, team] = await Promise.all([
      apiFetchWithAuth<{ items: Customer[] }>("/api/v1/workbench/customers?limit=100", t),
      apiFetchWithAuth<Conversion[]>("/api/v1/workbench/sales/conversions", t),
      apiFetchWithAuth<Staff[]>("/api/v1/workbench/staff", t).catch(() => [] as Staff[]),
    ]);
    setCustomers(c.items);
    setRows(conv);
    setStaff(Array.isArray(team) ? team : []);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) void load(session.access_token).catch(() => undefined);
    });
  }, [load]);

  useEffect(() => {
    const cid = searchParams.get("customer");
    const eng = searchParams.get("engagement");
    const amt = searchParams.get("amount");
    if (cid) setCustomerId(cid);
    if (eng) {
      setSourceType("engagement");
      setSourceId(eng);
    }
    if (amt) setAmount(amt);
  }, [searchParams]);

  useEffect(() => {
    if (!token || !customerId) {
      setEngagements([]);
      setCampaigns([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const [eng, timeline] = await Promise.all([
          apiFetchWithAuth<{ items: EngagementOpt[] }>(
            `/api/v1/workbench/customers/${customerId}/engagements?limit=20`,
            token,
          ),
          apiFetchWithAuth<{
            items: { kind: string; data?: { campaign_id?: string }; label: string }[];
          }>(`/api/v1/workbench/customers/${customerId}/timeline`, token).catch(() => ({
            items: [],
          })),
        ]);
        if (cancelled) return;
        setEngagements(eng.items || []);
        const camps: CampaignOpt[] = [];
        for (const item of timeline.items || []) {
          if (item.kind.startsWith("campaign:") && item.data?.campaign_id) {
            if (!camps.some((c) => c.campaign_id === item.data!.campaign_id)) {
              camps.push({
                campaign_id: item.data.campaign_id,
                campaign_name: item.label,
                recipient_id: "",
              });
            }
          }
        }
        setCampaigns(camps);
        // Default lead owner from latest engagement staff if present
        const withStaff = (eng.items || []).find((e) => (e as { staff_id?: string }).staff_id);
        if (withStaff && !leadOwnerId) {
          const sid = (withStaff as { staff_id?: string }).staff_id;
          if (sid) setLeadOwnerId(sid);
        }
      } catch {
        if (!cancelled) {
          setEngagements([]);
          setCampaigns([]);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [token, customerId, leadOwnerId]);

  async function logSale(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !customerId || !amount) return;
    const cents = Math.round(parseFloat(amount) * 100);
    try {
      await apiFetchWithAuth("/api/v1/workbench/sales/conversions", token, {
        method: "POST",
        body: JSON.stringify({
          customer_id: customerId,
          amount_cents: cents,
          notes: notes || null,
          status: "won",
          closer_staff_id: closerId || undefined,
          lead_owner_staff_id: leadOwnerId || undefined,
          source_type: sourceType || undefined,
          source_id: sourceId || undefined,
        }),
      });
      setAmount("");
      setNotes("");
      setSourceType("");
      setSourceId("");
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body) : "Failed");
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <WorkbenchPageHeader
        eyebrow="Sales"
        title="Sales"
        align="start"
        description="Log lead → sale conversions with closer / lead-owner attribution for commissions."
      />
      {error && <p className="text-sm text-red-300">{error}</p>}

      <form
        onSubmit={(e) => void logSale(e)}
        className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 md:grid-cols-4"
      >
        <WorkbenchSelect
          className="md:col-span-2"
          value={customerId}
          onChange={setCustomerId}
          required
          placeholder="Select customer…"
          options={[
            { value: "", label: "Select customer…" },
            ...customers.map((c) => ({
              value: c.id,
              label: `${c.email}${c.name ? ` (${c.name})` : ""}`,
            })),
          ]}
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Sale amount ($)"
          className="rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white"
          required
        />
        <button type="submit" className="rounded-lg bg-accent-admin px-4 py-2 text-sm font-semibold text-black">
          Log sale
        </button>

        <WorkbenchSelect
          className="md:col-span-2"
          value={closerId}
          onChange={setCloserId}
          placeholder="Closer (default: you)"
          options={[
            { value: "", label: "Closer (default: you)" },
            ...staff.map((s) => ({
              value: s.id,
              label: s.display_name || s.email,
            })),
          ]}
        />
        <WorkbenchSelect
          className="md:col-span-2"
          value={leadOwnerId}
          onChange={setLeadOwnerId}
          placeholder="Lead owner (optional)"
          options={[
            { value: "", label: "Lead owner (optional)" },
            ...staff.map((s) => ({
              value: s.id,
              label: s.display_name || s.email,
            })),
          ]}
        />

        <WorkbenchSelect
          value={sourceType}
          onChange={(v) => {
            setSourceType(v as "" | "campaign" | "engagement");
            setSourceId("");
          }}
          placeholder="Source type…"
          options={[
            { value: "", label: "Source type…" },
            { value: "engagement", label: "Engagement" },
            { value: "campaign", label: "Campaign" },
          ]}
        />
        <WorkbenchSelect
          className="md:col-span-3"
          value={sourceId}
          onChange={setSourceId}
          disabled={!sourceType}
          placeholder="Select source…"
          options={[
            { value: "", label: "Select source…" },
            ...(sourceType === "engagement"
              ? engagements.map((e) => ({
                  value: e.id,
                  label: `${e.channel}/${e.outcome} — ${e.summary.slice(0, 60)}`,
                }))
              : []),
            ...(sourceType === "campaign"
              ? campaigns.map((c) => ({
                  value: c.campaign_id,
                  label: c.campaign_name,
                }))
              : []),
          ]}
        />

        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white md:col-span-4"
        />
      </form>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-text-muted">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Closed</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="px-4 py-3 text-white">{r.customer_email}</td>
                <td className="px-4 py-3">${(r.amount_cents / 100).toFixed(2)}</td>
                <td className="px-4 py-3 text-text-muted">
                  {r.source_type ? `${r.source_type}` : "—"}
                </td>
                <td className="px-4 py-3">{new Date(r.closed_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
