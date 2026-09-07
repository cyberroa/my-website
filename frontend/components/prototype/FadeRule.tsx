import { cn } from "@/lib/cn";

/** Better Stack–style horizontal rule: accent fades to transparent at both ends. */
export function FadeRule({
  className,
  tone = "ice",
}: {
  className?: string;
  tone?: "ice" | "subtle";
}) {
  const via =
    tone === "ice"
      ? "via-accent-ice/35"
      : "via-white/12";

  return (
    <div
      className={cn(
        "h-px w-full bg-gradient-to-r from-transparent to-transparent",
        via,
        className,
      )}
      aria-hidden
    />
  );
}
