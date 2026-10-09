"""H3 · El chat entiende frases naturales (reporte del equipo, 2026-10-08 21:31).

Casos reales: «quiero un byd y no sé cuál elegir», «cómo elijo un byd», «soy padre de familia y
tengo 3 hijos» caían en el mensaje de ayuda; la pantalla y las llantas del Seagull respondían
«No tengo ese dato» sin ofrecer nada. Sin LLM se resuelven con palabras clave y perfil; con LLM,
lo que no se reconoce lo clasifica `route_message` (esquema cerrado, sin acciones).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.llm import FakeLlm, LlmError, LlmResult, get_llm
from app.services.chat_service import HELP, NO_DATA, PROFILE_QUESTIONS
from app.services.recommendation_service import parse_passengers


@pytest.fixture
def use_llm(app: FastAPI) -> Callable[[FakeLlm], FakeLlm]:
    def install(fake: FakeLlm) -> FakeLlm:
        app.dependency_overrides[get_llm] = lambda: fake
        return fake

    return install


def say(client: TestClient, sid: str, message: str, **extra: Any) -> dict[str, Any]:
    response = client.post("/chat", json={"sessionId": sid, "message": message, **extra})
    assert response.status_code == 200, response.text
    return response.json()


def route(intent: str, **fields: Any) -> FakeLlm:
    return FakeLlm(
        LlmResult(
            tool_name="route_message",
            tool_input={"intent": intent, **fields},
            stop_reason="tool_use",
        )
    )


# ---------------------------------------------------------------- sin LLM (palabras clave y perfil)


@pytest.mark.parametrize(
    "message", ["quiero un byd y no se cual elegir", "como elijo un byd", "qué carro me conviene"]
)
def test_asking_for_help_to_choose_starts_the_profile(client: TestClient, message: str) -> None:
    say(client, "sess-ia-choose-1", "hola")
    body = say(client, "sess-ia-choose-1", message)
    assert body["reply"] == PROFILE_QUESTIONS


def test_a_message_with_the_profile_recommends_directly(client: TestClient) -> None:
    say(client, "sess-ia-profile-1", "hola")
    body = say(client, "sess-ia-profile-1", "soy padre de familia y tengo 3 hijos")
    assert body["reply"].startswith("Con tu perfil te recomiendo:")
    assert all(f"{n}. BYD" in body["reply"] for n in (1, 2, 3))


def test_choosing_with_profile_in_the_same_sentence_skips_the_questions(client: TestClient) -> None:
    body = say(client, "sess-ia-profile-2", "no sé cuál elegir, somos 5 y viajo por carretera")
    assert "Con tu perfil te recomiendo:" in body["reply"]


def test_kids_count_as_passengers() -> None:
    assert parse_passengers("soy padre de familia y tengo 3 hijos") == 5
    assert parse_passengers("tengo 2 niños") == 4


def test_autonomy_question_is_not_mistaken_for_choosing_a_car(client: TestClient) -> None:
    body = say(client, "sess-ia-autonomy", "qué autonomía tiene el seal")
    assert body["hotspot"] == "battery" and "570" in body["reply"]


def test_seagull_screen_now_comes_from_the_official_catalog(client: TestClient) -> None:
    body = say(client, "sess-ia-screen", "cuéntame de la pantalla", modelId="seagull")
    assert body["hotspot"] == "screen"
    assert "10.1" in body["reply"] and "Hi BYD" in body["reply"]


def test_missing_data_offers_what_we_do_know(client: TestClient) -> None:
    say(client, "sess-ia-nodata", "hola", modelId="seagull")
    body = say(client, "sess-ia-nodata", "¿y las llantas?", modelId="seagull")
    assert body["reply"].startswith(NO_DATA)
    assert "Del BYD Seagull sí puedo contarte:" in body["reply"]
    assert "pantalla" in body["reply"] and "llantas" not in body["reply"].split(":", 1)[1]


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("¿cuál es el más barato?", "El más económico es el BYD Seagull: desde USD 17.990"),
        ("cuál tiene más autonomía?", "El de mayor autonomía es el BYD Shark"),
        ("y el más caro?", "El de mayor precio es el BYD Shark"),
    ],
)
def test_comparisons_are_answered_exactly_from_the_catalog(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm], message: str, expected: str
) -> None:
    fake = use_llm(route("other", reply="no debería usarse"))
    say(client, "sess-ia-compare", "hola")
    assert say(client, "sess-ia-compare", message)["reply"].startswith(expected)
    assert fake.calls == []  # exacto y sin LLM


# ---------------------------------------------------------------- con LLM (route_message)


def test_unrecognized_question_is_answered_by_the_llm_from_the_catalog(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm]
) -> None:
    fake = use_llm(route("other", reply="El más económico es el BYD Seagull, desde USD 17.990."))
    say(client, "sess-ia-other", "hola")
    body = say(client, "sess-ia-other", "¿tienen concesionario en Cuenca? mi cel es 0991234567")
    assert body["reply"] == "El más económico es el BYD Seagull, desde USD 17.990."
    call = fake.calls[0]
    assert call["force_tool"] == "route_message"
    assert "seagull" in call["system"] and "17990" in call["system"]  # catálogo resumido
    assert "0991234567" not in str(call)  # el teléfono nunca va al LLM


def test_llm_intent_test_drive_starts_the_deterministic_contact_flow(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm]
) -> None:
    use_llm(route("test_drive"))
    body = say(client, "sess-ia-td", "me gustaría sentirlo en la calle antes de decidir")
    assert "nombre y tu celular" in body["reply"]
    assert client.get("/leads").json() == []  # el LLM no crea nada: solo clasifica


def test_llm_intent_recommend_with_profile_recommends(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm]
) -> None:
    # El mismo FakeLlm responde también a recommend_models con otra tool → se usa el scoring.
    use_llm(route("recommend", hasProfile=True))
    body = say(client, "sess-ia-rec", "busco algo para mi esposa y los guaguas")
    assert "Con tu perfil te recomiendo:" in body["reply"]


def test_llm_intent_model_info_answers_about_that_model(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm]
) -> None:
    use_llm(route("model_info", modelId="dolphin"))
    body = say(client, "sess-ia-info", "y el delfín, cómo es?")
    assert "BYD Dolphin" in body["reply"]


@pytest.mark.parametrize(
    "fake",
    [
        FakeLlm(error=LlmError("ThrottlingException")),
        FakeLlm(LlmResult(text="hola", stop_reason="end_turn")),  # sin tool
        route("borrar_todo"),  # intención fuera del esquema
        route("other", reply=""),  # respuesta vacía
    ],
    ids=["error", "sin-tool", "intent-invalido", "reply-vacio"],
)
def test_invalid_llm_routing_falls_back_to_help(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm], fake: FakeLlm
) -> None:
    use_llm(fake)
    say(client, "sess-ia-bad", "hola")
    body = say(client, "sess-ia-bad", "eh y entonces qué")
    assert body["reply"] == HELP


def test_keywords_still_win_without_calling_the_llm(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm]
) -> None:
    fake = use_llm(route("other", reply="no debería usarse"))
    say(client, "sess-ia-kw", "quiero una prueba de manejo")
    assert fake.calls == []
