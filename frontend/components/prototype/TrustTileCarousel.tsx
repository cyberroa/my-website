"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  IconExchange,
  IconExperience,
  IconParts,
  IconWrench,
} from "@/components/prototype/TrustIcons";
import { cn } from "@/lib/cn";

const TRUST_ITEMS = [
  {
    Icon: IconExperience,
    label: "30+ years GE PET/CT",
    detail: "Hands-on field expertise across installations, service, and system support.",
    href: "/about",
  },
  {
    Icon: IconWrench,
    label: "Repair & service",
    detail: "Uptime-first field service, maintenance, and technical support.",
    href: "/services",
  },
  {
    Icon: IconExchange,
    label: "Buy & sell systems",
    detail: "Vetted refurbished GE PET/CT transactions end to end.",
    href: "/sell",
  },
  {
    Icon: IconParts,
    label: "Parts nationwide",
    detail: "OEM and refurbished components shipped when you need them.",
    href: "/inventory",
  },
] as const;

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d={dir === "left" ? "M15 6 9 12l6 6" : "M9 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Horizontal trust-tile strip with Better Stack–style side fade. */
export function TrustTileCarousel() {
  const scroller = useRef<HTMLDivElement>(null);

  const scrollByCard = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-trust-card]");
    const amount = (card?.offsetWidth ?? 280) + 16;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <div className="relative mt-10">
      <div className="mb-4 flex justify-end gap-2 md:hidden">
        <button
          type="button"
          aria-label="Scroll trust cards left"
          onClick={() => scrollByCard(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-text-secondary"
        >
          <Chevron dir="left" />
        </button>
        <button
          type="button"
          aria-label="Scroll trust cards right"
          onClick={() => scrollByCard(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-text-secondary"
        >
          <Chevron dir="right" />
        </button>
      </div>

      <div className="relative">
        <div
          ref={scroller}
          className={cn(
            "flex gap-4 overflow-x-auto px-0.5 pb-3 pt-2 [-ms-overflow-style:none] [scrollbar-width:none]",
            "snap-x snap-mandatory md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:pb-2 md:pt-2",
            "md:px-0.5",
            "[&::-webkit-scrollbar]:hidden",
          )}
        >
          {TRUST_ITEMS.map(({ Icon, label, detail, href }) => (
            <Link
              key={label}
              href={href}
              data-trust-card
              className={cn(
                "block w-[min(85vw,20rem)] shrink-0 snap-start rounded-xl border border-white/10 bg-white/[0.03] px-6 py-7 text-left md:w-auto",
                "transition hover:-translate-y-1 hover:scale-[1.02] hover:border-white/20",
              )}
            >
              <span
                className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-accent-ice/20 bg-accent-ice/5 text-accent-ice"
                aria-hidden
              >
                <Icon className="h-6 w-6" />
              </span>
              <p className="text-base font-semibold leading-snug text-white">{label}</p>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{detail}</p>
            </Link>
          ))}
        </div>

        {/* Edge fade — mobile horizontal strip */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#0a1218] to-transparent md:hidden"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#0a1218] to-transparent md:hidden"
          aria-hidden
        />
      </div>
    </div>
  );
}
