# Terminal 3 — API FastAPI (compañero) · `claude` en `apps/api`

Lee CLAUDE.md, docs/SPEC.md (H1-H4, H7), docs/openapi.yaml, docs/decision-tree.md, data/catalog.json. Spec-Driven Development + TDD estricto: primero el test del criterio de aceptación, luego la implementación mínima.

Objetivo (máx. 3 h): API que cumple el contrato y pasa un test de conformidad contra `docs/openapi.yaml`.

1. Scaffold con `uv`: FastAPI, Pydantic v2, `slowapi`, `httpx`, `pytest`, `pytest-asyncio`, `ruff`, `schemathesis` (conformidad con OpenAPI), `anthropic` (o `boto3` Bedrock), `hubspot-api-client`. Estructura: `app/routers`, `app/services`, `app/adapters` (`llm.py`, `crm.py`, `workshop.py`, `calendar.py`, cada uno con `Protocol` + implementación real + `Fake*` para tests), `app/repositories` (memoria para MVP, interfaz lista para DynamoDB), `app/core` (config por env, logging estructurado con redacción de PII, rate limit, CORS).
2. Modelos Pydantic generados/alineados con el contrato (`model_config = ConfigDict(extra="forbid")`). Validador de teléfono EC.
3. H1 `/leads`: tests CA1.1–CA1.5 → implementación. `afterHours` con zona `America/Guayaquil`. `CrmAdapter.push_lead` → HubSpot Contacts API si `HUBSPOT_TOKEN` existe, si no `FakeCrm` que loguea.
4. H2 `/recommendations`: fallback determinista primero (scoring del decision-tree.md) con tests; luego LLM con tool-calling que devuelve `{modelIds:[3]}` validado contra el catálogo (CA2.2). Si falla el LLM → fallback (CA2.3).
5. H3 `/chat`: `ChatService` con system prompt que inyecta SOLO el JSON del `modelId` consultado + reglas ("no inventes specs"). Tool-calling para acciones (`recommend`, `leave_contact`, `book`), cada tool valida con Pydantic antes de ejecutar (CA3.5). Devuelve `hotspot` si la pregunta refiere a wheels/seats/screen/battery/trunk/lights. Rate limit 20/min (CA3.4).
6. H4 `/availability` y `/appointments` desde `data/slots.json` (genera 2 semanas de slots 09:00–17:00 cada hora para `test_drive` en "Quito Norte" y `service` en "Taller Quito"). 409 si ocupado. `WorkshopAdapter` fake que escribe en memoria.
7. Conformidad: test con `schemathesis` contra `docs/openapi.yaml`. `ruff check` limpio. Dockerfile y `docker-compose.yml` en raíz.
8. Si sobra tiempo: H7 webhook Twilio sandbox reutilizando `ChatService`.

Seguridad: nunca loguear `phone`/`email` sin enmascarar; CORS a `http://localhost:5173` y al dominio de CloudFront por env; secretos solo por env. Rama `feat/api-core`, conventional commits.
