from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest

from app.customer_utils import (
    email_local_part_name,
    guessed_logo_url,
    hostname_for_logo,
    normalize_website,
    parse_first_name,
    customer_template_variables,
)
from app.models import Customer


def test_parse_first_name_skips_honorific():
    assert parse_first_name("Dr. Jane Doe") == "Jane"
    assert parse_first_name("Jane Doe") == "Jane"


def test_email_local_part_name():
    assert email_local_part_name("jane.doe@example.com") == "Jane"


def test_normalize_website_adds_scheme():
    assert normalize_website("example.com") == "https://example.com"
    assert normalize_website("https://x.org") == "https://x.org"
    assert normalize_website("") is None


def test_guessed_logo_from_website_not_gmail():
    assert hostname_for_logo("https://lakeside-imaging.example.com", "a@gmail.com") == (
        "lakeside-imaging.example.com"
    )
    assert hostname_for_logo(None, "ops@metrohealth-imaging.example.com") == (
        "metrohealth-imaging.example.com"
    )
    assert hostname_for_logo(None, "person@gmail.com") is None
    url = guessed_logo_url("https://riverside-petct.example.com", "x@gmail.com")
    assert url and "riverside-petct.example.com" in url


def test_customer_template_variables_first_name_fallback():
    c = Customer(
        id=uuid.uuid4(),
        email="bob.smith@example.com",
        name=None,
        company="Acme",
        tags=[],
        consent_marketing=False,
    )
    vars = customer_template_variables(c)
    assert vars["first_name"] == "Bob"
    assert vars["email"] == "bob.smith@example.com"


def test_resolve_outreach_audience_dedupes():
    from app.outreach import resolve_outreach_audience

    db = MagicMock()
    cid = uuid.uuid4()
    customer = Customer(
        id=cid,
        email="a@example.com",
        name="A",
        tags=[],
        consent_marketing=True,
    )
    db.get.return_value = customer

    audience = resolve_outreach_audience(
        db,
        customer_ids=[cid],
        segment_ids=[],
        manual_emails=["a@example.com"],
    )
    assert len(audience) == 1
    assert audience[0][0] == "a@example.com"
    assert audience[0][1] is customer
