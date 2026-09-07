/** Primary nav for the layout prototype — Tesla-style hover panels on desktop. */

export type ProtoNavLink = { href: string; label: string; detail?: string };

export type ProtoNavItem = {
  id: string;
  href: string;
  label: string;
  panel: {
    title: string;
    blurb: string;
    featured: ProtoNavLink[];
    links: ProtoNavLink[];
  };
};

export const PROTO_NAV: ProtoNavItem[] = [
  {
    id: "inventory",
    href: "/inventory",
    label: "Inventory",
    panel: {
      title: "Parts & systems",
      blurb: "Search OEM and refurbished CT/PET inventory ready to ship.",
      featured: [
        { href: "/inventory", label: "Browse inventory", detail: "Parts by number or name" },
        { href: "/sell", label: "Sell equipment", detail: "Get a quote on systems you retire" },
      ],
      links: [
        { href: "/inventory", label: "Search parts" },
        { href: "/contact", label: "Request a part" },
        { href: "/book", label: "Book a call" },
      ],
    },
  },
  {
    id: "services",
    href: "/services",
    label: "Services",
    panel: {
      title: "Repair & service",
      blurb: "Field service, maintenance, and technical support for GE PET/CT.",
      featured: [
        { href: "/services", label: "View services", detail: "Uptime-first field support" },
        { href: "/book", label: "Schedule service", detail: "Talk with a specialist" },
      ],
      links: [
        { href: "/services", label: "Field service" },
        { href: "/about", label: "Our expertise" },
        { href: "/contact", label: "Request support" },
      ],
    },
  },
  {
    id: "about",
    href: "/about",
    label: "About",
    panel: {
      title: "About Titan",
      blurb: "Three decades of GE PET/CT mastery behind every engagement.",
      featured: [
        { href: "/about", label: "Our story", detail: "From GE zone support to Titan" },
        { href: "/testimonials", label: "Testimonials", detail: "What facilities say" },
      ],
      links: [
        { href: "/about", label: "About Titan" },
        { href: "/insights", label: "Industry insight" },
        { href: "/contact", label: "Contact" },
      ],
    },
  },
  {
    id: "sell",
    href: "/sell",
    label: "Sell to Us",
    panel: {
      title: "Buy & sell systems",
      blurb: "Vetted refurbished GE PET/CT transactions end to end.",
      featured: [
        { href: "/sell", label: "Sell to us", detail: "Evaluation through logistics" },
        { href: "/inventory", label: "Browse systems", detail: "Available inventory" },
      ],
      links: [
        { href: "/sell", label: "Start a sale" },
        { href: "/book", label: "Book a call" },
        { href: "/contact", label: "Ask a question" },
      ],
    },
  },
  {
    id: "more",
    href: "/insights",
    label: "Discover",
    panel: {
      title: "Discover",
      blurb: "Guides, booking, and proof from the field.",
      featured: [
        { href: "/insights", label: "Industry insight", detail: "Installation, de-install, selling" },
        { href: "/book", label: "Book a call", detail: "Speak with the team" },
      ],
      links: [
        { href: "/insights", label: "Read insights" },
        { href: "/testimonials", label: "Testimonials" },
        { href: "/book", label: "Book" },
      ],
    },
  },
];

/** Flat lists kept for mobile drawer / footer convenience. */
export const PROTO_NAV_PRIMARY = PROTO_NAV.filter((i) => i.id !== "more").map(({ href, label }) => ({
  href,
  label,
}));

export const PROTO_NAV_MORE = [
  { href: "/book", label: "Book" },
  { href: "/insights", label: "Industry Insight" },
  { href: "/testimonials", label: "Testimonials" },
] as const;
