# Terminal 2 — Mockups asesor y taller (Esteban) · `claude` en `apps/web` (otra rama/worktree)

Usa `git worktree add ../web-mockups feat/web-mockups` para no chocar con la Terminal 1, o espera a que T1 termine el paso 2 (cliente API + MSW) y arranca desde ahí.

Lee CLAUDE.md, docs/SPEC.md (H6), docs/openapi.yaml. SDD + TDD.

Objetivo (máx. 1.5 h): dos vistas de recepción, en React, consumiendo el mismo API (mockeado con MSW):

1. Handlers MSW: `GET /leads` (8 leads de ejemplo, 5 con `afterHours: true`, teléfonos ya enmascarados `09****1234`, `recommendedModels`, `crmStatus`), `GET /appointments` y `GET /appointments?type=service` (mezcla de `test_drive` y `service`, con `slot`, `leadName`, `vehicle`).
2. `/asesor` (CA6.1): layout tipo bandeja HubSpot: tarjetas KPI arriba (Leads hoy, Fuera de horario, Citas test drive, Pendientes en CRM), tabla de leads con badge "Capturado fuera de horario", botón "Ver en HubSpot" (link mock), detalle lateral con los 3 modelos recomendados y la transcripción resumida del chat (campo `interest`).
3. `/taller` (CA6.2): agenda del día por franjas horarias, solo citas `service`, columna vehículo/placa/motivo, badge fuera de horario, botón "Confirmar recepción" (solo estado local).
4. Tests: cada vista renderiza datos del mock; el badge aparece solo cuando `afterHours` es true; filtro `type=service` en `/taller`.
5. Componentes compartidos en `src/components/ui` (Badge, KpiCard, Table). Tailwind, sin librerías de UI pesadas. Español.

No toques `features/viewer` ni `features/chat`. Commits convencionales, rama `feat/web-mockups`.
