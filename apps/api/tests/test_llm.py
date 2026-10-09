"""F5 · H2/H3 con Bedrock (CA2.2, CA3.2): adapter `BedrockLlm`, `RateGate` y los dos usos del LLM.

Ningún test llama a AWS: el adapter se prueba con un cliente simulado y los services con
`FakeLlm` vía `app.dependency_overrides[get_llm]`.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from botocore.exceptions import ClientError, NoCredentialsError
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.llm import (
    BedrockLlm,
    FakeLlm,
    LlmError,
    LlmResult,
    RateGate,
    ToolSpec,
    build_llm,
    get_llm,
)
from app.core.config import DATA_DIR, Settings
from app.core.pii import redact_free_text
from app.repositories.catalog import CatalogRepo
from app.schemas.chat import ChatRequest
from app.services.chat_service import DETAIL_SYSTEM, build_chat_service
from app.services.recommendation_service import RECOMMEND_TOOL

HAIKU = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
SONNET = "us.anthropic.claude-sonnet-4-6"
NOVA = "amazon.nova-lite-v1:0"
CATALOG = CatalogRepo.from_file(DATA_DIR / "catalog.json")
PHONE, EMAIL = "0991234567", "ana.prueba@correo.com"


# ---------------------------------------------------------------- utilidades


class StubBedrock:
    """Cliente `bedrock-runtime` simulado: devuelve o lanza cada resultado en orden."""

    def __init__(self, *outcomes: dict[str, Any] | Exception) -> None:
        self.outcomes = list(outcomes)
        self.calls: list[dict[str, Any]] = []

    def converse(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def client_error(code: str, message: str = "error") -> ClientError:
    return ClientError({"Error": {"Code": code, "Message": message}}, "Converse")


def text_response(text: str = "Hola", stop: str = "end_turn") -> dict[str, Any]:
    return {
        "output": {"message": {"role": "assistant", "content": [{"text": text}]}},
        "stopReason": stop,
        "usage": {"inputTokens": 120, "outputTokens": 30, "totalTokens": 150},
    }


def tool_response(ids: list[str]) -> dict[str, Any]:
    return {
        "output": {
            "message": {
                "role": "assistant",
                "content": [
                    {
                        "toolUse": {
                            "toolUseId": "t1",
                            "name": "recommend_models",
                            "input": {"modelIds": ids},
                        }
                    }
                ],
            }
        },
        "stopReason": "tool_use",
        "usage": {"inputTokens": 400, "outputTokens": 40},
    }


def make_llm(stub: StubBedrock, model_id: str = HAIKU, **kwargs: Any) -> BedrockLlm:
    return BedrockLlm(model_id, "us-east-1", gate=RateGate(0.0), client=stub, **kwargs)


USER_MSG = [{"role": "user", "content": [{"text": "hola"}]}]


@pytest.fixture
def use_llm(app: FastAPI) -> Callable[[FakeLlm], FakeLlm]:
    def install(fake: FakeLlm) -> FakeLlm:
        app.dependency_overrides[get_llm] = lambda: fake
        return fake

    return install


# ---------------------------------------------------------------- RateGate (≤ 1 req/s)


def test_rate_gate_waits_the_remaining_interval_between_calls() -> None:
    now = [100.0]
    slept: list[float] = []

    def sleep(seconds: float) -> None:
        slept.append(seconds)
        now[0] += seconds

    gate = RateGate(1.1, clock=lambda: now[0], sleep=sleep)
    with gate:
        pass
    assert slept == []  # la primera llamada no espera
    now[0] += 0.3
    with gate:
        pass
    assert slept == [pytest.approx(0.8)]
    now[0] += 5
    with gate:
        pass
    assert len(slept) == 1  # pasado el intervalo, no espera


# ---------------------------------------------------------------- BedrockLlm: forma de la llamada


def test_converse_request_has_explicit_max_tokens_and_forced_tool_with_strict_on_claude() -> None:
    stub = StubBedrock(tool_response(["dolphin", "seal", "shark"]))
    result = make_llm(stub).complete(
        "sys", USER_MSG, [RECOMMEND_TOOL], force_tool="recommend_models", temperature=0.0
    )
    call = stub.calls[0]
    assert call["modelId"] == HAIKU
    assert call["system"] == [{"text": "sys"}]
    assert call["inferenceConfig"] == {"maxTokens": 400, "temperature": 0.0}
    assert call["toolConfig"]["toolChoice"] == {"tool": {"name": "recommend_models"}}
    assert call["toolConfig"]["tools"][0]["toolSpec"]["strict"] is True
    assert "guardrailConfig" not in call
    assert result.tool_name == "recommend_models"
    assert result.tool_input == {"modelIds": ["dolphin", "seal", "shark"]}
    assert result.stop_reason == "tool_use"
    assert (result.input_tokens, result.output_tokens) == (400, 40)


def test_strict_is_not_sent_to_nova() -> None:
    stub = StubBedrock(tool_response(["dolphin", "seal", "shark"]))
    make_llm(stub, NOVA).complete("sys", USER_MSG, [RECOMMEND_TOOL], force_tool="recommend_models")
    assert "strict" not in stub.calls[0]["toolConfig"]["tools"][0]["toolSpec"]


def test_text_answer_without_tools() -> None:
    stub = StubBedrock(text_response("  El Dolphin tiene rines de 16.  "))
    result = make_llm(stub).complete("sys", USER_MSG, max_tokens=300)
    assert "toolConfig" not in stub.calls[0]
    assert stub.calls[0]["inferenceConfig"]["maxTokens"] == 300
    assert result.text == "El Dolphin tiene rines de 16."
    assert result.tool_name is None


def test_guardrail_config_wraps_only_user_text_in_guard_content() -> None:
    stub = StubBedrock(text_response())
    make_llm(stub, guardrail_id="gr-123", guardrail_version="1").complete("sys", USER_MSG)
    call = stub.calls[0]
    assert call["guardrailConfig"] == {
        "guardrailIdentifier": "gr-123",
        "guardrailVersion": "1",
        "trace": "disabled",
    }
    assert call["messages"][0]["content"] == [{"guardContent": {"text": {"text": "hola"}}}]
    assert call["system"] == [{"text": "sys"}]


# ---------------------------------------------------------------- BedrockLlm: errores y reintentos


def test_throttling_twice_raises_llm_error_after_two_calls() -> None:
    stub = StubBedrock(client_error("ThrottlingException"), client_error("ThrottlingException"))
    with pytest.raises(LlmError, match="ThrottlingException"):
        make_llm(stub).complete("sys", USER_MSG)
    assert len(stub.calls) == 2


def test_throttling_once_then_success_returns_the_answer() -> None:
    stub = StubBedrock(client_error("ThrottlingException"), text_response("ok"))
    assert make_llm(stub).complete("sys", USER_MSG).text == "ok"
    assert len(stub.calls) == 2


@pytest.mark.parametrize(
    "code", ["ValidationException", "AccessDeniedException", "ExpiredTokenException"]
)
def test_non_retryable_errors_fail_after_one_call(code: str) -> None:
    stub = StubBedrock(client_error(code))
    with pytest.raises(LlmError, match=code):
        make_llm(stub).complete("sys", USER_MSG)
    assert len(stub.calls) == 1


def test_on_demand_not_supported_retries_once_with_the_us_inference_profile() -> None:
    message = "Invocation of model ID x with on-demand throughput isn't supported."
    stub = StubBedrock(client_error("ValidationException", message), text_response("ok"))
    result = make_llm(stub, "anthropic.claude-haiku-4-5-20251001-v1:0").complete("sys", USER_MSG)
    assert result.text == "ok"
    assert [c["modelId"] for c in stub.calls] == [
        "anthropic.claude-haiku-4-5-20251001-v1:0",
        "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    ]


def test_missing_credentials_become_llm_error() -> None:
    stub = StubBedrock(NoCredentialsError())
    with pytest.raises(LlmError, match="NoCredentialsError"):
        make_llm(stub).complete("sys", USER_MSG)


def test_error_message_never_carries_the_remote_body() -> None:
    stub = StubBedrock(client_error("AccessDeniedException", f"user text {PHONE}"))
    with pytest.raises(LlmError) as info:
        make_llm(stub).complete("sys", USER_MSG)
    assert PHONE not in str(info.value)


def test_build_llm_only_when_use_bedrock_is_on() -> None:
    off = Settings(_env_file=None, use_bedrock=False)
    assert build_llm(off) is None
    on = Settings(_env_file=None, use_bedrock=True, aws_profile="hackathon")
    llm = build_llm(on)
    assert isinstance(llm, BedrockLlm)  # construir no abre conexiones ni lee credenciales
    assert llm.model_id == SONNET


def test_default_model_is_claude_sonnet_inference_profile() -> None:
    assert Settings(_env_file=None).bedrock_model_id == SONNET


# ---------------------------------------------------------------- PII antes del LLM


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        (f"mi cel es {PHONE}", "mi cel es {PHONE}"),
        ("llámame al +593 99 123 4567", "llámame al {PHONE}"),
        (f"escribe a {EMAIL} porfa", "escribe a {EMAIL} porfa"),
        ("cédula 1712345678", "cédula {ID}"),
        ("familia de 5, presupuesto $25.000 o 30k", "familia de 5, presupuesto $25.000 o 30k"),
    ],
)
def test_redact_free_text(text: str, expected: str) -> None:
    assert redact_free_text(text) == expected


# ---------------------------------------------------------------- Uso 1 · /recommendations (CA2.2)

PROFILE = f"Familia de 4 en ciudad, presupuesto 30k, mi cel {PHONE} y correo {EMAIL}"


def recommend(client: TestClient, profile: str = PROFILE) -> list[str]:
    response = client.post("/recommendations", json={"profile": profile})
    assert response.status_code == 200, response.text
    return [item["modelId"] for item in response.json()["items"]]


def test_llm_ids_are_used_in_order_with_reasons_from_the_catalog(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm]
) -> None:
    fake = use_llm(
        FakeLlm(
            LlmResult(
                tool_name="recommend_models",
                tool_input={"modelIds": ["shark", "seal", "seagull"]},
                stop_reason="tool_use",
            )
        )
    )
    response = client.post("/recommendations", json={"profile": PROFILE})
    body = response.json()["items"]
    assert [item["modelId"] for item in body] == ["shark", "seal", "seagull"]
    assert all(0 < len(item["reason"]) <= 200 for item in body)
    assert body[0]["price"] == CATALOG.get("shark").price  # precio del catálogo, no del LLM
    call = fake.calls[0]
    assert len(fake.calls) == 1
    assert call["force_tool"] == "recommend_models"
    assert call["tools"] == [RECOMMEND_TOOL]
    assert call["temperature"] == 0.0
    assert all(model_id in call["system"] for model_id in CATALOG.ids())


def test_profile_sent_to_the_llm_has_no_phone_or_email(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm]
) -> None:
    fake = use_llm(FakeLlm(LlmResult(tool_name=None)))
    recommend(client)
    sent = str(fake.calls[0])
    assert PHONE not in sent and EMAIL not in sent
    assert "{PHONE}" in sent and "{EMAIL}" in sent


@pytest.mark.parametrize(
    "result",
    [
        LlmResult(
            tool_name="recommend_models", tool_input={"modelIds": ["dolphin", "seal", "nope"]}
        ),
        LlmResult(
            tool_name="recommend_models", tool_input={"modelIds": ["dolphin", "dolphin", "seal"]}
        ),
        LlmResult(tool_name="recommend_models", tool_input={"modelIds": ["dolphin", "seal"]}),
        LlmResult(
            tool_name="recommend_models",
            tool_input={"modelIds": ["dolphin", "seal", "shark"], "extra": 1},
        ),
        LlmResult(tool_name="otra_tool", tool_input={"modelIds": ["dolphin", "seal", "shark"]}),
        LlmResult(text="Te recomiendo el Dolphin", stop_reason="end_turn"),
    ],
    ids=["id-inexistente", "repetidos", "solo-2", "campo-extra", "otra-tool", "sin-tool"],
)
def test_invalid_llm_output_falls_back_to_the_deterministic_scoring(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm], result: LlmResult
) -> None:
    baseline = recommend(client)  # sin LLM: scoring F4
    use_llm(FakeLlm(result))
    assert recommend(client) == baseline


def test_llm_error_still_answers_200_with_the_scoring(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm]
) -> None:
    baseline = recommend(client)
    use_llm(FakeLlm(error=LlmError("ExpiredTokenException")))
    assert recommend(client) == baseline


# ---------------------------------------------------------------- Uso 2 · /chat detail (CA3.2)


def chat(client: TestClient, session_id: str, message: str) -> dict[str, Any]:
    response = client.post("/chat", json={"sessionId": session_id, "message": message})
    assert response.status_code == 200, response.text
    return response.json()


def test_detail_reply_comes_from_the_llm_with_only_the_model_json_in_the_system(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm]
) -> None:
    baseline = chat(client, "sess-llm-base-01", "cuéntame de las llantas del dolphin")
    fake = use_llm(FakeLlm(LlmResult(text="Rines de 16 pulgadas.", stop_reason="end_turn")))
    body = chat(client, "sess-llm-detail-01", "cuéntame de las llantas del dolphin")
    assert body["reply"].endswith("Rines de 16 pulgadas.")
    assert body["hotspot"] == "wheels"  # el hotspot sigue saliendo de los sinónimos
    assert body["suggestedActions"] == baseline["suggestedActions"]
    assert len(fake.calls) == 1
    dolphin = CATALOG.get("dolphin")
    assert fake.calls[0]["system"] == DETAIL_SYSTEM + dolphin.model_dump_json(by_alias=True)
    assert fake.calls[0]["tools"] is None


def test_detail_prompt_never_contains_phone_or_email(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm]
) -> None:
    fake = use_llm(FakeLlm(LlmResult(text="Cuesta lo que dice la ficha.", stop_reason="end_turn")))
    chat(client, "sess-llm-pii-01", f"precio del seal? soy {EMAIL} cel {PHONE}")
    sent = str(fake.calls[0])
    assert PHONE not in sent and EMAIL not in sent


@pytest.mark.parametrize(
    "fake",
    [
        FakeLlm(error=LlmError("AccessDeniedException")),
        FakeLlm(LlmResult(text="", stop_reason="end_turn")),
        FakeLlm(LlmResult(text="Rines de", stop_reason="max_tokens")),
    ],
    ids=["error", "vacio", "cortado"],
)
def test_detail_falls_back_to_the_catalog_text(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm], fake: FakeLlm
) -> None:
    baseline = chat(client, "sess-llm-base-02", "¿qué tal la batería del dolphin?")
    use_llm(fake)
    assert chat(client, "sess-llm-fallback-02", "¿qué tal la batería del dolphin?") == baseline


def test_contact_and_slot_stages_make_zero_llm_calls(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm]
) -> None:
    fake = use_llm(FakeLlm())
    sid = "sess-llm-flow-01"
    chat(client, sid, "hola")
    chat(client, sid, "quiero una prueba de manejo")
    chat(client, sid, f"Soy Ana Prueba, mi celular es {PHONE}")
    chat(client, sid, "sí")
    chat(client, sid, "a las 10")
    assert len(client.get("/appointments").json()) == 1
    assert fake.calls == []


def test_channel_service_uses_the_llm_from_app_state(client: TestClient, app: FastAPI) -> None:
    fake = FakeLlm(LlmResult(text="Pantalla rotativa de 12,8 pulgadas.", stop_reason="end_turn"))
    app.state.llm = fake
    service = build_chat_service(app.state)
    response = service.handle(
        ChatRequest(session_id="sess-llm-channel-01", message="¿y la pantalla del dolphin?")
    )
    assert response.reply.endswith("Pantalla rotativa de 12,8 pulgadas.")
    assert len(fake.calls) == 1


def test_tool_spec_names_follow_bedrock_rules() -> None:
    assert isinstance(RECOMMEND_TOOL, ToolSpec)
    assert RECOMMEND_TOOL.input_schema["required"] == ["modelIds"]


# ---------------------------------------------------------------- regresiones del QA en vivo

NO_CHARGER = "Somos 4, uso en ciudad, presupuesto 25 mil, no tengo cargador en casa"


def test_llm_without_phev_for_a_customer_without_charger_falls_back_to_scoring(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm]
) -> None:
    # Caso real del QA: Haiku eligió [yuan-up, dolphin, seagull] e ignoró la regla CA2.4.
    baseline = recommend(client, NO_CHARGER)
    assert "shark" in baseline  # el scoring sí incluye el PHEV
    use_llm(
        FakeLlm(
            LlmResult(
                tool_name="recommend_models",
                tool_input={"modelIds": ["yuan-up", "dolphin", "seagull"]},
            )
        )
    )
    assert recommend(client, NO_CHARGER) == baseline


def test_llm_choice_with_a_phev_is_kept_for_a_customer_without_charger(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm]
) -> None:
    use_llm(
        FakeLlm(
            LlmResult(
                tool_name="recommend_models",
                tool_input={"modelIds": ["shark", "dolphin", "yuan-up"]},
            )
        )
    )
    assert recommend(client, NO_CHARGER) == ["shark", "dolphin", "yuan-up"]


@pytest.mark.parametrize("question", ["¿y las llantas?", "tamaño del maletero"])
def test_missing_catalog_data_skips_the_llm_and_uses_the_exact_phrase(
    client: TestClient, use_llm: Callable[[FakeLlm], FakeLlm], question: str
) -> None:
    # Caso real del QA: sin dato, Haiku añadía adornos («una de sus características destacadas»).
    fake = use_llm(FakeLlm(LlmResult(text="La pantalla es destacada.", stop_reason="end_turn")))
    chat(client, "sess-qa-nodata-1", "hola")
    response = client.post(
        "/chat",
        json={"sessionId": "sess-qa-nodata-1", "message": question, "modelId": "yuan-up"},
    )
    reply = response.json()["reply"]
    assert reply.startswith("No tengo ese dato, un asesor te confirma.")
    assert "sí puedo contarte" in reply and "asientos" in reply  # ofrece lo que sí hay
    assert fake.calls == []
