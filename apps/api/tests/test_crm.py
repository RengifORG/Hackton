"""F1 · adapters/crm.py: FakeCrm, HubSpotCrm (sin red, con httpx.MockTransport) y selección."""

from __future__ import annotations

import json
from datetime import datetime

import httpx
import pytest
from pydantic import SecretStr

from app.adapters.crm import CrmError, FakeCrm, HubSpotCrm, build_crm
from app.core.clock import ECUADOR_TZ
from app.core.config import Settings
from app.schemas.lead import CrmStatus, Lead


def make_lead(**overrides: object) -> Lead:
    data: dict[str, object] = {
        "id": "lead-1",
        "name": "Ana Prueba",
        "phone": "0991234567",
        "email": "ana.prueba@example.com",
        "source": "web",
        "consent": True,
        "created_at": datetime(2026, 10, 8, 19, 0, tzinfo=ECUADOR_TZ),
        "after_hours": True,
        "crm_status": CrmStatus.PENDING,
    }
    data.update(overrides)
    return Lead.model_validate(data)


def test_fake_crm_records_calls_and_can_simulate_failure() -> None:
    crm = FakeCrm()
    crm.push_lead(make_lead())
    assert [lead.id for lead in crm.calls] == ["lead-1"]

    crm.fail = True
    with pytest.raises(CrmError):
        crm.push_lead(make_lead(id="lead-2"))
    assert len(crm.calls) == 2


def test_hubspot_crm_creates_a_contact_with_bearer_token() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(201, json={"id": "hs-123"})

    client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://api.test")
    crm = HubSpotCrm(token="pat-test-token", client=client)

    external_id = crm.push_lead(make_lead())

    assert external_id == "hs-123"
    assert len(seen) == 1
    request = seen[0]
    assert request.method == "POST"
    assert request.url.path == "/crm/v3/objects/contacts"
    assert request.headers["Authorization"] == "Bearer pat-test-token"
    assert json.loads(request.content) == {
        "properties": {
            "firstname": "Ana Prueba",
            "phone": "0991234567",
            "email": "ana.prueba@example.com",
            "lifecyclestage": "lead",
        }
    }


def test_hubspot_crm_omits_email_when_the_lead_has_none() -> None:
    bodies: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        return httpx.Response(201, json={"id": "hs-9"})

    client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://api.test")
    HubSpotCrm(token="t", client=client).push_lead(make_lead(email=None))

    assert "email" not in bodies[0]["properties"]  # type: ignore[operator]


@pytest.mark.parametrize("status", [400, 401, 409, 500])
def test_hubspot_crm_raises_crm_error_without_leaking_the_body(status: int) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json={"message": "Contact 0991234567 already exists"})

    client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://api.test")

    with pytest.raises(CrmError) as excinfo:
        HubSpotCrm(token="t", client=client).push_lead(make_lead())

    assert str(status) in str(excinfo.value)
    assert "0991234567" not in str(excinfo.value)


def test_build_crm_uses_hubspot_only_when_a_token_is_configured() -> None:
    without = Settings(_env_file=None, hubspot_token=None)
    with_token = Settings(_env_file=None, hubspot_token=SecretStr("pat-test-token"))

    assert isinstance(build_crm(without), FakeCrm)
    assert isinstance(build_crm(with_token), HubSpotCrm)
