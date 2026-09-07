"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { WorkbenchSelect } from "@/components/workbench/WorkbenchSelect";
import { ApiError, apiFetch, type ApiCategory, type ApiPart } from "@/lib/api";
import { apiFetchWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";

const emptyForm = {
  part_number: "",
  name: "",
  description: "",
  category_slug: "",
  stock_quantity: "0",
  price: "",
  status: "in_stock",
};

export default function AdminPartsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [parts, setParts] = useState<ApiPart[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([
        apiFetchWithAuth<ApiPart[]>("/api/v1/workbench/parts?limit=500", t),
        apiFetch<ApiCategory[]>("/api/v1/categories"),
      ]);
      setParts(p);
      setCategories(c);
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

  async function savePart(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    const payload = {
      part_number: form.part_number.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      category_slug: form.category_slug.trim() || null,
      stock_quantity: Number(form.stock_quantity || 0),
      price: form.price.trim() ? Number(form.price) : null,
      status: form.status.trim() || "in_stock",
    };
    try {
      if (editingId) {
        await apiFetchWithAuth<ApiPart>(`/api/v1/workbench/parts/${editingId}`, token, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetchWithAuth<ApiPart>("/api/v1/workbench/parts", token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setForm(emptyForm);
      setEditingId(null);
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Save failed");
    }
  }

  async function removePart(id: string) {
    if (!token || !confirm("Delete this part?")) return;
    try {
      await apiFetchWithAuth<{ ok: boolean }>(`/api/v1/workbench/parts/${id}`, token, {
        method: "DELETE",
      });
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Delete failed");
    }
  }

  function startEdit(p: ApiPart) {
    setEditingId(p.id);
    setForm({
      part_number: p.part_number,
      name: p.name,
      description: p.description ?? "",
      category_slug: p.category ?? "",
      stock_quantity: String(p.stock_quantity),
      price: p.price != null ? String(p.price) : "",
      status: p.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <WorkbenchPageHeader
        eyebrow="Inventory"
        title="Parts"
        description="Create, update, or remove parts. Changes sync to the public inventory API."
      />

      <div className="mt-10 rounded-xl border border-white/10 bg-background-card p-6">
        <h2 className="text-lg font-semibold">{editingId ? "Edit part" : "Add part"}</h2>
        <form onSubmit={(e) => void savePart(e)} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-text-muted">Part number *</span>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.part_number}
              onChange={(e) => setForm((f) => ({ ...f, part_number: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-muted">Name *</span>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-text-muted">Description</span>
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-muted">Category slug</span>
            <WorkbenchSelect
              className="mt-1"
              value={form.category_slug}
              onChange={(category_slug) => setForm((f) => ({ ...f, category_slug }))}
              placeholder="—"
              options={[
                { value: "", label: "—" },
                ...categories.map((c) => ({
                  value: c.slug,
                  label: `${c.name} (${c.slug})`,
                })),
              ]}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-muted">Status</span>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-muted">Stock qty</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.stock_quantity}
              onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-muted">Price</span>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="optional"
            />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-accent-admin px-6 py-2 text-sm font-semibold text-black"
            >
              {editingId ? "Save changes" : "Create part"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="rounded-lg border border-white/15 px-6 py-2 text-sm font-semibold text-text-secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
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

      <div className="mt-10 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-background-raised text-text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Part #</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Cat</th>
              <th className="px-4 py-3 font-semibold">Stock</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : parts.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={6}>
                  No parts yet.
                </td>
              </tr>
            ) : (
              parts.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-xs text-accent-admin">{p.part_number}</td>
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 text-text-muted">{p.category ?? "—"}</td>
                  <td className="px-4 py-3">{p.stock_quantity}</td>
                  <td className="px-4 py-3 text-text-muted">{p.status}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="mr-3 text-accent-admin hover:underline"
                      onClick={() => startEdit(p)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-red-300 hover:underline"
                      onClick={() => void removePart(p.id)}
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
