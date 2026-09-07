"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FadeRule } from "@/components/prototype/FadeRule";
import { Eyebrow } from "@/components/ui";
import { IMAGES } from "@/lib/images";
import { cn } from "@/lib/cn";

export const CAPABILITY_SLIDES = [
  {
    id: "repair",
    eyebrow: "Repair & service",
    title: "Keep imaging systems online",
    body: "Field service, preventive maintenance, and technical support for GE PET/CT—so hospitals and imaging centers stay operational with less downtime.",
    cta: { href: "/services", label: "View services" },
    image: IMAGES.aboutTitant,
    imageAlt: "Titan Imaging technician servicing a GE Omni PET/CT system",
    imagePosition: "object-center",
  },
  {
    id: "buy-sell",
    eyebrow: "Buy & sell",
    title: "Move systems with confidence",
    body: "Source refurbished GE PET/CT systems or sell equipment you no longer need. We handle evaluation, logistics, and installation coordination end to end.",
    cta: { href: "/sell", label: "Sell to us" },
    secondaryCta: { href: "/inventory", label: "Browse inventory" },
    image: IMAGES.prototypeBuySell,
    imageAlt: "Medical imaging suite",
    imagePosition: "object-center",
  },
  {
    id: "parts",
    eyebrow: "Parts & sourcing",
    title: "OEM and refurbished components, fast",
    body: "Rapid access to quality CT/PET parts with expert guidance—so replacements land when your team needs them.",
    cta: { href: "/inventory", label: "Search parts" },
    image: IMAGES.prototypeParts,
    imageAlt: "Organized inventory of OEM and refurbished PET/CT parts ready for sourcing",
    imagePosition: "object-center",
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

/** Scroll offset that centers `card` in `scroller` (uses rects — offsetLeft is wrong when a positioned ancestor wraps the scroller). */
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

export function CapabilityCarousel({ edgeVignette = true }: { edgeVignette?: boolean }) {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const indexRef = useRef(0);
  const programmaticRef = useRef(false);
  const count = CAPABILITY_SLIDES.length;
  const atStart = index === 0;
  const atEnd = index === count - 1;

  const scrollToIndex = useCallback((i: number, behavior: ScrollBehavior = "smooth") => {
    const scroller = scrollerRef.current;
    const card = cardRefs.current[i];
    if (!scroller || !card) return;

    programmaticRef.current = true;
    indexRef.current = i;
    setIndex(i);

    const left = Math.max(0, centerScrollLeft(scroller, card));
    scroller.scrollTo({ left, behavior });

    const clear = () => {
      programmaticRef.current = false;
      scroller.removeEventListener("scrollend", clear);
    };

    if (behavior === "auto") {
      // Allow layout to settle, then unlock swipe sync
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(indexRef.current - 1);
      if (e.key === "ArrowRight") go(indexRef.current + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Sync index from swipe / free scroll (ignore while arrows/dots drive the reel)
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
      "flex h-10 w-10 items-center justify-center rounded-full border transition",
      disabled
        ? "cursor-not-allowed border-white/8 text-white/25"
        : "border-white/15 text-text-secondary hover:border-accent-ice/40 hover:text-white",
    );

  return (
    <section className="relative overflow-hidden py-16 md:py-24" aria-roledescription="carousel">
      <FadeRule className="absolute inset-x-0 top-0" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow className="text-accent-ice">What we do</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Service, systems, and parts
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Previous capability"
              disabled={atStart}
              onClick={() => go(index - 1)}
              className={navBtnClass(atStart)}
            >
              <Chevron dir="left" />
            </button>
            <button
              type="button"
              aria-label="Next capability"
              disabled={atEnd}
              onClick={() => go(index + 1)}
              className={navBtnClass(atEnd)}
            >
              <Chevron dir="right" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          className={cn(
            "relative flex items-stretch snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-4 pt-1",
            "px-[8%] md:gap-6 md:px-[14%] lg:px-[18%]",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {CAPABILITY_SLIDES.map((slide, i) => {
            const active = i === index;
            const focusCard = (e?: { preventDefault: () => void }) => {
              if (active) return;
              e?.preventDefault();
              go(i);
            };
            return (
              <article
                key={slide.id}
                data-index={i}
                ref={(node) => {
                  cardRefs.current[i] = node;
                }}
                onClick={() => focusCard()}
                className={cn(
                  "flex w-[84%] shrink-0 snap-center self-stretch transition duration-500 sm:w-[72%] md:w-[58%] lg:w-[48%]",
                  active ? "opacity-100" : "cursor-pointer opacity-45",
                )}
              >
                <div
                  className={cn(
                    "flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]",
                    "transition duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-white/20 hover:bg-white/[0.05]",
                  )}
                >
                  <div className="relative aspect-[16/10] shrink-0 overflow-hidden rounded-t-2xl md:aspect-[16/9]">
                    <Image
                      src={slide.image}
                      alt={slide.imageAlt}
                      fill
                      priority={i === 0}
                      className={cn("object-cover", slide.imagePosition)}
                      sizes="(max-width: 768px) 85vw, 50vw"
                    />
                    <div
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10"
                      aria-hidden
                    />
                  </div>

                  <div className="flex flex-1 flex-col px-6 py-6 md:px-8 md:py-7">
                    <p className="font-display text-[11px] uppercase tracking-[0.22em] text-accent-ice">
                      {slide.eyebrow}
                    </p>
                    <h3 className="mt-2 text-xl font-bold tracking-tight text-white md:text-2xl">
                      {slide.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-text-secondary md:text-base">
                      {slide.body}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-3 pt-5">
                      <Link
                        href={slide.cta.href}
                        onClick={focusCard}
                        className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-accent-ice"
                      >
                        {slide.cta.label}
                      </Link>
                      {"secondaryCta" in slide && slide.secondaryCta ? (
                        <Link
                          href={slide.secondaryCta.href}
                          onClick={focusCard}
                          className="inline-flex items-center justify-center rounded-lg border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-accent-ice/50"
                        >
                          {slide.secondaryCta.label}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {edgeVignette ? (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[12%] bg-gradient-to-r from-black via-black/80 to-transparent sm:w-[16%] md:w-[18%]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[12%] bg-gradient-to-l from-black via-black/80 to-transparent sm:w-[16%] md:w-[18%]"
              aria-hidden
            />
          </>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 px-6">
        <p className="font-display text-[11px] uppercase tracking-[0.22em] text-text-muted">
          {CAPABILITY_SLIDES[index].eyebrow}
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Previous"
            disabled={atStart}
            onClick={() => go(index - 1)}
            className={cn(
              "transition",
              atStart ? "cursor-not-allowed text-white/20" : "text-text-muted hover:text-white",
            )}
          >
            <Chevron dir="left" />
          </button>
          <div className="flex items-center gap-2" role="tablist" aria-label="Capability slides">
            {CAPABILITY_SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show ${s.eyebrow}`}
                onClick={() => go(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/25 hover:bg-white/50",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next"
            disabled={atEnd}
            onClick={() => go(index + 1)}
            className={cn(
              "transition",
              atEnd ? "cursor-not-allowed text-white/20" : "text-text-muted hover:text-white",
            )}
          >
            <Chevron dir="right" />
          </button>
        </div>
      </div>

      <FadeRule className="absolute inset-x-0 bottom-0" />
    </section>
  );
}
