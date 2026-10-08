"""Guarda estructural contra docs/openapi.yaml (en F6 se añade la conformidad con schemathesis).

Cada ruta que expone la app debe existir en el contrato con el mismo método y `operationId`.
"""

from __future__ import annotations

from typing import Any

import yaml
from fastapi.testclient import TestClient

from app.core.config import REPO_ROOT

CONTRACT_PATH = REPO_ROOT / "docs" / "openapi.yaml"
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}


def _operations(spec: dict[str, Any]) -> dict[tuple[str, str], str]:
    return {
        (path, method): operation["operationId"]
        for path, item in spec["paths"].items()
        for method, operation in item.items()
        if method in HTTP_METHODS
    }


def test_every_exposed_operation_exists_in_the_contract_with_same_operation_id(
    client: TestClient,
) -> None:
    contract = _operations(yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8")))
    exposed = _operations(client.get("/openapi.json").json())

    assert exposed, "la app no expone operaciones"
    unknown = {op: op_id for op, op_id in exposed.items() if op not in contract}
    assert unknown == {}, f"operaciones fuera del contrato: {unknown}"
    assert {op: contract[op] for op in exposed} == exposed


def test_f0_and_f1_operations_are_implemented(client: TestClient) -> None:
    exposed = _operations(client.get("/openapi.json").json())
    assert set(exposed.values()) >= {"health", "listModels", "getModel", "createLead", "listLeads"}
