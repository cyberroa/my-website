"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";
import { identify, track } from "@/lib/track";
import { cn } from "@/lib/cn";

type NewsletterCaptureProps = {
  className?: string;
  /** Compact = Better Stack–style inline row; stacked on mobile always */
  heading?: string;
  subcopy?: string;
  trackSource?: string;
};

export function NewsletterCapture({
  className,
  heading = "Imaging service updates & insights",
  subcopy = "Occasional notes on GE PET/CT service, parts availability, and industry guides—no spam.",
  trackSource = "newsletter",
}: NewsletterCaptureProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;

    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();
    if (!email) return;

    setStatus("sending");
    try {
      await apiFetch<{ ok: boolean }>("/api/v1/contact", {
        method: "POST",
        body: JSON.stringify({
          name: "Newsletter",
          email,
          subject: "Newsletter signup",
          message:
            "Newsletter signup — please add to marketing / insights list.",
        }),
      });
      void identify(email);
      void track("newsletter_signup", { source: trackSource }, { email });
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className={cn("mx-auto max-w-xl text-center", className)}>
      <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{heading}</h2>
      <p className="mt-3 text-sm text-text-secondary md:text-base">{subcopy}</p>

      {status === "sent" ? (
        <p className="mt-8 rounded-lg border border-accent-ice/30 bg-accent-ice/10 px-4 py-3 text-sm text-accent-ice">
          Thanks — you&apos;re on the list. We&apos;ll be in touch.
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:items-stretch"
        >
          <label className="sr-only" htmlFor="proto-newsletter-email">
            Work email
          </label>
          <input
            id="proto-newsletter-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Your work email"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/50 px-4 py-3.5 text-base text-white outline-none ring-accent-ice/25 placeholder:text-text-muted focus:border-accent-ice/40 focus:ring-2"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="shrink-0 rounded-lg bg-accent-ice px-7 py-3.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "sending" ? "Joining…" : "Get updates"}
          </button>
        </form>
      )}

      {status === "error" ? (
        <p className="mt-3 text-sm text-text-muted">
          Something went wrong. Try again or{" "}
          <a href="/contact" className="text-accent-ice underline">
            contact us
          </a>
          .
        </p>
      ) : null}

      <p className="mt-4 text-xs text-text-muted">
        By subscribing you agree to receive email from Titan Imaging. Unsubscribe anytime.
      </p>
    </div>
  );
}
