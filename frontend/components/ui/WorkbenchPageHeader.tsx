import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { cn } from "@/lib/cn";

type WorkbenchPageHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  align?: "center" | "start";
  className?: string;
};

export function WorkbenchPageHeader({
  eyebrow,
  title,
  description,
  actions,
  align = "center",
  className,
}: WorkbenchPageHeaderProps) {
  return (
    <section
      className={cn(
        align === "center" ? "text-center" : "text-left",
        actions != null && align === "start"
          ? "flex flex-wrap items-start justify-between gap-4"
          : undefined,
        className,
      )}
    >
      <div className={align === "center" ? undefined : "min-w-0 flex-1"}>
        <Eyebrow tone="admin">{eyebrow}</Eyebrow>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {description ? (
          <div
            className={cn(
              "mt-3 space-y-3 text-text-secondary",
              align === "center" && "mx-auto max-w-2xl",
            )}
          >
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </section>
  );
}
