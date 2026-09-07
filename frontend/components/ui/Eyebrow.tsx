import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type EyebrowProps = {
  children: ReactNode;
  className?: string;
  as?: "p" | "span";
  /** Public ice (default) or Workbench ice on charcoal */
  tone?: "ice" | "admin";
};

export function Eyebrow({ children, className, as: Tag = "p", tone = "ice" }: EyebrowProps) {
  return (
    <Tag
      className={cn(
        "font-display text-[11px] uppercase tracking-[0.25em]",
        tone === "admin" ? "text-accent-admin" : "text-accent-ice",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
