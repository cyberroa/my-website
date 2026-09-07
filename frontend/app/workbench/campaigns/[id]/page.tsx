"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";

type Campaign = {
  id: string;
  name: string;
  template_id: string;
  segment_id: string | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  stats_json: Record<string, unknown>;
  created_at: string;
};

type Recipient = {
  id: string;
  email: string;
  status: string;
  resend_message_id: string | null;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  unsubscribed_at: string | null;
};

type Preview = { subject: string; html: string; text: string };

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [token, setToken] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const [c, r] = await Promise.all([
        apiFetchWithAuth<Campaign>(`/api/v1/workbench/campaigns/${id}`, t),
        apiFetchWithAuth<Recipient[]>(`/api/v1/workbench/campaigns/${id}/recipients`, t),
      ]);
      setCampaign(c);
      setRecipients(r);
    } catch (e) {
      setError(e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) void load(session.access_token);
      else setLoading(false);
    });
  }, [id, load]);

  async function runPreview() {
    if (!token || !id) return;
    try {
      const p = await apiFetchWithAuth<Preview>(
        `/api/v1/workbench/campaigns/${id}/preview`,
        token,
        { method: "POST", body: JSON.stringify({ sample: {} }) },
      );
      setPreview(p);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Preview failed");
    }
  }

  const summary = campaign?.stats_json as Record<string, unknown> | undefined;

  return (
    <>
      <p className="text-sm">
        <Link href="/workbench/campaigns" className="text-accent-admin hover:underline">
          &larr; All campaigns
        </Link>
      </p>

      {loading ? (
        <p className="mt-6 text-text-muted">Loading…</p>
      ) : !campaign ? (
        <p className="mt-6 text-red-200">{error ?? "Not found"}</p>
      ) : (
        <>
          <section className="mt-6">
            <h1 className="text-2xl font-bold md:text-3xl">{campaign.name}</h1>
            <p className="mt-1 text-sm text-text-muted">
              Status: {campaign.status}
              {campaign.sent_at
                ? ` · Sent ${new Date(campaign.sent_at).toLocaleString()}`
                : null}
            </p>
            {summary ? (
              <p className="mt-2 text-xs text-text-muted">
                Audience: {String(summary.audience_total ?? "—")} · Queued:{" "}
                {String(summary.queued ?? "—")} · Sent: {String(summary.sent ?? "—")} · Failed:{" "}
                {String(summary.failed ?? "—")} · Skipped (suppressed):{" "}
                {String(summary.skipped_suppressed ?? "—")}
              </p>
            ) : null}
            <button
              type="button"
              className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-text-secondary hover:border-accent-admin hover:text-accent-admin"
              onClick={() => void runPreview()}
            >
              Preview email
            </button>
          </section>

          {preview ? (
            <div className="mt-6 rounded-xl border border-white/10 bg-background-card p-6">
              <h2 className="text-lg font-semibold">Preview</h2>
              <p className="mt-1 text-sm text-text-muted">Subject: {preview.subject}</p>
              <div
                className="prose prose-invert mt-4 max-w-none rounded-md border border-white/10 bg-white/5 p-4 text-sm"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>
          ) : null}

          <div className="mt-8 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-background-raised text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Sent</th>
                  <th className="px-4 py-3 font-semibold">Opened</th>
                  <th className="px-4 py-3 font-semibold">Clicked</th>
                  <th className="px-4 py-3 font-semibold">Bounced</th>
                  <th className="px-4 py-3 font-semibold">Unsub</th>
                </tr>
              </thead>
              <tbody>
                {recipients.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-text-muted" colSpan={7}>
                      No recipients yet.
                    </td>
                  </tr>
                ) : (
                  recipients.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">{r.email}</td>
                      <td className="px-4 py-3 text-text-muted">{r.status}</td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {r.sent_at ? new Date(r.sent_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {r.opened_at ? "✓" : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {r.clicked_at ? "✓" : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {r.bounced_at ? "✓" : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {r.unsubscribed_at ? "✓" : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
