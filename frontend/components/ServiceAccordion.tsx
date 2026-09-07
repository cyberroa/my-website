"use client";

import { useState } from "react";
import type { ServiceItem } from "@/lib/services-data";

export function ServiceAccordion({ items }: { items: ServiceItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {items.map((s) => {
        const open = openId === s.id;
        return (
          <div
            key={s.id}
            className={`rounded-xl border border-white/10 bg-gradient-to-br from-[#0d0d0d] to-[#111] transition ${
              open ? "border-accent-ice/30 shadow-lg shadow-black/40" : ""
            }`}
          >
            <button
              type="button"
              className="flex w-full items-start justify-between gap-4 p-5 text-left"
              onClick={() => setOpenId(open ? null : s.id)}
              aria-expanded={open}
            >
              <div>
                <div className="mb-1 flex items-center gap-2 text-accent-ice">
                  <span aria-hidden>◇</span>
                  <span className="text-lg font-semibold text-white">{s.title}</span>
                </div>
                <p className="text-sm text-text-secondary">{s.preview}</p>
              </div>
              <span
                className={`mt-1 shrink-0 text-accent-ice transition ${
                  open ? "rotate-180" : ""
                }`}
                aria-hidden
              >
                ▼
              </span>
            </button>
            {open ? (
              <div className="border-t border-white/5 px-5 pb-5 pt-0">
                <p className="text-sm leading-relaxed text-text-secondary">{s.body}</p>
                <ul className="mt-4 space-y-2 text-sm text-text-secondary">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="text-accent-ice">✓</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
