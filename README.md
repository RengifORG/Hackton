# BYD Ecuador — Asesor Virtual 24/7

**Hackathon BYD × Farmaenlace · Octubre 2026 · Equipo: Esteban Enríquez (web) · Alexionix Rengifo (API)**

🌐 Demo: https://main.d1gihhioa9kpai.amplifyapp.com

## El problema

El call center de BYD Ecuador atiende de 08:00 a 18:00. Fuera de ese horario el único canal es un formulario web sin respuesta inmediata; no hay chat, ni WhatsApp, ni forma de agendar una prueba de manejo o una cita de taller. El cliente que investiga un eléctrico lo hace de noche, con el teléfono en la mano, y en ese lapso compara con la marca que sí le contestó. **Cada noche se pierden leads que ya habían levantado la mano.**

## La solución

Un showroom abierto 24/7 que **muestra, capta y agenda** sin intervención humana, y deja todo listo en la bandeja del asesor y del taller para las 08:00:

1. **Muestra** — El BYD Dolphin en 3D: vista 360°, interior, vistas rápidas y hotspots (llantas, asientos, pantalla, batería, maletero, luces). Tocar una pieza abre la conversación sobre ella; preguntar por una pieza mueve la cámara.
2. **Capta** — El asesor virtual responde con la ficha oficial, recomienda 3 modelos del portafolio BYD Ecuador con 4 preguntas (uso, pasajeros, presupuesto, carga en casa) y registra el lead con consentimiento LOPDP.
3. **Agenda** — Prueba de manejo (Quito Norte) o cita de taller (Taller Quito) en franjas reales, con control de disponibilidad (409 si la franja está ocupada). Las citas de taller incluyen el beneficio SmartClub canjeable en Farmaenlace (reto 1).

Métrica de impacto: **leads capturados fuera de horario (18:00–08:00) y citas agendadas desde el chat**, visibles en la bandeja del asesor desde el día uno.

## Rutas

| Ruta | Qué muestra |
|---|---|
| `/` | Landing con CTA al asesor virtual |
| `/modelos/dolphin` | Visor 3D + asesor virtual (chat, recomendación, lead, cita) |
| `/asesor` | Bandeja del asesor comercial: KPIs, leads con teléfono enmascarado, modelos recomendados, cita, badge "Capturado fuera de horario"; auto-refresco cada 5 s |
| `/taller` | Agenda del taller: citas de servicio de hoy y próximos 7 días, por día y franja, con beneficio SmartClub |

## Qué es real y qué está simulado

| Pieza | Estado |
|---|---|
| Web (React + Three.js): visor 3D, chat, bandejas | **Real**, desplegada en AWS Amplify |
| API (FastAPI): validación estricta por contrato, rate limit, CORS, logs JSON con PII redactada | **Real** |
| Flujo conversacional: contacto antes de cita, franjas, 409, hotspots, recomendación por scoring | **Real**, determinista y con tests |
| Métrica `afterHours` en hora de Ecuador | **Real** |
| Amazon Bedrock para redactar la ficha y elegir modelos | **Real con `USE_BEDROCK=1`**; sin credenciales responde el camino determinista |
| CRM HubSpot | **Simulado**: `FakeCrm` en memoria; adapter con interfaz lista para `HUBSPOT_TOKEN` |
| ERP / órdenes de taller | **Simulado**: `FakeWorkshop` en memoria |
| Persistencia | **En memoria** (piloto: DynamoDB) |
| Modelo 3D | **Proxy**: BYD Seagull con licencia CC BY-NC-SA (ver `apps/web/public/models/CREDITS.md`); en producción BYD aporta sus assets |
| WhatsApp | **Siguiente paso**: webhook diseñado, no incluido |

## Arquitectura

```
apps/web (React 18 · Vite · TypeScript · Tailwind · React Three Fiber · zustand · MSW)
   │  cliente tipado generado desde docs/openapi.yaml (openapi-typescript + zod)
   ▼
apps/api (FastAPI · Pydantic v2 · slowapi · schemathesis)
   routers → services → adapters (LLM · CRM · Workshop · Calendar) + repositories (memoria · catálogo)
   │
   ├─ data/catalog.json   única fuente de modelos (web y API)
   └─ data/slots.json     franjas generadas por la API (14 días, L–S, 09:00–17:00)
```

El contrato `docs/openapi.yaml` es la fuente de verdad: la web genera sus tipos desde él (`pnpm check:api` falla en CI si quedan desactualizados) y la API valida su conformidad con schemathesis.

## Seguridad y datos

- Toda entrada se valida con esquemas estrictos (`extra="forbid"` / `z.strictObject`).
- El LLM nunca ejecuta acciones por texto libre: leads y citas solo se crean por transiciones de estado con datos validados.
- Teléfono y email nunca llegan al front en lectura (`LeadRead.phoneMasked`), nunca van a logs ni a prompts.
- Rate limit 20 req/min por IP en `/chat`, `/leads`, `/appointments`. CORS restringido. Secretos solo por variables de entorno.
- Aviso y consentimiento LOPDP en el primer mensaje y antes de registrar el lead. Solo datos sintéticos en seeds y tests.

## Cómo se construyó

Spec-Driven Development + TDD: `docs/SPEC.md` define historias con criterios de aceptación numerados; cada CA es un test. Protocolo de gates con auditoría por fase en `docs/AUDIT-CHECK.md`. CI (`.github/workflows/ci.yml`): gitleaks, lint, tests y build en cada PR. Conventional Commits, PRs pequeños, una aprobación cruzada.

## Arranque local

```bash
git clone https://github.com/RengifORG/Hackton.git && cd Hackton

# API — http://localhost:8000/docs
cd apps/api && uv sync && uv run uvicorn app.main:app --port 8000

# Web — http://localhost:5173
cd apps/web && pnpm install
VITE_USE_MOCKS=0 pnpm dev          # contra la API local
VITE_USE_MOCKS=1 pnpm dev          # sin API, con datos de ejemplo (MSW)
```

Variables en `apps/web/.env.example` y `apps/api/.env.example`. Tests: `pnpm test` (web) · `uv run pytest` (API).

## Ruta a piloto

1. HubSpot real: Contacts + Meetings (disponibilidad por asesor) — 1 día.
2. WhatsApp vía Twilio/Cloud API reutilizando `ChatService` — webhook ya definido.
3. Persistencia en DynamoDB; API en App Runner. Todo serverless, dentro del presupuesto AWS del piloto.
4. Asset 3D oficial de BYD y modelos adicionales en el visor.

## Documentación

`docs/SPEC.md` · `docs/openapi.yaml` · `docs/decision-tree.md` · `docs/ALINEACION.md` · `docs/AUDIT-CHECK.md` · `apps/api/README.md` · `prompts/`
