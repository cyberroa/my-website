"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TitanMarkIcon } from "@/components/prototype/BrandMarks";
import { SocialLinks } from "@/components/prototype/SocialLinks";
import { StaffAccessLink } from "@/components/StaffAccessLink";
import { PROTO_NAV_MORE, PROTO_NAV_PRIMARY } from "@/lib/prototype-nav";

const FOOTER_LINKS = [
  ...PROTO_NAV_PRIMARY,
  { href: "/contact", label: "Contact" },
  ...PROTO_NAV_MORE,
] as const;

export function PrototypeFooter() {
  const pathname = usePathname();
  const isPreview = pathname.startsWith("/prototype");

  return (
    <footer className="relative z-50 mt-0 border-t border-white/10 bg-background-raised">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-2 md:px-12 lg:grid-cols-[1.6fr_1fr_1fr_auto]">
        <div className="flex items-start gap-4 md:col-span-2 lg:col-span-1">
          <TitanMarkIcon size="trust" className="opacity-90" />
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-white">
              Titan Imaging Service
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
              Repair, service, parts, and buy/sell support for GE PET/CT systems—built on 30+ years of
              hands-on imaging expertise.
            </p>
            <SocialLinks className="mt-3" />
            <p className="mt-4 text-xs text-text-muted">
              © {new Date().getFullYear()} TITAN IMAGING. All Rights Reserved.
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Explore</p>
          <ul className="mt-4 space-y-2.5">
            {FOOTER_LINKS.slice(0, 5).map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm text-text-secondary transition hover:text-white"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Company</p>
          <ul className="mt-4 space-y-2.5">
            {FOOTER_LINKS.slice(5).map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm text-text-secondary transition hover:text-white"
                >
                  {label}
                </Link>
              </li>
            ))}
            {isPreview ? (
              <li>
                <Link href="/" className="text-sm text-text-muted transition hover:text-white">
                  Current site home
                </Link>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="flex items-start justify-end md:col-start-2 lg:col-start-4">
          <StaffAccessLink variant="footer" />
        </div>
      </div>
    </footer>
  );
}
