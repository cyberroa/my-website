"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkbenchPageHeader } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from "@/lib/api-workbench";
import { createClient } from "@/lib/supabase/client";

type MeResponse = {
  staff_tier?: string;
  staff: {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    staff_tier?: string;
  };
  pending_assignment: {
    id: string;
    status: string;
    policy: { name: string; terms_markdown: string; commission_rate_bps: number; hourly_rate_cents: number };
  } | null;
  active_assignment: { id: string; accepted_at: string | null; status: string } | null;
};

export default function MyPayPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) {
        apiFetchWithAuth<MeResponse>("/api/v1/workbench/staff/me", session.access_token)
          .then((data) => {
            const tier = data.staff_tier || data.staff?.staff_tier || "";
            if (tier === "owner") {
              router.replace("/workbench/team");
              return;
            }
            setMe(data);
          })
          .catch((e) => setError(e instanceof ApiError ? String(e.message) : "Failed"));
      }
    });
  }, [router]);

  async function accept() {
    if (!token || !me?.pending_assignment) return;
    await apiFetchWithAuth("/api/v1/workbench/staff/me/pay-assignment/accept", token, {
      method: "POST",
      body: JSON.stringify({ assignment_id: me.pending_assignment.id }),
    });
    const updated = await apiFetchWithAuth<MeResponse>("/api/v1/workbench/staff/me", token);
    setMe(updated);
  }

  const policy = me?.pending_assignment?.policy;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <WorkbenchPageHeader eyebrow="Pay" title="My Pay" align="start" description="Review and accept your commission and hourly terms." />
      {error && <p className="text-sm text-red-300">{error}</p>}

      {me?.active_assignment?.accepted_at && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Terms accepted on {new Date(me.active_assignment.accepted_at).toLocaleDateString()}.
        </div>
      )}

      {policy && me?.pending_assignment && (
        <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="font-display text-lg font-bold text-white">{policy.name}</h2>
          <p className="text-sm text-text-secondary">
            Commission: {(policy.commission_rate_bps / 100).toFixed(1)}% · Hourly: $
            {(policy.hourly_rate_cents / 100).toFixed(2)}
          </p>
          <pre className="whitespace-pre-wrap rounded bg-black/30 p-4 text-sm text-text-secondary">
            {policy.terms_markdown || "Standard Titan Imaging admin compensation terms apply."}
          </pre>
          <button
            type="button"
            onClick={() => void accept()}
            className="rounded-lg bg-accent-admin px-4 py-2 text-sm font-semibold text-black"
          >
            I accept these terms
          </button>
        </section>
      )}

      {!policy && !me?.active_assignment && (
        <p className="text-sm text-text-muted">No pay package assigned yet. Ask the owner to assign one under Team.</p>
      )}
    </main>
  );
}
