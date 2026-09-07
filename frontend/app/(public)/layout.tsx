import { Suspense } from "react";
import { ChatWidget } from "@/components/ChatWidget";
import { ConsentBanner } from "@/components/ConsentBanner";
import { PageViewTracker } from "@/components/PageViewTracker";
import { PrototypeFooter } from "@/components/prototype/PrototypeFooter";
import { PrototypeHeader } from "@/components/prototype/PrototypeHeader";
import { PrototypeSideVignette } from "@/components/prototype/PrototypeSideVignette";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PrototypeHeader />
      <PrototypeSideVignette />
      <main className="relative z-0 bg-black">{children}</main>
      <PrototypeFooter />
      <ChatWidget />
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <ConsentBanner />
    </>
  );
}
