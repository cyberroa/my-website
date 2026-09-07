/** In-app Workbench feature guides (stubs — expand as features mature). */

export type WorkbenchGuide = {
  slug: string;
  title: string;
  featureHref: string;
  featureLabel: string;
  summary: string;
  /** Placeholder how-to bullets until full docs are written */
  steps: string[];
  status: "stub" | "draft" | "ready";
};

export const WORKBENCH_GUIDES: WorkbenchGuide[] = [
  {
    slug: "studio",
    title: "AI Studio",
    featureHref: "/workbench/studio",
    featureLabel: "Open AI Studio",
    summary: "Generate marketing email, social, and outreach copy (and images) with brand presets.",
    steps: [
      "Choose Text or Image mode and pick a model.",
      "Optionally apply a design preset for Titan voice.",
      "Write a prompt, generate, then promote copy into templates or campaigns when ready.",
    ],
    status: "stub",
  },
  {
    slug: "analytics",
    title: "Analytics",
    featureHref: "/workbench/analytics",
    featureLabel: "Open Analytics",
    summary: "Live visitors, lead-stage pipeline, and engagement progressions.",
    steps: [
      "Review pipeline stage counts and open progressions.",
      "Use Studio Agent to log calls or paste email threads.",
      "Apply suggested stages and confirm won sales on Sales for commissions.",
    ],
    status: "stub",
  },
  {
    slug: "insights",
    title: "Market Map",
    featureHref: "/workbench/insights",
    featureLabel: "Open Market Map",
    summary: "Explore CRM relationships as a graph (customers, opportunities, competitors).",
    steps: ["Open Market Map and explore nodes.", "Use filters to focus on segments or competitors.", "Full guide coming soon."],
    status: "stub",
  },
  {
    slug: "briefings",
    title: "Briefings",
    featureHref: "/workbench/briefings",
    featureLabel: "Open Briefings",
    summary: "Daily AI staff reports summarizing activity and priorities.",
    steps: ["Open Briefings to read the latest report.", "Ensure cron and OpenRouter are configured on the API.", "Full guide coming soon."],
    status: "stub",
  },
  {
    slug: "customers",
    title: "Customers",
    featureHref: "/workbench/customers",
    featureLabel: "Open Customers",
    summary: "Customer list, import, and 360° timeline.",
    steps: ["Browse or search customers.", "Open a customer for timeline and notes.", "Import CSV when onboarding a list."],
    status: "stub",
  },
  {
    slug: "segments",
    title: "Segments",
    featureHref: "/workbench/segments",
    featureLabel: "Open Segments",
    summary: "Audience filters for campaigns and outreach.",
    steps: ["Create or edit a segment.", "Preview matching customers.", "Use the segment from campaigns or Goals."],
    status: "stub",
  },
  {
    slug: "goals",
    title: "Goals",
    featureHref: "/workbench/goals",
    featureLabel: "Open Goals",
    summary: "Opportunity-driven segments kept fresh by AI.",
    steps: ["Review goal-linked segments.", "Seed or refresh goals from the API/UI.", "Full guide coming soon."],
    status: "stub",
  },
  {
    slug: "templates",
    title: "Templates",
    featureHref: "/workbench/templates",
    featureLabel: "Open Templates",
    summary: "Reusable email copy for campaigns.",
    steps: ["Create or edit a template.", "Promote Studio drafts into templates when ready.", "Use templates inside Campaigns."],
    status: "stub",
  },
  {
    slug: "campaigns",
    title: "Campaigns",
    featureHref: "/workbench/campaigns",
    featureLabel: "Open Campaigns",
    summary: "Send email campaigns via Resend to segments.",
    steps: ["Create a campaign and choose a segment.", "Pick a template or paste copy.", "Send or schedule when Resend is configured."],
    status: "stub",
  },
  {
    slug: "social",
    title: "Social",
    featureHref: "/workbench/social",
    featureLabel: "Open Social",
    summary: "LinkedIn posts via Make.com webhooks.",
    steps: ["Draft post copy (or pull from Studio).", "Queue through Social when Make is wired.", "Full guide coming soon."],
    status: "stub",
  },
  {
    slug: "outreach",
    title: "Outreach",
    featureHref: "/workbench/outreach",
    featureLabel: "Open Outreach",
    summary: "One-off email blasts outside full campaigns.",
    steps: ["Compose a one-off message.", "Select recipients or a small list.", "Send when email is configured."],
    status: "stub",
  },
  {
    slug: "sales",
    title: "Sales",
    featureHref: "/workbench/sales",
    featureLabel: "Open Sales",
    summary: "Log won conversions for commission tracking.",
    steps: ["Log a conversion with closer/lead owner.", "Confirm amounts and dates.", "Earnings appear in Payroll / My Pay after policy acceptance."],
    status: "stub",
  },
  {
    slug: "service",
    title: "Service",
    featureHref: "/workbench/service",
    featureLabel: "Open Service",
    summary: "Field repair, site jobs, and PET/CT audits.",
    steps: ["Create a service or audit job.", "Complete with hours or flat pay; attach audit report when needed.", "Payroll picks up completed jobs."],
    status: "stub",
  },
  {
    slug: "team",
    title: "Team",
    featureHref: "/workbench/team",
    featureLabel: "Open Team",
    summary: "Staff roster, tiers, capabilities, and pay packages (owner only).",
    steps: ["Add staff with email and tier.", "Assign capabilities for Staff tier.", "Assign a pay package; staff accept under My Pay."],
    status: "stub",
  },
  {
    slug: "mypay",
    title: "My Pay",
    featureHref: "/workbench/mypay",
    featureLabel: "Open My Pay",
    summary: "Review and accept your commission and hourly terms.",
    steps: ["Open pending pay package.", "Read terms carefully.", "Accept to enable earnings for sales and time."],
    status: "stub",
  },
  {
    slug: "payroll",
    title: "Payroll",
    featureHref: "/workbench/payroll",
    featureLabel: "Open Payroll",
    summary: "Payout dashboard for accounting / owners.",
    steps: ["Review ledger entries.", "Mark paid or adjust as needed.", "Full guide coming soon."],
    status: "stub",
  },
  {
    slug: "parts",
    title: "Parts",
    featureHref: "/workbench/parts",
    featureLabel: "Open Parts",
    summary: "Inventory stock and pricing.",
    steps: ["Browse or edit parts.", "Keep pricing and qty current.", "Use Import for bulk updates."],
    status: "stub",
  },
  {
    slug: "categories",
    title: "Categories",
    featureHref: "/workbench/categories",
    featureLabel: "Open Categories",
    summary: "Part category taxonomy.",
    steps: ["Add or rename categories.", "Assign parts to categories from Parts.", "Full guide coming soon."],
    status: "stub",
  },
  {
    slug: "competitors",
    title: "Competitors",
    featureHref: "/workbench/competitors",
    featureLabel: "Open Competitors",
    summary: "Firecrawl listings and price compare.",
    steps: ["Add competitor sources.", "Run scrape (or wait for cron).", "Compare listings against your inventory."],
    status: "stub",
  },
  {
    slug: "import",
    title: "Import",
    featureHref: "/workbench/import",
    featureLabel: "Open Import",
    summary: "Bulk parts upload.",
    steps: ["Download or follow the CSV template.", "Upload via Import.", "Verify rows on Parts."],
    status: "stub",
  },
  {
    slug: "alerts",
    title: "Alerts",
    featureHref: "/workbench/alerts",
    featureLabel: "Open Alerts",
    summary: "Back-in-stock subscriber list.",
    steps: ["Review subscribers.", "Coordinate restock messaging.", "Full guide coming soon."],
    status: "stub",
  },
];

/** Map feature href → guide slug for Welcome “Guide” links */
export const FEATURE_HREF_TO_GUIDE_SLUG: Record<string, string> = Object.fromEntries(
  WORKBENCH_GUIDES.map((g) => [g.featureHref, g.slug]),
);

export function getGuide(slug: string): WorkbenchGuide | undefined {
  return WORKBENCH_GUIDES.find((g) => g.slug === slug);
}
