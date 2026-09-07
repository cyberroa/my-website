/**
 * Shared Tailwind class bundles for admin pages (`data-area="admin"`).
 * Use accent-admin (electric blue) so Workbench is distinct from public ice.
 */
export const workbenchBtnPrimary =
  "rounded-lg bg-accent-admin px-6 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

export const workbenchBtnSecondary =
  "rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-text-secondary transition hover:border-accent-admin hover:bg-accent-admin/5 hover:text-accent-admin disabled:opacity-50";

export const workbenchLink = "text-accent-admin hover:underline";

export const workbenchMono = "font-mono text-xs text-accent-admin";

export const workbenchInput =
  "mt-1 w-full rounded-md border border-white/15 bg-white/[0.05] px-3 py-2 outline-none ring-accent-admin/25 focus:border-accent-admin/40 focus:ring-2";

export const workbenchCard =
  "rounded-xl border border-white/12 bg-white/[0.035] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_40px_rgba(0,0,0,0.25)]";

export const workbenchTableWrap =
  "overflow-x-auto rounded-xl border border-white/12 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

export const workbenchTableHead =
  "border-b border-white/10 bg-white/[0.04] text-text-muted";

export const workbenchTableRow = "border-b border-white/5 hover:bg-accent-admin/[0.04]";

/** Matches AI Studio segment / customer picker menus. */
export const workbenchDropdownTrigger =
  "flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-left text-sm text-white outline-none transition hover:border-white/20 focus:border-accent-admin/40 disabled:opacity-50";

export const workbenchDropdownPanel =
  "absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-white/15 bg-[#0a0a0a] py-1 text-white opacity-100 shadow-2xl ring-1 ring-black";

export const workbenchDropdownItem =
  "w-full bg-[#0a0a0a] px-3 py-2 text-left text-sm text-white transition hover:bg-[#1a1a1a]";
