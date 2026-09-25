# FE-01 — Análisis y plan: Base del frontend / arquitectura

## 1. Resumen ejecutivo

`cidrix-web` existe y es un scaffold de Vite prácticamente intacto desde la inicialización del monorepo. La base técnica es reciente y compatible con el stack aprobado: React 19, Vite, TypeScript y Node.js 24. Sin embargo, todavía no es una aplicación CIDRIX: conserva la demostración de Vite, no usa arquitectura Feature-First, no tiene routing, Tailwind, variables de entorno, cliente API ni infraestructura de tests.

El estado basal es saludable: el lint actual, el typecheck y el build terminan correctamente. La deuda es principalmente estructural, no una consecuencia de código funcional previo.

FE-01 puede implementarse sin modificar `cidrix-api`. La recomendación es construir una SPA pequeña y explícita, con routing declarativo, layouts base, un Design System mínimo, un cliente HTTP basado en `fetch`, validación manual de entorno y tests con Vitest + React Testing Library. No se recomienda incorporar todavía estado global, caché de datos remotos ni librerías de formularios.

**Conclusión:** FE-01 está listo para implementación. No se detectaron bloqueos técnicos.

## 2. Estado actual encontrado

### 2.1 Repositorio y alcance

- Repositorio: monorepo Git con `cidrix-api`, `cidrix-web` y `docs`.
- Rama inspeccionada: `main`, alineada con `origin/main`.
- Commit inspeccionado: `e88ac2bb2e461a425190bb7661512843c151cce5`.
- `cidrix-web` fue añadido en el commit inicial `3ce1fdd` y no tiene cambios posteriores.
- No existe otro frontend en la raíz. La aparente duplicación visual al listar carpetas correspondía al contenido de `cidrix-web`; el proyecto frontend válido es únicamente `cidrix-web`.
- Había cuatro documentos históricos BE-10 no rastreados antes de este análisis. Se mantuvieron intactos y no pertenecen a FE-01.

### 2.2 Runtime y versiones reales

Entorno utilizado para la inspección:

- Node.js: `v24.18.0`.
- npm: `11.16.0`.

Versiones declaradas e instaladas en `cidrix-web`:

| Paquete | Rango en `package.json` | Versión instalada |
|---|---:|---:|
| `react` | `^19.2.7` | `19.2.7` |
| `react-dom` | `^19.2.7` | `19.2.7` |
| `vite` | `^8.1.1` | `8.1.3` |
| `@vitejs/plugin-react` | `^6.0.3` | `6.0.3` |
| `typescript` | `~6.0.2` | `6.0.3` |
| `oxlint` | `^1.71.0` | `1.72.0` |
| `@types/node` | `^24.13.2` | `24.13.2` |
| `@types/react` | `^19.2.17` | `19.2.17` |
| `@types/react-dom` | `^19.2.3` | `19.2.3` |

React 19 está conforme con el stack aprobado. TypeScript 6 es más reciente que el TypeScript 5.8 del backend, pero ambos paquetes se compilan de forma independiente y no comparten fuentes; no se encontró incompatibilidad real.

### 2.3 Dependencias e infraestructura ausentes

Actualmente no están instalados:

- Tailwind CSS.
- Router.
- Vitest o cualquier test runner frontend.
- React Testing Library.
- ESLint.
- Cliente HTTP externo.
- Gestor de estado global.
- Librería de formularios o validación de esquemas.

No existe configuración E2E, Storybook, Docker para el frontend ni pipeline CI específico del frontend.

### 2.4 Estructura actual

```text
cidrix-web/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/
│   │   ├── hero.png
│   │   ├── react.svg
│   │   └── vite.svg
│   ├── App.css
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .gitignore
├── .oxlintrc.json
├── index.html
├── package-lock.json
├── package.json
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

### 2.5 Configuración actual

- `vite.config.ts` solo registra `@vitejs/plugin-react`.
- No hay aliases.
- `tsconfig.app.json` tiene controles útiles como `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax` y `erasableSyntaxOnly`.
- `strict` no está declarado; por tanto, no se cumple todavía el requisito de TypeScript estricto de forma explícita.
- `package.json` expone `dev`, `build`, `lint` y `preview`.
- No existen scripts `typecheck`, `test` ni `test:watch`.
- El lint actual usa Oxlint, no ESLint.
- No existen archivos `.env*` en `cidrix-web`.
- `.gitignore` ignora `*.local`, pero no protege expresamente `.env` y todas sus variantes.

### 2.6 Boilerplate y problemas concretos

- `App.tsx` es la pantalla “Get started” de Vite con un contador.
- Todos los SVG, `hero.png`, `icons.svg`, `App.css` y la mayor parte de `index.css` pertenecen al boilerplate.
- `favicon.svg` también corresponde a Vite, no a CIDRIX.
- `index.html` conserva `lang="en"` y el título `cidrix-web`.
- `index.css` activa automáticamente un tema oscuro por `prefers-color-scheme`, contrario a la decisión de comenzar solo con tema claro.
- Hay estilos globales acoplados a IDs de la demo y un ancho fijo de 1126 px; no son una base reutilizable para layouts.
- `README.md` sigue siendo el README generado por Vite.
- No hay separación entre aplicación, features y elementos compartidos.

### 2.7 Validaciones basales ejecutadas

- `npm run lint`: **PASS**, con Oxlint.
- `npm exec tsc -- -b --pretty false`: **PASS**.
- `npm run build`: **PASS**, Vite 8.1.3, 20 módulos transformados.
- El directorio `dist` generado únicamente para esta comprobación fue eliminado después de validar el build; no quedó como artefacto del análisis.

### 2.8 Contratos reales relevantes del backend

El backend usa prefijo global `/api/v1`; `/health` queda fuera. CORS admite credenciales y, por defecto, `http://localhost:5173` está permitido.

Autenticación real disponible:

| Método y ruta | Acceso | Contrato relevante |
|---|---|---|
| `POST /api/v1/auth/login` | Público | Body `email`, `password`; retorna access token y establece cookie de refresh `httpOnly`. |
| `POST /api/v1/auth/refresh` | Público con cookie | Lee `refresh_token`; retorna un nuevo access token. |
| `POST /api/v1/auth/logout` | Bearer requerido | Invalida el refresh y limpia la cookie. |
| `GET /api/v1/auth/me` | Bearer requerido | Retorna `id`, `email`, `fullName`, `role`, `organizationId`, `avatarUrl`. |

El access token se envía como `Authorization: Bearer <token>`. El refresh token no está disponible para JavaScript y la cookie está limitada al path `/api/v1/auth`.

También se verificaron los contratos existentes de Users, Categories, Tickets, timeline, Comments, Attachments, Dashboard, Notifications y Settings. No hay que inventar endpoints para las fases siguientes. Aspectos que afectan la arquitectura del frontend:

- Todos los endpoints funcionales están protegidos por el backend y derivan el tenant del JWT.
- Dashboard solo permite `ADMIN` y `TECHNICIAN`.
- Notifications permite los tres roles y sus resultados están limitados al usuario autenticado.
- Settings permite GET a los tres roles, pero PATCH solo a `ADMIN`.
- Las fechas se serializan como strings JSON; los tipos frontend no deben declararlas como objetos `Date`.
- Las escrituras de tickets usan `version` para optimistic locking.
- Attachments usa `multipart/form-data`; download retorna un stream/binario y delete usa 204.
- El filtro global de errores responde `{ error: { code, message, details? } }`.
- El interceptor global envuelve los éxitos en `{ data: T }`.
- Los services paginados ya retornan `{ data, meta }`; el resultado HTTP actual es, por tanto, `{ data: { data: [...], meta: {...} } }`. El frontend debe modelar este contrato real sin intentar “corregirlo” desde FE-01.

No existe OpenAPI/Swagger ni un paquete de tipos compartido entre backend y frontend.

## 3. Decisiones arquitectónicas propuestas

### 3.1 Feature-First con núcleo pequeño de aplicación

**Decisión:** separar composición global en `app`, capacidades funcionales en `features`, elementos reutilizables en `shared` y estilos globales en `styles`.

**Motivo:** las fases FE-02 a FE-07 corresponden naturalmente a features. Cada feature podrá contener sus páginas, componentes, hooks, services y tipos sin convertir `shared` en un contenedor de lógica de negocio.

**Alternativas evaluadas:** estructura por tipo global (`components`, `services`, `pages`) y arquitectura por capas rígidas. La primera escala mal porque dispersa cada feature; la segunda agrega ceremonial innecesario para este MVP.

**Recomendación:** Feature-First, creando en FE-01 solo los archivos que tengan uso real. No crear directorios vacíos ni repositories frontend.

### 3.2 Routing declarativo con React Router

**Decisión:** añadir `react-router` y usar `BrowserRouter`, rutas anidadas y `Outlet`.

**Motivo:** CIDRIX necesita navegación SPA, segmentos dinámicos, layouts anidados, redirects y una ruta 404. El modo declarativo cubre FE-01 sin acoplar la carga de datos a loaders del router.

**Alternativas evaluadas:** routing manual con History API, Data Router y modo Framework de React Router. El routing manual recrearía una solución madura; Data/Framework añaden capacidades de loader/action/SSR que todavía no se necesitan.

**Recomendación:** modo declarativo. El data fetching continuará en los services/hooks de cada feature.

### 3.3 Rutas placeholder, no features simuladas

**Decisión:** registrar `/login`, `/dashboard`, `/tickets`, `/tickets/:id`, `/notifications` y `/settings` con páginas placeholder mínimas.

**Motivo:** permite verificar routing y layouts sin implementar comportamiento de fases futuras.

**Alternativa evaluada:** registrar solo `/login`. Esto no probaría la composición del `AppLayout` ni las rutas dinámicas que FE-01 debe preparar.

**Recomendación:** placeholders explícitos, sin llamadas API, formularios funcionales, permisos ni datos falsos. `/` redirige temporalmente a `/login`. FE-02 reemplazará la semántica de acceso.

### 3.4 Layouts sin autenticación prematura

**Decisión:** crear `AuthLayout` y `AppLayout`; el segundo tendrá regiones semánticas mínimas para sidebar/header/main, sin menú de usuario ni notificaciones funcionales.

**Motivo:** establece el contrato de composición y responsive que usarán las próximas fases.

**Alternativas evaluadas:** un único layout o shell completo desde FE-01. Un solo layout no refleja las dos experiencias; completar el shell anticiparía UX y sesión aún no aprobadas.

**Recomendación:** estructura accesible y mínima con `Outlet`. No crear `ProtectedRoute` ni `RoleRoute` hasta FE-02.

### 3.5 Tailwind CSS 4 con plugin oficial de Vite

**Decisión:** añadir `tailwindcss` y `@tailwindcss/vite`, usando configuración CSS-first.

**Motivo:** es la integración oficial directa para Vite y evita PostCSS/configuración adicional. Los tokens pueden expresarse como variables semánticas y `@theme`.

**Alternativas evaluadas:** PostCSS, CSS Modules sin Tailwind o CDN. El plugin de Vite es el camino más simple para el stack actual; el CDN no es adecuado para producción.

**Recomendación:** plugin oficial, sin `tailwind.config.js` mientras no exista una necesidad que lo justifique.

### 3.6 Tokens semánticos y tema claro

**Decisión:** definir colores, tipografía, sombras, radios y espaciado mediante tokens semánticos, no valores repetidos por componente.

**Motivo:** permite ajustar la identidad corporativa y añadir dark mode sin reescribir componentes.

**Alternativas evaluadas:** colores Tailwind directos en cada componente o un tema oscuro completo desde el inicio. El primero acopla la UI a valores concretos; el segundo está fuera de alcance.

**Recomendación:** tema claro explícito. Preparar variables sobre `:root`; en una fase posterior un selector como `[data-theme="dark"]` podrá reemplazar valores. No activar todavía `prefers-color-scheme: dark`.

### 3.7 Cliente HTTP con `fetch`

**Decisión:** centralizar llamadas JSON en un wrapper tipado sobre `fetch`.

**Motivo:** `fetch`, `AbortSignal`, `FormData` y `Blob` ya existen en el navegador y Node 24. Para el MVP no se necesita Axios.

**Alternativas evaluadas:** Axios y llamadas `fetch` dispersas. Axios agregaría dependencia sin resolver una necesidad presente; llamadas dispersas duplicarían URL, headers, credenciales y errores.

**Recomendación:** una función pequeña que:

- componga la URL desde configuración validada;
- envíe `credentials: "include"`;
- admita access token opcional sin decidir su persistencia;
- serialice JSON solo cuando corresponda y no fuerce headers sobre `FormData`;
- acepte `AbortSignal`;
- reconozca 204;
- convierta el envelope de error backend en un `ApiError` tipado;
- desenvuelva exactamente un nivel de `{ data: T }`.

La reautenticación automática y la deduplicación de refresh se implementarán en FE-02. Descargas Blob y uploads multipart se extenderán en FE-04 sobre la misma base.

### 3.8 Modelado del envelope real

**Decisión:** usar `ApiEnvelope<T>`, `ApiErrorEnvelope`, `PaginationMeta` y `Paginated<T>`. `apiRequest<T>` desenvuelve el envelope global y retorna `T`.

**Motivo:** para un endpoint paginado, `T` será `Paginated<TItem>`, reflejando correctamente `{ data: { data, meta } }` sin heurísticas ambiguas.

**Alternativas evaluadas:** aplanar cualquier propiedad `data` recursivamente o tipar respuestas como `unknown`/`any`. El aplanado puede corromper payloads legítimos y `any` elimina seguridad.

**Recomendación:** un solo unwrap documentado y tipos específicos por feature.

### 3.9 Variables de entorno con validación sin Zod

**Decisión:** crear `.env.example` con `VITE_API_URL=http://localhost:3000/api/v1` y un módulo `shared/config/env.ts` que valide que exista y sea una URL HTTP(S).

**Motivo:** evita URL hardcodeada y errores tardíos. Una validación simple no justifica instalar una librería de schemas.

**Alternativas evaluadas:** fallback silencioso a localhost o Zod. El fallback puede desplegar una URL incorrecta; Zod es excesivo para una sola variable.

**Recomendación:** fail-fast al arrancar. Ignorar `.env` y `.env.*`, preservando únicamente `.env.example`. Ninguna variable `VITE_*` puede contener secretos porque Vite la incorpora al bundle del cliente.

### 3.10 TypeScript estricto y un único alias

**Decisión:** activar `strict: true` y definir solo `@/* -> ./src/*`.

**Motivo:** un alias raíz elimina rutas relativas profundas sin multiplicar convenciones. `@/app`, `@/features` y `@/shared` se derivan naturalmente del mismo alias.

**Alternativas evaluadas:** varios aliases independientes, imports relativos exclusivamente y plugin adicional de paths. Varios aliases duplican configuración; imports relativos profundos son frágiles; Vite 8 puede resolver paths de TypeScript sin un plugin externo.

**Recomendación:** declarar `paths` en `tsconfig.app.json` y habilitar `resolve.tsconfigPaths` en Vite. Evitar `any`; usar `unknown` y narrowing en límites externos.

### 3.11 Estado

**Decisión:** no instalar Redux, Zustand ni TanStack Query en FE-01.

**Motivo:** no hay estado funcional todavía. La herramienta debe seguir al problema, no precederlo.

**Distribución recomendada:**

- UI efímera: `useState`/`useReducer` local.
- Sesión: Context reducido en FE-02, access token en memoria y recuperación mediante refresh cookie.
- Datos remotos: services y hooks por feature; reevaluar TanStack Query en FE-03, cuando existan caché, invalidaciones y mutaciones de Tickets.
- Formularios: estado controlado/nativo para casos simples; reevaluar React Hook Form cuando haya formularios complejos.

### 3.12 Formularios

**Decisión:** no añadir React Hook Form, Zod ni Yup en FE-01.

**Motivo:** no se implementa un formulario funcional en esta fase. El login de FE-02 es pequeño y puede comenzar con TypeScript y validación nativa/controlada.

**Recomendación:** revisar React Hook Form + Zod al llegar a creación/edición de tickets si la complejidad, validación cruzada o reutilización de esquemas lo justifica. La validación frontend mejora UX, pero el backend sigue siendo la autoridad.

### 3.13 Testing con Vitest y React Testing Library

**Decisión:** añadir Vitest, jsdom, React Testing Library y jest-dom.

**Motivo:** Vitest comparte la transformación/configuración de Vite y React Testing Library fomenta pruebas de comportamiento accesible.

**Alternativas evaluadas:** Jest, E2E desde FE-01 o no instalar tests hasta FE-02. Jest duplicaría pipeline; E2E no tiene flujo funcional que validar; posponer tests dejaría la arquitectura sin red de seguridad.

**Recomendación:** smoke tests del router/layout, componentes base y tests unitarios del cliente HTTP/configuración. Sin cobertura obligatoria ni E2E en FE-01.

### 3.14 ESLint en lugar de Oxlint

**Decisión:** reemplazar Oxlint por ESLint con flat config; no mantener ambos.

**Motivo:** el criterio de aceptación del Tech Lead pide explícitamente ESLint. Mantener dos linters generaría reglas duplicadas y resultados divergentes.

**Alternativas evaluadas:** conservar Oxlint o ejecutar ambos. Oxlint ya pasa y es más rápido, pero no satisface literalmente el criterio indicado; dos herramientas agregan mantenimiento sin valor para este tamaño de proyecto.

**Recomendación:** ESLint con reglas base de JavaScript, TypeScript, React Hooks y React Refresh. No activar inicialmente reglas type-aware costosas; `tsc` será la autoridad de tipos.

### 3.15 Manejo de errores

**Decisión:** separar errores de transporte/API de errores de render.

**Motivo:** requieren recuperación y mensajes distintos.

**Recomendación:**

- `ApiError` conserva `status`, `code`, `message` y `details`.
- Errores de red reciben código local estable y mensaje genérico.
- 401/403 quedan disponibles para que FE-02 decida refresh, cierre de sesión o pantalla de acceso denegado.
- Un `AppErrorBoundary` captura errores inesperados de React y muestra una recuperación genérica.
- Las features gestionarán estados loading, empty y error cerca del contexto visual.
- No mostrar stacks ni detalles internos al usuario final.

## 4. Arquitectura final propuesta

Árbol previsto al terminar FE-01. Solo se crean carpetas con archivos reales:

```text
cidrix-web/
├── public/
├── src/
│   ├── app/
│   │   ├── errors/
│   │   │   └── AppErrorBoundary.tsx
│   │   ├── layouts/
│   │   │   ├── AppLayout.tsx
│   │   │   └── AuthLayout.tsx
│   │   ├── router/
│   │   │   ├── AppRouter.tsx
│   │   │   └── AppRoutes.tsx
│   │   └── App.tsx
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
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── PageContainer.tsx
│   │   │   └── Spinner.tsx
│   │   ├── config/
│   │   │   └── env.ts
│   │   ├── services/api/
│   │   │   ├── api-client.ts
│   │   │   ├── api-error.ts
│   │   │   └── api.types.ts
│   │   └── types/
│   │       └── common.types.ts
│   ├── styles/
│   │   ├── globals.css
│   │   └── tokens.css
│   ├── test/
│   │   └── setup.ts
│   └── main.tsx
├── .env.example
├── .gitignore
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

Los tests se colocarán junto al código probado con sufijo `.test.ts`/`.test.tsx`. No se crean todavía providers globales vacíos; FE-02 añadirá `AuthProvider` cuando exista sesión real.

Reglas de dependencia:

- `app` puede importar `features` y `shared`.
- `features` puede importar `shared`.
- `shared` no importa desde `features` ni desde `app`.
- Una feature no importa internals de otra feature; si surge un contrato compartido real, se eleva conscientemente a `shared`.
- Los tipos de cada dominio futuro viven en su feature, no todos en `shared/types`.

## 5. Dependencias

### Mantener

- `react` y `react-dom`: runtime principal.
- `vite` y `@vitejs/plugin-react`: toolchain actual.
- `typescript` y tipos de React/Node: compilación y desarrollo.
- `package-lock.json`: builds reproducibles.

### Agregar

Dependencia de runtime:

- `react-router`: routing SPA, rutas anidadas, layouts y parámetros dinámicos.

Dependencias de desarrollo:

- `tailwindcss`: utilidades y tokens CSS.
- `@tailwindcss/vite`: integración oficial con Vite.
- `vitest`: test runner alineado con Vite.
- `jsdom`: entorno DOM para tests unitarios/componentes.
- `@testing-library/react`: render y queries centradas en comportamiento.
- `@testing-library/dom`: peer dependency explícita de React Testing Library.
- `@testing-library/jest-dom`: matchers legibles para accesibilidad/DOM.
- `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` y `globals`: reemplazo completo de Oxlint y cumplimiento del lint solicitado.

Las versiones se resolverán a releases estables compatibles con Node 24, React 19 y Vite 8 al momento de implementar, y quedarán registradas en el lockfile. No se actualizarán React, Vite o TypeScript incidentalmente.

### Retirar

- `oxlint`: se reemplaza por ESLint para evitar dos autoridades de lint.

### No agregar todavía

- Axios: `fetch` cubre el cliente base.
- Redux o Zustand: no existe estado global que lo requiera.
- TanStack Query: reevaluar en FE-03 con datos remotos reales.
- React Hook Form, Zod o Yup: reevaluar con formularios reales.
- Librerías de UI completas: impedirían consolidar primero la identidad de CIDRIX.
- `clsx`, `tailwind-merge` o variantes: los componentes iniciales no justifican aún esa abstracción.
- Librerías de iconos: no hay inventario visual aprobado.
- Storybook: coste prematuro para cinco componentes base.
- Playwright/Cypress: E2E queda para una fase con flujos funcionales.
- Cliente OpenAPI/codegen: el backend no publica una especificación OpenAPI.

## 6. Design System base

### 6.1 Estrategia visual

- Tema claro, limpio, profesional y con espacio visual generoso.
- Tipografía del sistema para evitar una dependencia y una descarga externa antes de aprobar identidad.
- Anchos de contenido y gutters responsive centralizados en `PageContainer`.
- Contraste y estados focus visibles como requisito, no como pulido posterior.
- Movimiento reducido cuando el usuario configura `prefers-reduced-motion`.

### 6.2 Tokens iniciales

- Colores semánticos: `background`, `surface`, `surface-muted`, `foreground`, `foreground-muted`, `border`, `primary`, `primary-hover`, `focus`, `danger` y `success`.
- Tipografía: familia sans, tamaños base y alturas de línea.
- Radios: control, card y pill cuando corresponda.
- Sombras: una elevación de card y una de overlay reservada.
- Spacing: usar la escala Tailwind; añadir tokens propios solo si aparece una medida de producto repetida.

Los valores de marca deben quedar aislados en `tokens.css`. FE-01 puede usar una paleta provisional accesible, pero la aprobación cromática corporativa sigue siendo una decisión de diseño, no de arquitectura.

### 6.3 Componentes iniciales

- `Button`: variantes primaria/secundaria/danger, tamaños, disabled y loading accesible.
- `Input`: label asociado, ayuda/error mediante IDs y `aria-describedby`.
- `Card`: superficie consistente sin lógica.
- `Spinner`: feedback de carga con texto accesible.
- `PageContainer`: ancho máximo y padding responsive.

No crear todavía `Textarea`, `Select`, `Badge` ni `EmptyState`: tendrán requisitos concretos en Tickets y otras features. Se añaden cuando su primer consumidor defina variantes reales.

### 6.4 Preparación para dark mode

Los componentes consumirán nombres semánticos, no colores físicos. Una futura capa `[data-theme="dark"]` podrá redefinir los valores sin cambiar JSX. FE-01 no implementará toggle, persistencia ni paleta oscura.

## 7. Routing y layouts

Estructura propuesta:

```text
BrowserRouter
├── AuthLayout
│   └── /login
├── AppLayout
│   ├── /dashboard
│   ├── /tickets
│   ├── /tickets/:id
│   ├── /notifications
│   └── /settings
└── * (Not Found)
```

- `/` redirige a `/login` durante FE-01.
- `AuthLayout` proporciona una superficie centrada y responsive.
- `AppLayout` define regiones `aside`, `header` y `main`, y renderiza hijos con `Outlet`.
- La navegación usa `Link`/`NavLink`, nunca anchors internos con recarga completa.
- Los placeholders dejan claro que la funcionalidad llegará en fases posteriores.
- FE-02 incorporará inicialización de sesión, rutas protegidas, redirect de usuarios autenticados y UX por rol.
- Ocultar rutas o enlaces por rol será UX; el backend continúa siendo la autoridad de autorización.
- El hosting de producción deberá resolver rutas desconocidas de la SPA hacia `index.html` para que `BrowserRouter` funcione al recargar una URL profunda.

## 8. Cliente API

### 8.1 Contrato propuesto

```ts
interface ApiEnvelope<T> {
  data: T
}

interface ApiErrorEnvelope {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}
```

Las fechas del backend se representan como `string` ISO en los tipos de transporte. La transformación a objetos o formatos visibles ocurre en utilidades de presentación, no en el cliente genérico.

### 8.2 Flujo de request

1. Resolver path contra `VITE_API_URL` validada.
2. Agregar `Accept: application/json`.
3. Agregar `Content-Type: application/json` solo para body JSON.
4. Incorporar Bearer cuando el llamador entregue access token.
5. Enviar siempre `credentials: "include"` para habilitar refresh cookie.
6. Propagar `AbortSignal`.
7. Tratar 204 sin intentar parsear JSON.
8. Parsear y validar defensivamente el shape mínimo del envelope.
9. En error HTTP, lanzar `ApiError` con datos del backend y fallback seguro.
10. En error de red, distinguir abort de indisponibilidad.

### 8.3 Límites de FE-01

- No guardar access token en `localStorage` ni `sessionStorage`.
- No implementar refresh automático.
- No implementar cola de requests mientras refresca.
- No redirigir desde el cliente HTTP; FE-02 decidirá navegación desde la capa de sesión.
- No implementar servicios de dominio completos.
- No intentar aplanar el envelope paginado del backend más allá de un unwrap global.

## 9. Estado y data fetching

FE-01 no requiere store global ni caché remota.

Estrategia evolutiva:

| Tipo de estado | Ubicación recomendada | Fase |
|---|---|---|
| Toggle, modal, input y estado visual | Estado local del componente | Desde FE-01 |
| Usuario, rol y access token en memoria | Context de Auth con API pequeña | FE-02 |
| Tickets, dashboard y notificaciones | Hooks/services por feature | FE-03 en adelante |
| Caché, revalidación e invalidaciones | Evaluar TanStack Query con casos reales | FE-03 |
| Formularios simples | Controlled/native | FE-02 |
| Formularios complejos | Evaluar React Hook Form + schema | FE-03 |

El cliente API no debe mantener estado de UI. Los componentes visuales tampoco deben conocer cookies, refresh ni construcción de URLs.

## 10. Testing y calidad

### 10.1 Scripts objetivo

```json
{
  "lint": "eslint .",
  "typecheck": "tsc -b --pretty false",
  "test": "vitest run",
  "test:watch": "vitest",
  "build": "tsc -b && vite build"
}
```

### 10.2 Configuración

- Vitest compartirá `vite.config.ts`.
- Entorno `jsdom` para componentes.
- `src/test/setup.ts` cargará jest-dom y cleanup cuando corresponda.
- Los tests importarán APIs de Vitest explícitamente; no se dependerá de globals implícitos.
- ESLint usará flat config para TS/TSX, React Hooks y Fast Refresh.
- TypeScript mantendrá project references y activará `strict`.

### 10.3 Pruebas mínimas de FE-01

- Render de `AuthLayout` y `AppLayout` mediante rutas en memoria.
- Resolución de `/tickets/:id` y fallback 404.
- Accesibilidad y estados de `Button` e `Input`.
- Spinner con nombre/estado accesible.
- Cliente API: URL, credenciales, JSON, Bearer opcional, envelope exitoso, error backend, 204, error de red y cancelación.
- Configuración: URL válida, variable ausente y protocolo inválido.

No se fija un porcentaje de cobertura en FE-01. El criterio es cubrir los límites críticos y evitar tests de implementación superficial.

### 10.4 Comprobación final esperada

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
git status --short
```

## 11. Riesgos detectados

| Severidad | Riesgo | Impacto | Mitigación / decisión |
|---|---|---|---|
| Crítico | Ninguno identificado para FE-01. | — | — |
| Alto | En producción el backend establece refresh cookie con `SameSite=strict`. Si frontend y API se publican en sites distintos, el navegador no enviará la cookie. | El refresh de sesión fallaría aunque CORS permita credenciales. | Tech Lead/DevOps debe garantizar despliegue same-site o abrir una tarea backend de cookies antes de producción. No se corrige en frontend. |
| Medio | Las respuestas paginadas tienen doble `data` por el interceptor global. | Confusión y riesgo de tipos incorrectos. | Modelar el contrato real con `ApiEnvelope<Paginated<T>>`; no aplicar heurísticas. |
| Medio | No existe OpenAPI ni paquete de contratos compartidos. | Drift manual entre DTOs backend y tipos frontend. | Tipos por feature, tests de cliente y checklist de contrato. Evaluar OpenAPI como tarea transversal futura. |
| Medio | `BrowserRouter` requiere fallback a `index.html` en hosting. | Refresh directo de `/tickets/:id` podría devolver 404 del servidor web. | Documentar y validar la regla de SPA al crear el despliegue. |
| Medio | El logout exige un access token vigente; si expiró, FE-02 tendrá que refrescar antes de cerrar sesión. | La cookie `httpOnly` no puede limpiarse desde JavaScript si el backend rechaza logout. | Diseñar explícitamente la máquina de sesión en FE-02 y, si es necesario, abrir seguimiento backend. |
| Medio | El refresh backend verifica usuario activo, pero no vuelve a verificar que la organización esté activa; el guard confía en claims hasta expiración. | La desactivación de tenant no necesariamente revoca de inmediato toda sesión. | Riesgo backend documentado; no hay mitigación de seguridad válida en frontend. Evaluar seguimiento separado. |
| Bajo | Paleta e identidad corporativa definitivas no están disponibles. | Tokens provisionales podrían cambiar. | Mantener valores concentrados y semánticos; pedir aprobación visual antes del pulido. |
| Bajo | TypeScript frontend 6 y backend 5.8 difieren. | No hay impacto actual porque no comparten build, pero puede importar si se crea un paquete común. | Alinear solo cuando exista un workspace de contratos compartidos. |
| Bajo | No existe CI frontend. | Las verificaciones dependen del desarrollador. | Dejar scripts deterministas; proponer CI en una tarea transversal o FE-08. |

## 12. Archivos a crear

- `cidrix-web/.env.example`
- `cidrix-web/eslint.config.js`
- `cidrix-web/src/app/App.tsx`
- `cidrix-web/src/app/errors/AppErrorBoundary.tsx`
- `cidrix-web/src/app/layouts/AppLayout.tsx`
- `cidrix-web/src/app/layouts/AuthLayout.tsx`
- `cidrix-web/src/app/router/AppRouter.tsx`
- `cidrix-web/src/app/router/AppRoutes.tsx`
- `cidrix-web/src/app/router/AppRoutes.test.tsx`
- `cidrix-web/src/features/auth/pages/LoginPlaceholderPage.tsx`
- `cidrix-web/src/features/dashboard/pages/DashboardPlaceholderPage.tsx`
- `cidrix-web/src/features/notifications/pages/NotificationsPlaceholderPage.tsx`
- `cidrix-web/src/features/settings/pages/SettingsPlaceholderPage.tsx`
- `cidrix-web/src/features/tickets/pages/TicketsPlaceholderPage.tsx`
- `cidrix-web/src/features/tickets/pages/TicketDetailPlaceholderPage.tsx`
- `cidrix-web/src/shared/components/Button.tsx`
- `cidrix-web/src/shared/components/Button.test.tsx`
- `cidrix-web/src/shared/components/Card.tsx`
- `cidrix-web/src/shared/components/Input.tsx`
- `cidrix-web/src/shared/components/Input.test.tsx`
- `cidrix-web/src/shared/components/PageContainer.tsx`
- `cidrix-web/src/shared/components/Spinner.tsx`
- `cidrix-web/src/shared/config/env.ts`
- `cidrix-web/src/shared/config/env.test.ts`
- `cidrix-web/src/shared/services/api/api-client.ts`
- `cidrix-web/src/shared/services/api/api-client.test.ts`
- `cidrix-web/src/shared/services/api/api-error.ts`
- `cidrix-web/src/shared/services/api/api.types.ts`
- `cidrix-web/src/shared/types/common.types.ts`
- `cidrix-web/src/styles/globals.css`
- `cidrix-web/src/styles/tokens.css`
- `cidrix-web/src/test/setup.ts`

La lista podrá compactarse durante implementación si dos archivos solo agregan indirection sin contenido real; cualquier reducción debe respetar las fronteras descritas.

## 13. Archivos a modificar

- `cidrix-web/.gitignore`: proteger archivos de entorno reales y permitir `.env.example`.
- `cidrix-web/index.html`: idioma español, título CIDRIX y eliminación del favicon de Vite.
- `cidrix-web/package.json`: scripts y dependencias aprobadas.
- `cidrix-web/package-lock.json`: resolución reproducible de dependencias.
- `cidrix-web/README.md`: instrucciones reales de instalación, entorno, scripts y estructura.
- `cidrix-web/src/main.tsx`: montar la aplicación y estilos globales desde la arquitectura nueva.
- `cidrix-web/tsconfig.app.json`: strict y alias.
- `cidrix-web/tsconfig.node.json`: strict para configuración Node.
- `cidrix-web/vite.config.ts`: Tailwind, paths de TypeScript y configuración de Vitest.

No se prevén cambios en `cidrix-api` ni en sus archivos de configuración.

## 14. Archivos a eliminar

Boilerplate sin uso:

- `cidrix-web/.oxlintrc.json`
- `cidrix-web/src/App.tsx`
- `cidrix-web/src/App.css`
- `cidrix-web/src/index.css`
- `cidrix-web/src/assets/hero.png`
- `cidrix-web/src/assets/react.svg`
- `cidrix-web/src/assets/vite.svg`
- `cidrix-web/public/icons.svg`
- `cidrix-web/public/favicon.svg`

No se eliminará `public/`; queda disponible para assets estáticos futuros. No se inventará un logotipo o favicon corporativo sin material aprobado.

## 15. Plan de implementación

1. Crear una rama de trabajo FE-01 desde el `main` aprobado y registrar commit base/estado inicial.
2. Instalar únicamente las dependencias aprobadas y retirar Oxlint; revisar el lockfile para evitar upgrades incidentales.
3. Activar TypeScript estricto, configurar el alias único y preparar ESLint flat config.
4. Integrar Tailwind con el plugin oficial de Vite y reemplazar el CSS de demo por tokens y estilos globales light-first.
5. Eliminar assets y componentes del boilerplate; actualizar `index.html` y README.
6. Crear `Button`, `Input`, `Card`, `Spinner` y `PageContainer` con APIs pequeñas, accesibles y tipadas.
7. Crear layouts y routing declarativo con rutas placeholder y 404; no implementar protección ni permisos.
8. Añadir `.env.example`, endurecer `.gitignore` y crear validación fail-fast de `VITE_API_URL`.
9. Implementar el cliente `fetch` base, envelopes y `ApiError`; sin refresh automático ni services de features.
10. Configurar Vitest/jsdom/Testing Library y añadir las pruebas mínimas indicadas.
11. Ejecutar lint, typecheck, tests, build y `git diff --check`.
12. Revisar `git diff` completo, confirmar que el backend no cambió y generar el informe de implementación para el Tech Lead.
13. Detenerse sin commit ni push si esas siguen siendo las instrucciones de implementación.

## 16. Criterios de aceptación

- [ ] Arquitectura Feature-First aplicada con reglas de dependencia claras.
- [ ] Boilerplate y assets de Vite eliminados.
- [ ] React 19 y Vite conservados sin actualización incidental.
- [ ] TypeScript `strict` habilitado y sin `any` innecesario.
- [ ] Alias `@/*` funcionando en TypeScript, Vite, tests y lint.
- [ ] React Router instalado en modo declarativo.
- [ ] `/login`, `/dashboard`, `/tickets`, `/tickets/:id`, `/notifications`, `/settings` y 404 resuelven correctamente.
- [ ] `AuthLayout` y `AppLayout` usan `Outlet` y semántica accesible.
- [ ] No existe protección de rutas ni autorización simulada antes de FE-02.
- [ ] Tailwind está integrado mediante el plugin oficial de Vite.
- [ ] Tokens visuales semánticos centralizados y tema claro explícito.
- [ ] No existe dark mode funcional.
- [ ] Button, Input, Card, Spinner y PageContainer son reutilizables y tipados.
- [ ] `VITE_API_URL` está documentada, validada y no hardcodeada en services.
- [ ] `.env` reales están ignorados y no hay secretos en el repositorio.
- [ ] Cliente API basado en `fetch`, con credenciales, errores tipados, cancelación y soporte 204.
- [ ] El cliente desenvuelve un solo envelope y modela paginación anidada correctamente.
- [ ] No existe refresh automático, login funcional ni almacenamiento persistente del token.
- [ ] ESLint flat config funciona y Oxlint fue retirado.
- [ ] `npm run lint` pasa.
- [ ] `npm run typecheck` pasa.
- [ ] `npm test` pasa y no usa `--passWithNoTests`.
- [ ] `npm run build` pasa.
- [ ] `git diff --check` pasa.
- [ ] No se añadieron Redux, Zustand, TanStack Query, Axios, React Hook Form, Zod, Yup ni E2E.
- [ ] No se modificó `cidrix-api`.
- [ ] La base queda preparada para FE-02 Auth y sesión.

## 17. Fuera de alcance

- Login funcional y validación real de credenciales.
- Inicialización/restauración de sesión.
- Refresh automático, exclusión mutua de refresh y replay de requests.
- Logout funcional.
- Persistencia del access token.
- Rutas protegidas y redirects por sesión.
- Navegación o componentes condicionados por rol.
- CRUD de tickets, filtros, optimistic locking y timeline.
- Comentarios y visibilidad PUBLIC/INTERNAL.
- Upload, listado, descarga o borrado de adjuntos.
- Dashboard y gráficas.
- Notificaciones y unread count.
- Edición de Settings.
- Gestión de Users o Categories.
- Dark mode funcional.
- Design System completo, iconografía o branding definitivo.
- Toasts/modales globales completos.
- TanStack Query u otro store/caché global.
- Librerías de formularios/schema.
- E2E, Storybook, deployment y CI.
- Cambios al backend o al envelope de respuestas.

## 18. Recomendación final

**FE-01 está listo para implementación.**

El scaffold actual es simple, compila y no contiene funcionalidad que deba migrarse. La API existente ofrece todos los fundamentos que la arquitectura necesita: prefijo estable, CORS con credenciales, auth por Bearer + refresh cookie, errores estructurados y módulos protegidos por rol/tenant.

Las decisiones que conviene ratificar al aprobar el plan son:

1. Reemplazar Oxlint por ESLint para satisfacer literalmente el criterio de calidad, evitando mantener ambos.
2. Usar `react-router` en modo declarativo.
3. Añadir Tailwind 4 mediante `@tailwindcss/vite`.
4. Añadir Vitest + React Testing Library + jsdom desde FE-01.
5. Mantener `fetch` y posponer Axios, TanStack Query y librerías de formularios.
6. Aceptar placeholders estructurales para las rutas futuras, sin lógica funcional.
7. Tratar la topología same-site de frontend/API como requisito de despliegue antes de producción.

Ninguno de estos puntos exige modificar el backend para comenzar FE-01.

## 19. Referencias técnicas verificadas

- [Tailwind CSS — instalación oficial con Vite](https://tailwindcss.com/docs/installation/using-vite)
- [React Router — instalación en modo declarativo](https://reactrouter.com/start/declarative/installation)
- [React Router — rutas anidadas y layouts](https://reactrouter.com/start/declarative/routing)
- [Vite — variables de entorno y exposición de `VITE_*`](https://vite.dev/guide/env-and-mode)
- [Vite — resolución de aliases y tsconfig paths](https://vite.dev/config/shared-options.html)
- [Vitest — guía de inicio y configuración compartida con Vite](https://vitest.dev/guide/)
- [Vitest — entorno jsdom](https://vitest.dev/config/environment)
- [React Testing Library — introducción](https://testing-library.com/docs/react-testing-library/intro/)
