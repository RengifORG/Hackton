"""LLM (H2/H3, F5): `LlmPort` + `BedrockLlm` (Converse, tool use, ≤ 1 req/s) + `FakeLlm`.

El LLM nunca decide acciones: los services le piden ids por tool use (con esquema) o un texto
redactado solo desde el JSON del catálogo, validan lo que vuelve y, ante cualquier fallo
(`LlmError`), siguen por el camino determinista. Regla del evento: Bedrock ≤ 1 solicitud/s.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated, Any, Protocol

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import Depends, Request

from app.core.config import Settings

log = logging.getLogger(__name__)

# Solo estos se reintentan (1 vez); Validation/AccessDenied/ExpiredToken nunca.
RETRYABLE_CODES = {
    "ThrottlingException",
    "TooManyRequestsException",
    "ServiceUnavailableException",
    "ModelTimeoutException",
    "InternalServerException",
}
ON_DEMAND_HINT = "on-demand throughput"
INFERENCE_PROFILE_PREFIX = "us."
MIN_INTERVAL_S = 1.1


class LlmError(RuntimeError):
    """Fallo del LLM. El mensaje es solo el código/tipo: nunca texto del usuario ni del modelo."""


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    input_schema: dict[str, Any]
    strict: bool = False  # structured outputs: solo Claude; Nova no lo soporta


@dataclass(frozen=True)
class LlmResult:
    text: str = ""
    tool_name: str | None = None
    tool_input: dict[str, Any] | None = None
    stop_reason: str = ""
    input_tokens: int = 0
    output_tokens: int = 0


class LlmPort(Protocol):
    def complete(
        self,
        system: str,
        messages: list[dict[str, Any]],
        tools: list[ToolSpec] | None = None,
        *,
        force_tool: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 400,
    ) -> LlmResult:
        """Una llamada (más 1 reintento si es transitorio); lanza `LlmError` si falla."""
        ...


class RateGate:
    """≥ `min_interval_s` entre llamadas a Bedrock en todo el proceso (Lock + reloj monotónico).

    El intervalo se mide desde el FIN de la llamada anterior: más conservador que 1 req/s.
    """

    def __init__(
        self,
        min_interval_s: float = MIN_INTERVAL_S,
        *,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._lock = threading.Lock()
        self._min = min_interval_s
        self._clock = clock
        self._sleep = sleep
        self._last: float | None = None

    def __enter__(self) -> RateGate:
        self._lock.acquire()
        if self._last is not None:
            wait = self._last + self._min - self._clock()
            if wait > 0:
                self._sleep(wait)
        return self

    def __exit__(self, *_exc: object) -> None:
        self._last = self._clock()
        self._lock.release()


BEDROCK_GATE = RateGate()  # singleton del proceso (uvicorn con 1 worker)


class BedrockLlm:
    """Amazon Bedrock Converse. El cliente boto3 se crea por llamada: si el usuario refresca las
    credenciales temporales del perfil, la siguiente llamada ya las usa sin reiniciar uvicorn."""

    def __init__(
        self,
        model_id: str,
        region: str,
        *,
        profile: str | None = None,
        guardrail_id: str | None = None,
        guardrail_version: str = "DRAFT",
        gate: RateGate | None = None,
        client: Any = None,
    ) -> None:
        self._model_id = model_id
        self._region = region
        self._profile = profile
        self._guardrail = (
            # trace=disabled: con trace la respuesta repetiría la PII detectada.
            {
                "guardrailIdentifier": guardrail_id,
                "guardrailVersion": guardrail_version,
                "trace": "disabled",
            }
            if guardrail_id
            else None
        )
        self._gate = gate or BEDROCK_GATE
        self._client = client

    @property
    def model_id(self) -> str:
        return self._model_id

    def _client_for_call(self) -> Any:
        if self._client is not None:
            return self._client
        session = boto3.Session(profile_name=self._profile, region_name=self._region)
        return session.client(
            "bedrock-runtime",
            config=Config(
                retries={"total_max_attempts": 1, "mode": "standard"},  # reintentos: aquí
                connect_timeout=2,
                read_timeout=12,
            ),
        )

    def complete(
        self,
        system: str,
        messages: list[dict[str, Any]],
        tools: list[ToolSpec] | None = None,
        *,
        force_tool: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 400,
    ) -> LlmResult:
        kwargs: dict[str, Any] = {
            "system": [{"text": system}],
            "messages": self._guard(messages),
            "inferenceConfig": {"maxTokens": max_tokens, "temperature": temperature},
        }
        if tools:
            kwargs["toolConfig"] = {
                "tools": [{"toolSpec": self._tool_spec(tool)} for tool in tools],
                "toolChoice": {"tool": {"name": force_tool}} if force_tool else {"auto": {}},
            }
        if self._guardrail:
            kwargs["guardrailConfig"] = self._guardrail

        model_id = self._model_id
        for attempt in (1, 2):
            started = time.monotonic()
            try:
                with self._gate:
                    response = self._client_for_call().converse(modelId=model_id, **kwargs)
            except ClientError as exc:
                error = exc.response.get("Error", {})
                code = error.get("Code", "ClientError")
                if attempt == 1 and code in RETRYABLE_CODES:
                    log.warning("bedrock retryable", extra={"code": code})
                    continue  # el gate ya espacia el reintento ≥ 1,1 s
                if (
                    attempt == 1
                    and code == "ValidationException"
                    and ON_DEMAND_HINT in str(error.get("Message", ""))
                    and not model_id.startswith(INFERENCE_PROFILE_PREFIX)
                ):
                    model_id = INFERENCE_PROFILE_PREFIX + model_id
                    log.warning("bedrock retry with inference profile", extra={"model": model_id})
                    continue
                log.warning("bedrock error", extra={"code": code, "model": model_id})
                raise LlmError(code) from None  # sin el cuerpo remoto
            except (BotoCoreError, OSError) as exc:  # NoCredentials, ProfileNotFound, timeouts
                log.warning("bedrock error", extra={"code": type(exc).__name__, "model": model_id})
                raise LlmError(type(exc).__name__) from None
            return self._parse(response, model_id, time.monotonic() - started)
        raise LlmError("RetriesExhausted")  # pragma: no cover (el bucle siempre retorna o lanza)

    def _tool_spec(self, tool: ToolSpec) -> dict[str, Any]:
        spec: dict[str, Any] = {
            "name": tool.name,
            "description": tool.description,
            "inputSchema": {"json": tool.input_schema},
        }
        if tool.strict and ".anthropic." in f".{self._model_id}":
            spec["strict"] = True
        return spec

    def _guard(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Con guardrail, solo el texto del usuario se evalúa (`guardContent`), no el catálogo."""
        if not self._guardrail:
            return messages
        guarded: list[dict[str, Any]] = []
        for message in messages:
            if message.get("role") != "user":
                guarded.append(message)
                continue
            content = [
                {"guardContent": {"text": {"text": block["text"]}}} if "text" in block else block
                for block in message.get("content", [])
            ]
            guarded.append({**message, "content": content})
        return guarded

    @staticmethod
    def _parse(response: dict[str, Any], model_id: str, elapsed_s: float) -> LlmResult:
        try:
            content = response["output"]["message"]["content"]
        except (KeyError, TypeError):
            raise LlmError("MalformedResponse") from None
        text = "".join(block.get("text", "") for block in content).strip()
        tool = next((block["toolUse"] for block in content if "toolUse" in block), None)
        usage = response.get("usage", {})
        result = LlmResult(
            text=text,
            tool_name=tool.get("name") if tool else None,
            tool_input=tool.get("input") if tool else None,
            stop_reason=response.get("stopReason", ""),
            input_tokens=usage.get("inputTokens", 0),
            output_tokens=usage.get("outputTokens", 0),
        )
        log.info(
            "bedrock call",
            extra={
                "model": model_id,
                "latencyMs": round(elapsed_s * 1000),
                "stopReason": result.stop_reason,
                "tool": result.tool_name,
                "inputTokens": result.input_tokens,
                "outputTokens": result.output_tokens,
            },
        )
        return result


class FakeLlm:
    """Tests: devuelve el resultado configurado (o lanza `error`) y registra cada llamada."""

    def __init__(self, result: LlmResult | None = None, *, error: Exception | None = None) -> None:
        self.result = result or LlmResult(text="ok", stop_reason="end_turn")
        self.error = error
        self.calls: list[dict[str, Any]] = []

    def complete(
        self,
        system: str,
        messages: list[dict[str, Any]],
        tools: list[ToolSpec] | None = None,
        *,
        force_tool: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 400,
    ) -> LlmResult:
        self.calls.append(
            {
                "system": system,
                "messages": messages,
                "tools": tools,
                "force_tool": force_tool,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
        )
        if self.error:
            raise self.error
        return self.result


def build_llm(settings: Settings) -> LlmPort | None:
    """`BedrockLlm` solo con USE_BEDROCK=1; si no, `None` y los services van por el determinista."""
    if not settings.use_bedrock:
        return None
    return BedrockLlm(
        settings.bedrock_model_id,
        settings.aws_region,
        profile=settings.aws_profile,
        guardrail_id=settings.bedrock_guardrail_id,
        guardrail_version=settings.bedrock_guardrail_version,
    )


def get_llm(request: Request) -> LlmPort | None:
    """Dependencia FastAPI; los tests la reemplazan con `app.dependency_overrides`."""
    return getattr(request.app.state, "llm", None)


LlmDep = Annotated[LlmPort | None, Depends(get_llm)]
