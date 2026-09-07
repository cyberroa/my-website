/** Grouped Titan Workbench navigation — used by WorkbenchNav. */

export type WorkbenchNavLink = {
  href: string;
  label: string;
  detail?: string;
  /** Empty = any authenticated staff. Otherwise need any of these capabilities (or owner). */
  requiredCapabilities?: string[];
  /** Owner tier only */
  ownerOnly?: boolean;
  /** Accounting capability or owner */
  accountingOnly?: boolean;
  /** Hide from owners (e.g. My Pay — owners assign packages, staff accept) */
  hideForOwner?: boolean;
};

export type WorkbenchNavGroup = {
  id: string;
  label: string;
  /** Primary landing when clicking the group label on desktop (optional). */
  href?: string;
  links: WorkbenchNavLink[];
};

export const WORKBENCH_NAV_GROUPS: WorkbenchNavGroup[] = [
  {
    id: "ai",
    label: "AI",
    href: "/workbench/studio",
    links: [
      {
        href: "/workbench/studio",
        label: "AI Studio",
        detail: "Prompts, models, generate content",
        requiredCapabilities: ["marketing"],
      },
      {
        href: "/workbench/analytics",
        label: "Analytics",
        detail: "Live visitors, pipeline, progressions",
        requiredCapabilities: ["sales", "marketing"],
      },
      {
        href: "/workbench/insights",
        label: "Market Map",
        detail: "CRM graph exploration",
        requiredCapabilities: ["sales", "marketing"],
      },
      {
        href: "/workbench/briefings",
        label: "Briefings",
        detail: "Daily AI staff reports",
        requiredCapabilities: ["marketing"],
      },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    href: "/workbench/customers",
    links: [
      {
        href: "/workbench/customers",
        label: "Customers",
        detail: "List, import, 360 timeline",
        requiredCapabilities: ["sales", "support", "marketing"],
      },
      {
        href: "/workbench/segments",
        label: "Segments",
        detail: "Audience filters",
        requiredCapabilities: ["sales", "support", "marketing"],
      },
      {
        href: "/workbench/goals",
        label: "Goals",
        detail: "Opportunity-driven segments",
        requiredCapabilities: ["sales", "support", "marketing"],
      },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    href: "/workbench/campaigns",
    links: [
      {
        href: "/workbench/templates",
        label: "Templates",
        detail: "Reusable email copy",
        requiredCapabilities: ["marketing"],
      },
      {
        href: "/workbench/campaigns",
        label: "Campaigns",
        detail: "Send via Resend",
        requiredCapabilities: ["marketing"],
      },
      {
        href: "/workbench/social",
        label: "Social",
        detail: "LinkedIn via Make",
        requiredCapabilities: ["marketing"],
      },
      {
        href: "/workbench/outreach",
        label: "Outreach",
        detail: "One-off email blasts",
        requiredCapabilities: ["marketing"],
      },
    ],
  },
  {
    id: "sales",
    label: "Sales & Pay",
    href: "/workbench/sales",
    links: [
      {
        href: "/workbench/sales",
        label: "Sales",
        detail: "Log conversions",
        requiredCapabilities: ["sales"],
      },
      {
        href: "/workbench/service",
        label: "Service",
        detail: "Field repair & site jobs",
        requiredCapabilities: ["technician", "support"],
      },
      {
        href: "/workbench/team",
        label: "Team",
        detail: "Staff profiles and pay packages",
        ownerOnly: true,
      },
      {
        href: "/workbench/mypay",
        label: "My Pay",
        detail: "Accept your terms",
        hideForOwner: true,
      },
      {
        href: "/workbench/payroll",
        label: "Payroll",
        detail: "Payout dashboard",
        accountingOnly: true,
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    href: "/workbench/parts",
    links: [
      {
        href: "/workbench/parts",
        label: "Parts",
        detail: "Stock and pricing",
        requiredCapabilities: ["sales", "support", "technician"],
      },
      {
        href: "/workbench/categories",
        label: "Categories",
        detail: "Part categories",
        requiredCapabilities: ["sales", "support", "technician"],
      },
      {
        href: "/workbench/competitors",
        label: "Competitors",
        detail: "Firecrawl listings + price compare",
        requiredCapabilities: ["sales", "marketing"],
      },
      {
        href: "/workbench/import",
        label: "Import",
        detail: "Bulk parts upload",
        requiredCapabilities: ["sales", "support", "technician"],
      },
      {
        href: "/workbench/alerts",
        label: "Alerts",
        detail: "Back-in-stock subscribers",
        requiredCapabilities: ["sales", "support", "technician"],
      },
    ],
  },
];

export type StaffAccess = {
  staffTier: string;
  effectiveCapabilities: string[];
};

export function canAccessNavLink(access: StaffAccess | null, link: WorkbenchNavLink): boolean {
  if (!access) return true; // show all until loaded (API still enforces)
  const isOwner = access.staffTier === "owner";
  if (link.hideForOwner && isOwner) return false;
  if (link.ownerOnly) return isOwner;
  if (link.accountingOnly) {
    return isOwner || access.effectiveCapabilities.includes("accounting");
  }
  const needed = link.requiredCapabilities;
  if (!needed || needed.length === 0) return true;
  if (isOwner) return true;
  return needed.some((c) => access.effectiveCapabilities.includes(c));
}

export function filterNavGroups(
  groups: WorkbenchNavGroup[],
  access: StaffAccess | null,
): WorkbenchNavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      links: g.links.filter((l) => canAccessNavLink(access, l)),
    }))
    .filter((g) => g.links.length > 0);
}

export function isWorkbenchLinkActive(pathname: string, href: string): boolean {
  if (href === "/workbench") return pathname === "/workbench";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isWorkbenchGroupActive(pathname: string, group: WorkbenchNavGroup): boolean {
  return group.links.some((l) => isWorkbenchLinkActive(pathname, l.href));
}
