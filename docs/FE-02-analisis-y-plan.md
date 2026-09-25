# CIDRIX — FE-02: Auth y sesión — Análisis y plan

Fecha de análisis: 2026-09-06  
Alcance de esta ejecución: inspección y diseño; no se implementó código de FE-02.

## 1. Resumen ejecutivo

`cidrix-web` ya contiene una base funcional y coherente para construir FE-02: React Router, layouts separados, cliente HTTP con `credentials: "include"`, errores tipados, variables de entorno validadas, componentes básicos y pruebas automatizadas. La estrategia aprobada sigue siendo correcta: refresh token exclusivamente en cookie `httpOnly`, access token solo en memoria y `/auth/me` como autoridad sobre el usuario.

El backend confirma los cuatro contratos necesarios (`login`, `refresh`, `me` y `logout`) y usa un envelope global `{ data: T }`. La solución recomendada es mantener el cliente HTTP de FE-01 y agregar una capa de sesión dentro de `features/auth`: un administrador de sesión TypeScript independiente, un `AuthProvider` pequeño, una fachada para requests autenticados y guards de routing.

Hay dos bloqueos previos a implementar:

1. La referencia visual aprobada de Google Stitch no estuvo adjunta ni disponible en el contexto de esta ejecución. No es posible planificar con fidelidad su composición, recursos, espaciado ni responsive sin inventar detalles.
2. FE-01 está presente como cambios locales no consolidados sobre `main`: la rama actual es `codex/fe-01-frontend-base`, pero `HEAD`, `main` y `origin/main` apuntan al mismo commit previo a esos cambios. Antes de apilar FE-02 debe consolidarse FE-01 o autorizarse expresamente continuar sobre este working tree.

La línea base inspeccionada pasa `lint`, `typecheck`, 29 tests y build.

## 2. Estado actual de FE-01

### Estructura real

La aplicación usa una arquitectura Feature-First inicial:

```text
cidrix-web/src/
├── app/
│   ├── errors/
│   ├── layouts/
│   └── router/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── notifications/
│   ├── settings/
│   └── tickets/
├── shared/
│   ├── components/
│   ├── config/
│   └── services/api/
├── styles/
└── test/
```

### Routing y layouts

- `/` redirige a `/login`.
- `/login` usa `AuthLayout` y una página placeholder.
- `/dashboard`, `/tickets`, `/tickets/:id`, `/notifications` y `/settings` usan `AppLayout`.
- Las rutas privadas todavía no tienen protección.
- `AppLayout` presenta navegación estática y no conoce al usuario ni su rol.
- `AuthLayout` es un contenedor neutral, centrado y responsive; puede recibir el diseño de Stitch, sujeto a revisar primero la referencia real.
- `AppErrorBoundary` envuelve el router.

### Cliente API y errores

`shared/services/api/api-client.ts` ya ofrece:

- URL base desde `VITE_API_URL`;
- rutas relativas y rechazo de rutas absolutas;
- `credentials: "include"` en todas las solicitudes;
- Bearer opcional mediante `accessToken`;
- JSON y `BodyInit`;
- `AbortSignal`;
- soporte de `204`;
- unwrap de exactamente un envelope `{ data: T }`;
- errores HTTP, de red, aborto y protocolo mediante `ApiError`.

No contiene refresh automático, almacenamiento de tokens ni retry. Esa separación es adecuada y no se recomienda reescribirla.

### Variables, estilos y componentes

- La configuración valida `VITE_API_URL` y falla temprano si es inválida.
- Tailwind CSS 4 está integrado mediante Vite.
- Los tokens existentes son light-only y cubren colores, tipografía, radios, sombras y foco.
- Se pueden reutilizar `Button`, `Input`, `Card`, `Spinner` y `PageContainer`.
- Los controles tienen estados de disabled/loading y bases de accesibilidad aprovechables.

### Tests, scripts y versiones comprobadas

Scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:watch` y `preview`.

| Elemento | Versión instalada |
|---|---:|
| Node.js | 24.18.0 |
| React / React DOM | 19.2.7 |
| React Router | 8.3.1 |
| TypeScript | 5.8.3 |
| Vite | 8.1.3 instalada |
| Tailwind CSS | 4.3.3 |
| ESLint | 10.10.0 |
| Vitest | 5.0.0 |
| React Testing Library | 16.3.3 |
| jsdom | 30.0.1 |

Validación ejecutada sobre la línea base actual:

- `npm run lint`: correcto.
- `npm run typecheck`: correcto.
- `npm test`: 7 archivos, 29 tests correctos.
- `npm run build`: correcto; 91 módulos transformados.

## 3. Contratos Auth del backend

Prefijo real: `/api/v1`. Todas las respuestas exitosas pasan por el interceptor global y adoptan `{ data: T }`. Los errores adoptan `{ error: { code, message, details? } }`.

| Método | Ruta | Request | Response útil dentro de `data` | Cookie | Auth requerida | Errores relevantes |
|---|---|---|---|---|---|---|
| `POST` | `/auth/login` | `{ email: string, password: string }` | `{ accessToken: string }` | Crea `refresh_token` | No | `400` validación; `401 UNAUTHORIZED` para credenciales inválidas, usuario no activo u organización inactiva |
| `POST` | `/auth/refresh` | Sin body; usa cookie | `{ accessToken: string }` | Lee `refresh_token`; no la rota | No Bearer | `401 UNAUTHORIZED` si falta, expiró, no coincide o el usuario no puede refrescar |
| `GET` | `/auth/me` | Sin body | `{ id, email, fullName, role, organizationId, avatarUrl }` | No depende de ella | Bearer válido | `401 UNAUTHORIZED` si el access token falta, expiró o es inválido |
| `POST` | `/auth/logout` | Sin body | `{ message: string }` | Limpia `refresh_token` | Bearer válido | `401 UNAUTHORIZED` si el access token no es válido |

Contrato frontend exacto de usuario:

```ts
type UserRole = 'ADMIN' | 'TECHNICIAN' | 'USER'

interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  organizationId: string
  avatarUrl: string | null
}
```

Detalles confirmados:

- Login normaliza el email a minúsculas y busca solo usuarios `ACTIVE`.
- La validación exige email válido y password de al menos 6 caracteres.
- Access token: duración configurable, 15 minutos por defecto.
- Refresh token: duración configurable, 7 días por defecto.
- Solo existe un hash de refresh por usuario; un login nuevo reemplaza la sesión refrescable anterior.
- `/auth/refresh` comprueba usuario activo y hash del refresh, pero no vuelve a verificar `organization.isActive`.
- `/auth/me` obtiene el usuario por id, pero no vuelve a comprobar estado activo del usuario ni de la organización.
- El JWT guard confía en los claims firmados durante la vida del access token.
- Los `UnauthorizedException` comparten el código público `UNAUTHORIZED`; el frontend no debe inferir lógica de seguridad comparando mensajes.

Cookie real en producción:

```text
nombre: refresh_token
httpOnly: true
secure: true
sameSite: strict
path: /api/v1/auth
maxAge: 7 días
domain: no configurado (host-only)
```

En desarrollo usa `secure: false` y `sameSite: lax`.

## 4. Referencia visual Stitch

La referencia visual de Google Stitch no estuvo disponible. El único adjunto fue el prompt en Markdown. Por tanto:

- no se identificaron ni se inventarán composición, ilustraciones, logo, colores específicos, tipografía, spacing o breakpoints del diseño;
- no se decidirá aún si hacen falta `PasswordInput`, control de visibilidad, `BrandMark` o assets decorativos;
- `AuthLayout` puede actuar como punto de integración, pero su estructura final solo se decidirá después de inspeccionar la referencia;
- antes de implementar, el Tech Lead debe adjuntar la captura/export aprobado, incluyendo recursos gráficos necesarios y, si existen, variantes desktop/mobile o especificaciones de dimensiones.

La falta de la referencia bloquea la aceptación visual obligatoria de FE-02.

## 5. Arquitectura Auth propuesta

```text
src/
├── app/
│   ├── providers/
│   │   └── AppProviders.tsx
│   ├── layouts/
│   │   ├── AppLayout.tsx
│   │   └── AuthLayout.tsx
│   └── router/
│       └── AppRoutes.tsx
└── features/
    └── auth/
        ├── api/
        │   ├── auth.api.ts
        │   └── auth.api.test.ts
        ├── components/
        │   ├── AuthFormError.tsx
        │   ├── LoginForm.tsx
        │   ├── LoginForm.test.tsx
        │   └── SessionLoader.tsx
        ├── context/
        │   ├── auth-context.ts
        │   ├── AuthProvider.tsx
        │   └── AuthProvider.test.tsx
        ├── hooks/
        │   ├── useAuth.ts
        │   └── useAuthenticatedApi.ts
        ├── model/
        │   └── auth.types.ts
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── LoginPage.test.tsx
        │   └── SessionUnavailablePage.tsx
        ├── routing/
        │   ├── GuestOnlyRoute.tsx
        │   ├── ProtectedRoute.tsx
        │   ├── ProtectedRoute.test.tsx
        │   ├── role-routes.test.ts
        │   └── role-routes.ts
        ├── session/
        │   ├── auth-session-manager.ts
        │   └── auth-session-manager.test.ts
        └── index.ts
```

Principios:

- `auth.api.ts` encapsula exclusivamente contratos HTTP de Auth y usa el cliente base sin refresh implícito.
- `auth-session-manager.ts` concentra token en memoria, refresh single-flight, generación de sesión y request/retry. Al ser TypeScript puro es fácil de probar.
- `AuthProvider` traduce los eventos del administrador a estado React y no contiene toda la lógica HTTP.
- Los componentes importan el contrato público desde `@/features/auth`, no archivos internos.
- Los módulos futuros reciben una fachada de request autenticado; no conocen ni leen el access token.

## 6. Modelo de sesión

Se recomienda una unión discriminada, no booleanos que puedan contradecirse:

```ts
type AuthState =
  | { status: 'initializing'; user: null }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated'; user: null; reason?: 'initial' | 'expired' | 'logout' }
  | { status: 'unavailable'; user: null; error: AuthSafeError }
```

`submitting` pertenece al formulario de login, no a la sesión global. Un fallo temporal de una request de negocio tampoco debe convertir por sí mismo la sesión en `unavailable` o `unauthenticated`.

Flujo de arranque:

```text
App monta AuthProvider
        |
        v
  initializing (sin renderizar login ni AppLayout)
        |
        v
POST /auth/refresh con cookie httpOnly
        |
        +-- 200 --> token en memoria --> GET /auth/me
        |                              |
        |                              +-- 200 --> authenticated(user)
        |                              +-- 401 --> limpiar token --> unauthenticated(expired)
        |                              +-- red/5xx/403 --> unavailable + retry
        |
        +-- 401 --> unauthenticated(initial/expired)
        +-- red/5xx/protocolo/403 --> unavailable + retry
```

Decisiones:

- Un `401` de refresh confirma que no hay sesión recuperable.
- Un fallo de red o `5xx` no prueba que la sesión haya expirado; se muestra una pantalla de indisponibilidad con reintento.
- Un `403` no se interpreta como expiración. Aunque `/me` no lo produce hoy, si ocurriera durante bootstrap se muestra un estado seguro de acceso no disponible, evitando un loop hacia login.
- Un `401` de `/me` inmediatamente después de refresh limpia la sesión sin volver a refrescar.
- La inicialización debe compartir una promesa o control equivalente para tolerar el doble montaje de efectos en React Strict Mode sin duplicar refresh.

## 7. AuthProvider

API pública mínima recomendada:

```ts
interface AuthContextValue {
  state: AuthState
  login(credentials: LoginCredentials): Promise<void>
  logout(): Promise<void>
  retryInitialization(): void
}
```

Responsabilidades:

- iniciar la restauración de sesión una sola vez;
- conservar el `AuthUser` y estado React;
- coordinar login, logout y cambios definitivos de sesión;
- exponer errores/avisos seguros, nunca respuestas internas completas;
- notificar a routing cuando la sesión expire.

No debe:

- guardar tokens en Web Storage;
- exponer el access token a componentes visuales;
- leer la cookie de refresh;
- decodificar el JWT como fuente de usuario;
- contener reglas de todas las features;
- renderizar el formulario o decidir estilos;
- reemplazar autorización backend.

`useAuthenticatedApi()` expondrá un `request<T>()` estable respaldado por el administrador de sesión. Así los módulos de Tickets, Dashboard y siguientes no reciben el token ni implementan refresh por separado.

## 8. Cliente API y refresh

Se mantiene `createApiClient` como transporte de bajo nivel. Sobre él se agrega una fachada autenticada pequeña:

1. Obtiene un snapshot del access token en memoria.
2. Ejecuta la request con Bearer.
3. Si responde distinto de `401`, entrega respuesta/error sin tocar sesión.
4. Si responde `401`, comprueba si otra operación ya cambió el token; si cambió, reintenta una vez con el token nuevo.
5. Si no cambió, espera el refresh single-flight.
6. Con refresh exitoso, repite la request original exactamente una vez.
7. Si el retry vuelve a `401`, limpia la sesión y no intenta otro refresh.

Exclusiones obligatorias del mecanismo automático:

- `/auth/login`;
- `/auth/refresh`;
- `/auth/logout`;
- `/auth/me` durante bootstrap/login.

Estas llamadas usan `auth.api.ts` directamente para que sus transiciones sean explícitas. Un `403` se propaga al consumidor y conserva la sesión.

Los payloads normales de FE-02 son replayable. Para futuras requests con streams no replayables, la fachada deberá aceptar una fábrica de request/body o marcarlas como no reintentables; no debe asumirse que cualquier `BodyInit` se puede consumir dos veces.

Un `AbortSignal` del consumidor no debe cancelar el refresh compartido de otros consumidores. Si el request original ya fue abortado, su retry no se ejecuta.

## 9. Single-flight refresh

El administrador mantiene internamente:

```ts
refreshPromise: Promise<string> | null
sessionGeneration: number
accessToken: string | null
```

Algoritmo:

```text
request A/B/C/D/E reciben 401
            |
primera request crea refreshPromise
            |
restantes esperan la misma promesa
            |
      un solo POST /auth/refresh
       /                    \
200: publica token        401: limpia sesión una vez
y cada request hace       y todas reciben error de
un único retry            sesión expirada
```

- La promesa se limpia en `finally`, comprobando que sigue siendo la misma instancia.
- Fallo de red/`5xx`: se rechazan los consumidores, pero no se declara automáticamente sesión expirada.
- `401` de refresh: token y usuario se invalidan una sola vez.
- Cada request conserva una marca interna `hasRetried`; no hay recursion infinita.
- `sessionGeneration` aumenta con login, logout o invalidación. Un refresh iniciado en una generación vieja no puede publicar un token después de un logout o un login nuevo.
- Si un request observa que el token ya cambió respecto de su snapshot, usa ese token antes de solicitar otro refresh; esto evita refresh redundante tras carreras normales.

## 10. Login

Flujo funcional futuro:

1. Renderizar exactamente la referencia Stitch una vez suministrada.
2. Formulario semántico con email y password.
3. Validar localmente, deshabilitar submit y mostrar loading durante la operación.
4. `POST /auth/login` mediante API Auth sin auto-refresh.
5. Guardar el access token solo en el administrador en memoria.
6. Ejecutar `GET /auth/me` con ese token.
7. Publicar `authenticated(user)` y redirigir al destino interno preservado si es permitido para el rol; en caso contrario, a su ruta inicial.

Requisitos UX/accesibilidad:

- `type="email"`, `autoComplete="username"`, `required`;
- password con `autoComplete="current-password"`, `required` y mínimo 6;
- submit con tecla Enter;
- labels visibles y errores vinculados mediante `aria-describedby`;
- resumen de error con `role="alert"`/`aria-live` y gestión de foco;
- controles deshabilitados durante submit para evitar duplicados;
- responsive según la referencia real;
- visibilidad de password solo si Stitch la contempla o el Tech Lead la aprueba.

El email se normaliza con `trim()` antes de enviar; el password nunca se recorta ni transforma. Ninguno se persiste o registra.

## 11. Validación del formulario

Decisión: usar estado controlado de React más restricciones HTML nativas y una validación pequeña propia.

Justificación:

- solo existen dos campos;
- el contrato es simple y estable;
- `Input` ya soporta errores accesibles;
- React Hook Form, Zod o Yup aumentarían superficie y bundle sin resolver complejidad real en FE-02.

Validaciones locales: email requerido/formato válido y password requerido/mínimo 6. El backend sigue siendo la autoridad final. Si formularios futuros justifican schemas compartidos, se reevalúa como decisión transversal.

## 12. Protected routes

Se proponen dos guards basados en `<Outlet />`:

### `ProtectedRoute`

- `initializing`: muestra `SessionLoader` a pantalla completa.
- `unavailable`: muestra `SessionUnavailablePage` con reintento.
- `unauthenticated`: redirige con `replace` a `/login` y conserva `pathname + search + hash` en `location.state.from`.
- `authenticated`: renderiza la ruta privada.

### `GuestOnlyRoute`

- `initializing`: muestra el mismo loader, evitando flash del login.
- `unavailable`: muestra el estado de indisponibilidad.
- `unauthenticated`: permite `/login`.
- `authenticated`: redirige al destino interno preservado si es válido y permitido o a la ruta inicial por rol.

Solo se acepta un destino que sea una ruta interna conocida; nunca URL absoluta ni redirect recibido directamente por query string. La ruta se valida también contra el rol para impedir enviar un `USER` a Dashboard. Los redirects usan `replace` para evitar ciclos en el historial.

## 13. Roles y navegación

Los guards de rol frontend mejoran UX; no autorizan operaciones.

Permisos backend observados que afectan FE-02:

| Área | ADMIN | TECHNICIAN | USER | Consecuencia FE-02 |
|---|---:|---:|---:|---|
| Dashboard | Sí | Sí | No | Ocultar Dashboard a USER |
| Tickets base | Sí | Sí | Sí | Mostrar Tickets a todos |
| Notificaciones | Sí | Sí | Sí | Puede mantenerse visible como placeholder |
| Settings GET | Sí | Sí | Sí | Puede mantenerse visible; edición futura solo según permisos reales |

Ruta inicial recomendada:

- `ADMIN` → `/dashboard`;
- `TECHNICIAN` → `/dashboard`;
- `USER` → `/tickets`.

`AppLayout` construirá su navegación a partir de una configuración tipada con roles permitidos. En FE-02 solo se ajustan visibilidad, usuario actual y logout; no se simulan acciones de Tickets, Dashboard, Notificaciones o Settings que pertenecen a fases posteriores.

## 14. Logout

El backend exige access token válido, por lo que el flujo debe cubrir expiración:

1. Marcar la sesión como cerrándose, aumentar `sessionGeneration`, bloquear nuevas requests y conservar internamente un snapshot del token para invalidación remota.
2. Limpiar de inmediato user/token del estado utilizable por la UI.
3. Intentar `POST /auth/logout` con el snapshot.
4. Si responde `401`, intentar un único refresh raw con cookie y usar el access token resultante solo para reintentar logout; no publicarlo como nueva sesión.
5. Limpiar siempre estado local en `finally` y redirigir a login.

Edge cases:

- Refresh `401`: la sesión remota ya no es recuperable; terminar logout local.
- Red/`5xx`: terminar logout local, pero advertir de forma segura que la cookie `httpOnly` pudo quedar vigente. Una recarga podría restaurar la sesión hasta que el refresh expire o el backend vuelva a estar disponible.
- Un refresh concurrente anterior no puede resucitar la sesión por el control de generación.
- Logout repetido debe ser idempotente desde la perspectiva de UI.

La limitación de logout remoto no puede resolverse totalmente en frontend. Como seguimiento backend, convendría evaluar un endpoint que pueda invalidar/limpiar usando la cookie aun con access token expirado. No se modifica backend dentro de FE-02 sin aprobación.

## 15. Manejo de errores

| Categoría | Detección | Comportamiento UI |
|---|---|---|
| Validación local | Campos inválidos | Error junto al campo; no enviar request |
| Credenciales/estado no aceptado | Login `401` | Mensaje genérico: verificar credenciales o contactar al administrador; no revelar qué dato falló |
| Sesión expirada | Refresh `401` o retry final `401` | Limpiar sesión y redirigir a login con aviso seguro |
| Forbidden | `403` en request autenticado | Mantener sesión y mostrar acceso denegado en el contexto de la operación |
| Backend no disponible | `network` o `5xx` | Mensaje de indisponibilidad y acción de reintento |
| Request abortada | `aborted` | No mostrar error global si el aborto fue intencional |
| Protocolo inesperado | `protocol` | Mensaje genérico y registro técnico sin datos sensibles, según observabilidad futura |
| Error inesperado | Error no clasificado | Fallback seguro; no exponer stack ni respuesta interna |

No se ramificará lógica por textos como “organización no activa”, porque el código público actual es `UNAUTHORIZED` para varios casos. La UI puede usar el mensaje genérico sin crear enumeración de cuentas.

## 16. Seguridad

- Access token solo en memoria; nunca `localStorage`, `sessionStorage`, IndexedDB o cookies accesibles a JavaScript.
- Refresh token únicamente en cookie backend `httpOnly`; frontend no intenta leerlo.
- Mantener `credentials: "include"`.
- `/auth/me` es la fuente de identidad y rol; no decodificar JWT para poblar usuario.
- No persistir password ni incluir credenciales/tokens en logs, errores, analytics o estado de navegación.
- Reducir riesgo XSS evitando HTML no confiable, `dangerouslySetInnerHTML` y dependencias innecesarias. Una CSP es seguimiento de despliegue, no alcance de FE-02.
- Limpiar referencias a token, user y promesas vigentes al invalidar sesión.
- Los guards y elementos ocultos del frontend son UX; todos los endpoints deben seguir protegidos por backend.
- `organizationId` proviene de `/auth/me`, pero el frontend no lo usa para “asegurar” consultas. El aislamiento multi-tenant continúa siendo responsabilidad backend.
- No introducir secretos en variables `VITE_*`: todo valor compilado en frontend es público.

Deuda backend observada, sin corregir en FE-02:

- refresh no vuelve a comprobar organización activa;
- `/me` no vuelve a comprobar usuario/organización activos;
- un access token válido conserva sus claims hasta expirar;
- una sola sesión refrescable por usuario debido al único hash almacenado.

## 17. SameSite / CORS / despliegue

Backend habilita CORS con orígenes exactos desde `CORS_ORIGINS`, `credentials: true` y headers `Content-Type`/`Authorization`. El frontend ya envía credenciales.

Desarrollo local no está bloqueado si se mantiene:

```text
Frontend: http://localhost:5173
API:      http://localhost:3000/api/v1
Cookie:   SameSite=Lax, Secure=false
CORS:     incluye exactamente http://localhost:5173
```

Producción usa cookie `SameSite=Strict`, `Secure` y host-only. Es viable cuando frontend y API son HTTPS y same-site bajo el mismo dominio registrable, por ejemplo `app.cidrix.com` y `api.cidrix.com`. Puede romper refresh si:

- frontend y API están en dominios registrables distintos;
- existe diferencia de esquema que los vuelve schemeful cross-site;
- CORS no contiene exactamente el origin frontend;
- un proxy cambia host/path y deja de coincidir con `/api/v1/auth`.

Antes de desplegar debe aprobarse y probarse la topología real, incluyendo `Set-Cookie`, preflight y refresh desde navegador. No hace falta modificar la cookie para desarrollo local actual.

## 18. Componentes

### Reutilizar

- `Button`: submit y logout.
- `Input`: email/password y errores por campo.
- `Card`: solo si coincide con Stitch.
- `Spinner`: submit y carga de sesión.
- `PageContainer`: responsive general.
- `AuthLayout` y `AppLayout`: como puntos estructurales.

### Crear

- `LoginForm`: formulario y estado local de submit.
- `AuthFormError`: error general accesible.
- `SessionLoader`: carga inicial a pantalla completa.
- `SessionUnavailablePage`: indisponibilidad y retry.
- control mínimo de resumen de usuario/logout en `AppLayout` o componente local extraído si su estructura lo justifica.

### No crear todavía

- `PasswordInput`, `BrandMark` o assets decorativos hasta revisar Stitch.
- sistema completo de toast/modal.
- librería UI o Design System expandido.
- skeletons de módulos futuros.
- widgets ficticios de Dashboard/Tickets.

## 19. Dependencias

### Mantener

- React, React Router y APIs del navegador.
- Cliente `fetch` existente.
- Tailwind CSS.
- Vitest y React Testing Library.

### Agregar

Ninguna. La arquitectura propuesta puede implementarse con las dependencias presentes.

### No agregar todavía

- Redux, Zustand o cualquier store global adicional.
- Axios.
- TanStack Query.
- React Hook Form.
- Zod, Yup u otro schema validator.
- MSW: para FE-02 bastan dependencias inyectables y mocks del cliente/API. Se reconsidera si la cantidad de integraciones HTTP crece en fases posteriores.

## 20. Testing

### API Auth

- request/body/envelope de login;
- refresh y `credentials: include` heredado;
- Bearer de `/me` y logout;
- traducción de errores sin exponer datos sensibles.

### Administrador de sesión

- token permanece solo en memoria;
- request autenticado añade Bearer;
- `401` + refresh exitoso + un retry;
- retry final `401` invalida sesión sin loop;
- refresh `401` invalida sesión;
- refresh de red/`5xx` no se clasifica como expiración;
- cinco requests concurrentes producen un solo refresh;
- token ya actualizado evita refresh redundante;
- logout/generación impide publicar un refresh obsoleto;
- abortar un consumidor no cancela el refresh compartido.

### AuthProvider

- estado inicial `initializing`;
- refresh + `/me` restauran sesión;
- refresh `401` termina en `unauthenticated`;
- `/me` `401` limpia token;
- backend caído termina en `unavailable` y permite retry;
- Strict Mode no duplica la inicialización efectiva;
- login exitoso publica usuario real;
- logout limpia estado aun cuando falla la llamada remota.

### Login

- render del diseño aprobado;
- labels, inputs, autocomplete y submit por teclado;
- validación local;
- loading/disabled y prevención de doble submit;
- credenciales inválidas;
- error de red;
- éxito y redirect;
- responsive mediante revisión visual/manual complementaria.

### Routing

- anónimo no accede a rutas privadas;
- autenticado no permanece en `/login`;
- `initializing` no muestra login ni layout privado;
- `unavailable` muestra retry;
- destino original interno se conserva;
- destino inválido/externo se descarta;
- no existen redirect loops.

### Roles y layout

- ADMIN y TECHNICIAN tienen Dashboard como ruta inicial;
- USER inicia en Tickets y no ve Dashboard;
- navegación compartida respeta únicamente permisos backend confirmados;
- usuario real y logout aparecen en `AppLayout`.

No se recomienda E2E en FE-02: el proyecto aún no tiene infraestructura y los flujos quedan cubiertos por pruebas unitarias/integración con Vitest. Una smoke E2E de autenticación puede incorporarse en una fase transversal posterior.

## 21. Archivos a crear

Plan concreto, sujeto únicamente a ajustar nombres de componentes visuales tras recibir Stitch:

```text
cidrix-web/src/app/providers/AppProviders.tsx
cidrix-web/src/features/auth/api/auth.api.ts
cidrix-web/src/features/auth/api/auth.api.test.ts
cidrix-web/src/features/auth/components/AuthFormError.tsx
cidrix-web/src/features/auth/components/LoginForm.tsx
cidrix-web/src/features/auth/components/LoginForm.test.tsx
cidrix-web/src/features/auth/components/SessionLoader.tsx
cidrix-web/src/features/auth/context/auth-context.ts
cidrix-web/src/features/auth/context/AuthProvider.tsx
cidrix-web/src/features/auth/context/AuthProvider.test.tsx
cidrix-web/src/features/auth/hooks/useAuth.ts
cidrix-web/src/features/auth/hooks/useAuthenticatedApi.ts
cidrix-web/src/features/auth/model/auth.types.ts
cidrix-web/src/features/auth/pages/LoginPage.tsx
cidrix-web/src/features/auth/pages/LoginPage.test.tsx
cidrix-web/src/features/auth/pages/SessionUnavailablePage.tsx
cidrix-web/src/features/auth/routing/GuestOnlyRoute.tsx
cidrix-web/src/features/auth/routing/ProtectedRoute.tsx
cidrix-web/src/features/auth/routing/ProtectedRoute.test.tsx
cidrix-web/src/features/auth/routing/role-routes.ts
cidrix-web/src/features/auth/routing/role-routes.test.ts
cidrix-web/src/features/auth/session/auth-session-manager.ts
cidrix-web/src/features/auth/session/auth-session-manager.test.ts
cidrix-web/src/features/auth/index.ts
cidrix-web/src/app/layouts/AppLayout.test.tsx
```

## 22. Archivos a modificar

```text
cidrix-web/src/app/App.tsx
cidrix-web/src/app/router/AppRoutes.tsx
cidrix-web/src/app/router/AppRoutes.test.tsx
cidrix-web/src/app/layouts/AppLayout.tsx
cidrix-web/src/app/layouts/AuthLayout.tsx   # solo según la referencia Stitch
```

No se prevén cambios en `cidrix-api`, `schema.prisma`, dependencias ni cliente API base. Si durante implementación el transporte requiere un ajuste mínimo por un caso demostrado, deberá mantenerse compatible y ampliar sus tests; la primera opción es resolverlo en la capa Auth.

## 23. Archivos a eliminar

```text
cidrix-web/src/features/auth/pages/LoginPlaceholderPage.tsx
```

No se prevén otras eliminaciones.

## 24. Riesgos

### Crítico

No se identificó un riesgo técnico crítico que obligue a rediseñar backend o frontend.

### Alto

- Referencia Stitch ausente: bloquea fidelidad y aceptación visual; debe adjuntarse antes de implementar.
- FE-01 no consolidado en Git: implementar FE-02 sobre cambios locales no versionados dificulta revisión, rollback y separación de alcance.
- Logout remoto requiere access token válido: una caída de red puede dejar cookie refrescable aunque la UI haya limpiado su sesión.

### Medio

- Cookie `SameSite=Strict` depende de topología same-site y HTTPS en producción.
- Refresh no verifica nuevamente organización activa y `/me` no verifica estados activos; la revocación puede demorarse hasta expirar tokens.
- Un solo hash de refresh por usuario invalida sesiones previas al iniciar sesión en otro navegador/dispositivo.
- Concurrencia de requests, Strict Mode y logout requieren generación + single-flight correctos para evitar carreras.
- Repetir cuerpos no replayables exige una política explícita en la fachada de requests.

### Bajo

- `CORS_ORIGINS` se divide por comas sin normalizar espacios; la configuración debe escribirse sin espacios accidentales.
- Los errores de autenticación comparten el código `UNAUTHORIZED`, por lo que la UI solo puede ofrecer mensajes genéricos.
- La UI base es light-only; no afecta FE-02 porque dark mode está fuera de alcance.

## 25. Plan de implementación

1. Resolver precondiciones: adjuntar/revisar Stitch y consolidar FE-01 o autorizar explícitamente el trabajo apilado.
2. Documentar las medidas visuales reales de Stitch y mapearlas a tokens/componentes existentes, sin alterar todavía arquitectura global.
3. Crear tipos exactos de Auth y el adaptador `auth.api.ts` con tests de contrato.
4. Implementar el administrador de sesión en memoria con generación, single-flight y retry único; completar primero sus pruebas de concurrencia y carreras.
5. Implementar `AuthProvider`, hooks y restauración de sesión con estados discriminados.
6. Integrar `AppProviders` manteniendo `AppErrorBoundary` como protección exterior.
7. Crear `SessionLoader` y `SessionUnavailablePage` para evitar flashes y diferenciar indisponibilidad de anonimato.
8. Implementar `ProtectedRoute`, `GuestOnlyRoute`, rutas iniciales por rol y sanitización de destino.
9. Reemplazar el placeholder por el Login fiel a Stitch, conectar formulario, accesibilidad, errores y loading.
10. Ajustar `AppLayout` mínimamente con usuario, logout y navegación por roles respaldada por endpoints reales.
11. Completar casos de logout expirado/fallido y avisos seguros.
12. Ejecutar tests completos, lint, typecheck y build.
13. Revisar responsive/accesibilidad manualmente y comparar visualmente contra Stitch en los tamaños proporcionados.
14. Revisar `git diff`, confirmar que no existen cambios backend ni features FE-03+, y generar el informe de implementación que solicite el Tech Lead.

## 26. Criterios de aceptación

- [ ] La referencia Stitch fue adjuntada, analizada y reproducida con fidelidad razonable.
- [ ] Login es responsive, semántico, accesible y operable con teclado.
- [ ] Login usa el endpoint real y maneja loading, doble submit, validación y errores seguros.
- [ ] Access token existe solo en memoria.
- [ ] No se usa `localStorage` ni `sessionStorage` para JWT.
- [ ] Refresh token permanece exclusivamente en cookie `httpOnly`.
- [ ] Todas las llamadas mantienen `credentials: "include"`.
- [ ] Recargar restaura sesión mediante refresh y después `/auth/me`.
- [ ] `/auth/me` es la autoridad de usuario, rol y organizationId.
- [ ] `AuthProvider` tiene responsabilidades acotadas y no expone tokens.
- [ ] Estado inicial evita flash de login o contenido privado.
- [ ] Backend no disponible permite reintento y no simula sesión expirada.
- [ ] Rutas privadas redirigen al anónimo y `/login` redirige al autenticado.
- [ ] Destino original solo acepta rutas internas válidas y permitidas por rol.
- [ ] ADMIN/TECHNICIAN inician en Dashboard; USER inicia en Tickets.
- [ ] Dashboard no se muestra a USER.
- [ ] Un `401` de request normal usa refresh y un único retry.
- [ ] Cinco `401` concurrentes producen un solo refresh.
- [ ] No existe loop de refresh.
- [ ] Un `403` no cierra la sesión.
- [ ] Logout limpia estado local aun si falla la invalidación remota.
- [ ] Una carrera refresh/logout no resucita la sesión.
- [ ] No se registran secretos, passwords ni tokens.
- [ ] La autorización sigue dependiendo del backend.
- [ ] Tests de Auth, routing, refresh, concurrencia y roles pasan.
- [ ] `npm run lint` pasa.
- [ ] `npm run typecheck` pasa.
- [ ] `npm test` pasa.
- [ ] `npm run build` pasa.
- [ ] No se agregan dependencias sin nueva aprobación.
- [ ] No se modifica backend.
- [ ] No se implementan features de FE-03 en adelante.

## 27. Fuera de alcance

- CRUD y detalle funcional de Tickets.
- Comentarios y adjuntos.
- Dashboard con métricas reales.
- Notificaciones reales.
- Settings funcionales.
- Dark mode y rediseño global.
- Store global, cache de server state o librería de formularios.
- E2E completo e infraestructura asociada.
- CI/CD.
- Cambios en JWT, cookies, guards o contratos backend.
- Corrección de la política de revocación backend.
- Implementación de módulos ficticios para completar el sidebar.

## 28. Recomendación final

**FE-02 requiere resolver bloqueos antes de implementar.**

La arquitectura y contratos están suficientemente definidos, pero no debe comenzar la implementación hasta:

1. recibir la referencia visual exacta de Google Stitch y sus assets/variantes disponibles; y
2. consolidar FE-01 en una base Git revisable o recibir autorización explícita del Tech Lead para apilar FE-02 sobre el working tree actual.

Una vez resueltas ambas precondiciones, no se identifica la necesidad de modificar backend ni añadir dependencias para implementar FE-02.
