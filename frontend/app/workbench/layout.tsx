import type { Metadata } from "next";
import { WorkbenchShell } from "@/components/workbench/WorkbenchShell";

export const metadata: Metadata = {
  title: "Workbench",
  robots: { index: false, follow: false },
};

export default function WorkbenchLayout({ children }: { children: React.ReactNode }) {
  return <WorkbenchShell>{children}</WorkbenchShell>;
}
