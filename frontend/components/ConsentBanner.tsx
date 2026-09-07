"use client";

import { useEffect, useState } from "react";
import { hasConsent, setConsent } from "@/lib/track";

const CHOICE_COOKIE = "ti_consent";

function hasChoice(): boolean {
  if (typeof document === "undefined") return true;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${CHOICE_COOKIE}=`));
}

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!hasChoice());
  }, []);

  function decide(choice: "yes" | "no") {
    setConsent(choice);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-background-raised/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 px-6 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-text-secondary">
          We use cookies to understand how you use our site and improve service. See our{" "}
          <a href="/privacy" className="underline hover:text-accent-ice">
            privacy notice
          </a>
          .
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => decide("no")}
            className="rounded-lg border border-white/15 px-4 py-1.5 text-sm font-semibold text-text-secondary hover:border-white/30"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => {
              decide("yes");
              // best-effort: consent doesn't send a prior page_view, but future events will fire
              if (typeof window !== "undefined") {
                void import("@/lib/track").then(({ track }) => {
                  if (hasConsent()) void track("page_view");
                });
              }
            }}
            className="rounded-lg bg-accent-ice px-4 py-1.5 text-sm font-semibold text-black"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
