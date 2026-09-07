"""Staff tier + capability checks for Titan Workbench RBAC."""

from __future__ import annotations

from typing import Any, Iterable

from fastapi import HTTPException

from app.models import WorkbenchStaff

STAFF_TIERS = frozenset({"owner", "admin", "staff"})

CAPABILITIES = frozenset({"marketing", "sales", "support", "accounting", "technician"})

# Trusted ops lead (admin tier) — all work areas except accounting / owner-only
ADMIN_TIER_CAPS = frozenset({"marketing", "sales", "support", "technician"})

ALL_CAPS = frozenset(CAPABILITIES)

# Display labels for Team UI
TIER_LABELS = {
    "owner": "Owner",
    "admin": "Ops lead",
    "staff": "Staff",
}

CAP_LABELS = {
    "marketing": "Marketing",
    "sales": "Sales",
    "support": "Support",
    "accounting": "Accounting",
    "technician": "Technician",
}

# Nav / route → any of these capabilities (empty = any authenticated staff)
ROUTE_CAPABILITIES: dict[str, frozenset[str]] = {
    "ai_studio": frozenset({"marketing"}),
    "briefings": frozenset({"marketing"}),
    "live": frozenset({"sales", "marketing"}),
    "insights": frozenset({"sales", "marketing"}),
    "customers": frozenset({"sales", "support", "marketing"}),
    "segments": frozenset({"sales", "support", "marketing"}),
    "goals": frozenset({"sales", "support", "marketing"}),
    "templates": frozenset({"marketing"}),
    "campaigns": frozenset({"marketing"}),
    "social": frozenset({"marketing"}),
    "outreach": frozenset({"marketing"}),
    "sales": frozenset({"sales"}),
    "service": frozenset({"technician", "support"}),
    "my_pay": frozenset(),  # non-owner staff only (see can_access_route)
    "team": frozenset(),  # owner tier only — checked separately
    "payroll": frozenset({"accounting"}),
    "parts": frozenset({"sales", "support", "technician"}),
    "categories": frozenset({"sales", "support", "technician"}),
    "competitors": frozenset({"sales", "marketing"}),
    "import": frozenset({"sales", "support", "technician"}),
    "alerts": frozenset({"sales", "support", "technician"}),
    "staff_feedback": frozenset(),  # owner + ops lead — checked separately
    "actions": frozenset({"sales", "marketing", "support"}),
}

# href → route id for nav filtering
HREF_ROUTE_IDS: dict[str, str] = {
    "/workbench/studio": "ai_studio",
    "/workbench/actions": "actions",
    "/workbench/analytics": "live",
    "/workbench/briefings": "briefings",
    "/workbench/live": "live",
    "/workbench/insights": "insights",
    "/workbench/customers": "customers",
    "/workbench/segments": "segments",
    "/workbench/goals": "goals",
    "/workbench/templates": "templates",
    "/workbench/campaigns": "campaigns",
    "/workbench/social": "social",
    "/workbench/outreach": "outreach",
    "/workbench/sales": "sales",
    "/workbench/service": "service",
    "/workbench/mypay": "my_pay",
    "/workbench/team": "team",
    "/workbench/payroll": "payroll",
    "/workbench/parts": "parts",
    "/workbench/categories": "categories",
    "/workbench/competitors": "competitors",
    "/workbench/import": "import",
    "/workbench/alerts": "alerts",
    "/workbench/feedback": "staff_feedback",
}


def normalize_capabilities(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        c = str(item).strip().lower()
        if c in CAPABILITIES and c not in out:
            out.append(c)
    return out


def normalize_tier(raw: str | None, *, legacy_role: str | None = None) -> str:
    tier = (raw or "").strip().lower()
    if tier in STAFF_TIERS:
        return tier
    role = (legacy_role or "").strip().lower()
    if role == "owner":
        return "owner"
    if role == "admin":
        return "admin"
    return "staff"


def effective_capabilities(staff: WorkbenchStaff) -> set[str]:
    tier = normalize_tier(getattr(staff, "staff_tier", None), legacy_role=getattr(staff, "role", None))
    if tier == "owner":
        return set(ALL_CAPS)
    if tier == "admin":
        return set(ADMIN_TIER_CAPS)
    return set(normalize_capabilities(getattr(staff, "capabilities", None) or []))


def is_owner_tier(staff: WorkbenchStaff) -> bool:
    return normalize_tier(getattr(staff, "staff_tier", None), legacy_role=getattr(staff, "role", None)) == "owner"


def is_ops_lead_tier(staff: WorkbenchStaff) -> bool:
    return normalize_tier(getattr(staff, "staff_tier", None), legacy_role=getattr(staff, "role", None)) == "admin"


def is_owner_or_ops_lead(staff: WorkbenchStaff) -> bool:
    return is_owner_tier(staff) or is_ops_lead_tier(staff)


def require_owner_or_ops_lead(staff: WorkbenchStaff) -> None:
    if not is_owner_or_ops_lead(staff):
        raise HTTPException(status_code=403, detail="Owner or ops lead access required")


def has_capability(staff: WorkbenchStaff, capability: str) -> bool:
    return capability in effective_capabilities(staff)


def has_any_capability(staff: WorkbenchStaff, caps: Iterable[str]) -> bool:
    needed = set(caps)
    if not needed:
        return True
    return bool(effective_capabilities(staff) & needed)


def require_owner_tier(staff: WorkbenchStaff) -> None:
    if not is_owner_tier(staff):
        raise HTTPException(status_code=403, detail="Owner access required")


def require_capability(staff: WorkbenchStaff, capability: str) -> None:
    if is_owner_tier(staff):
        return
    if not has_capability(staff, capability):
        raise HTTPException(status_code=403, detail=f"{capability} access required")


def require_any_capability(staff: WorkbenchStaff, *capabilities: str) -> None:
    if is_owner_tier(staff):
        return
    if not has_any_capability(staff, capabilities):
        raise HTTPException(
            status_code=403,
            detail=f"Requires one of: {', '.join(capabilities)}",
        )


def require_accounting(staff: WorkbenchStaff) -> None:
    """Payroll dashboard / ledger / adhoc — accounting capability or owner."""
    if is_owner_tier(staff) or has_capability(staff, "accounting"):
        return
    raise HTTPException(status_code=403, detail="Accounting access required")


def can_access_route(staff: WorkbenchStaff, route_id: str) -> bool:
    if route_id == "team":
        return is_owner_tier(staff)
    if route_id == "staff_feedback":
        return is_owner_or_ops_lead(staff)
    if route_id == "payroll":
        return is_owner_tier(staff) or has_capability(staff, "accounting")
    # My Pay is for staff accepting packages — owners use Team + Payroll instead
    if route_id == "my_pay":
        return not is_owner_tier(staff)
    caps = ROUTE_CAPABILITIES.get(route_id)
    if caps is None:
        return True
    if not caps:
        return True
    return is_owner_tier(staff) or has_any_capability(staff, caps)


def can_access_href(staff: WorkbenchStaff, href: str) -> bool:
    route_id = HREF_ROUTE_IDS.get(href)
    if not route_id:
        return True
    return can_access_route(staff, route_id)


def default_landing_href(staff: WorkbenchStaff) -> str:
    """First allowed workbench page for post-login redirect."""
    preference = [
        "/workbench",
        "/workbench/studio",
        "/workbench/service",
        "/workbench/sales",
        "/workbench/customers",
        "/workbench/campaigns",
        "/workbench/payroll",
        "/workbench/parts",
        "/workbench/mypay",
    ]
    for href in preference:
        if can_access_href(staff, href):
            return href
    return "/workbench"


def sync_legacy_role(staff: WorkbenchStaff) -> None:
    """Keep role column aligned with staff_tier for older code paths."""
    tier = normalize_tier(getattr(staff, "staff_tier", None), legacy_role=getattr(staff, "role", None))
    staff.role = "owner" if tier == "owner" else ("admin" if tier == "admin" else "staff")
