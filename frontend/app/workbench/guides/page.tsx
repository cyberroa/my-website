"use client";

import Link from "next/link";
import { WorkbenchPageHeader } from "@/components/ui";
import { WORKBENCH_GUIDES } from "@/lib/workbench-guides";

export default function WorkbenchGuidesIndexPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <WorkbenchPageHeader
        eyebrow="Guides"
        title="Workbench guides"
        align="start"
        description="How-to docs for each Workbench area. Stubs today — expand as features ship."
      />
      <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
        {WORKBENCH_GUIDES.map((g) => (
          <li key={g.slug} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link href={`/workbench/guides/${g.slug}`} className="font-medium text-white hover:text-accent-admin">
                {g.title}
              </Link>
              <p className="text-sm text-text-muted">{g.summary}</p>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">{g.status}</span>
          </li>
        ))}
      </ul>
      <Link href="/workbench" className="inline-block text-sm text-accent-admin hover:underline">
        ← Back to Welcome
      </Link>
    </main>
  );
}
