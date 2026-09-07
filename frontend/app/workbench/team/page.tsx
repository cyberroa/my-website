"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { WorkbenchSelect } from "@/components/workbench/WorkbenchSelect";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";

type Staff = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  staff_tier: string;
  staff_tier_label: string;
  capabilities: string[];
  effective_capabilities: string[];
  active: boolean;
};

type Policy = { id: string; name: string; version: number };

type RoleOption = { id: string; label: string };

const TIER_OPTIONS: RoleOption[] = [
  { id: "owner", label: "Owner" },
  { id: "admin", label: "Ops lead" },
  { id: "staff", label: "Staff" },
];

const CAP_OPTIONS: RoleOption[] = [
  { id: "marketing", label: "Marketing" },
  { id: "sales", label: "Sales" },
  { id: "support", label: "Support" },
  { id: "accounting", label: "Accounting" },
  { id: "technician", label: "Technician" },
];

export default function AdminTeamPage() {
  const [token, setToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("staff");
  const [caps, setCaps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTier, setEditTier] = useState("staff");
  const [editCaps, setEditCaps] = useState<string[]>([]);

  const load = useCallback(async (t: string) => {
    const [s, p] = await Promise.all([
      apiFetchWithAuth<Staff[]>("/api/v1/workbench/staff", t),
      apiFetchWithAuth<Policy[]>("/api/v1/workbench/pay-policies", t),
    ]);
    setStaff(s);
    setPolicies(p);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) void load(session.access_token).catch(() => undefined);
    });
  }, [load]);

  function toggleCap(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((c) => c !== id) : [...list, id]);
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !email.trim()) return;
    setError(null);
    try {
      await apiFetchWithAuth("/api/v1/workbench/staff", token, {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          staff_tier: tier,
          capabilities: tier === "staff" ? caps : [],
        }),
      });
      setEmail("");
      setCaps([]);
      setTier("staff");
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body) : "Failed");
    }
  }

  async function saveEdit(staffId: string) {
    if (!token) return;
    setError(null);
    try {
      await apiFetchWithAuth(`/api/v1/workbench/staff/${staffId}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          staff_tier: editTier,
          capabilities: editTier === "staff" ? editCaps : [],
        }),
      });
      setEditingId(null);
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body) : "Update failed");
    }
  }

  async function createDefaultPolicy() {
    if (!token) return;
    await apiFetchWithAuth("/api/v1/workbench/pay-policies", token, {
      method: "POST",
      body: JSON.stringify({
        name: "Standard Admin Package",
        is_default: true,
        commission_rate_bps: 500,
        commission_applies_to: "closer",
        hourly_rate_cents: 2500,
        terms_markdown:
          "Commission applies to logged won sales where you are the closer. Hourly rate applies to submitted time entries after acceptance.",
      }),
    });
    await load(token);
  }

  async function assignPolicy(staffId: string, policyId: string) {
    if (!token) return;
    await apiFetchWithAuth(`/api/v1/workbench/staff/${staffId}/pay-assignment`, token, {
      method: "POST",
      body: JSON.stringify({ policy_id: policyId }),
    });
    alert("Pay package assigned — staff must accept under My Pay.");
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <WorkbenchPageHeader
        eyebrow="Team"
        title="Team"
        align="start"
        description="Staff profiles, tiers (Owner / Ops lead / Staff), capabilities, and pay packages."
      />
      {error && <p className="text-sm text-red-300">{error}</p>}

      <form onSubmit={(e) => void addStaff(e)} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-bold text-white">Add staff</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@example.com"
            className="rounded-md border border-white/15 bg-[#121218] px-3 py-2 text-sm text-white"
            required
          />
          <WorkbenchSelect
            value={tier}
            onChange={setTier}
            options={TIER_OPTIONS.map((t) => ({ value: t.id, label: t.label }))}
          />
          <button type="submit" className="rounded-lg bg-accent-admin px-4 py-2 text-sm font-semibold text-black">
            Add staff
          </button>
        </div>
        {tier === "staff" ? (
          <div className="flex flex-wrap gap-3">
            {CAP_OPTIONS.map((c) => (
              <label key={c.id} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={caps.includes(c.id)}
                  onChange={() => toggleCap(caps, c.id, setCaps)}
                />
                {c.label}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted">
            {tier === "owner"
              ? "Owner gets all capabilities automatically."
              : "Ops lead gets marketing, sales, support, and technician (not accounting / team)."}
          </p>
        )}
      </form>

      {!policies.length && token && (
        <button
          type="button"
          onClick={() => void createDefaultPolicy()}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white"
        >
          Create default pay package
        </button>
      )}

      <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
        {staff.map((s) => (
          <li key={s.id} className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-white">{s.display_name || s.email}</p>
                <p className="text-sm text-text-muted">
                  {s.email} · {s.staff_tier_label || s.staff_tier}
                  {s.effective_capabilities?.length
                    ? ` · ${s.effective_capabilities.join(", ")}`
                    : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(editingId === s.id ? null : s.id);
                    setEditTier(s.staff_tier || "staff");
                    setEditCaps(s.capabilities || []);
                  }}
                  className="rounded border border-white/20 px-3 py-1 text-xs font-semibold text-white"
                >
                  {editingId === s.id ? "Cancel" : "Edit roles"}
                </button>
                {policies[0] && (
                  <button
                    type="button"
                    onClick={() => void assignPolicy(s.id, policies[0].id)}
                    className="rounded border border-white/20 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Assign default package
                  </button>
                )}
              </div>
            </div>
            {editingId === s.id ? (
              <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
                <WorkbenchSelect
                  value={editTier}
                  onChange={setEditTier}
                  options={TIER_OPTIONS.map((t) => ({ value: t.id, label: t.label }))}
                />
                {editTier === "staff" ? (
                  <div className="flex flex-wrap gap-3">
                    {CAP_OPTIONS.map((c) => (
                      <label key={c.id} className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <input
                          type="checkbox"
                          checked={editCaps.includes(c.id)}
                          onChange={() => toggleCap(editCaps, c.id, setEditCaps)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void saveEdit(s.id)}
                  className="rounded-lg bg-accent-admin px-3 py-1.5 text-xs font-semibold text-black"
                >
                  Save
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
