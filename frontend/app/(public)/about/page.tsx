import type { Metadata } from "next";
import Image from "next/image";
import { FadeRule } from "@/components/prototype/FadeRule";
import {
  Container,
  Eyebrow,
  LinkButton,
  PageHero,
  Section,
  SectionHeading,
} from "@/components/ui";
import { IMAGES } from "@/lib/images";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "About Us",
  description: "Specialists in PET/CT solutions—decades of GE experience, nationwide support.",
  openGraph: {
    title: "About Us | TITAN IMAGING",
    description: "Specialists in PET/CT solutions—decades of GE experience, nationwide support.",
    url: "/about",
  },
  alternates: {
    canonical: "/about",
  },
};

const values = [
  {
    icon: "⚡",
    title: "Uptime First",
    body: "Minimizing downtime so your facility stays operational and patients receive care without delay.",
  },
  {
    icon: "○",
    title: "Technical Precision",
    body: "Rigorous alignment, calibration, and optimization to ensure imaging accuracy you can trust.",
  },
  {
    icon: "✓",
    title: "Compliance & Audits",
    body: "Over 100 system audits completed to verify performance specs and reduce operational costs.",
  },
  {
    icon: "◇",
    title: "Customer Partnership",
    body: "We don't just fix systems—we build lasting relationships with facilities we support.",
  },
];

const stats = [
  ["25+", "States Served"],
  ["10+", "Countries Reached"],
  ["1,500+", "Projects Completed"],
  ["800+", "Facilities Supported"],
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        image={IMAGES.prototypeHero}
        eyebrow="About Titan Imaging Service"
        title="Quality & Expertise You Deserve"
        subtitle="Three decades of hands-on PET/CT excellence. Trusted by hospitals and imaging centers nationwide."
      />

      <Container className="overflow-visible pb-20">
        <Section spacing="standard" className="overflow-visible">
          <div className="grid items-center gap-10 overflow-visible md:grid-cols-2 md:gap-12 lg:gap-14">
            <div className="relative z-10 flex flex-col justify-center">
              <Eyebrow>Who We Are</Eyebrow>
              <h2 className="mt-2 text-2xl font-bold md:text-3xl">Specialists in PET/CT Solutions</h2>
              <p className="mt-4 text-text-secondary">
                At <strong className="text-white">Titan Imaging Service</strong>, we provide
                comprehensive PET/CT solutions tailored to hospitals, imaging centers, and private
                practices. Founded in 2021 in Jacksonville, Florida, our mission is to deliver
                reliable, high-quality imaging services that keep systems running smoothly and
                patients cared for.
              </p>
              <p className="mt-4 text-text-secondary">
                With decades of experience in the imaging industry, our owner brings over 30 years of
                hands-on expertise with GE PET/CT systems—including installations, de-installations,
                modifications, and sales of refurbished systems and parts. Prior to founding Titan
                Imaging, they served as a Regional PET/CT Zone Support Engineer at{" "}
                <strong className="text-white">GE Healthcare</strong>, training field engineers,
                conducting system audits, and overseeing major PET/CT installations across the
                Southeast.
              </p>
              <p className="mt-4 text-text-secondary">
                Our team prides itself on technical precision: aligning complex systems,
                troubleshooting performance issues, and optimizing operations. We&apos;ve conducted
                over 100 PET/CT system audits to ensure compliance, reduce downtime, and minimize
                costs for our clients.
              </p>
            </div>

            <div className="relative aspect-[4/3] w-full overflow-visible sm:aspect-[16/10] md:aspect-auto md:min-h-[22rem] lg:min-h-[26rem]">
              <div
                className={cn(
                  "absolute inset-0 overflow-hidden border border-white/10 border-r-0 bg-black",
                  "rounded-2xl md:rounded-l-2xl md:rounded-r-none",
                  "md:right-[calc(-1*(max(0px,(100vw-72rem)/2)+1.5rem))] md:left-0 md:w-auto",
                )}
              >
                <Image
                  src={IMAGES.aboutTitant}
                  alt="Titan Imaging technician servicing a GE Omni PET/CT system"
                  fill
                  className="object-cover object-[20%_center]"
                  sizes="(max-width: 768px) 100vw, 55vw"
                />
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-black via-black/80 to-transparent md:w-36 lg:w-44"
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </Section>

        <Section spacing="tight">
          <SectionHeading
            title="What Drives Us"
            description="The principles that guide every project we undertake"
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <div
                key={v.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-left transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]"
              >
                <div className="text-2xl text-accent-ice" aria-hidden>
                  {v.icon}
                </div>
                <h3 className="mt-4 font-semibold">{v.title}</h3>
                <p className="mt-2 text-sm text-text-muted">{v.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section spacing="tight" className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map(([n, l]) => (
            <div key={l} className="text-center">
              <p className="font-display text-3xl font-bold text-accent-ice md:text-4xl">
                {n}
              </p>
              <p className="mt-1 text-sm text-text-muted">{l}</p>
            </div>
          ))}
        </Section>

        <Section
          spacing="none"
          className="grid gap-10 py-12 md:grid-cols-2 md:items-center md:py-16"
        >
          <div>
            <Eyebrow>Our Expertise</Eyebrow>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">
              Built on Decades of GE PET/CT Mastery
            </h2>
            <p className="mt-4 text-text-secondary">
              At Titan Imaging, we combine in-depth knowledge of imaging technologies with hands-on
              experience to provide services that hospitals and imaging centers can trust.
            </p>
            <p className="mt-4 text-text-secondary">
              Uptime, accuracy, and customer satisfaction are our top priorities. From installations
              to audits, we bring the same rigor and precision that defined GE Healthcare&apos;s
              standards—now applied directly to your facility.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-background-card p-10">
            <p className="font-display text-5xl font-bold text-accent-ice">100+</p>
            <p className="mt-1 text-text-muted">PET/CT System Audits</p>
            <ul className="mt-8 space-y-3 text-sm text-text-secondary">
              {[
                "Performance specification compliance",
                "Downtime reduction strategies",
                "Cost optimization",
                "Field engineer training",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-accent-ice">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </Container>

      <section className="relative overflow-hidden bg-black pb-20 md:pb-28">
        <FadeRule />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(110,201,240,0.08),_transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl px-6 pt-12 text-center md:px-12 md:pt-14">
          <SectionHeading
            title="Ready to Partner With Us?"
            description="Whether you need a system audit, installation support, or refurbished equipment—we're here to help."
          />
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <LinkButton href="/contact" className="!rounded-full px-10">
              Get in Touch
            </LinkButton>
            <LinkButton
              href="/services"
              variant="secondary"
              className="!rounded-full border-white/25 px-10"
            >
              View Our Services
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
