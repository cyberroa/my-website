/**
 * Public social profile URLs for footer and marketing surfaces.
 * Override via NEXT_PUBLIC_* in `.env.local` (restart dev server after changes).
 */
export const SOCIAL_LINKS = {
  linkedin:
    process.env.NEXT_PUBLIC_LINKEDIN_URL?.trim() ||
    "https://www.linkedin.com/company/titan-imaging-service",
  instagram:
    process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() ||
    "https://www.instagram.com/titanimagingservice",
  x:
    process.env.NEXT_PUBLIC_X_URL?.trim() ||
    "https://x.com/titanimagingservice",
} as const;
