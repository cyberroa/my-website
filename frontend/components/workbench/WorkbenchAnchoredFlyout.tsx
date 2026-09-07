"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  align?: "left" | "right";
  width?: number;
  label?: string;
  id?: string;
  children: ReactNode;
};

export function WorkbenchAnchoredFlyout({
  open,
  onClose,
  anchorRef,
  align = "right",
  width = 320,
  label,
  id,
  children,
}: Props) {
  const autoId = useId();
  const panelId = id || autoId;
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 8;
      let left = align === "right" ? rect.right - width : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      let top = rect.bottom + gap;
      const h = panelRef.current?.offsetHeight || 280;
      if (top + h > window.innerHeight - 8) {
        top = Math.max(8, rect.top - h - gap);
      }
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, width, anchorRef, children]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      id={panelId}
      ref={panelRef}
      role="dialog"
      aria-label={label}
      style={{ top: pos.top, left: pos.left, width }}
      className="fixed z-[201] overflow-hidden rounded-xl border border-white/15 bg-[#0a0a0a] text-white shadow-[0_16px_48px_rgba(0,0,0,1)]"
    >
      {children}
    </div>,
    document.body,
  );
}
