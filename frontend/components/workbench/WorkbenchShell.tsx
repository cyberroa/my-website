"use client";

import { usePathname } from "next/navigation";
import { WorkbenchNav } from "@/components/workbench/WorkbenchNav";
import { WorkbenchSupabaseSetup } from "@/components/workbench/WorkbenchSupabaseSetup";
import { isSupabaseConfigured } from "@/lib/env-public";

export function WorkbenchAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#101014]" />
      <div className="absolute -left-1/4 top-0 h-[28rem] w-[70%] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(43,180,255,0.16),_transparent_70%)] blur-2xl" />
      <div className="absolute -right-1/4 top-1/3 h-[24rem] w-[55%] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(43,180,255,0.07),_transparent_70%)] blur-3xl" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/40 to-transparent" />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

export function WorkbenchShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/workbench/login";
  const supabaseOk = isSupabaseConfigured();

  if (isLogin) {
    return (
      <div data-area="admin" className="relative min-h-screen text-white">
        <WorkbenchAtmosphere />
        <div className="relative z-10">{children}</div>
      </div>
    );
  }

  if (!supabaseOk && !isLogin) {
    return (
      <div data-area="admin" className="relative min-h-screen text-white">
        <WorkbenchAtmosphere />
        <div className="relative z-10">
          <WorkbenchSupabaseSetup />
        </div>
      </div>
    );
  }

  return (
    <div data-area="admin" className="relative min-h-screen text-white">
        <WorkbenchAtmosphere />
      <div className="relative z-10">
        <WorkbenchNav />
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </div>
    </div>
  );
}
