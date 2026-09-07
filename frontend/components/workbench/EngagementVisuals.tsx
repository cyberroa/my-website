import { cn } from "@/lib/cn";

export const STAGES = ["new", "contacted", "engaged", "qualified", "proposal", "won", "lost"] as const;
export type LeadStage = (typeof STAGES)[number];

export type GlyphName =
  | "spark"
  | "phone"
  | "chat"
  | "star"
  | "doc"
  | "trophy"
  | "x"
  | "mail"
  | "bot"
  | "globe"
  | "calendar"
  | "flag";

export const STAGE_VISUAL: Record<
  LeadStage,
  { color: string; bg: string; border: string; icon: GlyphName }
> = {
  new: { color: "#a9b4c2", bg: "bg-white/5", border: "border-white/15", icon: "spark" },
  contacted: { color: "#2BB4FF", bg: "bg-accent-admin/10", border: "border-accent-admin/35", icon: "phone" },
  engaged: { color: "#34D399", bg: "bg-accent-signal/10", border: "border-accent-signal/35", icon: "chat" },
  qualified: { color: "#FFFF84", bg: "bg-accent-caution/10", border: "border-accent-caution/40", icon: "star" },
  proposal: { color: "#C9A86C", bg: "bg-accent-caution/15", border: "border-accent-caution/45", icon: "doc" },
  won: { color: "#34D399", bg: "bg-accent-signal/15", border: "border-accent-signal/50", icon: "trophy" },
  lost: { color: "#E07A5F", bg: "bg-accent-alert/10", border: "border-accent-alert/40", icon: "x" },
};

export const CHANNEL_TONE: Record<string, string> = {
  studio_agent: "border-accent-admin/40 bg-accent-admin/15 text-accent-admin",
  phone: "border-accent-caution/40 bg-accent-caution/15 text-accent-caution",
  email_paste: "border-accent-signal/40 bg-accent-signal/15 text-accent-signal",
  email: "border-accent-signal/40 bg-accent-signal/15 text-accent-signal",
  web: "border-white/20 bg-white/10 text-accent-titanium",
};

export const OUTCOME_TONE: Record<string, string> = {
  meeting_set: "border-accent-signal/40 bg-accent-signal/15 text-accent-signal",
  interested: "border-accent-signal/40 bg-accent-signal/15 text-accent-signal",
  won: "border-accent-signal/40 bg-accent-signal/15 text-accent-signal",
  callback: "border-accent-admin/40 bg-accent-admin/15 text-accent-admin",
  objection: "border-accent-caution/40 bg-accent-caution/15 text-accent-caution",
  not_interested: "border-accent-alert/40 bg-accent-alert/15 text-accent-alert",
  lost: "border-accent-alert/40 bg-accent-alert/15 text-accent-alert",
};

export const CHANNEL_ICON: Record<string, GlyphName> = {
  studio_agent: "bot",
  phone: "phone",
  email_paste: "mail",
  email: "mail",
  web: "globe",
};

export const OUTCOME_ICON: Record<string, GlyphName> = {
  meeting_set: "calendar",
  interested: "chat",
  won: "trophy",
  callback: "phone",
  objection: "flag",
  not_interested: "x",
  lost: "x",
};

export function Glyph({ name, className = "h-3 w-3 shrink-0" }: { name: GlyphName; className?: string }) {
  if (name === "phone") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M3.2 2.8h2.2l1 2.4-1.3 1.1a9 9 0 0 0 4.6 4.6l1.1-1.3 2.4 1v2.2A1.2 1.2 0 0 1 12 14 10.2 10.2 0 0 1 2 4a1.2 1.2 0 0 1 1.2-1.2Z" />
      </svg>
    );
  }
  if (name === "chat") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M3 3.5h10v7H6.5L3 13.2V3.5Z" />
      </svg>
    );
  }
  if (name === "star") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
        <path d="m8 1.6 1.7 3.5 3.8.6-2.7 2.7.6 3.8L8 10.4 4.6 12.2l.6-3.8L2.5 5.7l3.8-.6Z" />
      </svg>
    );
  }
  if (name === "doc") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M5 2.5h4.5L13 6v7.5H5V2.5Z" />
        <path d="M9.5 2.5V6H13" />
      </svg>
    );
  }
  if (name === "trophy") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M5 3h6v3.5A3 3 0 0 1 8 9.5 3 3 0 0 1 5 6.5V3Z" />
        <path d="M5 4H3.2A1.7 1.7 0 0 0 5 6.2M11 4h1.8A1.7 1.7 0 0 1 11 6.2M8 9.5V12M5.5 13h5" />
      </svg>
    );
  }
  if (name === "x") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
      </svg>
    );
  }
  if (name === "mail") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <rect x="2.5" y="3.5" width="11" height="9" rx="1" />
        <path d="m3 4.2 5 4 5-4" />
      </svg>
    );
  }
  if (name === "bot") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <rect x="3" y="5" width="10" height="8" rx="1.5" />
        <path d="M8 5V3M6.2 8.5h.1M9.7 8.5h.1M5.5 11h5" />
      </svg>
    );
  }
  if (name === "globe") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="8" cy="8" r="5.2" />
        <path d="M3 8h10M8 3c1.6 1.6 2.4 3.3 2.4 5S9.6 11.4 8 13C6.4 11.4 5.6 9.7 5.6 8S6.4 4.6 8 3Z" />
      </svg>
    );
  }
  if (name === "calendar") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <rect x="2.5" y="3.5" width="11" height="10" rx="1" />
        <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" />
      </svg>
    );
  }
  if (name === "flag") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M4 2.5v11M4 3h7l-1.5 2.5L11 8H4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M8 2.5 9 6h3.5L9.8 8.2 10.8 12 8 9.8 5.2 12l1-3.8L3.5 6H7Z" />
    </svg>
  );
}

export function EngagementBadge({
  value,
  className,
  icon,
}: {
  value: string;
  className: string;
  icon: GlyphName;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
        className,
      )}
    >
      <Glyph name={icon} />
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function StageIcon({ name, color }: { name: GlyphName; color: string }) {
  return (
    <span style={{ color }}>
      <Glyph name={name} className="h-4 w-4 shrink-0" />
    </span>
  );
}

export function stageTone(stage: string) {
  const map: Record<string, string> = {
    new: "border-white/20 bg-white/10 text-accent-titanium",
    contacted: "border-accent-admin/40 bg-accent-admin/15 text-accent-admin",
    engaged: "border-accent-signal/40 bg-accent-signal/15 text-accent-signal",
    qualified: "border-accent-caution/40 bg-accent-caution/15 text-accent-caution",
    proposal: "border-accent-caution/45 bg-accent-caution/20 text-accent-caution",
    won: "border-accent-signal/50 bg-accent-signal/20 text-accent-signal",
    lost: "border-accent-alert/40 bg-accent-alert/15 text-accent-alert",
  };
  return map[stage] ?? "border-white/20 bg-white/10 text-white/70";
}
