import Image from "next/image";
import { HomeSearch } from "@/components/HomeSearch";
import { GeHealthcareMark, PetCtMark, TitanMark, TitanMarkIcon } from "@/components/prototype/BrandMarks";
import { CapabilityCarousel } from "@/components/prototype/CapabilityCarousel";
import { FadeRule } from "@/components/prototype/FadeRule";
import { InsightsCarousel } from "@/components/prototype/InsightsCarousel";
import { NewsletterCapture } from "@/components/prototype/NewsletterCapture";
import { TrustTileCarousel } from "@/components/prototype/TrustTileCarousel";
import { Container, Eyebrow, LinkButton, Section } from "@/components/ui";
import { IMAGES } from "@/lib/images";
import { cn } from "@/lib/cn";

const CORE_SERVICES = [
  ["Parts Sourcing", "OEM and refurbished CT/PET components for reliable performance."],
  ["System Sales", "Pre-owned and refurbished systems, professionally vetted."],
  ["Installation", "Professional system installation and calibration services."],
  ["Partner With Us", "Collaborate to expand your imaging service capabilities."],
] as const;

type HomePageContentProps = {
  variant?: "production" | "preview";
};

export function HomePageContent({ variant = "production" }: HomePageContentProps) {
  const isPreview = variant === "preview";
  const newsletterSource = isPreview ? "prototype_home" : "home";
  /** Transparent on /prototype so Workbench grid shows; solid black on public /. */
  const surface = isPreview ? "bg-transparent" : "bg-black";

  return (
    <>
      {/* Hero */}
      <section
        className={cn(
          "relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pb-44 pt-20 text-center md:pb-52 md:pt-24",
          surface,
        )}
      >
        <div className="absolute inset-0 z-0">
          <Image
            src={IMAGES.prototypeHero}
            alt=""
            fill
            className="object-cover object-[center_45%]"
            priority
            sizes="100vw"
            quality={95}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(110,201,240,0.08),_transparent_55%)]" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl -translate-y-10 md:-translate-y-16">
          {!isPreview ? <TitanMarkIcon size="hero" className="mb-6 md:mb-8" /> : null}
          <p className="font-display text-sm font-bold uppercase tracking-[0.28em] text-white md:text-base md:tracking-[0.32em]">
            {isPreview ? "Titan Imaging Service" : "CT/PET Parts & Services"}
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
            {isPreview ? (
              <>GE PET/CT repair, service, buy &amp; sell</>
            ) : (
              <>Precision Parts. Seamless Service. Every Time.</>
            )}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-text-secondary md:text-xl">
            {isPreview
              ? "Precision support for hospitals and imaging centers—built on three decades of hands-on GE expertise."
              : "Trusted sourcing, repair, and support for medical imaging systems. Over 30 years of hands-on expertise."}
          </p>
          {!isPreview ? (
            <div className="mx-auto mt-8 max-w-xl">
              <HomeSearch />
            </div>
          ) : null}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <LinkButton href="/inventory" size="lg">
              Browse Inventory
            </LinkButton>
            <LinkButton href="/contact" variant="secondary" size="lg">
              Request Support
            </LinkButton>
          </div>
        </div>

        <div
          className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 md:block"
          aria-hidden
        >
          <div className="h-8 w-px bg-gradient-to-b from-accent-ice/60 to-transparent" />
        </div>
      </section>

      {/* Trust strip */}
      <section id="trust" className={cn("relative", surface)}>
        <FadeRule />
        <div className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-14">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-text-muted">
            Built around the platforms hospitals trust
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 md:gap-x-14">
            <GeHealthcareMark />
            <span
              className="hidden h-7 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent sm:block"
              aria-hidden
            />
            <PetCtMark />
            <span
              className="hidden h-7 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent sm:block"
              aria-hidden
            />
            <TitanMark size="trust" />
          </div>
          <TrustTileCarousel />
        </div>
        <FadeRule />
      </section>

      {/* Capabilities */}
      <div className={surface}>
        <CapabilityCarousel edgeVignette={!isPreview} />
      </div>

      {/* Industry experience — inset card image, rounded left corners, fade on right */}
      {!isPreview ? (
        <section className={cn("relative", surface)}>
          <FadeRule />
          <div className="relative mx-auto max-w-6xl overflow-visible px-6 py-10 md:px-12 md:py-14 lg:py-16">
            <div className="grid items-center gap-10 overflow-visible md:grid-cols-2 md:gap-12 lg:gap-14">
              <div className="relative z-10 flex flex-col justify-center">
                <Eyebrow className="text-accent-ice">Industry Experience</Eyebrow>
                <h2 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">
                  Trusted by Hospitals &amp; Imaging Centers
                </h2>
                <p className="mt-4 text-text-secondary">
                  Titan Imaging Service provides high-quality CT and PET parts, system solutions, and
                  service support to imaging centers and hospitals nationwide.
                </p>
                <p className="mt-4 text-text-secondary">
                  With over 30 years of hands-on experience in GE PET/CT systems, our team ensures
                  reliable installations, precise maintenance, and fast technical support.
                </p>
                <LinkButton href="/about" size="sm" className="mt-8 w-fit">
                  Learn More
                </LinkButton>
              </div>

              <div className="relative aspect-[4/3] w-full overflow-visible sm:aspect-[16/10] md:aspect-auto md:min-h-[22rem] lg:min-h-[26rem]">
                <div
                  className={cn(
                    "absolute inset-0 overflow-hidden border border-white/10 border-r-0 bg-black",
                    "rounded-2xl md:rounded-l-2xl md:rounded-r-none",
                    /* Bleed past container to the viewport right edge */
                    "md:right-[calc(-1*(max(0px,(100vw-72rem)/2)+3rem))] md:left-0 md:w-auto",
                  )}
                >
                  <Image
                    src={IMAGES.industryExperience}
                    alt="Titan Imaging technician servicing a GE PET/CT system in a clinical suite"
                    fill
                    className="object-cover object-[20%_center]"
                    sizes="(max-width: 768px) 100vw, 55vw"
                  />
                  {/* Fade to black near the right screen edge */}
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-black via-black/80 to-transparent md:w-36 lg:w-44"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </div>
          <FadeRule />
        </section>
      ) : null}

      {/* Newsletter — between Industry Experience and Core Services FadeRules */}
      <section className={cn("relative overflow-hidden py-16 md:py-20", surface)}>
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(110,201,240,0.07),_transparent_65%)]"
          aria-hidden
        />
        <div className="relative px-6 md:px-12">
          <NewsletterCapture trackSource={newsletterSource} />
        </div>
      </section>

      {/* Core services + credibility proof */}
      {!isPreview ? (
        <section className={cn("relative overflow-hidden py-20 md:py-28", surface)}>
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(110,201,240,0.06),_transparent_65%)]"
            aria-hidden
          />
          <FadeRule className="absolute inset-x-0 top-0" />
          <Container>
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow className="text-accent-ice">Our Core Services</Eyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                End-to-end solutions for medical imaging
              </h2>
              <p className="mt-4 text-text-secondary">
                From parts to full system support—everything your facility needs to stay operational.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {CORE_SERVICES.map(([title, desc]) => (
                <div
                  key={title}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center transition hover:-translate-y-1 hover:border-white/20"
                >
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-3 text-sm text-text-muted">{desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-16 border-t border-white/10 pt-14 text-center md:mt-20 md:pt-16">
              <p className="mx-auto max-w-2xl text-base leading-relaxed text-text-secondary md:text-lg">
                Our owner spent years as a Regional PET/CT Zone Support Engineer at GE Healthcare—
                training field engineers, running system audits, and overseeing major installations.
                That rigor now backs every repair, parts order, and system transaction.
              </p>
              <dl className="mx-auto mt-10 grid max-w-4xl gap-8 sm:grid-cols-3 sm:gap-6">
                {[
                  ["100+", "System audits completed"],
                  ["25+", "States served"],
                  ["800+", "Facilities supported"],
                ].map(([stat, label]) => (
                  <div key={label} className="text-center">
                    <dt className="font-display text-3xl font-bold tracking-wide text-accent-ice md:text-4xl">
                      {stat}
                    </dt>
                    <dd className="mt-2 text-sm text-text-muted">{label}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-10">
                <LinkButton href="/about" variant="secondary" size="md">
                  About us
                </LinkButton>
              </div>
            </div>
          </Container>
        </section>
      ) : null}

      {/* Parts search — preview only (production has search in hero) */}
      {isPreview ? (
        <Section spacing="standard" className={cn("relative pb-20 pt-4 md:pb-24", surface)}>
          <FadeRule />
          <div className="mx-auto max-w-3xl px-6 pt-16 text-center md:px-12 md:pt-20">
            <Eyebrow className="text-accent-ice">Parts inventory</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">Find a part</h2>
            <p className="mt-4 text-text-secondary">
              Search by part number or name—OEM and refurbished CT/PET components.
            </p>
            <HomeSearch />
          </div>
        </Section>
      ) : null}

      <InsightsCarousel surfaceClassName={surface} edgeVignette={!isPreview} />

      {/* Closing CTA */}
      <section className={cn("relative overflow-hidden py-20 md:py-28", surface)}>
        <FadeRule />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(110,201,240,0.08),_transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl px-6 pt-12 text-center md:px-12 md:pt-14">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            {isPreview ? "Talk to a specialist" : "Need Support?"}
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            {isPreview
              ? "Need service, a quote on a system, or help sourcing a part? Reach the team directly."
              : "Speak directly with our team and get expert assistance today."}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <LinkButton href="/contact" size="lg">
              Contact us
            </LinkButton>
            <LinkButton href="/book" variant="secondary" size="lg">
              Book a call
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
