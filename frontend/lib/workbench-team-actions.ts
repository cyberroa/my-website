export type TeamActionState = "In progress" | "Scheduled" | "Pending";

export type TeamActionItem = {
  n: string;
  action: string;
  account: string;
  state: TeamActionState;
  href: string;
};

export const TEAM_ACTION_STATE_STYLE = {
  "In progress": {
    mark: "bg-accent-admin text-black",
    account: "text-accent-admin",
    badge: "border-accent-admin/45 bg-accent-admin/15 text-accent-admin",
  },
  Scheduled: {
    mark: "border border-accent-caution/60 bg-accent-caution/10 text-accent-caution",
    account: "text-accent-caution",
    badge: "border-accent-caution/45 bg-accent-caution/10 text-accent-caution",
  },
  Pending: {
    mark: "border border-accent-titanium/40 bg-white/5 text-accent-titanium",
    account: "text-accent-titanium",
    badge: "border-white/20 bg-white/5 text-accent-titanium",
  },
} as const;

/** Placeholder queue until Actions is driven fully by Analytics progressions. */
export const MOCK_TEAM_ACTIONS: TeamActionItem[] = [
  {
    n: "01",
    action: "Send personalized service outreach",
    account: "Cityview Medical Center",
    state: "In progress",
    href: "/workbench/studio?mode=agent&customer_q=Cityview+Medical+Center",
  },
  {
    n: "02",
    action: "Follow up on a PET/CT proposal",
    account: "Northshore Imaging",
    state: "Scheduled",
    href: "/workbench/customers?search=Northshore+Imaging",
  },
  {
    n: "03",
    action: "Review engaged webinar audience",
    account: "12 new contacts",
    state: "Pending",
    href: "/workbench/segments",
  },
];
