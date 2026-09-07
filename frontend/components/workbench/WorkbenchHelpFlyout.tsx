"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from "@/lib/api-workbench";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { WorkbenchAnchoredFlyout } from "@/components/workbench/WorkbenchAnchoredFlyout";

type Tab = "ask" | "feedback";

type GuideLink = { title: string; href: string };

type AskTurn = {
  role: "user" | "assistant";
  text: string;
  guides?: GuideLink[];
};

type AskOut = { answer: string; guides: GuideLink[]; ai: boolean };

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M9.6 9.5a2.4 2.4 0 1 1 3.7 2c-.9.6-1.3 1.1-1.3 2.1v.2" />
      <circle cx="12" cy="16.6" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WorkbenchHelpFlyout() {
  const pathname = usePathname();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("ask");
  const [token, setToken] = useState<string | null>(null);
  const [askDraft, setAskDraft] = useState("");
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [askBusy, setAskBusy] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
    });
  }, []);

  useEffect(() => {
    if (open) return;
    setFeedbackSent(false);
    setError(null);
  }, [open]);

  async function sendAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !askDraft.trim()) return;
    const message = askDraft.trim();
    setAskDraft("");
    setError(null);
    setTurns((prev) => [...prev, { role: "user", text: message }]);
    setAskBusy(true);
    try {
      const out = await apiFetchWithAuth<AskOut>("/api/v1/workbench/help/ask", token, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setTurns((prev) => [
        ...prev,
        { role: "assistant", text: out.answer, guides: out.guides },
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? "Could not answer right now" : "Could not answer right now");
    } finally {
      setAskBusy(false);
    }
  }

  async function sendFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !feedbackDraft.trim()) return;
    setFeedbackBusy(true);
    setError(null);
    try {
      await apiFetchWithAuth("/api/v1/workbench/help/feedback", token, {
        method: "POST",
        body: JSON.stringify({ message: feedbackDraft.trim(), page_path: pathname }),
      });
      setFeedbackDraft("");
      setFeedbackSent(true);
    } catch {
      setError("Could not send feedback");
    } finally {
      setFeedbackBusy(false);
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Help and feedback"
        aria-label="Help and feedback"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition",
          open
            ? "border-accent-admin/50 bg-accent-admin/15 text-accent-admin"
            : "border-white/15 bg-white/[0.03] text-white/80 hover:border-accent-admin/40 hover:text-white",
        )}
      >
        <HelpIcon />
      </button>
      <WorkbenchAnchoredFlyout
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        align="right"
        width={360}
        label="Help and feedback"
      >
        <div className="border-b border-white/10 bg-[#0a0a0a] px-3 pt-3">
          <div className="flex gap-1">
            {(
              [
                ["ask", "Ask"],
                ["feedback", "Feedback"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id);
                  setError(null);
                }}
                className={cn(
                  "flex-1 rounded-t-lg px-3 py-2 text-sm font-semibold",
                  tab === id ? "bg-[#161616] text-white" : "text-white/50 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-[#0a0a0a] p-3">
          {tab === "ask" ? (
            <div className="space-y-3">
              <p className="text-xs text-white/50">
                Ask how to use a Workbench feature. Answers point to the sitemap and guides.
              </p>
              <div className="max-h-52 space-y-2 overflow-y-auto">
                {turns.length === 0 ? (
                  <p className="rounded-lg bg-[#161616] px-3 py-2 text-xs text-white/55">
                    Example: “How do I log a service job?” or “Where are email campaigns?”
                  </p>
                ) : (
                  turns.map((t, i) => (
                    <div
                      key={`${t.role}-${i}`}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm",
                        t.role === "user" ? "bg-[#161616] text-white" : "bg-[#121212] text-white/90",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{t.text}</p>
                      {t.guides?.length ? (
                        <ul className="mt-2 space-y-1">
                          {t.guides.map((g) => (
                            <li key={g.href}>
                              <Link
                                href={g.href}
                                onClick={() => setOpen(false)}
                                className="text-xs font-medium text-accent-admin hover:underline"
                              >
                                {g.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={(e) => void sendAsk(e)} className="space-y-2">
                <textarea
                  value={askDraft}
                  onChange={(e) => setAskDraft(e.target.value)}
                  rows={3}
                  placeholder="How do I…?"
                  className="w-full resize-none rounded-lg border border-white/10 bg-[#161616] px-3 py-2 text-sm text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={askBusy || !askDraft.trim() || !token}
                  className="w-full rounded-lg bg-accent-admin px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
                >
                  {askBusy ? "Thinking…" : "Ask"}
                </button>
              </form>
              <Link
                href="/workbench/guides"
                onClick={() => setOpen(false)}
                className="block text-center text-xs text-accent-admin hover:underline"
              >
                Open all guides
              </Link>
            </div>
          ) : feedbackSent ? (
            <p className="rounded-lg bg-[#161616] px-3 py-4 text-center text-sm font-medium text-white">
              Your feedback has been sent to the Admin.
            </p>
          ) : (
            <form onSubmit={(e) => void sendFeedback(e)} className="space-y-2">
              <p className="text-xs text-white/50">
                Tell Admin what is broken, missing, or confusing on this page.
              </p>
              <textarea
                value={feedbackDraft}
                onChange={(e) => setFeedbackDraft(e.target.value)}
                rows={5}
                placeholder="Feedback about the site…"
                className="w-full resize-none rounded-lg border border-white/10 bg-[#161616] px-3 py-2 text-sm text-white outline-none"
              />
              <button
                type="submit"
                disabled={feedbackBusy || !feedbackDraft.trim() || !token}
                className="w-full rounded-lg bg-accent-admin px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
              >
                {feedbackBusy ? "Sending…" : "Send to Admin"}
              </button>
            </form>
          )}
          {error ? <p className="mt-2 text-xs text-accent-alert">{error}</p> : null}
        </div>
      </WorkbenchAnchoredFlyout>
    </>
  );
}
