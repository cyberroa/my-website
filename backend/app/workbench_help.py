"""Guide catalog and keyword matching for Workbench help."""

from __future__ import annotations

GUIDES: list[dict[str, str]] = [
    {
        "slug": "studio",
        "title": "AI Studio",
        "feature_href": "/workbench/studio",
        "summary": "Generate marketing email, social, and outreach copy (and images) with brand presets.",
        "keywords": "studio ai prompt image generate preset marketing copy",
    },
    {
        "slug": "analytics",
        "title": "Analytics",
        "feature_href": "/workbench/analytics",
        "summary": "Live visitors, lead-stage pipeline, and engagement progressions.",
        "keywords": "analytics pipeline visitors live agent engagement",
    },
    {
        "slug": "insights",
        "title": "Market Map",
        "feature_href": "/workbench/insights",
        "summary": "Explore CRM relationships as a graph (customers, opportunities, competitors).",
        "keywords": "insights market map graph",
    },
    {
        "slug": "briefings",
        "title": "Briefings",
        "feature_href": "/workbench/briefings",
        "summary": "Daily AI staff reports summarizing activity and priorities.",
        "keywords": "briefing daily report cron",
    },
    {
        "slug": "customers",
        "title": "Customers",
        "feature_href": "/workbench/customers",
        "summary": "Customer list, import, and 360° timeline.",
        "keywords": "customer crm dossier logo import list",
    },
    {
        "slug": "segments",
        "title": "Segments",
        "feature_href": "/workbench/segments",
        "summary": "Audience filters for campaigns and outreach.",
        "keywords": "segment audience filter",
    },
    {
        "slug": "goals",
        "title": "Goals",
        "feature_href": "/workbench/goals",
        "summary": "Opportunity-driven segments.",
        "keywords": "goal opportunity audit used new system parts",
    },
    {
        "slug": "templates",
        "title": "Templates",
        "feature_href": "/workbench/templates",
        "summary": "Reusable email copy.",
        "keywords": "template email copy",
    },
    {
        "slug": "campaigns",
        "title": "Campaigns",
        "feature_href": "/workbench/campaigns",
        "summary": "Send campaigns via Resend.",
        "keywords": "campaign resend send email blast",
    },
    {
        "slug": "social",
        "title": "Social",
        "feature_href": "/workbench/social",
        "summary": "LinkedIn via Make.",
        "keywords": "social linkedin make",
    },
    {
        "slug": "outreach",
        "title": "Outreach",
        "feature_href": "/workbench/outreach",
        "summary": "One-off email blasts.",
        "keywords": "outreach blast one-off",
    },
    {
        "slug": "sales",
        "title": "Sales",
        "feature_href": "/workbench/sales",
        "summary": "Log conversions and commissions.",
        "keywords": "sales won conversion commission",
    },
    {
        "slug": "service",
        "title": "Service",
        "feature_href": "/workbench/service",
        "summary": "Field repair and site jobs.",
        "keywords": "service job audit technician field",
    },
    {
        "slug": "team",
        "title": "Team",
        "feature_href": "/workbench/team",
        "summary": "Staff roster and pay packages (owner).",
        "keywords": "team staff roster role",
    },
    {
        "slug": "mypay",
        "title": "My Pay",
        "feature_href": "/workbench/mypay",
        "summary": "Accept your pay package.",
        "keywords": "pay package accept mypay",
    },
    {
        "slug": "payroll",
        "title": "Payroll",
        "feature_href": "/workbench/payroll",
        "summary": "Payout ledger.",
        "keywords": "payroll payout accounting",
    },
    {
        "slug": "parts",
        "title": "Parts",
        "feature_href": "/workbench/parts",
        "summary": "Inventory stock and pricing.",
        "keywords": "parts inventory stock",
    },
    {
        "slug": "categories",
        "title": "Categories",
        "feature_href": "/workbench/categories",
        "summary": "Part category taxonomy.",
        "keywords": "category categories taxonomy",
    },
    {
        "slug": "competitors",
        "title": "Competitors",
        "feature_href": "/workbench/competitors",
        "summary": "Firecrawl listings and price compare.",
        "keywords": "competitor scrape firecrawl price",
    },
    {
        "slug": "import",
        "title": "Import",
        "feature_href": "/workbench/import",
        "summary": "Bulk parts upload.",
        "keywords": "import csv upload parts",
    },
    {
        "slug": "alerts",
        "title": "Alerts",
        "feature_href": "/workbench/alerts",
        "summary": "Back-in-stock subscriber list.",
        "keywords": "alert restock subscriber",
    },
]


def guide_href(slug: str) -> str:
    return f"/workbench/guides/{slug}"


def catalog_prompt() -> str:
    lines = [
        "You help Titan Imaging staff use Workbench. Answer only from this catalog.",
        "Always point them to the matching guide and the sitemap at /workbench.",
        "Do not invent pages. If unsure, send them to /workbench/guides.",
        "",
        "Guides:",
    ]
    for g in GUIDES:
        lines.append(
            f"- {g['title']}: {g['summary']} Feature: {g['feature_href']} Guide: {guide_href(g['slug'])}"
        )
    lines.append("- Sitemap / operations home: /workbench")
    lines.append("- All guides: /workbench/guides")
    return "\n".join(lines)


def match_guides(message: str, *, limit: int = 3) -> list[dict[str, str]]:
    text = (message or "").lower()
    scored: list[tuple[int, dict[str, str]]] = []
    for g in GUIDES:
        hay = f"{g['title']} {g['summary']} {g['keywords']} {g['slug']}".lower()
        score = 0
        for token in {t for t in text.replace("/", " ").split() if len(t) > 2}:
            if token in hay:
                score += 2
            if token in g["slug"] or token in g["title"].lower():
                score += 3
        if score:
            scored.append((score, g))
    scored.sort(key=lambda x: -x[0])
    picked = [g for _, g in scored[:limit]]
    if not picked:
        return [{"title": "Workbench guides", "href": "/workbench/guides"}]
    out = [{"title": g["title"], "href": guide_href(g["slug"])} for g in picked]
    out.append({"title": "Sitemap & operations home", "href": "/workbench"})
    # unique hrefs
    seen: set[str] = set()
    unique: list[dict[str, str]] = []
    for item in out:
        if item["href"] in seen:
            continue
        seen.add(item["href"])
        unique.append(item)
    return unique


def fallback_answer(message: str, guides: list[dict[str, str]]) -> str:
    names = ", ".join(g["title"] for g in guides)
    return (
        "AI help is not configured right now. Open the sitemap on the Workbench home page "
        f"(/workbench) or these guides: {names}."
    )
