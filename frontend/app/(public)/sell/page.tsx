import type { Metadata } from "next";
import Link from "next/link";
import { SellForm } from "@/components/forms/SellForm";
import { Container, Eyebrow, PageHero } from "@/components/ui";
import { IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Sell to Us",
  description:
    "Sell PET/CT equipment and parts to Titan Imaging Service—fair quotes and a simple process.",
  openGraph: {
    title: "Sell to Us | TITAN IMAGING",
    description:
      "Sell PET/CT equipment and parts to Titan Imaging Service—fair quotes and a simple process.",
    url: "/sell",
  },
  alternates: {
    canonical: "/sell",
  },
};

export default function SellPage() {
  return (
    <>
      <PageHero
        image={IMAGES.prototypeBuySell}
        eyebrow="Sell Your Equipment"
        title="Sell With Confidence"
        subtitle="Turn your PET/CT equipment into a fair offer. We buy systems, parts, and components—and make the process simple."
        contentClassName="max-w-2xl"
      />

      <Container className="grid gap-10 pb-24 pt-10 md:pt-14 lg:grid-cols-2 lg:items-start">
        <div className="rounded-xl border border-white/10 bg-background-card/95 p-8">
          <div className="mb-8">
            <Eyebrow as="span" className="text-sm tracking-[0.15em]">
              Submit Your Equipment
            </Eyebrow>
            <p className="mt-1 text-sm text-text-muted">
              Fill out the form and we&apos;ll follow up with a quote.
            </p>
          </div>
          <SellForm />
        </div>

        <div className="rounded-xl border border-white/10 bg-background-card/95 p-8">
          <Eyebrow as="span" className="text-sm tracking-[0.15em]">
            How It Works
          </Eyebrow>
          <p className="mt-4 text-sm leading-relaxed text-text-secondary">
            Selling your equipment to Titan Imaging is simple and secure. Submit your details,
            receive a fair quote, and we guide you through every step for a smooth, transparent
            experience.
          </p>
          <ol className="mt-8 space-y-6 border-t border-white/10 pt-8">
            {[
              [
                "Submit",
                "Send equipment details via the form. Include model, condition, and quantity.",
              ],
              [
                "Get a Quote",
                "Our team reviews your submission and provides a fair offer within 24 hours.",
              ],
              ["Complete", "We handle logistics and payment so you can sell with confidence."],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-ice/10 font-display text-sm font-bold text-accent-ice">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-white">{title}</p>
                  <p className="mt-1 text-sm text-text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            {["CT Systems", "PET Systems", "Parts & Components"].map((label) => (
              <div
                key={label}
                className="flex min-w-[120px] flex-1 flex-col items-center rounded-lg border border-white/10 bg-accent-ice/5 py-4 text-center"
              >
                <span className="text-lg text-accent-ice" aria-hidden>
                  ◇
                </span>
                <span className="mt-2 text-xs font-semibold text-text-secondary">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 rounded-lg border border-accent-ice/15 bg-accent-ice/5 px-4 py-3 text-center text-sm text-text-secondary">
            Prefer to talk? Call{" "}
            <Link href="tel:9047426265" className="font-semibold text-accent-ice">
              (904) 742-6265
            </Link>
            .
          </p>
          <p className="mt-6 border-t border-white/10 pt-6 text-xs leading-relaxed text-text-muted">
            <strong className="text-text-secondary">Security note:</strong> verify communications by
            calling{" "}
            <a href="tel:9047426265" className="text-accent-ice underline">
              (904) 742-6265
            </a>{" "}
            or{" "}
            <a href="mailto:info@test.com" className="text-accent-ice underline">
              info@test.com
            </a>
            .
          </p>
        </div>
      </Container>
    </>
  );
}
