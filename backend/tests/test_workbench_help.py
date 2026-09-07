from __future__ import annotations

from types import SimpleNamespace

from app.staff_permissions import can_access_route, require_owner_or_ops_lead
from app.workbench_help import fallback_answer, match_guides


def test_match_guides_studio():
    links = match_guides("How do I generate an image in AI Studio?")
    hrefs = [g["href"] for g in links]
    assert "/workbench/guides/studio" in hrefs
    assert "/workbench" in hrefs


def test_match_guides_fallback_index():
    links = match_guides("zzzz unrelated xyz")
    assert links[0]["href"] == "/workbench/guides"


def test_fallback_answer_mentions_sitemap():
    guides = match_guides("campaigns")
    text = fallback_answer("campaigns", guides)
    assert "/workbench" in text


def test_staff_feedback_route_owner_and_admin():
    owner = SimpleNamespace(staff_tier="owner", role="owner", capabilities=[])
    admin = SimpleNamespace(staff_tier="admin", role="admin", capabilities=[])
    staff = SimpleNamespace(staff_tier="staff", role="staff", capabilities=["sales"])
    assert can_access_route(owner, "staff_feedback")
    assert can_access_route(admin, "staff_feedback")
    assert not can_access_route(staff, "staff_feedback")


def test_require_owner_or_ops_lead_staff():
    staff = SimpleNamespace(staff_tier="staff", role="staff", capabilities=[])
    try:
        require_owner_or_ops_lead(staff)
        raise AssertionError("expected 403")
    except Exception as e:
        assert getattr(e, "status_code", None) == 403
