"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { use } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { getGuide } from "@/lib/workbench-guides";

export default function WorkbenchGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const guide = getGuide(slug);
  if (!guide) notFound();

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-6 py-10">
      <WorkbenchPageHeader
        eyebrow="Guide"
        title={guide.title}
        align="start"
        description={guide.summary}
      />

      {guide.status === "stub" ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-text-muted">
          This guide is a stub. Full how-to content will be added as the feature is fully implemented.
        </p>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">How to use</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-text-secondary">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href={guide.featureHref}
          className="rounded-lg bg-accent-admin px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
        >
          {guide.featureLabel}
        </Link>
        <Link
          href="/workbench/guides"
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40"
        >
          All guides
        </Link>
        <Link href="/workbench" className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-white">
          Welcome
        </Link>
      </div>
    </main>
  );
}
