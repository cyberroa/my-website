"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";

type SocialPost = {
  id: string;
  channel: string;
  body: string;
  link_url: string | null;
  first_comment: string | null;
  image_url: string | null;
  status: string;
  external_id: string | null;
  error: string | null;
  scheduled_at: string | null;
  posted_at: string | null;
  created_at: string;
};

const emptyForm = {
  body: "",
  link_url: "",
  first_comment: "",
  image_url: "",
  scheduled_at: "",
};

export default function AdminSocialPage() {
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetchWithAuth<SocialPost[]>("/api/v1/workbench/social/posts", t);
      setRows(r);
    } catch (e) {
      setError(e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) void load(session.access_token);
      else setLoading(false);
    });
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetchWithAuth("/api/v1/workbench/social/posts", token, {
        method: "POST",
        body: JSON.stringify({
          body: form.body.trim(),
          link_url: form.link_url.trim() || null,
          first_comment: form.first_comment.trim() || null,
          image_url: form.image_url.trim() || null,
          scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        }),
      });
      setForm(emptyForm);
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Send failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!token || !confirm("Delete this social post record?")) return;
    try {
      await apiFetchWithAuth(`/api/v1/workbench/social/posts/${id}`, token, { method: "DELETE" });
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Delete failed");
    }
  }

  const charCount = form.body.length;
  const maxChars = 3000;

  return (
    <>
      <WorkbenchPageHeader
        eyebrow="Social"
        title="LinkedIn composer"
        description={
          <>
            Posts are sent to a Make scenario that publishes to Titan Imaging&apos;s LinkedIn Page.
            See <code>docs/phase4a-make-setup.md</code> to configure the webhook.
          </>
        }
      />

      <div className="mt-10 rounded-xl border border-white/10 bg-background-card p-6">
        <h2 className="text-lg font-semibold">New post</h2>
        <form onSubmit={(e) => void submit(e)} className="mt-4 grid gap-3">
          <label className="block text-sm">
            <span className="text-text-muted">Body *</span>
            <textarea
              required
              className="mt-1 min-h-[160px] w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              maxLength={maxChars}
            />
            <span
              className={`mt-1 block text-right text-xs ${
                charCount > maxChars - 200 ? "text-amber-300" : "text-text-muted"
              }`}
            >
              {charCount} / {maxChars}
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-text-muted">Link URL</span>
            <input
              type="url"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.link_url}
              onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
              placeholder="https://titanimaging.com/inventory/..."
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-muted">First comment (posted as follow-up to beat link demotion)</span>
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.first_comment}
              onChange={(e) => setForm((f) => ({ ...f, first_comment: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-muted">Image URL (optional)</span>
            <input
              type="url"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-muted">Schedule (optional)</span>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.scheduled_at}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
            />
          </label>
          <div>
            <button
              type="submit"
              disabled={submitting || !form.body.trim()}
              className="rounded-lg bg-accent-admin px-6 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {submitting ? "Sending to Make…" : "Send to Make"}
            </button>
          </div>
        </form>
      </div>

      {error ? (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="mt-8 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-background-raised text-text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">Body</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">External</th>
              <th className="px-4 py-3 font-semibold" />
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
                  No posts yet.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {new Date(p.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 max-w-md truncate" title={p.body}>
                    {p.body}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {p.status}
                    {p.error ? (
                      <span className="block text-xs text-red-300">{p.error}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{p.external_id ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-red-300 hover:underline"
                      onClick={() => void remove(p.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
