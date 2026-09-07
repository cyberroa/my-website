export type TeamActionState = "In progress" | "Scheduled" | "Pending";

export type TeamActionEventKind = "queued" | "studio" | "email" | "call" | "stage" | "audience";

export type TeamActionEvent = {
  at: string;
  kind: TeamActionEventKind;
  title: string;
  detail: string;
  stateAfter: TeamActionState;
};

export type TeamActionItem = {
  id: string;
  n: string;
  action: string;
  account: string;
  state: TeamActionState;
  workHref: string;
  workCta: string;
  /** Resolve to a dossier when this customer exists in CRM. */
  customerSearch?: string;
  events: TeamActionEvent[];
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

export const TEAM_ACTION_KIND_STYLE: Record<TeamActionEventKind, string> = {
  queued: "border-white/20 bg-white/10 text-accent-titanium",
  studio: "border-accent-admin/40 bg-accent-admin/15 text-accent-admin",
  email: "border-accent-signal/40 bg-accent-signal/15 text-accent-signal",
  call: "border-accent-caution/40 bg-accent-caution/15 text-accent-caution",
  stage: "border-accent-admin/40 bg-accent-admin/15 text-accent-admin",
  audience: "border-accent-caution/40 bg-accent-caution/15 text-accent-caution",
};

/** Placeholder queue until Actions is driven fully by Analytics progressions. */
export const MOCK_TEAM_ACTIONS: TeamActionItem[] = [
  {
    id: "service-outreach",
    n: "01",
    action: "Send personalized service outreach",
    account: "Twin Rivers Scan Center",
    state: "In progress",
    workHref: "/workbench/studio?mode=agent",
    workCta: "Continue in AI Studio",
    customerSearch: "Twin Rivers Scan Center",
    events: [
      {
        at: "2026-09-07T12:05:00Z",
        kind: "queued",
        title: "Action opened",
        detail: "Operations Center queued service outreach for Twin Rivers Scan Center.",
        stateAfter: "Pending",
      },
      {
        at: "2026-09-07T13:20:00Z",
        kind: "stage",
        title: "Account attached",
        detail: "Dossier context pulled for the service conversation.",
        stateAfter: "Scheduled",
      },
      {
        at: "2026-09-07T14:40:00Z",
        kind: "studio",
        title: "Studio draft started",
        detail: "Personalized service note drafted in Agent mode. Awaiting send.",
        stateAfter: "In progress",
      },
    ],
  },
  {
    id: "proposal-followup",
    n: "02",
    action: "Follow up on a PET/CT proposal",
    account: "Northstar Imaging",
    state: "Scheduled",
    workHref: "/workbench/customers",
    workCta: "Open customer dossier",
    customerSearch: "Northstar Imaging",
    events: [
      {
        at: "2026-09-04T15:10:00Z",
        kind: "email",
        title: "Proposal sent",
        detail: "PET/CT upgrade options emailed to Northstar Imaging.",
        stateAfter: "Pending",
      },
      {
        at: "2026-09-06T10:00:00Z",
        kind: "call",
        title: "Callback requested",
        detail: "Account asked for a follow-up after internal review.",
        stateAfter: "Scheduled",
      },
      {
        at: "2026-09-07T09:00:00Z",
        kind: "queued",
        title: "Follow-up on today’s queue",
        detail: "Staff to review dossier history before the call.",
        stateAfter: "Scheduled",
      },
    ],
  },
  {
    id: "webinar-audience",
    n: "03",
    action: "Review engaged webinar audience",
    account: "12 new contacts",
    state: "Pending",
    workHref: "/workbench/segments",
    workCta: "Open segments",
    events: [
      {
        at: "2026-09-05T18:00:00Z",
        kind: "audience",
        title: "Webinar closed",
        detail: "Attendance export captured 12 new engaged contacts.",
        stateAfter: "Pending",
      },
      {
        at: "2026-09-06T11:30:00Z",
        kind: "queued",
        title: "Segment review queued",
        detail: "Needs a playbook pass before nurture or outreach.",
        stateAfter: "Pending",
      },
    ],
  },
];

export function getTeamAction(id: string): TeamActionItem | undefined {
  return MOCK_TEAM_ACTIONS.find((a) => a.id === id);
}

export function teamActionPath(id: string): string {
  return `/workbench/actions/${id}`;
}
