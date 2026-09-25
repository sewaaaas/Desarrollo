# FE-01 — Implementation Review: Base del frontend / arquitectura

## 1. Resumen ejecutivo

FE-01 quedó implementado sobre `cidrix-web`. El scaffold de Vite fue convertido en una base frontend CIDRIX con arquitectura Feature-First, React Router, layouts estructurales, Tailwind CSS con tokens semánticos, un Design System mínimo, configuración de entorno fail-fast, cliente API centralizado sobre `fetch`, manejo base de errores y pruebas unitarias/de componentes.

La versión de TypeScript fue alineada obligatoriamente de 6.0.3 a **5.8.3**. React permanece en 19.2.7 y Vite en 8.1.3, sin upgrades incidentales.

Todas las validaciones obligatorias pasan. No se modificó `cidrix-api`, no se implementó el Login real ni ninguna funcionalidad de FE-02 a FE-07, y no se realizó commit, push, pull request ni merge.

Rama local de trabajo: `codex/fe-01-frontend-base`.

Commit base: `e88ac2bb2e461a425190bb7661512843c151cce5`.

## 2. Cambios realizados

### Arquitectura

- Se creó el núcleo de aplicación en `src/app`.
- Se separaron layouts, routing y error boundary.
- Se crearon features independientes para Auth, Dashboard, Notifications, Settings y Tickets.
- Se centralizaron componentes, configuración y servicios reutilizables en `src/shared`.
- Se respetaron las fronteras `app -> features/shared`, `features -> shared`, `shared -X-> app/features`.
- No se crearon carpetas vacías ni capas sin consumidor.

### Toolchain

- TypeScript quedó bloqueado con rango `~5.8.3` y versión instalada 5.8.3.
- Se activó `strict: true` en la configuración de aplicación y de Vite/Node.
- Se implementó el alias único `@/* -> src/*` mediante `paths` y `resolve.tsconfigPaths` de Vite.
- Oxlint fue retirado.
- ESLint flat config quedó configurado para JavaScript, TypeScript, React Hooks y React Refresh.
- Se añadieron scripts explícitos para lint, typecheck, tests y watch de tests.

### Routing

- Se añadió React Router en modo declarativo.
- Se configuraron rutas placeholder para Login, Dashboard, Tickets, detalle de ticket, Notifications y Settings.
- `/` redirige temporalmente a `/login`.
- Se añadió una pantalla 404 segura.
- No se añadieron guardas, sesión, permisos ni redirects de usuario autenticado.

### Layouts

- `AuthLayout` ofrece un contenedor neutral, flexible y responsive para integrar en FE-02 el Login aprobado de Stitch.
- `AppLayout` prepara regiones semánticas `aside`, `header` y `main`.
- La navegación actual es puramente estructural y no contiene lógica de rol o sesión.

### Design System

- Se crearon `Button`, `Input`, `Card`, `Spinner` y `PageContainer`.
- Los componentes son tipados, accesibles y no contienen lógica de negocio.
- Se centralizaron colores, radios, sombras y tipografía.
- Solo existe tema claro; no se implementó dark mode.

### API client

- Se creó un cliente centralizado basado en `fetch`.
- Construye rutas relativas desde `VITE_API_URL`.
- Usa `credentials: "include"`.
- Incluye `Accept: application/json`.
- Solo añade `Content-Type: application/json` cuando se usa `json`.
- Permite body nativo, incluido `FormData`, sin forzar content type.
- Admite Bearer opcional y `AbortSignal`.
- Maneja 204, errores HTTP estructurados, fallos de red, cancelaciones y respuestas inválidas.
- Desenvuelve exactamente un nivel de `{ data: T }`.
- Modela paginación como `ApiEnvelope<Paginated<T>>`, respetando el contrato actual del backend.

### Environment

- Se creó `.env.example` con `VITE_API_URL=http://localhost:3000/api/v1`.
- `.gitignore` bloquea `.env` y `.env.*`, excepto `.env.example`.
- La aplicación valida al iniciar que la variable exista, sea string, sea una URL válida y use HTTP(S).
- No existe fallback silencioso.

### Testing

- Se configuró Vitest con jsdom.
- Se configuró React Testing Library y jest-dom.
- Se añadió cleanup común.
- Se implementaron pruebas de routing, layouts, componentes, error boundary, environment y cliente API.

### Documentación

- Se reemplazó el README genérico de Vite por instrucciones de CIDRIX Web.
- Se documentaron requisitos, instalación, entorno, scripts, estructura y reglas arquitectónicas.
- `index.html` usa `lang="es"`, título CIDRIX y descripción del producto.
- Se retiró el favicon demo sin inventar un favicon corporativo.

## 3. Dependencias

### Agregadas

Runtime:

- `react-router` 8.3.1.

Desarrollo:

- `tailwindcss` 4.3.3.
- `@tailwindcss/vite` 4.3.3.
- `vitest` 5.0.0.
- `jsdom` 30.0.1.
- `@testing-library/react` 16.3.3.
- `@testing-library/dom` 10.4.1.
- `@testing-library/jest-dom` 7.0.1.
- `eslint` 10.10.0.
- `@eslint/js` 10.0.1.
- `typescript-eslint` 8.69.0.
- `eslint-plugin-react-hooks` 7.1.1.
- `eslint-plugin-react-refresh` 0.5.6.
- `globals` 17.12.0.

### Retiradas

- `oxlint`.

### Versiones finales relevantes

| Dependencia | Versión final |
|---|---:|
| Node.js usado | 24.18.0 |
| React | 19.2.7 |
| React DOM | 19.2.7 |
| TypeScript | **5.8.3** |
| Vite | 8.1.3 |
| React Router | 8.3.1 |
| Tailwind CSS | 4.3.3 |
| ESLint | 10.10.0 |
| Vitest | 5.0.0 |

React y Vite conservaron sus versiones bloqueadas previas. TypeScript 6.x ya no está instalado ni declarado.

### Auditoría de dependencias

La instalación inicial detectó vulnerabilidades transitivas en `postcss@8.5.16` y `nanoid@3.3.15`, ambas procedentes de Vite. Se actualizaron de forma dirigida dentro de los rangos compatibles a `postcss@8.5.28` y `nanoid@3.3.18`.

Resultado final de `npm audit`: **0 vulnerabilidades**.

No se utilizó `npm audit fix` y no se modificaron dependencias directas fuera de la allowlist aprobada.

## 4. Arquitectura final

```text
cidrix-web/
├── .env.example
├── .gitignore
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── README.md
├── public/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── errors/
│   │   │   ├── AppErrorBoundary.test.tsx
│   │   │   └── AppErrorBoundary.tsx
│   │   ├── layouts/
│   │   │   ├── AppLayout.tsx
│   │   │   └── AuthLayout.tsx
│   │   └── router/
│   │       ├── AppRouter.tsx
│   │       ├── AppRoutes.test.tsx
│   │       └── AppRoutes.tsx
│   ├── features/
│   │   ├── auth/pages/LoginPlaceholderPage.tsx
│   │   ├── dashboard/pages/DashboardPlaceholderPage.tsx
│   │   ├── notifications/pages/NotificationsPlaceholderPage.tsx
│   │   ├── settings/pages/SettingsPlaceholderPage.tsx
│   │   └── tickets/pages/
│   │       ├── TicketDetailPlaceholderPage.tsx
│   │       └── TicketsPlaceholderPage.tsx
│   ├── shared/
│   │   ├── components/
│   │   │   ├── Button.test.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.test.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── PageContainer.tsx
│   │   │   ├── Spinner.test.tsx
│   │   │   └── Spinner.tsx
│   │   ├── config/
│   │   │   ├── env.test.ts
│   │   │   └── env.ts
│   │   └── services/api/
│   │       ├── api-client.test.ts
│   │       ├── api-client.ts
│   │       ├── api-error.ts
│   │       └── api.types.ts
│   ├── styles/
│   │   ├── globals.css
│   │   └── tokens.css
│   ├── test/
│   │   └── setup.ts
│   └── main.tsx
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

No se creó `shared/types/common.types.ts` porque no apareció un tipo común real fuera de los contratos API. Crear el archivo vacío habría añadido una abstracción sin consumidor.

## 5. Routing final

| Ruta | Layout | Componente | Estado |
|---|---|---|---|
| `/` | Ninguno | `Navigate` | Redirect temporal a `/login`. |
| `/login` | `AuthLayout` | `LoginPlaceholderPage` | Placeholder neutral; sin formulario. |
| `/dashboard` | `AppLayout` | `DashboardPlaceholderPage` | Placeholder estructural. |
| `/tickets` | `AppLayout` | `TicketsPlaceholderPage` | Placeholder estructural. |
| `/tickets/:id` | `AppLayout` | `TicketDetailPlaceholderPage` | Placeholder; valida parámetro dinámico. |
| `/notifications` | `AppLayout` | `NotificationsPlaceholderPage` | Placeholder estructural. |
| `/settings` | `AppLayout` | `SettingsPlaceholderPage` | Placeholder estructural. |
| `*` | Ninguno | `NotFoundPage` interno | Pantalla 404 segura. |

No existe protección de rutas. Durante FE-01 las rutas del `AppLayout` pueden abrirse directamente; FE-02 asumirá sesión, redirects y experiencia por rol.

## 6. Design System implementado

### Tokens reales

`tokens.css` concentra:

- `background`.
- `surface`.
- `surface-muted`.
- `foreground`.
- `foreground-muted`.
- `border`.
- `primary`.
- `primary-hover`.
- `focus`.
- `danger`.
- `success`.
- radio de controles y cards.
- sombra de card y overlay.
- familia tipográfica sans del sistema.

Los tokens se exponen a Tailwind mediante `@theme inline`. Los hexadecimales existen únicamente en el archivo central de tokens; los componentes consumen nombres semánticos.

### Componentes

- `Button`: variantes `primary`, `secondary` y `danger`; tamaños `sm`, `md`, `lg`; estados disabled/loading; `aria-busy`; spinner nombrado.
- `Input`: label obligatorio asociado, helper/error enlazado con `aria-describedby`, `aria-invalid` y soporte completo de atributos nativos.
- `Card`: superficie, borde, radio y sombra consistentes.
- `Spinner`: tres tamaños, `role="status"` y label accesible configurable.
- `PageContainer`: ancho máximo y paddings responsive.

No se crearon Textarea, Select, Badge, EmptyState, Modal, Toast, Table ni Dropdown.

### Tema y responsive

- `color-scheme: light` es explícito.
- No existe `prefers-color-scheme: dark`, clases `dark:` ni toggle de tema.
- Los tokens semánticos permiten sustituir valores en una fase futura.
- Se incluyó tratamiento para `prefers-reduced-motion`.
- Los layouts se adaptan desde móvil a escritorio sin fijar una composición definitiva del Login.

## 7. Cliente API

### Comportamiento real

- `createApiClient()` permite inyectar base URL y `fetch` para pruebas.
- La instancia compartida obtiene la URL desde `VITE_API_URL` en tiempo de ejecución.
- Solo permite paths relativos, evitando que un consumidor omita accidentalmente la base configurada.
- Normaliza slashes entre URL base y path.
- Envía cookies con `credentials: "include"`.
- Establece `Accept: application/json`.
- La opción `json` serializa con `JSON.stringify` y añade `Content-Type: application/json`.
- La opción mutuamente exclusiva `body` admite cuerpos nativos sin imponer content type.
- `accessToken` es opcional, se recorta y produce `Authorization: Bearer` solo cuando existe.
- Propaga el `AbortSignal` recibido.
- Un 204 retorna `undefined` sin intentar parsear body.
- Los éxitos deben respetar `{ data: T }`; se desenvuelve exactamente ese nivel.
- El payload paginado interior conserva `{ data, meta }` sin un segundo unwrap.

### ApiError

`ApiError` ofrece:

- `kind`: `http`, `network`, `aborted` o `protocol`.
- `code` estable.
- `message` segura.
- `status` cuando existe una respuesta HTTP.
- `details` opcionales del contrato backend.
- `cause` para diagnóstico sin mostrarlo en la UI.

Los errores HTTP válidos conservan `error.code`, `error.message` y `error.details` del backend. Respuestas inesperadas y fallos de transporte usan códigos locales diferenciables.

### Limitaciones deliberadas

No se implementaron:

- refresh automático;
- cola o replay de requests;
- persistencia de access token;
- redirects por 401;
- AuthProvider;
- servicios de dominio;
- upload o download funcionales.

## 8. Seguridad

- No se encontraron secretos en el diff.
- `.env` y variantes reales están ignorados; solo `.env.example` se versionará.
- `VITE_API_URL` contiene configuración pública, no credenciales.
- No existe uso de `localStorage` ni `sessionStorage`.
- No existe persistencia de JWT.
- No existe código de refresh token en frontend.
- Las cookies quedan preparadas mediante `credentials: "include"`.
- El Bearer es opcional y debe ser proporcionado por la futura capa de sesión.
- No se implementó autorización en frontend como barrera de seguridad.
- No existe lógica tenant en el cliente; el backend continúa siendo la autoridad.
- El error boundary no muestra mensajes internos ni stack traces al usuario.
- La auditoría npm termina con cero vulnerabilidades conocidas.

## 9. Tests

### Archivos

- `src/app/errors/AppErrorBoundary.test.tsx`.
- `src/app/router/AppRoutes.test.tsx`.
- `src/shared/components/Button.test.tsx`.
- `src/shared/components/Input.test.tsx`.
- `src/shared/components/Spinner.test.tsx`.
- `src/shared/config/env.test.ts`.
- `src/shared/services/api/api-client.test.ts`.

### Casos cubiertos

- Error boundary: fallback seguro y no exposición del error interno.
- Routing: Login/AuthLayout, Tickets/AppLayout, detalle dinámico y 404.
- Button: click, disabled/loading, `aria-busy` y spinner accesible.
- Input: asociación de label, helper y error accesible.
- Spinner: status y nombre accesible.
- Environment: HTTP, HTTPS, normalización, ausencia, tipo inválido, URL malformada y protocolo inválido.
- API client: URL desde env, normalización de URL, credentials, unwrap único, paginación, JSON, Bearer opcional, FormData sin content type, 204, error backend, error de red, cancelación y response protocol inválido.

### Resultado

- Suites: **7 passed / 7**.
- Tests: **29 passed / 29**.
- Snapshots: ninguno.

## 10. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `npm run lint` | **PASS** — ESLint sin errores ni warnings. |
| `npm run typecheck` | **PASS** — TypeScript 5.8.3 strict. |
| `npm test` | **PASS** — 7 suites, 29 tests. |
| `npm run build` | **PASS** — Vite 8.1.3, 91 módulos transformados. |
| `git diff --check` | **PASS** — sin errores de whitespace. |
| `npm audit` | **PASS** — 0 vulnerabilidades. |

El build generó:

- `dist/index.html`: 0.50 kB.
- CSS: 14.81 kB, 3.88 kB gzip.
- JavaScript: 239.81 kB, 76.71 kB gzip.

El directorio `dist` fue eliminado después de validar porque es un artefacto reproducible e ignorado por Git.

Git emitió advertencias informativas de futura conversión LF a CRLF en algunos archivos existentes/modificados. `git diff --check` finalizó con exit code 0.

## 11. Archivos creados

- `cidrix-web/.env.example`
- `cidrix-web/eslint.config.js`
- `cidrix-web/src/app/App.tsx`
- `cidrix-web/src/app/errors/AppErrorBoundary.test.tsx`
- `cidrix-web/src/app/errors/AppErrorBoundary.tsx`
- `cidrix-web/src/app/layouts/AppLayout.tsx`
- `cidrix-web/src/app/layouts/AuthLayout.tsx`
- `cidrix-web/src/app/router/AppRouter.tsx`
- `cidrix-web/src/app/router/AppRoutes.test.tsx`
- `cidrix-web/src/app/router/AppRoutes.tsx`
- `cidrix-web/src/features/auth/pages/LoginPlaceholderPage.tsx`
- `cidrix-web/src/features/dashboard/pages/DashboardPlaceholderPage.tsx`
- `cidrix-web/src/features/notifications/pages/NotificationsPlaceholderPage.tsx`
- `cidrix-web/src/features/settings/pages/SettingsPlaceholderPage.tsx`
- `cidrix-web/src/features/tickets/pages/TicketDetailPlaceholderPage.tsx`
- `cidrix-web/src/features/tickets/pages/TicketsPlaceholderPage.tsx`
- `cidrix-web/src/shared/components/Button.test.tsx`
- `cidrix-web/src/shared/components/Button.tsx`
- `cidrix-web/src/shared/components/Card.tsx`
- `cidrix-web/src/shared/components/Input.test.tsx`
- `cidrix-web/src/shared/components/Input.tsx`
- `cidrix-web/src/shared/components/PageContainer.tsx`
- `cidrix-web/src/shared/components/Spinner.test.tsx`
- `cidrix-web/src/shared/components/Spinner.tsx`
- `cidrix-web/src/shared/config/env.test.ts`
- `cidrix-web/src/shared/config/env.ts`
- `cidrix-web/src/shared/services/api/api-client.test.ts`
- `cidrix-web/src/shared/services/api/api-client.ts`
- `cidrix-web/src/shared/services/api/api-error.ts`
- `cidrix-web/src/shared/services/api/api.types.ts`
- `cidrix-web/src/styles/globals.css`
- `cidrix-web/src/styles/tokens.css`
- `cidrix-web/src/test/setup.ts`
- `docs/FE-01-implementation-review.md`

## 12. Archivos modificados

- `cidrix-web/.gitignore`
- `cidrix-web/README.md`
- `cidrix-web/index.html`
- `cidrix-web/package-lock.json`
- `cidrix-web/package.json`
- `cidrix-web/src/main.tsx`
- `cidrix-web/tsconfig.app.json`
- `cidrix-web/tsconfig.node.json`
- `cidrix-web/vite.config.ts`

## 13. Archivos eliminados

- `cidrix-web/.oxlintrc.json`
- `cidrix-web/public/favicon.svg`
- `cidrix-web/public/icons.svg`
- `cidrix-web/src/App.css`
- `cidrix-web/src/App.tsx`
- `cidrix-web/src/assets/hero.png`
- `cidrix-web/src/assets/react.svg`
- `cidrix-web/src/assets/vite.svg`
- `cidrix-web/src/index.css`

Todos correspondían a Oxlint reemplazado o al boilerplate de Vite. `public` puede quedar vacío y disponible para futuros assets aprobados.

## 14. Desviaciones respecto al plan

No se detectaron desviaciones relevantes respecto al plan aprobado.

Ajustes menores de implementación:

- No se creó `shared/types/common.types.ts`, porque no había un tipo común real que ubicar allí.
- `NotFoundPage` se mantuvo privado dentro de `AppRoutes.tsx`, ya que solo tiene un consumidor.
- No se creó un provider global vacío; FE-02 añadirá `AuthProvider` cuando exista lógica real.
- Se añadió un test específico para `AppErrorBoundary`, fortaleciendo el alcance aprobado.
- Se actualizaron únicamente `postcss` y `nanoid` transitivos dentro de sus rangos para resolver vulnerabilidades de la instalación, sin cambiar React o Vite.

## 15. Problemas encontrados

### TypeScript 6 en el scaffold

- Problema: el frontend declaraba TypeScript `~6.0.2` y resolvía 6.0.3.
- Causa: versión del scaffold inicial.
- Solución: se cambió a `~5.8.3` y el lockfile resuelve 5.8.3.
- Impacto: alineación completa con la decisión del Tech Lead; todas las validaciones pasan.

### Interfaces vacías detectadas por ESLint

- Problema: la primera corrida de ESLint rechazó las interfaces vacías de props de Card y PageContainer.
- Causa: una interfaz sin miembros era equivalente al tipo HTML base.
- Solución: se reemplazaron por type aliases.
- Impacto: ninguno funcional; lint final en verde.

### Validación de URL sin esquema

- Problema: el constructor `URL` interpreta `localhost:` como un esquema y clasificaba el valor como protocolo no permitido.
- Causa: semántica estándar del parser URL.
- Solución: se exige explícitamente el patrón `scheme://` antes de construir la URL.
- Impacto: error fail-fast más exacto y prueba correspondiente en verde.

### Vulnerabilidades transitivas iniciales

- Problema: npm reportó dos vulnerabilidades altas en versiones transitivas de PostCSS y nanoid.
- Causa: versiones previamente resueltas bajo el rango de Vite.
- Solución: actualización dirigida a PostCSS 8.5.28 y nanoid 3.3.18.
- Impacto: auditoría final con cero vulnerabilidades; sin upgrade de Vite.

### Acceso al registro npm

- Problema: el primer intento de instalación/auditoría quedó sin respuesta dentro del sandbox.
- Causa: acceso de red restringido.
- Solución: se repitieron los comandos con autorización de red explícita.
- Impacto: solo operativo; instalación y lockfile finales son válidos.

## 16. Riesgos pendientes

- El hosting futuro debe redirigir rutas SPA como `/tickets/:id` hacia `index.html` para que `BrowserRouter` funcione al recargar.
- El backend usa una cookie refresh `SameSite=strict` en producción; frontend y API deberán desplegarse bajo una topología same-site o requerirán una decisión backend/DevOps separada.
- El envelope paginado actual conserva doble nivel `data`; el cliente lo modela correctamente, pero sigue siendo un contrato fácil de malinterpretar en nuevas features.
- No existe OpenAPI ni generación compartida de tipos; las próximas features deberán contrastar sus tipos de transporte con los DTOs backend.
- Los valores visuales son provisionales y centralizados. Branding y referencia Stitch deberán aplicarse en las fases correspondientes.
- No existe CI frontend todavía; los scripts están preparados para incorporarlo.
- La configuración es fail-fast: cada entorno de ejecución debe definir `VITE_API_URL` antes de iniciar la aplicación.

Ninguno de estos riesgos bloquea la revisión de FE-01.

## 17. Fuera de alcance respetado

Se confirmó que no se implementaron:

- Login real ni reproducción del diseño de Stitch.
- AuthProvider, sesión, refresh, logout o persistencia JWT.
- Protección de rutas, roles o permisos frontend.
- Tickets, detalle funcional, comentarios o adjuntos.
- Dashboard funcional.
- Notifications funcionales.
- Settings funcionales.
- Users o Categories.
- Dark mode.
- Toasts, modales o Design System extendido.
- Redux, Zustand o TanStack Query.
- Axios.
- React Hook Form, Zod o Yup.
- Storybook, Playwright, Cypress o E2E.
- Cambios en `cidrix-api`.

Los cuatro documentos históricos BE-10 no rastreados y `docs/FE-01-analisis-y-plan.md`, existente antes de implementar, permanecieron intactos.

## 18. Estado para revisión

**FE-01 listo para revisión del Tech Lead y pruebas manuales.**

No se realizó commit ni push.
