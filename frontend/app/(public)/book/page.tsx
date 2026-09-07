import type { Metadata } from "next";
import Image from "next/image";
import { CalendlyEmbed } from "@/components/CalendlyEmbed";
import { Container, Eyebrow, Section } from "@/components/ui";
import { IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Book an Appointment",
  description: "Schedule time with Titan Imaging Service via Calendly.",
  openGraph: {
    title: "Book an Appointment | TITAN IMAGING",
    description: "Schedule time with Titan Imaging Service via Calendly.",
    url: "/book",
  },
  alternates: {
    canonical: "/book",
  },
};

export default function BookPage() {
  return (
    <Section spacing="none" className="relative overflow-visible pb-16 md:pb-20">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[min(52vh,600px)] overflow-hidden"
        aria-hidden
      >
        <Image
          src={IMAGES.aboutTitant}
          alt=""
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black from-[12%] via-black/50 to-transparent" />
      </div>

      <Container maxWidth="narrow" className="relative z-10 pt-28 text-center md:pt-32">
        <Eyebrow>Scheduling</Eyebrow>
        <h1 className="mt-3 text-3xl font-bold md:text-4xl">Book an Appointment</h1>
        <p className="mx-auto mt-4 max-w-xl text-text-secondary">
          Choose a time that works for you. Calendly will be swapped for Cal.com in a later phase if
          you choose to migrate.
        </p>
      </Container>

      <Container maxWidth="narrow" className="relative z-20 mt-24">
        <div className="overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10">
          <CalendlyEmbed />
        </div>
      </Container>
    </Section>
  );
}
