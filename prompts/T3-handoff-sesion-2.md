---
title: Terminal 3 · traspaso a la sesión 2 de Claude Code (F5 Bedrock → F7a WhatsApp → F6 entrega)
date: 2026-10-08
tipo: prompt-claude-code
repo: https://github.com/RengifORG/Hackton
rama: feat/api-core
precondicion: leer este archivo completo antes de tocar código; F5 solo con GO de Cowork en G3
complementa: prompts/T3-api-core.md (fases y reglas) · docs/AUDIT-CHECK.md (gates) · plan v2 en el cerebro
---

# Terminal 3 · sesión 2 — continúa desde F5

> **Cómo usar:** abre Claude Code en `C:\Hackaton\Hackton` y pega este archivo como primer mensaje (`cat prompts/T3-handoff-sesion-2.md`). Es autocontenido. Mandan, en este orden: `CLAUDE.md` → `docs/SPEC.md` + `docs/openapi.yaml` (v0.2.0) → `prompts/T3-api-core.md` → este archivo. La memoria del proyecto (`~/.claude/projects/C--Hackaton/memory/`) trae el contexto de la sesión 1 automáticamente.

## 0. Estado al cierre de la sesión 1 (2026-10-08, ~14:45 EC)

| Qué | Estado |
|---|---|
| Rama `feat/api-core` (= `origin`) | F0 `51bf9e7` · F1 `4da004c` · `LeadRead` `f4042a1` · merge `main` `5c80f5f` (contrato v0.2.0 + web de Esteban hasta el PR #6) · F2 `9afbb55` · F3 `ceddf17` · **F4** (último commit, ver `git log`) |
| Tests / lint | **249 passed** · `ruff check` y `ruff format --check` limpios · `uv run pytest -q` desde `apps/api` |
| Gates (Cowork) | G0 GO · **G1, G2, G3, G4 pendientes** (audita desde `origin/feat/api-core`; `main` local está viejo, comparar contra `origin/main`) |
| Contrato | v0.2.0 intacto (`git diff origin/main -- docs/openapi.yaml` = 0). `tests/test_contract.py` valida rutas, `operationId` y las respuestas reales contra el YAML con `jsonschema_rs` |
| Endpoints vivos | `/health` · `/models` · `/models/{modelId}` · `POST/GET /leads` (`LeadRead` en GET) · `GET /availability` · `POST/GET /appointments` · `POST /chat` · `POST /recommendations` |
| Datos | `data/slots.json` versionado (la API lo regenera si no cubre hoy) · `data/catalog.json` (6 modelos; `idealFor` se conserva en `CatalogRepo.ideal_for`) |
| AWS | perfil CLI `hackathon` OK · **solo `us-east-1`** (us-east-2 tiene deny explícito) · Converse verificado con `amazon.nova-lite-v1:0` y `us.anthropic.claude-haiku-4-5-20251001-v1:0` · credenciales temporales pegadas a las 12:03 (**caducan**; el usuario las refresca desde Workshop Studio) · DENY apprunner e iam:GetRole/SimulatePrincipalPolicy · sin roles IAM reutilizables · Bedrock Agents gestionados cerrado a cuentas nuevas (403) |
| Meta | app "App Pruebas" con WhatsApp configurado (número de prueba, Phone Number ID y WABA ID visibles), **token sin generar**, webhook vacío, app **sin publicar** → Meta solo entrega webhooks de prueba del panel → **F7a saliente primero**, F7b entrante condicionado |
| Local | ngrok 3.39 con cuenta (dominio dev fijo) · Docker Desktop instalado, apagado · AWS CLI solo en PowerShell (no en Git Bash) |

Documentos de referencia (léelos si necesitas detalle): plan v2 `C:\Hackaton\cerebro\hackton\06-backlog\2026-10-08__plan-ejecucion-aws-agente-whatsapp.md` (+ `anexos\` con código de `BedrockLlm`, webhook y exposición HTTPS) · nota H-A `…\2026-10-08__nota-H-A-verificacion-bedrock.md` · prompts de Cowork en `C:\Users\AMOVIL\Downloads\2026-10-08__prompt-claude-code__F5-bedrock-F7-whatsapp.md`.

## 1. Patrones ya establecidos (respétalos)

- `router → service → adapter/repository`; adapters como `Protocol` + implementación real + `Fake*` + `build_*(settings)` + `get_*(request)` leyendo `request.app.state` (ver `adapters/crm.py`, `adapters/workshop.py`). Tests los sustituyen con `app.dependency_overrides` (ver `tests/conftest.py`: `settings` sin `.env`, `FixedClock` 2026-10-08 10:00 EC, `FakeCrm`, `FakeWorkshop`, `limiter.reset()`).
- Esquemas: `CamelModel` (salida) y `StrictInput` (entrada, `extra="forbid"`); opcionales **no anulables** (`campo: str = Field(default=None)`): nunca pases `None` explícito al construirlos (ese bug costó un test en F4).
- Rate limit: `@limiter.limit(RATE_LIMIT)` con `request: Request` y **sin** `from __future__ import annotations` en el router (ver `routers/leads.py`). 429 en español desde `core/ratelimit.py`.
- PII: `core/pii.mask_phone` para respuestas; `core/logging.py` redacta teléfono/email/cédula en logs (incluidos objetos en `extra=`). Nunca el cuerpo crudo de un webhook ni `hub.verify_token` en logs.
- Reloj: `app.state.clock` (`create_app(settings, clock=...)`), nunca `datetime.now()` directo.
- El chat ya expone `ChatService.handle(ChatRequest, *, known_phone=None)` y `build_chat_service(app.state)` para canales fuera del ciclo request; el teléfono del canal **nunca** va al LLM.

Trampas de entorno (sesión 1): usa el tool **Write** para archivos de código (un heredoc bash muy largo falló por quoting); invoca `uv run --project C:\Hackaton\Hackton\apps\api …` y `git -C C:\Hackaton\Hackton …` con rutas absolutas (hubo carreras de directorio en llamadas paralelas); AWS CLI va por **PowerShell**; **nunca leas `apps/api/.env`** (contiene secretos del usuario; para añadir claves usa `Add-Content` sin abrirlo, o pide al usuario que las pegue).

## 2. Orden de trabajo y gates

**F5 Bedrock** (solo con GO de G3) → nota de cierre → **F7a WhatsApp saliente** (solo con GO de G5) → **F6 entrega** → **F7b webhook** (solo si el PR `contract` está mergeado en `main` y la sonda de inbound recibe POST) → PR final `feat/api-core → main` (aprueba Esteban). Mientras Cowork audita, sigue con la fase siguiente y corrige hallazgos en commits `fix(api): …`. Cortes de tiempo en el plan v2 §7.

Decisiones que el usuario debía cerrar (pregúntalas si no están en la memoria): **D3** modelo primario (recomendado Haiku 4.5), **D6** hora de entrega/demo, **D7** GO para crear un Guardrail, **D8** GO para el sondeo IAM reversible, **D12** publicar o no la app de Meta, **D13** qué hacer si Esteban no aprueba el PR `contract`.

## 3. F5 · Bedrock (CA2.2, CA3.2) — 30 min · commit `feat(api): BedrockLlm con tool-calling validado y fallback (H2/H3)`

Diseño completo con código en el anexo `2026-10-08__anexo-agente-bedrock.md` §3–§7. Resumen obligatorio:

1. `adapters/llm.py`: `LlmPort.complete(system, messages, tools=None, *, force_tool=None, temperature=0.3, max_tokens=400) -> LlmResult(text, tool_name, tool_input, stop_reason, input_tokens, output_tokens)`. `BedrockLlm` usa `bedrock-runtime.converse` con `system`, `messages`, `inferenceConfig` (**maxTokens siempre explícito**), `toolConfig` (`toolSpec` + `toolChoice: {"tool": {"name": …}}`; `strict` solo en Claude) y `guardrailConfig` opcional (`trace: "disabled"`). **Cliente boto3 creado por llamada** (`boto3.Session(profile_name=settings.aws_profile, region_name=settings.aws_region).client("bedrock-runtime", config=Config(retries={"total_max_attempts": 1}, connect_timeout=2, read_timeout=12))`) para sobrevivir al refresco de credenciales sin reiniciar. `RateGate` singleton (≥ 1,1 s entre llamadas, `threading.Lock` + `time.monotonic`): regla del evento ≤ 1 req/s. 1 reintento solo ante `ThrottlingException`/5xx; `ExpiredTokenException`, `AccessDeniedException`, `ValidationException`, `NoCredentialsError`, timeouts → `LlmError(código)` → el **service** cae al camino determinista sin excepción hacia el router. Si el error dice "on-demand throughput isn't supported", reintenta una vez con prefijo `us.`. `FakeLlm(result|error)` registra llamadas. `build_llm(settings)` → `None` si `USE_BEDROCK=0`.
2. `Settings`/`.env.example`: `AWS_PROFILE` (pydantic-settings no exporta `.env` a `os.environ`: pásalo explícito), `BEDROCK_MODEL_ID` (default `us.anthropic.claude-haiku-4-5-20251001-v1:0`; alterno `amazon.nova-lite-v1:0`), `BEDROCK_GUARDRAIL_ID`, `BEDROCK_GUARDRAIL_VERSION`. Al arrancar con guardrail: sonda `apply_guardrail` (1 llamada por el gate); si `AccessDenied` → guardrail apagado con log.
3. **Uso 1** `RecommendationService.recommend`: si hay LLM, tool `recommend_models` (`{modelIds: [3]}`, `toolChoice` forzado, `temperature 0`) con el catálogo mínimo (id, name, price, segment, rangeKm, idealFor) en el system prompt y el perfil **pre-redactado** (`core/pii`: teléfono/email → `{PHONE}`/`{EMAIL}`); valida con Pydantic **y** contra `CatalogRepo` (3 ids distintos existentes); cualquier fallo → scoring actual (ya implementado).
4. **Uso 2** `ChatService._detail`: si hay LLM, system = instrucciones fijas + **solo el JSON del modelo** (`model.model_dump_json(by_alias=True)`) + "si no está en el JSON responde: No tengo ese dato, un asesor te confirma"; `guardContent` sobre el texto del usuario; si falla o devuelve vacío → `hotspot_reply`/`summary_reply` actuales. El LLM **no** decide `suggestedActions` ni `hotspot` (sigue siendo por sinónimos) ni crea nada. Etapas `contact`/`slot`: **0 llamadas**.
5. Tests con `FakeLlm` (ninguno llama a AWS): ids inválidos/duplicados/2 ids → fallback; `LlmError` → 200 por fallback; el system capturado contiene el JSON del modelo y no contiene teléfono ni email; `RateGate` con reloj/sleep inyectados; `BedrockLlm(client=stub)` con `ThrottlingException` ×2 → `LlmError` y 2 llamadas; `ValidationException` → 1 llamada. `contact`/`slot` → `FakeLlm.calls == []`.
6. **Smoke real lo ejecutas tú** (Cowork no tiene credenciales): con `.env` del usuario (`USE_BEDROCK=1`), 2 llamadas (1 por modelo) respetando 1 RPS y la web parada; pega en la nota `stopReason`, `usage`, latencia y la respuesta, sin secretos. Si `ExpiredTokenException`: pide al usuario refrescar credenciales (no las pidas por chat).

## 4. PR `contract` (ábrelo ya, en paralelo; aprueba Esteban) — rama `contract/whatsapp-webhook`

Aditivo sobre `docs/openapi.yaml` → `0.3.0`: `GET /webhooks/whatsapp` (query `hub.mode`, `hub.verify_token`, `hub.challenge` requeridos → `200` `text/plain` con el challenge; `403`) · `POST /webhooks/whatsapp` (header `X-Hub-Signature-256` requerido; body `application/json` libre → `200 {status}`; `403`) · **`404` y `429` en `POST /appointments`, `422` en `GET /availability`** (schemathesis los necesita). `docs/SPEC.md` H7: CA7.1 (saliente lead fuera de horario), CA7.2 (confirmación de cita), CA7.3 (entrante, condicionado) según el prompt de Cowork. `docs/AUDIT-CHECK.md` §4: fila **G7a/G7b**. `prompts/T3-api-core.md` F7: "Twilio" → "Meta Cloud API". Label `contract`. **Nunca edites el YAML dentro de `feat/api-core`** (el diff contra `origin/main` debe seguir en 0); F7b solo tras merge a `main` y `git merge origin/main`.

## 5. F7a · WhatsApp saliente (CA7.1–7.2) — 25 min · commit `feat(api): confirmaciones salientes por WhatsApp Cloud API (H7a)`

Según el prompt de Cowork (`…F5-bedrock-F7-whatsapp.md` §F7a): `adapters/whatsapp.py` (`WhatsAppPort.send_text(to_digits, body) -> WhatsAppResult(ok, message_id, error)`; `MetaWhatsApp(token, phone_number_id, api_version="v25.0", client=None)` → `POST https://graph.facebook.com/{v}/{phone_number_id}/messages` con `Authorization: Bearer`, cuerpo `{"messaging_product":"whatsapp","to":"5939…","type":"text","text":{"preview_url":false,"body":…}}`, timeout 5 s, errores sin PII y **sin lanzar**; `FakeWhatsApp(fail=False).sent`; `build_whatsapp(settings)` solo si `WHATSAPP_ENABLED=1` + token + phone id). `core/pii.to_wa_digits` (`09…`/`+5939…` → `5939…`). `services/notify_service.py` (`WhatsAppNotifier.lead_after_hours(lead)` y `.appointment_confirmed(appointment, lead)`: nombre de pila, cashback en `service`, fallo no bloqueante, teléfono enmascarado en logs), invocado desde `LeadService.create` (si `afterHours`) y `AppointmentService.create`. Env: `WHATSAPP_ENABLED`, `WHATSAPP_API_VERSION=v25.0`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN` (temporal 24 h, lo genera el usuario), más `WHATSAPP_VERIFY_TOKEN` y `WHATSAPP_APP_SECRET` (F7b). `docs/SPEC.md` se edita por commit `docs:` en la rama (no toca el YAML). Prueba real: 1 lead con reloj a 19:00 (`DEMO_NOW` o `FixedClock`) al móvil EC registrado en el número de prueba → debe llegar; `message_id` enmascarado en la nota; **no repitas en bucle**.

## 6. F6 · Entrega — 30–35 min · commits `test(api): conformidad OpenAPI con schemathesis` · `chore(api): Dockerfile, compose y README`

`tests/test_contract.py`: schemathesis (`schemathesis.openapi.from_path("../../docs/openapi.yaml")` + `schema.app = app`, filtrar `^/webhooks`, `limiter.enabled = False` durante la conformidad, `FakeLlm`/`FakeCrm`/`FakeWhatsApp`). `Dockerfile` con **contexto en la raíz del repo** (copia `data/` y `apps/api/`; `uv sync --frozen --no-dev`; `uvicorn … --host 0.0.0.0 --port 8000 --proxy-headers`), `docker-compose.yml` en la raíz; arrancar Docker Desktop y `docker pull python:3.12-slim` antes. `Settings.demo_now` opcional (`DEMO_NOW=2026-10-08T19:00:00-05:00` → `FixedClock`), documentado como "simulación de hora para la demo" (la demo es antes de las 18:00 y la métrica es `afterHours`). README `apps/api`: arranque, variables, **"qué es real vs simulado"** (real: API, Bedrock con modelo/región/usage, WhatsApp saliente, 3D; simulado: HubSpot `FakeCrm`, taller `FakeWorkshop`; webhook entrante "implementado, no activable" si aplica).

## 7. F7b · Webhook entrante (solo si el PR `contract` está en `main` y la sonda recibe POST) — 40 min

Diseño con código en el anexo `2026-10-08__anexo-meta-whatsapp-cloud-api.md` §10: GET verifica `hub.verify_token` en tiempo constante y devuelve el challenge en `text/plain`; POST valida `X-Hub-Signature-256` = `sha256=` + HMAC-SHA256(App Secret, **bytes crudos**) → 403, responde 200 en < 5 s y procesa en `BackgroundTasks`; dedupe por `wamid`; filtra `metadata.phone_number_id`; ignora `statuses`/no-texto; `sessionId = sha256(wa_id)[:32]`; `ChatService.handle(…, known_phone=f"+{wa_id}")`; 20/min por `wa_id`; `mark_read` + typing indicator; `contacts` no se modela; `view_3d` como texto sin URL mientras la web sea local. Sonda previa de 10 min: GET/POST mínimos + ngrok + botón *Test* de Meta + 1 mensaje real; sin POST en 2 min → F7b queda "implementado, no activable".

## 8. Lo que hace el usuario (no tú)

- `apps/api/.env` desde `.env.example`: `USE_BEDROCK=1`, `AWS_PROFILE=hackathon`, `AWS_REGION=us-east-1`, `BEDROCK_MODEL_ID`, y los `WHATSAPP_*` (Phone Number ID y token temporal de la consola de Meta; App Secret; verify token con `uv run python -c "import secrets;print(secrets.token_urlsafe(32))"`).
- Meta: destinatarios del número de prueba **solo móviles EC** (el suyo, Esteban, 1 respaldo), `hello_world` desde la consola, y escribir desde su teléfono al número de prueba (abre la ventana de 24 h).
- Refrescar credenciales AWS antes del smoke G5 y 10 min antes de la demo (no hace falta reiniciar uvicorn si el cliente es por llamada).
- Arranque demo: `uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers` (terminal 1) y, para el webhook, `ngrok http 8000 --url https://<dominio>.ngrok-free.app --inspect=false` (terminal 2).
- GO explícito antes de que tú crees recursos en AWS (guardrail, sondeo IAM) o merges a `main`.

## 9. Nota de cierre por fase (pégala a Cowork)

Formato de `prompts/T3-api-core.md` §9 (FASE · QUÉ HICE · ARCHIVOS · CÓMO VERIFICAR con salida real de `uv run pytest -q` y `uv run ruff check .` · TESTS · CONTRATO · SUPUESTOS · PENDIENTES/RIESGOS · COMMITS) **más**: `INTEGRACIÓN REAL` (Bedrock: modelo/región/latencia/usage · WhatsApp: message_id enmascarado · webhook: verificado sí/no), `ETIQUETA README (real vs simulado)` y `SECRETOS: confirmo que no hay llaves/tokens en el repo (git diff revisado; .env ignorado)`. Si algo bloquea (token expirado, 401 de Meta, AccessDenied de Bedrock): para, escribe la nota con el error literal y espera.

## 10. Verificación rápida al empezar

```bash
git -C C:/Hackaton/Hackton fetch origin && git -C C:/Hackaton/Hackton status -sb
uv run --project C:/Hackaton/Hackton/apps/api pytest -q          # 249 passed
uv run --project C:/Hackaton/Hackton/apps/api ruff check .        # All checks passed
git -C C:/Hackaton/Hackton diff origin/main -- docs/openapi.yaml apps/web | wc -l   # 0
```
