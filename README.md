# BYD Ecuador — Agente de leads 24/7 (MVP Hackathon)

Captura leads fuera del horario del call center, recomienda 3 modelos, muestra el Dolphin en 3D y agenda citas que llegan al asesor (HubSpot) y al taller.

## Arranque
```
git clone <repo> && cd <repo>
# Web
cd apps/web && pnpm i && pnpm dev          # http://localhost:5173
# API
cd apps/api && uv sync && uv run uvicorn app.main:app --reload   # http://localhost:8000/docs
```

## Cómo trabajamos
- `docs/SPEC.md` + `docs/openapi.yaml` son la fuente de verdad (SDD). Cambios al contrato → PR con label `contract`.
- TDD. CI exige lint + tests + sin secretos.
- Ramas `feat/<area>-<nombre>`, PR a `main`, 1 aprobación.
- Prompts por terminal en `prompts/`.

## Rutas web
`/` landing+chat · `/modelos/dolphin` 3D+chat · `/asesor` bandeja CRM mock · `/taller` agenda taller mock
