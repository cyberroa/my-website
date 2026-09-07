import { WorkbenchAtmosphere } from "@/components/workbench/WorkbenchShell";
import { WorkbenchNav } from "@/components/workbench/WorkbenchNav";

/** Staff chrome only — no public header, footer, or chat. */
export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-area="admin" className="relative min-h-screen text-white">
      <WorkbenchAtmosphere />
      <div className="relative z-10">
        <WorkbenchNav />
        <main>{children}</main>
      </div>
    </div>
  );
}
