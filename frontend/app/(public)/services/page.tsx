import type { Metadata } from "next";
import { FadeRule } from "@/components/prototype/FadeRule";
import { ServiceAccordion } from "@/components/ServiceAccordion";
import {
  Container,
  LinkButton,
  PageHero,
  SectionHeading,
} from "@/components/ui";
import { IMAGES } from "@/lib/images";
import { SERVICES } from "@/lib/services-data";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Installation, logistics, training, system sales, service contracts, and parts support for PET/CT.",
  openGraph: {
    title: "Services | TITAN IMAGING",
    description:
      "Installation, logistics, training, system sales, service contracts, and parts support for PET/CT.",
    url: "/services",
  },
  alternates: {
    canonical: "/services",
  },
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        image={IMAGES.aboutTitant}
        eyebrow="What We Offer"
        title="CT & PET Solutions That Keep You Running"
        subtitle="Comprehensive services designed to maximize uptime, optimize performance, and support your imaging operations from installation to ongoing maintenance."
      />

      <Container maxWidth="narrow" className="pb-0 pt-14">
        <SectionHeading title="Our Services" description="Tap a service to expand details" />
        <div className="mt-10">
          <ServiceAccordion items={SERVICES} />
        </div>
      </Container>

      <Container maxWidth="wide" className="grid grid-cols-2 gap-6 py-16 sm:grid-cols-4 md:py-20">
        {[
          ["25+", "States Served"],
          ["100+", "System Audits"],
          ["1,500+", "Projects Completed"],
          ["30+", "Years Experience"],
        ].map(([num, label]) => (
          <div key={label} className="text-center">
            <p className="font-display text-3xl font-bold text-accent-ice md:text-4xl">
              {num}
            </p>
            <p className="mt-1 text-sm text-text-muted">{label}</p>
          </div>
        ))}
      </Container>

      <section className="relative overflow-hidden bg-black pb-20 md:pb-28">
        <FadeRule />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(110,201,240,0.08),_transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl px-6 pt-12 text-center md:px-12 md:pt-14">
          <SectionHeading
            title="Ready to Get Started?"
            description="Whether you need a system audit, installation support, or a quote—we're here to help."
          />
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <LinkButton href="/contact" className="!rounded-full px-10">
              Contact Us
            </LinkButton>
            <LinkButton
              href="/inventory"
              variant="secondary"
              className="!rounded-full border-white/25 px-10"
            >
              Browse Inventory
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
