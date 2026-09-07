"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";

type Template = {
  id: string;
  name: string;
  slug: string;
  subject: string;
  preheader: string | null;
  body_md: string;
  body_html: string | null;
  from_name: string | null;
  reply_to: string | null;
  tags: string[];
};

type Preview = { subject: string; html: string; text: string };

const emptyForm = {
  name: "",
  slug: "",
  subject: "",
  preheader: "",
  body_md: "",
  body_html: "",
  from_name: "",
  reply_to: "",
  tags: "",
};

export default function AdminTemplatesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetchWithAuth<Template[]>("/api/v1/workbench/templates", t);
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || null,
      subject: form.subject.trim(),
      preheader: form.preheader.trim() || null,
      body_md: form.body_md,
      body_html: form.body_html.trim() || null,
      from_name: form.from_name.trim() || null,
      reply_to: form.reply_to.trim() || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    try {
      if (editingId) {
        await apiFetchWithAuth(`/api/v1/workbench/templates/${editingId}`, token, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetchWithAuth("/api/v1/workbench/templates", token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setForm(emptyForm);
      setEditingId(null);
      setPreview(null);
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Save failed");
    }
  }

  function startEdit(t: Template) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      slug: t.slug,
      subject: t.subject,
      preheader: t.preheader ?? "",
      body_md: t.body_md,
      body_html: t.body_html ?? "",
      from_name: t.from_name ?? "",
      reply_to: t.reply_to ?? "",
      tags: t.tags.join(", "),
    });
    setPreview(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id: string) {
    if (!token || !confirm("Delete template?")) return;
    try {
      await apiFetchWithAuth(`/api/v1/workbench/templates/${id}`, token, { method: "DELETE" });
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Delete failed");
    }
  }

  async function runPreview(id: string) {
    if (!token) return;
    try {
      const p = await apiFetchWithAuth<Preview>(
        `/api/v1/workbench/templates/${id}/preview`,
        token,
        { method: "POST", body: JSON.stringify({ sample: {} }) },
      );
      setPreview(p);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (err) {
      setError(
        err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Preview failed",
      );
    }
  }

  return (
    <>
      <WorkbenchPageHeader
        eyebrow="Email"
        title="Templates"
        description={
          <>
            Reusable email templates for campaigns. Use{" "}
            <code>{`{{ name }}`}</code>, <code>{`{{ first_name }}`}</code>,{" "}
            <code>{`{{ company }}`}</code>, <code>{`{{ email }}`}</code>,{" "}
            <code>{`{{ phone }}`}</code>, <code>{`{{ role }}`}</code>,{" "}
            <code>{`{{ website }}`}</code> placeholders.
          </>
        }
      />

      <div className="mt-10 rounded-xl border border-white/10 bg-background-card p-6">
        <h2 className="text-lg font-semibold">
          {editingId ? "Edit template" : "Create template"}
        </h2>
        <form onSubmit={(e) => void save(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-text-muted">Name *</span>
            <input
              required
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-muted">Slug</span>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="auto from name"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-text-muted">Subject *</span>
            <input
              required
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-text-muted">Preheader</span>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.preheader}
              onChange={(e) => setForm((f) => ({ ...f, preheader: e.target.value }))}
              placeholder="preview line shown in inbox"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-text-muted">Body (Markdown)</span>
            <textarea
              className="mt-1 min-h-[180px] w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs"
              value={form.body_md}
              onChange={(e) => setForm((f) => ({ ...f, body_md: e.target.value }))}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-text-muted">Body (HTML — optional override)</span>
            <textarea
              className="mt-1 min-h-[140px] w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs"
              value={form.body_html}
              onChange={(e) => setForm((f) => ({ ...f, body_html: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-muted">From name</span>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.from_name}
              onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-muted">Reply-to</span>
            <input
              type="email"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.reply_to}
              onChange={(e) => setForm((f) => ({ ...f, reply_to: e.target.value }))}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-text-muted">Tags (comma separated)</span>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-accent-admin px-6 py-2 text-sm font-semibold text-black"
            >
              {editingId ? "Save changes" : "Create template"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="rounded-lg border border-white/15 px-6 py-2 text-sm font-semibold text-text-secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setPreview(null);
                }}
              >
                Cancel edit
              </button>
            ) : null}
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
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Slug</th>
              <th className="px-4 py-3 font-semibold">Subject</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={4}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={4}>
                  No templates yet.
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-accent-admin">{t.slug}</td>
                  <td className="px-4 py-3 text-text-muted">{t.subject}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="mr-3 text-accent-admin hover:underline"
                      onClick={() => void runPreview(t.id)}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className="mr-3 text-accent-admin hover:underline"
                      onClick={() => startEdit(t)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-red-300 hover:underline"
                      onClick={() => void remove(t.id)}
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

      {preview ? (
        <div className="mt-10 rounded-xl border border-white/10 bg-background-card p-6">
          <h2 className="text-lg font-semibold">Preview</h2>
          <p className="mt-1 text-sm text-text-muted">Subject: {preview.subject}</p>
          <div
            className="prose prose-invert mt-4 max-w-none rounded-md border border-white/10 bg-white/5 p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
          <details className="mt-4 text-xs text-text-muted">
            <summary className="cursor-pointer">Plain text</summary>
            <pre className="mt-2 whitespace-pre-wrap">{preview.text}</pre>
          </details>
        </div>
      ) : null}
    </>
  );
}
