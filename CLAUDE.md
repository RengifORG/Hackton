# BYD Ecuador — Agente de leads 24/7 (Hackathon MVP)

Monorepo. Lee `docs/SPEC.md` y `docs/openapi.yaml` ANTES de tocar código. El spec manda: si algo no está en el spec, no se implementa; si el spec está mal, se corrige el spec primero (Spec-Driven Development).

## Estructura
- `apps/web/`      React + Vite + TS + Tailwind + React Three Fiber (Esteban)
- `apps/api/`      FastAPI + Pydantic v2 (compañero)
- `docs/`          SPEC.md, openapi.yaml, decision-tree.md
- `data/`          catalog.json (fuente única de verdad de modelos), slots.json
- `.github/`       CI

## Reglas (no negociables)
1. **Contrato primero**: `docs/openapi.yaml` es el contrato. Web mockea con MSW contra él; API lo cumple y lo valida en tests.
2. **TDD**: test que falla → implementación mínima → refactor. Ningún PR sin tests del comportamiento nuevo.
3. **SOLID pragmático**: router → service → adapter. Adapters (LLM, HubSpot, Calendar, WhatsApp) detrás de una interfaz y mockeables. Nada de lógica de negocio en routers ni en componentes React.
4. **Security first**:
   - Pydantic/zod estrictos en toda entrada. `extra="forbid"`.
   - El LLM nunca ejecuta acciones por texto libre: solo tool-calling con esquema; el service valida el payload antes de actuar.
   - PII (cédula, teléfono, email) nunca en logs ni en prompts más allá de lo necesario. Logs estructurados con campos redactados.
   - Rate limit en `/chat`, `/leads`, `/appointments`. CORS solo al origen del front. Secrets solo por env; `.env` en `.gitignore`; gitleaks en CI.
   - HTTPS siempre (CloudFront/ACM).
5. **Commits**: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Ramas `feat/<area>-<corto>`. PR pequeño, CI verde, 1 aprobación.
6. **Español** en UI y docs; código e identificadores en inglés.

## Comandos
- Web: `pnpm i && pnpm dev` · `pnpm test` · `pnpm lint`
- API: `uv sync && uv run uvicorn app.main:app --reload` · `uv run pytest` · `uv run ruff check .`

## Fuera de alcance del MVP (no implementar)
Un 3D por cada modelo, ERP real, login de clientes, pagos, multi-idioma.
