"use client";

import Link from "next/link";
import { Suspense } from "react";
import { Eyebrow } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env-public";
import { useSearchParams } from "next/navigation";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.4c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.7Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5H1.2v3.1C3.2 21.3 7.3 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.3c-.2-.7-.4-1.4-.4-2.3s.1-1.6.4-2.3V6.6H1.2C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.3.6 4.5 1.7l3.4-3.4C18 1.1 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.6l4 3.1c.9-2.9 3.6-4.9 6.8-4.9Z"
      />
    </svg>
  );
}

function LoginInner() {
  const sp = useSearchParams();
  const err = sp.get("error");
  const supabaseOk = isSupabaseConfigured();

  async function signIn() {
    const supabase = createClient();
    const next = "/workbench";
    // Prefer the current browser origin for local OAuth so we never bounce to
    // production Site URL when NEXT_PUBLIC_SITE_URL points at Vercel.
    const envSite = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "";
    const isLocalHost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const site = isLocalHost ? window.location.origin : envSite || window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {!supabaseOk ? (
        <div className="mb-8 max-w-lg rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-100">
          <p className="font-semibold">Supabase env not loaded</p>
          <p className="mt-2 text-amber-100/90">
            Add <code className="text-white">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-white">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="text-white">frontend/.env.local</code>, then restart{" "}
            <code className="text-white">npm run dev</code>.
          </p>
        </div>
      ) : null}
      <Eyebrow tone="admin">Titan Imaging</Eyebrow>
      <h1 className="mt-3 text-3xl font-bold">Workbench sign in</h1>
      <p className="mt-3 max-w-md text-text-secondary">
        Use your Google account. Access is limited to approved staff emails.
      </p>
      {err === "forbidden" ? (
        <p className="mt-6 text-sm text-red-400">This account is not allowed to access the workbench.</p>
      ) : null}
      {err === "auth" ? (
        <p className="mt-6 text-sm text-red-400">Sign-in failed. Please try again.</p>
      ) : null}
      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          disabled={!supabaseOk}
          onClick={() => void signIn()}
          className="inline-flex items-center justify-center gap-2.5 rounded-lg border border-accent-admin bg-[#2a2a30] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#33333a] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <GoogleMark />
          Continue with Google
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-[#2a2a30] px-8 py-3 text-sm font-semibold text-white/70 transition hover:border-white/25 hover:bg-[#33333a] hover:text-white"
        >
          Back to Titan Imaging
        </Link>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginInner />
    </Suspense>
  );
}
