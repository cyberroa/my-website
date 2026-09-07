"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  label?: string;
  id?: string;
  role?: "dialog" | "listbox";
  className?: string;
  children: ReactNode;
};

export function StudioFloatingMenu({
  open,
  onClose,
  labelledBy,
  label,
  id,
  role = "dialog",
  className,
  children,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        id={id}
        role={role}
        aria-modal={role === "dialog" ? true : undefined}
        aria-labelledby={labelledBy}
        aria-label={!labelledBy ? label : undefined}
        className={
          className ??
          "relative z-[201] w-full max-w-sm overflow-hidden rounded-xl border border-white/15 bg-[#0a0a0a] text-white shadow-[0_24px_80px_rgba(0,0,0,1)]"
        }
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
