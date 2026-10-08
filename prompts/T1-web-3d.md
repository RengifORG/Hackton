# Terminal 1 — Web + vista 3D (Esteban) · `claude` en `apps/web`

Lee CLAUDE.md, docs/SPEC.md (H3, H5), docs/openapi.yaml y data/catalog.json. Trabajamos con Spec-Driven Development y TDD: no escribas código que no esté respaldado por un criterio de aceptación del SPEC.

Objetivo de esta sesión (máx. 2.5 h): dejar funcionando `/modelos/dolphin` con vista 3D 360 + hotspots + chat lateral, contra un mock del API.

Pasos, en orden, y me confirmas al terminar cada uno:

1. Scaffold en `apps/web`: Vite + React 18 + TypeScript + Tailwind + react-router. Instala `three @react-three/fiber @react-three/drei zustand zod msw vitest @testing-library/react @testing-library/jest-dom jsdom`. Configura `pnpm test`, `pnpm lint` (eslint + prettier). Paths: `src/features/{viewer,chat,catalog}`, `src/mocks` (MSW), `src/lib/api` (cliente tipado).
2. Cliente API tipado desde `docs/openapi.yaml` con `openapi-typescript` (genera `src/lib/api/schema.d.ts`). Handlers MSW para `GET /models`, `GET /models/{id}`, `POST /chat`, `POST /recommendations` que leen `data/catalog.json`. Test: el cliente devuelve el catálogo y valida con zod.
3. Feature `viewer` (H5): componente `CarViewer` con `<Canvas>`, `<Stage>`, `<OrbitControls autoRotate>`, `useGLTF('/models/dolphin.glb')` con `<Suspense>` y loader. Si no existe el .glb todavía, usa un placeholder (box con proporciones 4.28×1.57×1.77 m) para no bloquearme. Hotspots desde `model.hotspots` con `<Html>` de drei; click → `useChatStore.ask("Cuéntame de las " + label)`. Función `focusHotspot(id)` que anima la cámara (usa `useSpring` de `@react-spring/three` o lerp manual). Fallback si no hay WebGL (CA5.4). Tests: render sin WebGL muestra fallback; click en hotspot llama al store.
4. Feature `chat` (H3): panel lateral, store zustand con `sessionId` (uuid), mensajes, `ask()`. `POST /chat` vía cliente; si la respuesta trae `hotspot`, llama `focusHotspot`. Primer mensaje muestra aviso LOPDP. Chips de `suggestedActions`. Tests: enviar mensaje agrega respuesta; respuesta con hotspot dispara focus.
5. Página `/` con hero y CTA "Hablar con el asesor virtual"; `/modelos/dolphin` con viewer + chat. Mobile-first.
6. CI: verifica que `pnpm lint && pnpm test` pasen en local antes de commitear. Conventional commits, rama `feat/web-viewer`.

Restricciones: nada de lógica de negocio en componentes (va en stores/hooks). Sin `any`. Sin secretos en el front. Español en la UI. No implementes nada de H6 ni del backend real.
