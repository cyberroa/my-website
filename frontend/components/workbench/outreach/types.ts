export type OutreachCustomer = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  role: string | null;
  website: string | null;
};

export type OutreachSegment = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  member_count?: number;
};

export type OutreachTemplate = {
  id: string;
  name: string;
  slug: string;
  subject: string;
  body_md: string;
  body_html: string | null;
};

export type CustomerListResponse = {
  items: OutreachCustomer[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

export type SegmentListResponse = {
  items: OutreachSegment[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

export type AudienceState = {
  customers: OutreachCustomer[];
  segments: (OutreachSegment & { member_count: number })[];
  manualEmails: string[];
};

export type OutreachPreview = {
  recipient_count: number;
  sample_email: string;
  sample_name: string | null;
  subject: string;
  html: string;
  text: string;
};

export const MERGE_VARIABLES = [
  "name",
  "first_name",
  "company",
  "email",
  "phone",
  "role",
  "website",
] as const;

export const DRAG_CUSTOMER = "application/x-titan-customer";
export const DRAG_SEGMENT = "application/x-titan-segment";
