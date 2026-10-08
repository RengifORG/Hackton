# apps/api — BYD Ecuador Lead Agent API

API FastAPI + Pydantic v2 que cumple el contrato `docs/openapi.yaml` (paths exactos, JSON camelCase, sin prefijo `/api`).

## Arranque
```bash
cd apps/api
uv sync
uv run uvicorn app.main:app --reload   # http://localhost:8000/docs
```

## Verificar
```bash
uv run pytest -q
uv run ruff check .
```

## Variables de entorno
Copia `.env.example` a `.env` (ignorado por git). Ninguna es obligatoria para arrancar.

| Variable | Default | Uso |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:5173` | Orígenes permitidos, separados por coma |
| `USE_BEDROCK` | `0` | `1` activa Amazon Bedrock (F5); si no, fallback determinista |
| `AWS_REGION` | `us-east-1` | Región de Bedrock |
| `BEDROCK_MODEL_ID` | `amazon.nova-lite-v1:0` | Modelo Bedrock (Converse API) |
| `HUBSPOT_TOKEN` | vacío | Si existe, `HubSpotCrm`; si no, `FakeCrm` en memoria |
| `LOG_LEVEL` | `INFO` | Nivel de logging |
| `CATALOG_PATH` | `<repo>/data/catalog.json` | Única fuente de modelos (ruta resuelta desde el código) |
| `SLOTS_PATH` | `<repo>/data/slots.json` | Franjas (la API lo genera en F2) |

## Estructura
`app/routers` (HTTP) → `app/services` (negocio) → `app/adapters` (LLM/CRM/taller/calendario, con `Protocol` + `Fake*`) y `app/repositories` (memoria + catálogo). `app/core`: config, logging con redacción de PII, rate limit, reloj inyectable (hora Ecuador). `app/schemas`: modelos Pydantic alineados al contrato.

## Estado por fase
- **F0** · scaffold: `GET /health`, `GET /models`, `GET /models/{modelId}` desde `data/catalog.json`. ✅
- **F1** · H1 leads: `POST /leads` (201, `afterHours` en hora de Ecuador, entrega al CRM, 20/min por IP → 429) y `GET /leads` (bandeja del asesor, teléfono y email enmascarados). ✅
- F2 disponibilidad y citas · F3 chat · F4 recomendaciones · F5 Bedrock · F6 conformidad y entrega: pendientes.

## Leads (H1)
- `afterHours = true` si el lead entra antes de las 08:00 o desde las 18:00 hora de Ecuador.
- El lead se guarda **antes** de llamar al CRM: si el CRM falla, queda con `crmStatus: "failed"` y no se pierde.
- CRM: con `HUBSPOT_TOKEN` se crea el contacto en HubSpot (Contacts API v3); sin token se usa `FakeCrm` en memoria (**simulado**).
- `GET /leads` devuelve `phone` como `09****1234` y `email` como `a***@dominio`. El CRM sí recibe el teléfono completo.
- Rate limit solo en escrituras (`POST`); las lecturas no se limitan porque las bandejas las refrescan cada pocos segundos.

La sección **"qué es real vs simulado"** se completa en F6.
