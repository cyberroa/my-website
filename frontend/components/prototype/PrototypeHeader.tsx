"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { TitanWordmark } from "@/components/prototype/BrandMarks";
import { StaffAccessLink } from "@/components/StaffAccessLink";
import { cn } from "@/lib/cn";
import { PROTO_NAV, PROTO_NAV_MORE, PROTO_NAV_PRIMARY, type ProtoNavItem } from "@/lib/prototype-nav";

export function PrototypeHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelDomId = useId();
  const homeHref = pathname.startsWith("/prototype") ? "/prototype" : "/";

  const activeItem = PROTO_NAV.find((i) => i.id === panelId) ?? null;
  const panelOpen = Boolean(activeItem);
  const solid = scrolled || panelOpen || mobileOpen;

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openPanel = (id: string) => {
    clearCloseTimer();
    setPanelId(id);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setPanelId(null), 120);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setPanelId(null);
  }, [pathname]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  useEffect(() => () => clearCloseTimer(), []);

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-50 transition-[background-color,backdrop-filter,box-shadow] duration-300",
        solid
          ? "bg-[#141414]/95 shadow-[0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md"
          : "bg-transparent shadow-none",
      )}
    >
      {/* Thin Tesla-like bar — transparent at top, solid on scroll */}
      <div
        className="relative z-20 mx-auto flex h-12 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
        onMouseLeave={scheduleClose}
      >
        <Link
          href={homeHref}
          className="flex min-w-0 shrink items-center"
          onClick={() => setMobileOpen(false)}
          onMouseEnter={() => setPanelId(null)}
          aria-label="Titan Imaging Service — home"
        >
          <TitanWordmark />
        </Link>

        {/* Desktop nav — centered cluster */}
        <nav
          className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 md:flex"
          aria-label="Primary"
          onMouseEnter={clearCloseTimer}
        >
          {PROTO_NAV.map((item) => {
            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`) ||
              panelId === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                onMouseEnter={() => openPanel(item.id)}
                onFocus={() => openPanel(item.id)}
                aria-expanded={panelId === item.id}
                aria-controls={panelDomId}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2" onMouseEnter={() => setPanelId(null)}>
          <StaffAccessLink variant="header" />
          <Link
            href="/contact"
            className="hidden rounded-md bg-accent-ice px-3.5 py-1.5 text-sm font-semibold text-black transition hover:brightness-110 md:inline-flex"
          >
            Contact
          </Link>

          <button
            type="button"
            className="relative z-10 flex h-9 w-9 flex-col items-center justify-center gap-1.5 md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => {
              setPanelId(null);
              setMobileOpen((v) => !v);
            }}
          >
            <span
              className={cn(
                "block h-0.5 w-5 origin-center bg-white transition",
                mobileOpen && "translate-y-[7px] rotate-45",
              )}
            />
            <span className={cn("block h-0.5 w-5 bg-white transition", mobileOpen && "opacity-0")} />
            <span
              className={cn(
                "block h-0.5 w-5 origin-center bg-white transition",
                mobileOpen && "-translate-y-[7px] -rotate-45",
              )}
            />
          </button>
        </div>
      </div>

      {/* Hover mega panel — desktop */}
      <div
        id={panelDomId}
        role="region"
        aria-label={activeItem ? `${activeItem.label} menu` : "Navigation menu"}
        aria-hidden={!panelOpen}
        className={cn(
          "relative z-20 hidden overflow-hidden border-t border-white/10 bg-[#141414] transition-[max-height,opacity] duration-300 ease-out md:block",
          panelOpen ? "max-h-[22rem] opacity-100" : "pointer-events-none max-h-0 opacity-0",
        )}
        onMouseEnter={clearCloseTimer}
        onMouseLeave={scheduleClose}
      >
        {activeItem ? <MegaPanel item={activeItem} onNavigate={() => setPanelId(null)} /> : null}
      </div>

      {/* Page dim when mega menu open */}
      <button
        type="button"
        tabIndex={panelOpen ? 0 : -1}
        aria-label="Close menu"
        onClick={() => setPanelId(null)}
        className={cn(
          "fixed inset-0 top-12 z-10 hidden bg-black/55 transition-opacity duration-300 md:block",
          panelOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="border-t border-white/10 bg-[#141414] px-4 pb-5 pt-2 md:hidden">
          <nav className="flex flex-col gap-0.5" aria-label="Mobile">
            {PROTO_NAV_PRIMARY.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-sm font-medium transition",
                    active ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {label}
                </Link>
              );
            })}
            <div className="my-2 border-t border-white/10" />
            {PROTO_NAV_MORE.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-white/75 transition hover:bg-white/5 hover:text-white"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="mt-3 inline-flex items-center justify-center rounded-md bg-accent-ice px-4 py-2.5 text-sm font-semibold text-black"
            >
              Contact
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function MegaPanel({ item, onNavigate }: { item: ProtoNavItem; onNavigate: () => void }) {
  const { panel } = item;
  return (
    <div className="mx-auto grid max-w-[1400px] gap-8 px-6 py-8 lg:grid-cols-[1fr_auto] lg:gap-12 lg:px-8">
      <div>
        <p className="font-display text-[10px] uppercase tracking-[0.22em] text-accent-ice">
          {panel.title}
        </p>
        <p className="mt-2 max-w-md text-sm text-text-secondary">{panel.blurb}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {panel.featured.map((f) => (
            <Link
              key={f.href + f.label}
              href={f.href}
              onClick={onNavigate}
              className="group rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]"
            >
              <p className="text-sm font-semibold text-white group-hover:text-accent-ice">{f.label}</p>
              {f.detail ? <p className="mt-1 text-xs text-text-muted">{f.detail}</p> : null}
            </Link>
          ))}
        </div>
      </div>
      <ul className="flex flex-col gap-1 border-t border-white/10 pt-4 lg:min-w-[12rem] lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        {panel.links.map((l) => (
          <li key={l.href + l.label}>
            <Link
              href={l.href}
              onClick={onNavigate}
              className="block rounded-md px-2 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
