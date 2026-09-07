"use client";

import { useEffect, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { apiUploadWithAuth } from '@/lib/api-workbench';
import { createClient } from "@/lib/supabase/client";

type ImportResult = {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
};

export default function AdminImportPage() {
  const [token, setToken] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
    });
  }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const out = await apiUploadWithAuth<ImportResult>(
        "/api/v1/workbench/parts/import",
        token,
        fd,
        { dry_run: dryRun },
      );
      setResult(out);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <WorkbenchPageHeader
        eyebrow="Bulk data"
        title="Import inventory"
        description={
          <p>
            Upload the CSV or Excel template from{" "}
            <code className="text-accent-admin">inventory-templates/</code>. Run a dry run first
            to validate rows.
          </p>
        }
      />

      <form
        onSubmit={(e) => void upload(e)}
        className="mt-10 max-w-xl rounded-xl border border-white/10 bg-background-card p-6"
      >
        <label className="block text-sm">
          <span className="text-text-muted">File (.csv or .xlsx)</span>
          <input
            type="file"
            accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="mt-2 block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          Dry run (validate only)
        </label>
        <button
          type="submit"
          disabled={!file || !token || busy}
          className="mt-6 rounded-lg bg-accent-admin px-6 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          {busy ? "Working…" : "Upload"}
        </button>
      </form>

      {error ? (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-8 rounded-xl border border-white/10 bg-background-raised p-6 text-sm">
          <p>
            Created: <strong>{result.created}</strong> · Updated: <strong>{result.updated}</strong>
          </p>
          {result.errors.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-text-muted">
              {result.errors.map((e) => (
                <li key={`${e.row}-${e.message}`}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-text-muted">No row errors.</p>
          )}
        </div>
      ) : null}
    </>
  );
}
