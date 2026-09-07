"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from "@/lib/api-workbench";
import { createClient } from "@/lib/supabase/client";

type Item = {
  id: string;
  staff_email: string;
  message: string;
  page_path: string | null;
  created_at: string;
  read_at: string | null;
};

export default function StaffFeedbackPage() {
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: string) => {
    const list = await apiFetchWithAuth<Item[]>("/api/v1/workbench/help/feedback", t);
    setRows(list);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) {
        void load(session.access_token).catch((e) => {
          setError(e instanceof ApiError ? "Owner or ops lead access required" : "Failed to load");
        });
      }
    });
  }, [load]);

  async function markRead(id: string) {
    if (!token) return;
    const updated = await apiFetchWithAuth<Item>(
      `/api/v1/workbench/help/feedback/${id}/read`,
      token,
      { method: "PATCH" },
    );
    setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }

  return (
    <div className="space-y-8">
      <WorkbenchPageHeader
        eyebrow="Team"
        title="Staff feedback"
        align="start"
        description="Messages sent from the ? help flyout. Visible to owners and ops leads."
      />
      {error ? <p className="text-sm text-accent-alert">{error}</p> : null}
      {rows.length === 0 && !error ? (
        <p className="text-sm text-text-muted">No feedback yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-white/12 bg-[#0a0a0a] p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-white">{r.staff_email}</p>
                <p className="text-xs text-white/45">
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              {r.page_path ? (
                <p className="mt-1 text-xs text-white/45">{r.page_path}</p>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-sm text-white/90">{r.message}</p>
              {r.read_at ? (
                <p className="mt-2 text-xs text-white/35">Read</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void markRead(r.id)}
                  className="mt-3 text-xs font-semibold text-accent-admin hover:underline"
                >
                  Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
