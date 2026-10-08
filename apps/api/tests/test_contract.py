"""Guarda contra docs/openapi.yaml (en F6 se añade la conformidad con schemathesis).

1. Cada ruta que expone la app existe en el contrato con el mismo método y `operationId`.
2. Las respuestas reales validan contra el JSON Schema del contrato (`components.schemas`).
"""

from __future__ import annotations

from typing import Any

import jsonschema_rs
import pytest
import yaml
from fastapi.testclient import TestClient

from app.core.config import REPO_ROOT

CONTRACT_PATH = REPO_ROOT / "docs" / "openapi.yaml"
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}


@pytest.fixture(scope="module")
def contract() -> dict[str, Any]:
    return yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))


def _operations(spec: dict[str, Any]) -> dict[tuple[str, str], str]:
    return {
        (path, method): operation["operationId"]
        for path, item in spec["paths"].items()
        for method, operation in item.items()
        if method in HTTP_METHODS
    }


def assert_matches_schema(contract: dict[str, Any], schema_name: str, instance: Any) -> None:
    """Valida `instance` contra `components.schemas.<schema_name>` (JSON Schema 2020-12)."""
    root = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$ref": f"#/components/schemas/{schema_name}",
        "components": contract["components"],
    }
    errors = [f"{e.instance_path}: {e.message}" for e in jsonschema_rs.iter_errors(root, instance)]
    assert errors == [], f"{schema_name} no cumple el contrato: {errors}"


def test_every_exposed_operation_exists_in_the_contract_with_same_operation_id(
    client: TestClient, contract: dict[str, Any]
) -> None:
    expected = _operations(contract)
    exposed = _operations(client.get("/openapi.json").json())

    assert exposed, "la app no expone operaciones"
    unknown = {op: op_id for op, op_id in exposed.items() if op not in expected}
    assert unknown == {}, f"operaciones fuera del contrato: {unknown}"
    assert {op: expected[op] for op in exposed} == exposed


def test_f0_to_f2_operations_are_implemented(client: TestClient) -> None:
    exposed = _operations(client.get("/openapi.json").json())
    assert set(exposed.values()) >= {
        "health",
        "listModels",
        "getModel",
        "createLead",
        "listLeads",
        "availability",
        "createAppointment",
        "listAppointments",
        "chat",
    }


def test_chat_responses_match_contract_schemas(
    client: TestClient, contract: dict[str, Any]
) -> None:
    request = {
        "sessionId": "sess-contract-chat",
        "message": "cuéntame de las llantas",
        "modelId": "dolphin",
    }
    assert_matches_schema(contract, "ChatRequest", request)
    response = client.post("/chat", json=request)
    assert response.status_code == 200
    assert_matches_schema(contract, "ChatResponse", response.json())
    assert_matches_schema(
        contract,
        "ChatResponse",
        client.post("/chat", json={"sessionId": "sess-contract-chat", "message": "hola"}).json(),
    )


def test_models_responses_match_contract_schemas(
    client: TestClient, contract: dict[str, Any]
) -> None:
    for item in client.get("/models").json():
        assert_matches_schema(contract, "ModelSummary", item)
    assert_matches_schema(contract, "Model", client.get("/models/dolphin").json())


def test_leads_responses_match_contract_schemas(
    client: TestClient, contract: dict[str, Any]
) -> None:
    payload = {
        "name": "Ana Prueba",
        "phone": "0991234567",
        "email": "ana.prueba@example.com",
        "source": "web",
        "interest": "Prueba de manejo",
        "recommendedModels": ["dolphin"],
        "consent": True,
        "sessionId": "sess-contract-01",
    }
    assert_matches_schema(contract, "LeadCreate", payload)

    created = client.post("/leads", json=payload).json()
    assert_matches_schema(contract, "Lead", created)

    for item in client.get("/leads").json():
        assert_matches_schema(contract, "LeadRead", item)


def test_appointments_responses_match_contract_schemas(
    client: TestClient, contract: dict[str, Any]
) -> None:
    lead = client.post(
        "/leads",
        json={"name": "Ana Prueba", "phone": "0991234567", "source": "web", "consent": True},
    ).json()
    for slot in client.get(
        "/availability", params={"type": "service", "date": "2026-10-09"}
    ).json():
        assert_matches_schema(contract, "Slot", slot)

    for appointment_type, slot_id in (
        ("test_drive", "td-2026-10-09-10"),
        ("service", "sv-2026-10-09-10"),
    ):
        payload = {"leadId": lead["id"], "type": appointment_type, "slotId": slot_id, "notes": "n"}
        assert_matches_schema(contract, "AppointmentCreate", payload)
        created = client.post("/appointments", json=payload)
        assert created.status_code == 201
        assert_matches_schema(contract, "Appointment", created.json())

    for item in client.get("/appointments").json():
        assert_matches_schema(contract, "Appointment", item)


def test_contract_validation_is_not_a_no_op(contract: dict[str, Any]) -> None:
    with pytest.raises(AssertionError):
        assert_matches_schema(contract, "LeadRead", {"id": "x", "phone": "0991234567"})
