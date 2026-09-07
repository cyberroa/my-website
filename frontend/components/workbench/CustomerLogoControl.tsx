"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from "@/lib/api-workbench";
import { WorkbenchAnchoredFlyout } from "@/components/workbench/WorkbenchAnchoredFlyout";

type CustomerLogoFields = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  website?: string | null;
  logo_url?: string | null;
};

function hostnameForLogo(website: string | null | undefined, email: string) {
  let host: string | null = null;
  if (website) {
    try {
      const url = website.includes("://") ? website : `https://${website}`;
      host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      host = null;
    }
  }
  const consumer = new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com"]);
  if ((!host || consumer.has(host)) && email.includes("@")) {
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    if (domain && !consumer.has(domain)) host = domain;
  }
  return host;
}

export function guessedLogoUrl(website: string | null | undefined, email: string) {
  const host = hostnameForLogo(website, email);
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

function GenericBusinessIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-8 w-8 text-accent-titanium"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="M5 28h22" strokeLinecap="round" />
      <path d="M7 28V12h18v16" strokeLinejoin="round" />
      <path d="M12 12V8h8v4" strokeLinejoin="round" />
      <path d="M16 5.5v5M13.5 8h5" strokeLinecap="round" />
      <path d="M13.5 28v-6h5v6" />
      <path d="M10.5 16.5h2M19.5 16.5h2M10.5 20.5h2M19.5 20.5h2" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  token: string | null;
  customer: CustomerLogoFields;
  onUpdated: (logoUrl: string | null) => void;
};

export function CustomerLogoControl({ token, customer, onUpdated }: Props) {
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displaySrc = customer.logo_url || null;

  useEffect(() => {
    setBroken(false);
  }, [displaySrc]);

  async function patchLogo(logo_url: string) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetchWithAuth<{ logo_url: string | null }>(
        `/api/v1/workbench/customers/${customer.id}`,
        token,
        { method: "PATCH", body: JSON.stringify({ logo_url }) },
      );
      onUpdated(updated.logo_url ?? null);
      setOpen(false);
    } catch (e) {
      setError(e instanceof ApiError ? "Could not save logo" : "Could not save logo");
    } finally {
      setBusy(false);
    }
  }

  async function fetchLogo() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetchWithAuth<{ logo_url: string | null }>(
        `/api/v1/workbench/customers/${customer.id}/logo/fetch`,
        token,
        { method: "POST", body: JSON.stringify({}) },
      );
      onUpdated(updated.logo_url ?? null);
      setOpen(false);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? "Add a company website or work email to fetch a logo"
          : "Fetch failed",
      );
    } finally {
      setBusy(false);
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 180_000) {
      setError("Keep uploads under 180 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      if (!result.startsWith("data:image/")) {
        setError("Use a PNG, JPG, SVG, or WebP image");
        return;
      }
      void patchLogo(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-[#161616] text-sm font-semibold text-accent-titanium transition hover:border-accent-admin/50"
        aria-label="Set company logo"
        title="Set company logo"
        aria-expanded={open}
      >
        {displaySrc && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displaySrc}
            alt=""
            className="h-full w-full object-contain p-1"
            onError={() => setBroken(true)}
          />
        ) : (
          <GenericBusinessIcon />
        )}
      </button>
      <input
        id={fileId}
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <WorkbenchAnchoredFlyout
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        align="left"
        width={288}
        label="Company logo"
      >
        <div className="bg-[#0a0a0a] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
            Company logo
          </p>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              className="w-full rounded-lg bg-[#161616] px-3 py-2.5 text-left text-sm text-white hover:bg-[#1f1f1f] disabled:opacity-50"
              disabled={busy}
              onClick={() => void fetchLogo()}
            >
              Fetch from website / email domain
            </button>
            <button
              type="button"
              className="w-full rounded-lg bg-[#161616] px-3 py-2.5 text-left text-sm text-white hover:bg-[#1f1f1f] disabled:opacity-50"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              Upload from computer
            </button>
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://… image URL"
              className="w-full rounded-lg border border-white/10 bg-[#161616] px-3 py-2 text-sm text-white outline-none focus:border-accent-admin/40"
            />
            <button
              type="button"
              disabled={busy || !urlDraft.trim()}
              className="w-full rounded-lg bg-accent-admin px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
              onClick={() => void patchLogo(urlDraft.trim())}
            >
              Use URL
            </button>
            {customer.logo_url ? (
              <button
                type="button"
                className="w-full rounded-lg bg-[#161616] px-3 py-2.5 text-left text-sm text-accent-alert hover:bg-[#1f1f1f] disabled:opacity-50"
                disabled={busy}
                onClick={() => void patchLogo("")}
              >
                Remove logo
              </button>
            ) : null}
            {error ? <p className="text-xs text-accent-alert">{error}</p> : null}
          </div>
        </div>
      </WorkbenchAnchoredFlyout>
    </>
  );
}
