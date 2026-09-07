"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from '@/lib/api-workbench';
import {
  MARKETING_DESIGN_PRESETS,
  getDesignPreset,
  type MarketingDesignPreset,
} from "@/lib/design-presets";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

type AiStatus = {
  enabled: boolean;
  configured: boolean;
  models: Record<string, string>;
  gemini_configured: boolean;
  allowed_models: string[];
};

type Preset = {
  id: string;
  name: string;
  slug: string;
  category: string;
  system_prompt: string;
  user_prompt_template: string;
};

type Run = {
  id: string;
  model: string;
  user_prompt: string;
  output_text: string | null;
  output_image_url: string | null;
  created_at: string;
};

type Mode = "text" | "image";

const SUGGESTIONS = [
  "Warm-lead nurture email for a hospital GE PET/CT parts inquiry",
  "LinkedIn post: back-in-stock CT tube inventory",
  "Outreach email for a sell-to-us equipment evaluation",
  "Campaign subject + body for consent-ready nurture segment",
];

function shortModelLabel(id: string): string {
  const last = id.split("/").pop() || id;
  return last.length > 22 ? `${last.slice(0, 20)}…` : last;
}

function IconSparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2.5 13.2 8l5.8 1.2L13.2 10.4 12 16l-1.2-5.6L5 9.2 10.8 8 12 2.5Zm7 9.5 0.7 3.2 3.3.7-3.3.7-.7 3.2-.7-3.2-3.3-.7 3.3-.7.7-3.2Z" />
    </svg>
  );
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0 6 6M12 5l-6 6" />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={cn("h-3 w-3 opacity-70 transition-transform", open && "rotate-180")}
      fill="currentColor"
      aria-hidden
    >
      <path d="M2.2 4.2 6 8l3.8-3.8-.9-.9L6 6.2 3.1 3.3z" />
    </svg>
  );
}

function IconPalette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3.5c-4.7 0-8.5 3.4-8.5 7.6 0 2.6 1.5 4.9 3.8 6.2.4.2.7-.1.7-.5v-1.4c0-1.5 1.2-2.7 2.7-2.7h2.1c3.5 0 6.4-2.6 6.4-5.8C19.2 5.2 16 3.5 12 3.5Z"
      />
      <circle cx="8.2" cy="9.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="7.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="8.6" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.2" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconDoc({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 3.5h5.5L18 8v12.5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
      />
      <path strokeLinecap="round" d="M13.5 3.5V8H18M9.5 12h5M9.5 15.5h5" />
    </svg>
  );
}

function IconBookmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1V19l-6-3.5L6 19V4.5Z"
      />
    </svg>
  );
}

export default function AdminAiStudioPage() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoteName, setPromoteName] = useState("AI Draft");
  const [contextSegmentId, setContextSegmentId] = useState("");
  const [contextCustomerId, setContextCustomerId] = useState("");
  const [mode, setMode] = useState<Mode>("text");
  const [modelOpen, setModelOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [savePresetName, setSavePresetName] = useState("");
  const [savePresetCategory, setSavePresetCategory] = useState("general");
  const [designPresetId, setDesignPresetId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const modelMenuId = useId();
  const designMenuId = useId();
  const presetsMenuId = useId();
  const modelRef = useRef<HTMLDivElement>(null);
  const designRef = useRef<HTMLDivElement>(null);
  const presetsRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (t: string) => {
    try {
      const [st, pr, rn] = await Promise.all([
        apiFetchWithAuth<AiStatus>("/api/v1/workbench/ai/status", t),
        apiFetchWithAuth<Preset[]>("/api/v1/workbench/ai/prompts", t),
        apiFetchWithAuth<Run[]>("/api/v1/workbench/ai/studio/runs", t),
      ]);
      setStatus(st);
      setPresets(pr);
      setRuns(rn);
      setModel((prev) => prev || st.allowed_models[0] || st.models?.default || "");
    } catch (e) {
      setError(e instanceof ApiError ? String(e.message) : "Failed to load AI Studio");
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) void load(session.access_token);
    });
  }, [load]);

  useEffect(() => {
    if (!modelOpen && !designOpen && !presetsOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (modelOpen && modelRef.current && !modelRef.current.contains(t)) {
        setModelOpen(false);
      }
      if (designOpen && designRef.current && !designRef.current.contains(t)) {
        setDesignOpen(false);
      }
      if (presetsOpen && presetsRef.current && !presetsRef.current.contains(t)) {
        setPresetsOpen(false);
        setSavePresetOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModelOpen(false);
        setDesignOpen(false);
        setPresetsOpen(false);
        setSavePresetOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [modelOpen, designOpen, presetsOpen]);

  async function seedPresets() {
    if (!token) return;
    await apiFetchWithAuth("/api/v1/workbench/ai/prompts/seed", token, { method: "POST" });
    await load(token);
  }

  function openSavePresetForm() {
    const active = presets.find((p) => p.id === activePresetId);
    setSavePresetName(active?.name ?? (promoteName.trim() || "My prompt"));
    setSavePresetCategory(active?.category ?? "general");
    setSavePresetOpen(true);
  }

  async function saveCurrentPreset(asNew: boolean) {
    if (!token) return;
    const name = savePresetName.trim();
    if (!name) {
      setError("Preset name is required");
      return;
    }
    if (!userPrompt.trim() && !systemPrompt.trim()) {
      setError("Add a user or system prompt before saving");
      return;
    }
    setError(null);
    try {
      if (activePresetId && !asNew) {
        await apiFetchWithAuth(`/api/v1/workbench/ai/prompts/${activePresetId}`, token, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            category: savePresetCategory,
            system_prompt: systemPrompt,
            user_prompt_template: userPrompt,
          }),
        });
      } else {
        const res = await apiFetchWithAuth<{ id: string }>("/api/v1/workbench/ai/prompts", token, {
          method: "POST",
          body: JSON.stringify({
            name,
            category: savePresetCategory,
            system_prompt: systemPrompt,
            user_prompt_template: userPrompt,
          }),
        });
        setActivePresetId(res.id);
      }
      setSavePresetOpen(false);
      setPresetsOpen(false);
      await load(token);
    } catch (e) {
      setError(e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Save failed");
    }
  }

  async function deletePreset(id: string) {
    if (!token || !confirm("Delete this saved prompt?")) return;
    try {
      await apiFetchWithAuth(`/api/v1/workbench/ai/prompts/${id}`, token, { method: "DELETE" });
      if (activePresetId === id) setActivePresetId(null);
      await load(token);
    } catch (e) {
      setError(e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Delete failed");
    }
  }

  function applyPreset(p: Preset) {
    setActivePresetId(p.id);
    setSystemPrompt(p.system_prompt);
    setUserPrompt(p.user_prompt_template);
    setShowSystem(Boolean(p.system_prompt?.trim()));
    setDesignPresetId(null);
    setPresetsOpen(false);
    textareaRef.current?.focus();
  }

  function applyDesignPreset(p: MarketingDesignPreset) {
    setDesignPresetId(p.id);
    setSystemPrompt(p.systemPrompt);
    setShowSystem(true);
    setDesignOpen(false);
    textareaRef.current?.focus();
  }

  function startWithDesignMd() {
    applyDesignPreset(MARKETING_DESIGN_PRESETS[0]);
  }

  function clearDesignPreset() {
    setDesignPresetId(null);
    setSystemPrompt("");
    setShowSystem(false);
    setDesignOpen(false);
  }

  function blankProject() {
    setSystemPrompt("");
    setUserPrompt("");
    setOutput("");
    setImageUrl(null);
    setShowSystem(false);
    setDesignPresetId(null);
    setActivePresetId(null);
    setPromoteName("AI Draft");
    textareaRef.current?.focus();
  }

  async function runGenerate() {
    if (!token || !userPrompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "image") {
        const res = await apiFetchWithAuth<{ output_image_url: string }>(
          "/api/v1/workbench/ai/studio/image",
          token,
          { method: "POST", body: JSON.stringify({ prompt: userPrompt }) },
        );
        setImageUrl(res.output_image_url);
        setOutput("");
      } else {
        const res = await apiFetchWithAuth<{ output_text: string }>(
          "/api/v1/workbench/ai/studio/complete",
          token,
          {
            method: "POST",
            body: JSON.stringify({
              model,
              system: systemPrompt,
              user: userPrompt,
              context: {
                ...(contextSegmentId.trim() ? { segment_id: contextSegmentId.trim() } : {}),
                ...(contextCustomerId.trim() ? { customer_id: contextCustomerId.trim() } : {}),
              },
            }),
          },
        );
        setOutput(res.output_text);
      }
      await load(token);
    } catch (e) {
      setError(e instanceof ApiError ? JSON.stringify(e.body ?? e.message) : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function promote(target: "template" | "social" | "campaign") {
    if (!token || !output.trim()) return;
    const res = await apiFetchWithAuth<{ type: string; id: string }>(
      "/api/v1/workbench/ai/studio/promote",
      token,
      {
        method: "POST",
        body: JSON.stringify({
          output_text: output,
          target,
          name: promoteName,
          image_url: imageUrl,
          segment_id: contextSegmentId.trim() || undefined,
        }),
      },
    );
    alert(`Created ${res.type}: ${res.id}`);
  }

  const ready = status?.configured;
  const canSend =
    Boolean(token && userPrompt.trim() && !loading) &&
    (mode === "text" ? Boolean(ready) : Boolean(status?.gemini_configured));
  const activeDesign = getDesignPreset(designPresetId);

  const activePreset = presets.find((p) => p.id === activePresetId) ?? null;

  const chipSuggestions =
    presets.length > 0
      ? presets.slice(0, 6).map((p) => ({ key: p.id, label: p.name, onClick: () => applyPreset(p) }))
      : SUGGESTIONS.map((s, i) => ({
          key: `s-${i}`,
          label: s,
          onClick: () => {
            setUserPrompt(s);
            textareaRef.current?.focus();
          },
        }));

  return (
    <div className="-mx-2 flex min-h-[calc(100vh-8rem)] flex-col sm:-mx-0">
      {/* Top bar actions */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0" />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startWithDesignMd}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-white/90 transition hover:bg-white/[0.08]"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Start with your design
          </button>
          <button
            type="button"
            onClick={() => void seedPresets()}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-white/90 transition hover:bg-white/[0.08]"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Seed presets
          </button>
          <button
            type="button"
            onClick={blankProject}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-white/90 transition hover:bg-white/[0.08]"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Blank project
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-1 pb-16 pt-4">
        {!ready && !bannerDismissed && (
          <div className="mb-8 flex w-full max-w-xl items-start gap-3 rounded-full border border-white/10 bg-[#25252b]/90 px-4 py-2.5 text-sm text-white/80 shadow-lg backdrop-blur">
            <span className="min-w-0 flex-1 text-center leading-snug">
              Set <span className="font-semibold text-accent-admin">OPENROUTER_API_KEY</span> on the
              API, then restart — generation activates automatically.
            </span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setBannerDismissed(true)}
              className="shrink-0 rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        <h1 className="mb-10 text-center font-display text-4xl font-bold tracking-tight text-white md:text-5xl">
          Workbench AI Studio
        </h1>

        {/* Composer — Stitch-like shell with papaya gradient edge */}
        <div className="relative w-full">
          <div
            className="rounded-[1.75rem] p-[1px]"
            style={{
              background:
                "linear-gradient(105deg, rgba(255,135,0,0.55) 0%, rgba(255,255,255,0.12) 42%, rgba(255,180,80,0.35) 100%)",
            }}
          >
            <div className="rounded-[1.7rem] bg-[#2a2a30] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
              {showSystem && (
                <div className="border-b border-white/8 px-5 pt-4">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    System prompt
                    {activeDesign ? (
                      <span className="ml-2 font-medium normal-case tracking-normal text-accent-admin">
                        · {activeDesign.name}
                      </span>
                    ) : activePreset ? (
                      <span className="ml-2 font-medium normal-case tracking-normal text-accent-admin">
                        · {activePreset.name}
                      </span>
                    ) : null}
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => {
                      setSystemPrompt(e.target.value);
                      setDesignPresetId(null);
                      setActivePresetId(null);
                    }}
                    rows={3}
                    placeholder="Optional system instructions…"
                    className="mb-3 w-full resize-none rounded-xl bg-black/45 px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/45"
                  />
                </div>
              )}

              <div className="px-5 pt-5">
                <textarea
                  ref={textareaRef}
                  value={userPrompt}
                  onChange={(e) => {
                    setUserPrompt(e.target.value);
                    setActivePresetId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void runGenerate();
                    }
                  }}
                  rows={4}
                  placeholder={
                    mode === "image"
                      ? "Describe the ad or social image to generate…"
                      : "What marketing email, social post, or outreach shall we write?"
                  }
                  className="w-full resize-none rounded-xl bg-black/45 px-3.5 py-3 text-base leading-relaxed text-white outline-none placeholder:text-white/45 md:text-[17px]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 pt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowSystem((v) => !v)}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-full transition",
                      showSystem
                        ? "bg-white text-black"
                        : "text-white/70 hover:bg-white/10 hover:text-white",
                    )}
                    title="Toggle system prompt"
                    aria-pressed={showSystem}
                  >
                    <IconPlus className="h-4 w-4" />
                  </button>

                  <div className="ml-0.5 flex rounded-full bg-black/25 p-0.5">
                    <button
                      type="button"
                      onClick={() => setMode("text")}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-medium transition",
                        mode === "text" ? "bg-white text-black" : "text-white/65 hover:text-white",
                      )}
                    >
                      Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("image")}
                      disabled={!status?.gemini_configured}
                      title={
                        status?.gemini_configured
                          ? "Image generation"
                          : "Set GOOGLE_AI_API_KEY for images"
                      }
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                        mode === "image" ? "bg-white text-black" : "text-white/65 hover:text-white",
                      )}
                    >
                      Image
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="relative" ref={presetsRef}>
                    <button
                      type="button"
                      aria-expanded={presetsOpen}
                      aria-controls={presetsMenuId}
                      title="Saved prompts"
                      onClick={() => {
                        setPresetsOpen((v) => !v);
                        setModelOpen(false);
                        setDesignOpen(false);
                      }}
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
                        activePresetId || presetsOpen
                          ? "border-accent-admin/50 bg-accent-admin/15 text-accent-admin"
                          : "border-white/10 bg-black/20 text-white/80 hover:bg-black/35 hover:text-white",
                      )}
                    >
                      <IconBookmark className="h-4 w-4" />
                    </button>
                    {presetsOpen && (
                      <div
                        id={presetsMenuId}
                        role="dialog"
                        aria-label="Saved prompts"
                        className="absolute bottom-full right-0 z-30 mb-2 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#1e1e24] shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
                      >
                        <div className="border-b border-white/8 px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <IconBookmark className="h-4 w-4 text-accent-admin" />
                            <span className="text-sm font-semibold tracking-wide text-white">
                              Saved prompts
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-white/50">
                            Load a saved system + user prompt, or save what you have in the composer.
                          </p>
                          {!savePresetOpen ? (
                            <button
                              type="button"
                              onClick={openSavePresetForm}
                              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white transition hover:bg-white/[0.1]"
                            >
                              <IconPlus className="h-3.5 w-3.5" />
                              Save current prompt
                            </button>
                          ) : (
                            <div className="mt-3 space-y-2">
                              <input
                                value={savePresetName}
                                onChange={(e) => setSavePresetName(e.target.value)}
                                placeholder="Preset name"
                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                              />
                              <select
                                value={savePresetCategory}
                                onChange={(e) => setSavePresetCategory(e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                              >
                                <option value="general">General</option>
                                <option value="email">Email</option>
                                <option value="social">Social</option>
                                <option value="outreach">Outreach</option>
                              </select>
                              <div className="flex flex-wrap gap-2">
                                {activePresetId ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => void saveCurrentPreset(false)}
                                      className="flex-1 rounded-full bg-accent-admin px-3 py-2 text-sm font-semibold text-black"
                                    >
                                      Update
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void saveCurrentPreset(true)}
                                      className="flex-1 rounded-full border border-white/15 px-3 py-2 text-sm text-white"
                                    >
                                      Save as new
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void saveCurrentPreset(true)}
                                    className="w-full rounded-full bg-accent-admin px-3 py-2 text-sm font-semibold text-black"
                                  >
                                    Save
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSavePresetOpen(false)}
                                  className="w-full text-xs text-white/45 hover:text-white/70"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="max-h-64 overflow-y-auto px-2 py-2">
                          {presets.length === 0 ? (
                            <p className="px-2.5 py-3 text-xs text-white/45">
                              No saved prompts yet. Use <strong>Seed presets</strong> for starters,
                              or save your own.
                            </p>
                          ) : (
                            presets.map((p) => {
                              const selected = p.id === activePresetId;
                              return (
                                <div
                                  key={p.id}
                                  className={cn(
                                    "flex items-start gap-1 rounded-xl px-1 py-1 transition hover:bg-white/5",
                                    selected && "bg-white/[0.06]",
                                  )}
                                >
                                  <button
                                    type="button"
                                    onClick={() => applyPreset(p)}
                                    className="min-w-0 flex-1 px-1.5 py-1.5 text-left"
                                  >
                                    <span className="block text-sm font-semibold text-white">
                                      {p.name}
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-white/45">
                                      {p.category} · {p.user_prompt_template.slice(0, 60)}
                                      {p.user_prompt_template.length > 60 ? "…" : ""}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    title="Delete"
                                    onClick={() => void deletePreset(p.id)}
                                    className="shrink-0 rounded-lg px-2 py-2 text-xs text-white/35 hover:bg-white/5 hover:text-red-300"
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative" ref={designRef}>
                    <button
                      type="button"
                      aria-expanded={designOpen}
                      aria-controls={designMenuId}
                      title="Use Design.md"
                      onClick={() => {
                        setDesignOpen((v) => !v);
                        setModelOpen(false);
                      }}
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
                        designPresetId || designOpen
                          ? "border-accent-admin/50 bg-accent-admin/15 text-accent-admin"
                          : "border-white/10 bg-black/20 text-white/80 hover:bg-black/35 hover:text-white",
                      )}
                    >
                      <IconPalette className="h-4 w-4" />
                    </button>
                    {designOpen && (
                      <div
                        id={designMenuId}
                        role="dialog"
                        aria-label="Design.md marketing presets"
                        className="absolute bottom-full right-0 z-30 mb-2 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#1e1e24] shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
                      >
                        <div className="border-b border-white/8 px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <IconDoc className="h-4 w-4 text-accent-admin" />
                            <span className="text-sm font-semibold tracking-wide text-white">
                              Design.md
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-white/50">
                            Studio uses Design.md for brand voice unless a marketing preset is
                            picked.
                          </p>
                          <button
                            type="button"
                            onClick={startWithDesignMd}
                            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white transition hover:bg-white/[0.1]"
                          >
                            <IconPlus className="h-3.5 w-3.5" />
                            Start with your design
                          </button>
                        </div>

                        <div className="px-2 py-2">
                          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                            Marketing presets
                          </p>
                          {MARKETING_DESIGN_PRESETS.map((p) => {
                            const selected = p.id === designPresetId;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => applyDesignPreset(p)}
                                className={cn(
                                  "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/5",
                                  selected && "bg-white/[0.06]",
                                )}
                              >
                                <span
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-white/15"
                                  style={{ backgroundColor: p.swatch }}
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-semibold text-white">
                                    {p.name}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-white/45">
                                    {p.blurb}
                                  </span>
                                </span>
                                {selected && (
                                  <span className="text-sm text-white" aria-hidden>
                                    ✓
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {designPresetId && (
                            <button
                              type="button"
                              onClick={clearDesignPreset}
                              className="mt-1 w-full rounded-xl px-2.5 py-2 text-left text-xs text-white/45 transition hover:bg-white/5 hover:text-white/70"
                            >
                              Clear design preset
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative" ref={modelRef}>
                    <button
                      type="button"
                      aria-expanded={modelOpen}
                      aria-controls={modelMenuId}
                      onClick={() => {
                        setModelOpen((v) => !v);
                        setDesignOpen(false);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-medium text-white/90 transition hover:bg-black/35"
                    >
                      <IconSparkle className="h-3.5 w-3.5 text-accent-admin" />
                      {shortModelLabel(model || "Model")}
                      <IconChevron open={modelOpen} />
                    </button>
                    {modelOpen && (
                      <div
                        id={modelMenuId}
                        role="listbox"
                        className="absolute bottom-full right-0 z-30 mb-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#1e1e24] py-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
                      >
                        {(status?.allowed_models ?? []).map((m) => {
                          const selected = m === model;
                          return (
                            <button
                              key={m}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => {
                                setModel(m);
                                setModelOpen(false);
                              }}
                              className={cn(
                                "flex w-full items-start gap-2 px-3.5 py-2.5 text-left transition hover:bg-white/5",
                                selected && "bg-white/[0.06]",
                              )}
                            >
                              <IconSparkle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-admin" />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-white">
                                  {shortModelLabel(m)}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-white/45">
                                  {m}
                                </span>
                              </span>
                              {selected && (
                                <span className="text-sm text-white" aria-hidden>
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {!status?.allowed_models?.length && (
                          <p className="px-3.5 py-2 text-sm text-white/50">No models configured</p>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!canSend}
                    onClick={() => void runGenerate()}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-admin text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={loading ? "Generating" : "Generate"}
                  >
                    {loading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    ) : (
                      <IconSend className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Suggestion chips */}
        <div className="mt-6 flex w-full flex-wrap justify-center gap-2">
          {chipSuggestions.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onClick}
              className="max-w-[16rem] truncate rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-left text-sm text-white/75 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
            >
              {c.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-6 w-full rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-center text-sm text-red-100">
            {error}
          </p>
        )}

        <div className="mt-6 grid w-full max-w-xl gap-3 sm:grid-cols-2">
          <label className="block text-left text-xs text-white/50">
            Segment ID (playbook context)
            <input
              value={contextSegmentId}
              onChange={(e) => setContextSegmentId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-accent-admin/40"
              placeholder="UUID from Segments"
            />
          </label>
          <label className="block text-left text-xs text-white/50">
            Customer ID (dossier context)
            <input
              value={contextCustomerId}
              onChange={(e) => setContextCustomerId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-accent-admin/40"
              placeholder="UUID from Customers"
            />
          </label>
        </div>

        {/* Results */}
        {(output || imageUrl) && (
          <section className="mt-12 w-full space-y-4">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#25252b]/80 p-5 shadow-xl backdrop-blur">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-white/70">Output</h2>
                <input
                  value={promoteName}
                  onChange={(e) => setPromoteName(e.target.value)}
                  className="max-w-[12rem] rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-sm text-white outline-none focus:border-accent-admin/40"
                  placeholder="Draft name"
                />
              </div>
              {output && (
                <textarea
                  value={output}
                  onChange={(e) => setOutput(e.target.value)}
                  rows={12}
                  className="w-full resize-y rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm leading-relaxed text-white/90 outline-none focus:border-accent-admin/30"
                />
              )}
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="Generated"
                  className="mt-3 max-h-64 rounded-2xl border border-white/10"
                />
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void promote("template")}
                  disabled={!output.trim()}
                  className="rounded-full border border-accent-admin/45 bg-accent-admin/10 px-4 py-2 text-sm font-semibold text-accent-admin transition hover:bg-accent-admin/20 disabled:opacity-40"
                >
                  Save as template
                </button>
                <button
                  type="button"
                  onClick={() => void promote("social")}
                  disabled={!output.trim()}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/5 disabled:opacity-40"
                >
                  Create social draft
                </button>
                <button
                  type="button"
                  onClick={() => void promote("campaign")}
                  disabled={!output.trim()}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/5 disabled:opacity-40"
                >
                  Draft campaign
                </button>
                <Link
                  href="/workbench/templates"
                  className="px-2 text-sm text-white/50 transition hover:text-accent-admin"
                >
                  Templates →
                </Link>
              </div>
            </div>
          </section>
        )}

        {runs.length > 0 && !output && !imageUrl && (
          <section className="mt-14 w-full max-w-xl">
            <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
              Recent
            </h2>
            <ul className="space-y-2">
              {runs.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setUserPrompt(r.user_prompt);
                      if (r.output_text) setOutput(r.output_text);
                      if (r.output_image_url) setImageUrl(r.output_image_url);
                      setModel(r.model);
                    }}
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
                  >
                    <span className="block text-xs text-accent-admin">{shortModelLabel(r.model)}</span>
                    <span className="mt-0.5 block truncate text-sm text-white/70">
                      {r.user_prompt}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
