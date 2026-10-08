"""F0 · GET /health, GET /models y GET /models/{modelId} contra docs/openapi.yaml."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import DATA_DIR
from app.repositories.catalog import CatalogRepo

CATALOG_IDS = ["dolphin", "seagull", "yuan-up", "song-plus", "seal", "shark"]
SUMMARY_REQUIRED = {"id", "name", "price", "segment", "rangeKm", "thumbnail"}
SUMMARY_ALLOWED = SUMMARY_REQUIRED | {"has3d"}
HOTSPOT_ENUM = {"wheels", "seats", "screen", "battery", "trunk", "lights"}


def _raw_catalog() -> dict[str, dict]:
    raw = json.loads((DATA_DIR / "catalog.json").read_text(encoding="utf-8-sig"))
    return {m["id"]: m for m in raw["models"]}


def test_health_returns_200(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_models_returns_the_six_catalog_ids_in_order(client: TestClient) -> None:
    response = client.get("/models")
    assert response.status_code == 200
    assert [m["id"] for m in response.json()] == CATALOG_IDS


def test_list_models_has_model_summary_shape_in_camel_case(client: TestClient) -> None:
    items = client.get("/models").json()
    assert len(items) == 6
    for item in items:
        assert SUMMARY_REQUIRED <= set(item) <= SUMMARY_ALLOWED, item
        assert isinstance(item["rangeKm"], int)
        assert isinstance(item["price"], int | float)
        assert isinstance(item["has3d"], bool)
        assert "range_km" not in item
        assert "specs" not in item and "hotspots" not in item


def test_get_model_returns_full_model_with_specs_and_hotspots(client: TestClient) -> None:
    # El modelo con vista 3D es el BYD Seagull (el .glb de la web es un Seagull).
    response = client.get("/models/seagull")
    assert response.status_code == 200
    body = response.json()
    raw = _raw_catalog()["seagull"]
    assert body["id"] == "seagull"
    assert body["name"] == raw["name"]
    assert body["price"] == raw["price"]
    assert body["rangeKm"] == raw["rangeKm"]
    assert body["has3d"] is True
    # specs pasan íntegras desde el catálogo (sin inventar ni perder nada)
    assert body["specs"] == raw["specs"]
    assert len(body["hotspots"]) == 6
    assert [h["id"] for h in body["hotspots"]] == [h["id"] for h in raw["hotspots"]]
    for hotspot in body["hotspots"]:
        assert set(hotspot) == {"id", "label", "position"}
        assert len(hotspot["position"]) == 3
        assert all(isinstance(coord, int | float) for coord in hotspot["position"])


def test_get_model_without_3d_has_empty_hotspots_and_its_specs(client: TestClient) -> None:
    body = client.get("/models/dolphin").json()
    assert body["has3d"] is False
    assert body["hotspots"] == []
    assert body["specs"] == _raw_catalog()["dolphin"]["specs"]  # ficha completa, sin 3D


@pytest.mark.parametrize("model_id", ["no-existe", "DOLPHIN", "dolphin "])
def test_get_unknown_model_returns_404(client: TestClient, model_id: str) -> None:
    response = client.get(f"/models/{model_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Modelo no encontrado"


def test_routes_are_not_under_api_prefix(client: TestClient) -> None:
    assert client.get("/api/models").status_code == 404
    assert client.get("/api/health").status_code == 404


def test_generated_openapi_get_model_uses_contract_param_and_declares_404(
    client: TestClient,
) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    get_model = paths["/models/{modelId}"]["get"]
    assert get_model["operationId"] == "getModel"
    assert get_model["parameters"][0]["name"] == "modelId"
    assert "404" in get_model["responses"]


def test_catalog_hotspot_ids_stay_inside_contract_enum(client: TestClient) -> None:
    hotspots = [h for mid in CATALOG_IDS for h in client.get(f"/models/{mid}").json()["hotspots"]]
    assert len(hotspots) == 6
    assert all(h["id"] in HOTSPOT_ENUM for h in hotspots)


def test_catalog_repo_rejects_hotspot_outside_contract_enum(tmp_path: Path) -> None:
    bad = {
        "models": [
            {
                "id": "x",
                "name": "X",
                "price": 1,
                "segment": "s",
                "rangeKm": 1,
                "thumbnail": "/x.jpg",
                "hotspots": [{"id": "engine", "label": "Motor", "position": [0, 0, 0]}],
            }
        ]
    }
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(bad), encoding="utf-8")
    with pytest.raises(ValidationError):
        CatalogRepo.from_file(path)


def test_catalog_repo_rejects_duplicate_ids(tmp_path: Path) -> None:
    item = {"id": "dup", "name": "D", "price": 1, "segment": "s", "rangeKm": 1, "thumbnail": "/d"}
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps({"models": [item, item]}), encoding="utf-8")
    with pytest.raises(ValueError, match="duplicados"):
        CatalogRepo.from_file(path)
