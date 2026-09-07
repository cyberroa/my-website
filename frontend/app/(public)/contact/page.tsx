import type { Metadata } from "next";
import { CalendlyEmbed } from "@/components/CalendlyEmbed";
import { ContactForm } from "@/components/forms/ContactForm";
import { Container, Eyebrow, PageHero } from "@/components/ui";
import { IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Reach Titan Imaging Service for PET/CT parts, service, scheduling, and support.",
  openGraph: {
    title: "Contact Us | TITAN IMAGING",
    description: "Reach Titan Imaging Service for PET/CT parts, service, scheduling, and support.",
    url: "/contact",
  },
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        image={IMAGES.customerService}
        eyebrow="Get in Touch"
        title="We're Here to Help"
        subtitle="Have a question about our PET/CT services, inventory, or need a quote? Reach out—we typically respond within 24 hours."
        contentClassName="max-w-2xl"
      >
        <div className="mx-auto mt-8 flex flex-wrap justify-center gap-8 text-sm font-semibold">
          <a
            href="tel:9047426265"
            className="flex items-center gap-2 text-text-secondary transition hover:text-accent-ice"
          >
            <span className="text-accent-ice" aria-hidden>
              ☎
            </span>
            (904) 742-6265
          </a>
          <a
            href="mailto:info@test.com"
            className="flex items-center gap-2 text-text-secondary transition hover:text-accent-ice"
          >
            <span className="text-accent-ice" aria-hidden>
              ✉
            </span>
            info@test.com
          </a>
        </div>
      </PageHero>

      <Container className="grid gap-10 pb-24 pt-14 lg:grid-cols-2 lg:items-start">
        <div className="rounded-xl border border-white/10 bg-background-raised/95 p-8 shadow-xl shadow-black/30">
          <div className="mb-8">
            <Eyebrow as="span" className="text-sm tracking-[0.15em]">
              Send Us a Message
            </Eyebrow>
            <p className="mt-1 text-sm text-text-muted">
              Fill out the form below and we&apos;ll respond within 24 hours.
            </p>
          </div>
          <ContactForm />
        </div>

        <div className="rounded-xl border border-white/10 bg-background-raised/95 p-8 shadow-xl shadow-black/30">
          <div className="mb-6">
            <Eyebrow as="span" className="text-sm tracking-[0.15em]">
              Ready to Schedule?
            </Eyebrow>
            <p className="mt-1 text-sm text-text-muted">
              Book a call at a time that works for you (Calendly).
            </p>
          </div>
          <CalendlyEmbed />
        </div>
      </Container>
    </>
  );
}
