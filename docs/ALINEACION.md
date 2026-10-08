# ALINEACION — decisiones de equipo (2026-10-08)

Fuente de verdad sigue siendo `SPEC.md` + `openapi.yaml` + `CLAUDE.md`. Este archivo registra decisiones y el único cambio de contrato pendiente.

## Decisiones aceptadas (de prompts/T3-api-core.md)
- A · Reto 1 Farmaenlace: al confirmar cita `service`, el chat añade 1 línea de cashback SmartClub. Sin cambio de contrato.
- B · LLM: Bedrock (Converse) solo con `USE_BEDROCK=1`; `FakeLlm` en tests; fallback determinista siempre.
- C · `data/slots.json` lo genera la API (14 días, L–S, 09–17, "Quito Norte" / "Taller Quito") y se versiona.
- D · AWS: solo `AWS_REGION`, `BEDROCK_MODEL_ID` por env.
- Roles de aprobación: Esteban aprueba PRs de `apps/api`; Alexionix aprueba PRs de `apps/web`.
- Protocolo de gates: `docs/AUDIT-CHECK.md` (Cowork audita, Claude Code codifica).

## Cambio de contrato pendiente (PR `contract`) — HALLAZGO C1 · alta
`GET /leads` debe devolver teléfono enmascarado, pero `Lead` hereda de `LeadCreate` y exige `phone` con regex `^(\+593|0)9\d{8}$` → "09****1234" rompe el schema (schemathesis fallaría en F6).

Propuesta (mínima, compatible con la web):
```yaml
Lead:                      # respuesta de POST /leads (201) — sin cambios
LeadRead:                  # NUEVO — respuesta de GET /leads
  type: object
  required: [id, name, phoneMasked, source, createdAt, afterHours]
  properties:
    id, name, source, interest, recommendedModels, createdAt, afterHours, crmStatus  # igual que Lead
    phoneMasked: { type: string, example: "09****1234" }
# GET /leads → items: $ref LeadRead
```
Web (`/asesor`) consume `phoneMasked`; nunca recibe `phone`. Aprobar y aplicar en `openapi.yaml` antes de F1 de la API.

## Integración web ↔ api (gate S2)
- Web lee `VITE_API_URL` (default `http://localhost:8000`); MSW solo si `VITE_USE_MOCKS=1`.
- Enums (`suggestedActions`, `hotspot`, `AppointmentType`) se importan del tipo generado desde `openapi.yaml`, no se copian a mano.
- Chat: si la API ofrece franjas numeradas en texto, la web además muestra chips con `slotId` cuando `suggestedActions` incluye `book_*` (misma acción, mejor UX). Sin cambio de contrato.

## Fuera de alcance confirmado
3D de más de un modelo (se usa `dolphin.glb`, proxy Seagull con créditos CC BY-NC-SA en `apps/web/public/models/CREDITS.md`), ERP real, login, pagos.
