import Link from "next/link";
import { FEATURE_HREF_TO_GUIDE_SLUG } from "@/lib/workbench-guides";
import type { WorkbenchNavGroup } from "@/lib/workbench-nav";

export function WorkbenchSitemap({ groups }: { groups: WorkbenchNavGroup[] }) {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pb-12 pt-8 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Site map</h2>
        <Link href="/workbench/guides" className="text-sm text-accent-admin hover:underline">
          All guides
        </Link>
      </div>

      {groups.map((group) => (
        <section key={group.id} className="space-y-3">
          <h3 className="text-lg font-semibold text-white">{group.label}</h3>
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
            {group.links.map((link) => {
              const guideSlug = FEATURE_HREF_TO_GUIDE_SLUG[link.href];
              return (
                <li
                  key={link.href}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white">{link.label}</p>
                    {link.detail ? <p className="text-sm text-text-muted">{link.detail}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={link.href}
                      className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-accent-admin hover:text-accent-admin"
                    >
                      Open
                    </Link>
                    {guideSlug ? (
                      <Link
                        href={`/workbench/guides/${guideSlug}`}
                        className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:border-white/25 hover:text-white"
                      >
                        Guide
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
