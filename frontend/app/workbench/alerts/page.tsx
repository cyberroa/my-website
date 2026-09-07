"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";

type AlertRow = {
  id: string;
  email: string;
  part_number: string;
  part_name: string;
  active: boolean;
  created_at: string;
  last_notified_at: string | null;
};

export default function AdminAlertsPage() {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchWithAuth<AlertRow[]>("/api/v1/workbench/inventory-alerts", t);
      setRows(data);
    } catch (e) {
      setError(e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) void load(session.access_token);
      else setLoading(false);
    });
  }, [load]);

  return (
    <>
      <WorkbenchPageHeader
        eyebrow="Notifications"
        title="Inventory alerts"
        description="Customers who asked to be emailed when a part becomes available."
      />

      {error ? (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="mt-10 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-background-raised text-text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Part</th>
              <th className="px-4 py-3 font-semibold">Active</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">Last notified</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={5}>
                  No subscriptions yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-accent-admin">{r.part_number}</span>
                    <span className="ml-2 text-text-muted">{r.part_name}</span>
                  </td>
                  <td className="px-4 py-3">{r.active ? "yes" : "no"}</td>
                  <td className="px-4 py-3 text-text-muted">{r.created_at}</td>
                  <td className="px-4 py-3 text-text-muted">{r.last_notified_at ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
