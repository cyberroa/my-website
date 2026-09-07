"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function HomeSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      className="mx-auto mt-10 flex w-full max-w-xl flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        router.push(query ? `/inventory?q=${encodeURIComponent(query)}` : "/inventory");
      }}
    >
      <input
        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-background-raised/90 px-4 py-3.5 text-base text-white outline-none ring-accent-ice/30 placeholder:text-text-muted focus:ring-2"
        placeholder="Search parts by number or name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search parts"
      />
      <button
        type="submit"
        className="rounded-lg bg-accent-ice px-8 py-3.5 text-sm font-semibold text-black transition hover:brightness-110"
      >
        Search
      </button>
    </form>
  );
}
