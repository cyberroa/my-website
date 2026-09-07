"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { identify, track } from "@/lib/track";

const inputClassName =
  "w-full rounded-lg border border-white/10 bg-background-card px-4 py-3.5 text-white outline-none ring-accent-ice/20 placeholder:text-text-muted focus:ring-2";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;

    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      subject: String(fd.get("subject") ?? "").trim(),
      message: String(fd.get("message") ?? "").trim(),
    };

    setStatus("sending");
    try {
      await apiFetch<{ ok: boolean }>("/api/v1/contact", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (payload.email) {
        void identify(payload.email);
      }
      void track(
        "contact_submit",
        { subject: payload.subject || null },
        { email: payload.email || undefined },
      );
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="contact-name"
          className="mb-2 block text-xs font-semibold text-text-secondary"
        >
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          placeholder="Your name"
          className={inputClassName}
        />
      </div>
      <div>
        <label
          htmlFor="contact-email"
          className="mb-2 block text-xs font-semibold text-text-secondary"
        >
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className={inputClassName}
        />
      </div>
      <div>
        <label
          htmlFor="contact-phone"
          className="mb-2 block text-xs font-semibold text-text-secondary"
        >
          Phone <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <input
          id="contact-phone"
          name="phone"
          type="tel"
          placeholder="(555) 555-5555"
          className={inputClassName}
        />
      </div>
      <div>
        <label
          htmlFor="contact-subject"
          className="mb-2 block text-xs font-semibold text-text-secondary"
        >
          Subject
        </label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          placeholder="How can we help?"
          className={inputClassName}
        />
      </div>
      <div>
        <label
          htmlFor="contact-message"
          className="mb-2 block text-xs font-semibold text-text-secondary"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          placeholder="Tell us more…"
          className={`min-h-[120px] resize-y ${inputClassName}`}
        />
      </div>
      <Button type="submit" variant="accent" fullWidth disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send Message"}
      </Button>
      {status === "sent" ? (
        <p className="rounded-lg border border-accent-ice/20 bg-accent-ice/10 px-4 py-3 text-center text-sm text-accent-ice">
          Thanks for reaching out. Your message has been sent. For immediate help, call{" "}
          <a href="tel:9047426265" className="font-semibold underline">
            (904) 742-6265
          </a>
          .
        </p>
      ) : status === "error" ? (
        <p className="rounded-lg border border-white/10 bg-background-card px-4 py-3 text-center text-sm text-text-secondary">
          Something went wrong sending your message. Please try again, or call{" "}
          <a href="tel:9047426265" className="font-semibold text-accent-ice underline">
            (904) 742-6265
          </a>
          .
        </p>
      ) : null}
      <p className="border-t border-white/10 pt-4 text-xs leading-relaxed text-text-muted">
        <strong className="text-text-secondary">Security note:</strong> Be cautious of anyone
        impersonating Titan Imaging Service. Verify by calling{" "}
        <a href="tel:9047426265" className="text-accent-ice underline">
          (904) 742-6265
        </a>{" "}
        or emailing{" "}
        <a href="mailto:info@test.com" className="text-accent-ice underline">
          info@test.com
        </a>
        .
      </p>
    </form>
  );
}
