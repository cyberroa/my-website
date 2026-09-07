export function WorkbenchSupabaseSetup() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <p className="font-display text-[11px] uppercase tracking-[0.25em] text-accent-admin">Admin</p>
      <h1 className="mt-3 text-2xl font-bold">Configure Supabase for local admin</h1>
      <p className="mt-4 text-text-secondary">
        Create <code className="text-accent-admin">frontend/.env.local</code> (copy from{" "}
        <code className="text-accent-admin">.env.example</code>) and set:
      </p>
      <ul className="mt-6 list-inside list-disc space-y-2 text-left text-sm text-text-muted">
        <li>
          <code className="text-white">NEXT_PUBLIC_SUPABASE_URL</code> — Supabase → Settings → API → Project URL
        </li>
        <li>
          <code className="text-white">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> — same page → anon public key
        </li>
        <li>
          <code className="text-white">NEXT_PUBLIC_API_URL</code> — must match your API (e.g.{" "}
          <code className="text-white">http://localhost:8080</code> if uvicorn uses port 8080)
        </li>
      </ul>
      <p className="mt-8 text-sm text-text-muted">
        Restart <code className="text-white">npm run dev</code> after saving. Then open{" "}
        <code className="text-white">/workbench/login</code> again.
      </p>
    </div>
  );
}
