"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FadeRule } from "@/components/prototype/FadeRule";
import { Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";

const INSIGHT_SLIDES = [
  {
    id: "ct-install-cost",
    category: "Installation",
    title: "How Much Does CT Scanner Installation Cost in 2026?",
    excerpt:
      "Site preparation, rigging, compliance, and calibration—what drives the full cost of a CT install.",
    href: "/insights",
    soon: false,
  },
  {
    id: "petct-deinstall",
    category: "De-installation",
    title: "Complete Guide to Deinstalling a PET CT System Safely",
    excerpt:
      "Safe removal, transport logistics, and regulatory considerations for facilities taking systems offline.",
    soon: true,
  },
  {
    id: "sell-used-ct",
    category: "Selling",
    title: "How to Sell a Used CT Scanner",
    excerpt:
      "Maximize resale value while minimizing downtime and risk when retiring imaging equipment.",
    soon: true,
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

function centerScrollLeft(scroller: HTMLElement, card: HTMLElement) {
  const s = scroller.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  const delta = c.left - s.left - (s.width - c.width) / 2;
  return scroller.scrollLeft + delta;
}

function nearestCardIndex(scroller: HTMLElement, cards: (HTMLElement | null)[]) {
  const mid = scroller.getBoundingClientRect().left + scroller.clientWidth / 2;
  let best = 0;
  let bestDist = Infinity;
  cards.forEach((card, i) => {
    if (!card) return;
    const r = card.getBoundingClientRect();
    const dist = Math.abs(r.left + r.width / 2 - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}

/** Compact article reel — A ↔ B ↔ C, no wrap; easy to grow as posts are added. */
export function InsightsCarousel({
  surfaceClassName = "bg-black",
  edgeVignette = true,
}: {
  surfaceClassName?: string;
  edgeVignette?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const indexRef = useRef(0);
  const programmaticRef = useRef(false);
  const count = INSIGHT_SLIDES.length;
  const atStart = index === 0;
  const atEnd = index === count - 1;

  const scrollToIndex = useCallback((i: number, behavior: ScrollBehavior = "smooth") => {
    const scroller = scrollerRef.current;
    const card = cardRefs.current[i];
    if (!scroller || !card) return;

    programmaticRef.current = true;
    indexRef.current = i;
    setIndex(i);

    scroller.scrollTo({ left: Math.max(0, centerScrollLeft(scroller, card)), behavior });

    const clear = () => {
      programmaticRef.current = false;
      scroller.removeEventListener("scrollend", clear);
    };

    if (behavior === "auto") {
      requestAnimationFrame(() => {
        programmaticRef.current = false;
      });
      return;
    }

    if ("onscrollend" in window) {
      scroller.addEventListener("scrollend", clear, { once: true });
    } else {
      setTimeout(clear, 450);
    }
  }, []);

  const go = useCallback(
    (next: number) => {
      const i = Math.max(0, Math.min(count - 1, next));
      if (i === indexRef.current) return;
      scrollToIndex(i);
    },
    [count, scrollToIndex],
  );

  useEffect(() => {
    scrollToIndex(0, "auto");
  }, [scrollToIndex]);

  useEffect(() => {
    const onResize = () => scrollToIndex(indexRef.current, "auto");
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [scrollToIndex]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    let frame = 0;
    const sync = () => {
      if (programmaticRef.current) return;
      const i = nearestCardIndex(root, cardRefs.current);
      if (i !== indexRef.current) {
        indexRef.current = i;
        setIndex(i);
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("scroll", onScroll);
    };
  }, []);

  const navBtnClass = (disabled: boolean) =>
    cn(
      "flex h-9 w-9 items-center justify-center rounded-full border transition",
      disabled
        ? "cursor-not-allowed border-white/8 text-white/25"
        : "border-white/15 text-text-secondary hover:border-accent-ice/40 hover:text-white",
    );

  return (
    <section className={cn("relative overflow-hidden py-16 md:py-20", surfaceClassName)} aria-roledescription="carousel">
      <FadeRule />

      <div className="relative mx-auto max-w-7xl px-6 pt-12 md:px-12 md:pt-14">
        <div className="mb-8 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <Eyebrow className="text-accent-ice">Industry insight</Eyebrow>
            <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
              Guides for CT installation, PET/CT, and equipment transitions
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Previous insight"
              disabled={atStart}
              onClick={() => go(index - 1)}
              className={navBtnClass(atStart)}
            >
              <Chevron dir="left" />
            </button>
            <button
              type="button"
              aria-label="Next insight"
              disabled={atEnd}
              onClick={() => go(index + 1)}
              className={navBtnClass(atEnd)}
            >
              <Chevron dir="right" />
            </button>
            <Link
              href="/insights"
              className="ml-1 inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-accent-ice transition hover:gap-3 hover:text-white"
            >
              Read all
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          className={cn(
            "relative flex items-stretch snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3 pt-2",
            "px-[10%] md:gap-5 md:px-[18%] lg:px-[22%]",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {INSIGHT_SLIDES.map((slide, i) => {
            const active = i === index;
            const focusCard = (e?: { preventDefault: () => void }) => {
              if (active) return;
              e?.preventDefault();
              go(i);
            };

            const inner = (
              <>
                <p className="font-display text-[10px] uppercase tracking-[0.2em] text-accent-ice">
                  {slide.category}
                </p>
                <h3 className="mt-2 text-base font-semibold leading-snug text-white md:text-lg">
                  {slide.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">{slide.excerpt}</p>
                {"soon" in slide && slide.soon ? (
                  <span className="mt-5 text-sm font-semibold text-text-muted">Coming soon →</span>
                ) : (
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent-ice transition group-hover:gap-2">
                    Read more →
                  </span>
                )}
              </>
            );

            const cardClass = cn(
              "flex h-full min-h-[11.5rem] flex-col rounded-xl border border-white/10 bg-white/[0.03] px-5 py-5 md:min-h-[12.5rem] md:px-6 md:py-6",
              "transition duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-white/20 hover:bg-white/[0.05]",
            );

            return (
              <article
                key={slide.id}
                data-index={i}
                ref={(node) => {
                  cardRefs.current[i] = node;
                }}
                onClick={() => focusCard()}
                className={cn(
                  "flex w-[78%] shrink-0 snap-center self-stretch transition duration-500 sm:w-[62%] md:w-[42%] lg:w-[34%]",
                  active ? "opacity-100" : "cursor-pointer opacity-45",
                )}
              >
                {"soon" in slide && slide.soon ? (
                  <div className={cn(cardClass, "h-full w-full")}>{inner}</div>
                ) : (
                  <Link
                    href={slide.href}
                    onClick={focusCard}
                    className={cn("group block h-full w-full", cardClass)}
                  >
                    {inner}
                  </Link>
                )}
              </article>
            );
          })}
        </div>

        {edgeVignette ? (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[10%] bg-gradient-to-r from-black via-black/80 to-transparent sm:w-[14%] md:w-[16%]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[10%] bg-gradient-to-l from-black via-black/80 to-transparent sm:w-[14%] md:w-[16%]"
              aria-hidden
            />
          </>
        ) : null}
      </div>

      <div className="mt-5 flex justify-center gap-2 px-6" role="tablist" aria-label="Insight articles">
        {INSIGHT_SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Show ${s.title}`}
            onClick={() => go(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-5 bg-white" : "w-1.5 bg-white/25 hover:bg-white/50",
            )}
          />
        ))}
      </div>
    </section>
  );
}
