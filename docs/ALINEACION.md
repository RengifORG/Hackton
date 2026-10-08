---
title: Alineación de equipo — contexto desde el lado API para Esteban
date: 2026-10-08
tipo: alineacion
para: Esteban (apps/web · T1 + T2)
de: Alexionix (apps/api · T3)
repo: https://github.com/RengifORG/Hackton
estado: v1 · para leer en 5 min y responder las preguntas de §7 antes de codificar
ubicacion-sugerida: docs/ALINEACION.md
---

# Alineación de equipo · contexto para continuar desde tu lado

> Etiquetas: **[Oficial]** = documento del organizador (rúbrica / guía AWS / deck). **[Repo]** = ya está así en tu constitución. **[Hecho]** = construido y verificado hoy de mi lado. **[Propuesta]** = para decidir juntos.

## 0. Por qué este documento (léelo primero)

Arrancamos en paralelo: tú dejaste la **constitución del repo** (SPEC + OpenAPI + CLAUDE.md + prompts por terminal) y yo, en mi sesión, **levanté la rúbrica oficial y la guía AWS** del organizador y **construí un prototipo funcional** del chatbot que agenda citas. Las dos cosas encajan bien, pero hay **4 ajustes pequeños** que conviene decidir **antes** de que escribas la primera línea, para no duplicar ni chocar en el contrato. Todo lo demás se mantiene como lo definiste: **tu constitución manda**.

## 1. Lo que el organizador fijó y tu SPEC todavía no refleja [Oficial]

**Rúbrica (una sola para los 3 retos):**

| Criterio | Pts | Lo que piden textual |
|---|---:|---|
| Propuesta de valor e impacto | **30** | problema relevante, usuario definido, beneficio concreto, **cómo medirías el impacto** |
| Calidad técnica y ejecución | **25** | prototipo funcional del flujo principal; **integraciones reales**; **identificar qué funciona y qué está simulado**; *"se valora la ejecución, no la cantidad de código ni la complejidad"* |
| Novedad y diferenciación | **20** | combinar IA, APIs, datos de forma creativa |
| Viabilidad e implementación | **15** | ruta realista a piloto |
| Claridad de presentación y demo | **10** | **pitch de 3 minutos** |

Escala 1–5; puntos = (nota ÷ 5) × peso. Evaluación general 75 + técnica 25.

**Los 3 retos del hackathon** (y la rúbrica dice que es *una misma rúbrica para los tres*): (1) fidelización transversal Farmaenlace×BYD, (2) servicio al cliente / post-venta, (3) mejora operativa. Tu SPEC cubre **muy bien el 2** (citas de taller/test drive) y **el 3** (bandeja del asesor y agenda del taller que se llenan solas). **El 1 no aparece**: ahí entra Farmaenlace (SmartClub/cashback). No hace falta un módulo nuevo; ver propuesta A en §4.

**Guía AWS del evento:** sandbox vía Workshop Studio (`catalog.workshops.aws`, código `0c31-026dc5-9e`), **una sola persona del equipo** la configura, acceso por consola o CLI. Reglas duras: **nada de datos reales** (13 categorías: personales, salud, pagos…), sin S3/EC2/RDS públicos, **Bedrock ≤ 1 solicitud/segundo**. Esto refuerza dos cosas de tu CLAUDE.md: datos sintéticos y PII enmascarada.

## 2. Lo que ya existe de mi lado (para que no lo rehagas) [Hecho]

- **Prototipo funcional** (FastAPI + React) de *exactamente* el flujo del SPEC: el cliente chatea → el bot agenda **test drive** (→ CRM tipo HubSpot simulado) o **taller/mantenimiento** (→ DMS/mini-ERP simulado) → la cita **aparece sola** en la vista del asesor y en la del taller (polling 3 s), con etiqueta "nuevo por chatbot". Incluye un **adaptador Amazon Bedrock** (Converse) con **fallback determinista** (la demo nunca depende de la red). Capturas adjuntas en el cerebro.
- **Qué de eso se porta a `apps/api`** (y qué no):

| Pieza mía | Destino en tu estructura | Nota |
|---|---|---|
| Máquina de estados del chat (intención → contacto → franja → cita) | `services/chat_service.py` | se adapta a tu `ChatRequest/ChatResponse`, `suggestedActions`, `hotspot` |
| Lógica de franjas y reserva (409, adapters por tipo) | `services/appointment_service.py` + `adapters/calendar.py` | a tu `Slot`/`Appointment` |
| Adaptador Bedrock + fallback | `adapters/llm.py` (`LlmPort`, `BedrockLlm`, `FakeLlm`) | T3 permite `boto3` |
| Seeds y stores en memoria | `repositories/memory.py` | interfaz lista para DynamoDB |
| **Mi front React (3 vistas)** | **no se entrega** | la web es tuya (T1/T2); queda como referencia visual |

- **Cerebro del proyecto** (vault Obsidian en mi máquina, lo comparto): rúbrica y guía AWS transcritas, ADRs, plan de la API acoplado a tu contrato, guion de demo de 3 min.

## 3. Lo que adopto tal cual de tu constitución [Repo]

Contrato primero (`docs/openapi.yaml`, web mockea con MSW, API lo valida con `schemathesis`); TDD por criterio de aceptación; `router → service → adapter` con `Protocol` + `Fake*`; `extra="forbid"`; LLM **solo** por tool-calling validado; PII fuera de logs y prompts; rate limit; CORS a `:5173`; secretos por env + gitleaks; Conventional Commits; ramas `feat/<area>-<nombre>`; PR pequeño, CI verde, 1 aprobación; español en UI/docs, inglés en código. `uv`/`ruff`/`pytest` en API; `pnpm` en web. **Flujo CONTACTO → CITA** del `decision-tree.md` (lead con consentimiento antes de cualquier cita).

## 4. Los 4 ajustes que propongo decidir ahora [Propuesta]

| # | Tema | Hoy en el repo | Propuesta | Por qué | Impacto |
|---|---|---|---|---|---|
| **A** | Reto 1 (fidelización Farmaenlace) | No está | Al confirmar una cita `service`, el chat menciona el **cashback SmartClub canjeable en Farmaenlace** (solo texto, sin tocar contrato). Opcional: campo `loyaltyNote?: string` en `Appointment` vía PR `contract`. | La rúbrica es única para los 3 retos; con una línea cubrimos el reto 1 sin construir nada | Cero riesgo (texto); mínimo si se añade el campo opcional |
| **B** | LLM | `anthropic` **o** `boto3` Bedrock | **Bedrock** (`boto3`, modelo económico tipo Nova Lite; Claude en Bedrock si hay acceso), con `FakeLlm` en tests y fallback determinista en runtime | "Integraciones reales" = 25 pts; hay sandbox del evento; mi adaptador ya existe | Tú no cambias nada: el front solo ve `/chat` |
| **C** | `data/slots.json` | Mencionado, no existe | **La API lo genera** (2 semanas, 09:00–17:00 cada hora; `test_drive` "Quito Norte", `service` "Taller Quito") y lo versiona | T3 paso 6 ya lo dice; evita que ambos lo creemos | Tus mocks MSW pueden usar el mismo archivo |
| **D** | AWS sandbox | — | Una sola persona la abre (propongo que seas **tú** si vas a desplegar la web en CloudFront, o yo si solo usamos Bedrock). Región a fijar (sugiero `us-east-1`). Habilitar acceso al modelo en Bedrock | Regla del organizador; evita dos cuentas | 15 min de quien la abra |

Fuera de esto, **no toco tu contrato**. Si algo del contrato no calza al implementar, abro PR con label `contract` como dice tu README.

## 5. Plan conjunto de hoy (paralelo, con 3 puntos de sincronización)

| Tiempo | Esteban (web) | Alexionix (api) | Sincronización |
|---|---|---|---|
| T+0:00 | Lees este doc, respondes §7 | Ajusto el plan con tus respuestas | **S1 · 10 min de alineación** (chat o llamada) |
| T+0:10 → 1:30 | T1 pasos 1–4: scaffold, cliente tipado desde OpenAPI, MSW, viewer 3D, chat | F0–F2: scaffold `uv`, `/health`, `/models` (catalog.json), **H1 `/leads`**, **H4 `/availability` + `/appointments`** | — |
| T+1:30 | T1 paso 5 (rutas `/` y `/modelos/dolphin`) o T2 (`/asesor`, `/taller`) | **H3 `/chat`** determinista (CONTACTO→CITA, `hotspot`, `suggestedActions`, rate limit) | **S2 · smoke MSW → API real** (tu web apunta a `:8000`; recorrido lead → cita → `/asesor` y `/taller`) |
| T+2:30 | Pulido UI + badge "fuera de horario" | H2 `/recommendations` (fallback) → Bedrock encima → `schemathesis` + `ruff` + Docker | **S3 · demo interna cronometrada (3 min)** |
| T+3:00 | Pitch: slides mínimas | README `apps/api`, `.env.example`, "real vs simulado" | Ensayo final |

**Corte mínimo demostrable:** tu T1 (viewer + chat contra mock) + mi F0–F3. Si a T+2:00 no está verde, no abrimos H2/Bedrock: pulimos lo que hay (la rúbrica premia ejecución).

## 6. Lo que debe calzar técnicamente (checklist de integración)

- Paths **exactos** del `openapi.yaml`, **sin prefijo `/api`**; JSON en **camelCase** (`sessionId`, `leadId`, `afterHours`, `rangeKm`).
- `sessionId` lo genera tu front (uuid, 8–64 chars); el estado de conversación vive en la API por `sessionId`.
- `modelId` siempre de `data/catalog.json`; `/recommendations` devuelve **exactamente 3** ids existentes.
- `hotspot` ∈ {`wheels, seats, screen, battery, trunk, lights`}; `suggestedActions` ∈ {`recommend, leave_contact, book_test_drive, book_service, view_3d`}. Nada fuera del enum.
- `POST /leads` (con `consent: true`) **antes** de `POST /appointments` (`leadId` obligatorio). 409 si el slot está ocupado.
- `afterHours` calculado en `America/Guayaquil` (fuera de 08:00–18:00): es la **métrica de la demo** en `/asesor`.
- CORS: `http://localhost:5173` (+ CloudFront por env). Tu `VITE_API_URL=http://localhost:8000` cuando dejes MSW.
- Teléfonos solo enmascarados en respuestas de lectura (`09****1234`); nada de PII al LLM.

## 7. Preguntas para ti (responde en una línea cada una)

1. ¿Confirmas roles: tú T1 + T2 (web), yo T3 (api)?
2. ¿OK con **A** (cashback Farmaenlace como texto en el chat; campo opcional después)?
3. ¿OK con **B** (Bedrock como LLM, con fallback)?
4. ¿OK con **C** (la API genera `data/slots.json`)?
5. **D**: ¿quién abre la sandbox AWS y en qué región?
6. ¿Tienes ya el `.glb` del Dolphin o vas con el placeholder de T1 paso 3?
7. ¿Quién presenta qué en los 3 minutos? (Propuesta: tú abres con problema + 3D; yo cierro con agenda/bandejas + "real vs simulado"; métrica en pantalla.)

## 8. Anexos (dónde está cada cosa)

- Prototipo funcional (referencia): `C:\Hackaton\2026-10-08__primera-linea-byd__prototipo-h4\` (README con `run.ps1`; capturas en `spec/shots/`). Puedo subirlo como rama `ref/prototipo-h4` del repo si te sirve de referencia visual — no lo mezclamos con `main`.
- Plan detallado de la API acoplado a tu contrato (fases F0–F7, tests por CA, DoD): `docs/` del cerebro → `2026-10-08__plan-desarrollo-api__acoplado-repo-esteban.md`.
- Rúbrica y guía AWS (PDFs del organizador): `C:\Hackaton\cerebro\` (te los paso).
- Decisiones registradas (ADRs y log): `C:\Hackaton\cerebro\hackton\02-decisiones\`.
