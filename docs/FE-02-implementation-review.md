# CIDRIX — FE-02: Auth y sesión — Implementation review

Fecha: 2026-09-09  
Rama de trabajo: `codex/fe-01-frontend-base`  
Base autorizada: working tree actual de FE-01.

## 1. Resumen ejecutivo

FE-02 quedó implementado sobre la base FE-01 autorizada. La aplicación ahora dispone de login real, restauración de sesión, access token privado en memoria, refresh cookie `httpOnly`, `/auth/me`, logout robusto, requests autenticados con single-flight refresh, guards de routing, redirects seguros, ruta inicial por rol, navegación mínima por rol y estados diferenciados de carga/indisponibilidad.

El Login reproduce la captura de Google Stitch adjunta con una tarjeta compacta centrada, marca CIDRIX, jerarquía, colores, campos, CTA y footer equivalentes. Se validó manualmente en desktop, tablet y móvil.

No se modificó backend, no se añadieron dependencias y no se avanzó a FE-03. La batería final pasa con 13 suites y 90 tests.

## 2. Precondiciones

- El Tech Lead autorizó expresamente continuar sobre el working tree no consolidado de FE-01.
- Se preservaron todos los cambios previos; no se ejecutó reset ni cambio de rama.
- La captura exacta del Login de Stitch estuvo disponible y se revisó antes de editar la pantalla.
- Se reconfirmaron los contratos reales en `cidrix-api`.
- Node.js usado: 24.18.0.
- `VITE_API_URL` continúa apuntando a `http://localhost:3000/api/v1` en el entorno local existente.

## 3. Referencia Stitch utilizada

La captura proporcionada tiene resolución 1360×746 y muestra:

- fondo blanco limpio;
- tarjeta blanca centrada, estrecha, con borde tenue, radio medio y sombra difusa;
- marca CIDRIX centrada en la parte superior;
- título “Iniciar sesión” con jerarquía fuerte y color azul marino;
- labels visibles, dos inputs sin placeholders y bordes grises;
- CTA azul de ancho completo;
- texto “¿Olvidaste tu contraseña?” bajo el botón;
- footer centrado con política, términos y copyright.

Implementación:

- composición y proporciones reproducidas con React + Tailwind;
- ancho máximo de tarjeta de 22.25 rem;
- fondo blanco, espaciado compacto, borde y `shadow-overlay`;
- color primario alineado al azul del diseño;
- copyright 2023 conservado como aparece en la referencia;
- footer anclado al borde inferior en tablet/desktop y en flujo natural en móvil.

Diferencias inevitables:

- No se entregó un asset oficial del logo. Se creó una aproximación vectorial inline del isotipo “C” con facetas azules, sin añadir archivos binarios ni dependencias.
- Los inputs y el botón conservan una altura mínima accesible cercana a 40 px, algo mayor a la medida aparente de la captura. Esto vuelve la tarjeta ligeramente más alta.
- “¿Olvidaste tu contraseña?”, Política y Términos permanecen como texto no interactivo porque no existen rutas o contratos aprobados para esos flujos. No se inventaron enlaces.

## 4. Arquitectura Auth final

```text
src/
├── app/
│   ├── providers/AppProviders.tsx
│   ├── layouts/
│   └── router/
└── features/auth/
    ├── api/
    ├── components/
    ├── context/
    ├── hooks/
    ├── model/
    ├── pages/
    ├── routing/
    ├── session/
    └── index.ts
```

Separación aplicada:

- API Auth: contratos HTTP explícitos.
- Session Manager: token, concurrencia, retry y carreras, independiente de React.
- AuthProvider: estado React y operaciones públicas.
- Hooks: acceso acotado al estado y a la fachada autenticada.
- Routing: sesión, guest-only, roles y destinos seguros.
- UI: Login, marca, errores, loader e indisponibilidad.
- Barrel público: evita que otras features consuman internals.

## 5. Contratos Auth implementados

| Método | Ruta | Implementación frontend |
|---|---|---|
| `POST` | `/auth/login` | Body `{ email, password }`; obtiene `{ accessToken }` ya desempaquetado por el cliente base |
| `POST` | `/auth/refresh` | Sin body ni Bearer; cookie enviada por `credentials: "include"` |
| `GET` | `/auth/me` | Bearer explícito; retorna `AuthUser` exacto |
| `POST` | `/auth/logout` | Bearer explícito; descarta el mensaje informativo |

`auth.api.ts` reutiliza por completo URL, fetch, headers, envelopes y errores de FE-01. Estas cuatro transiciones no dependen del auto-refresh implícito.

## 6. Modelo de sesión

Se implementó una unión discriminada:

```text
initializing
authenticated(user)
unauthenticated(reason: initial | expired | logout)
unavailable(error seguro)
```

Bootstrap:

```text
initializing
    ↓
POST /auth/refresh
    ├─ 200 → token privado → GET /auth/me → authenticated
    ├─ 401 → unauthenticated
    └─ network/5xx → unavailable → retry
```

Un `/me` 401 posterior al refresh invalida la sesión sin iniciar otro ciclo. Un fallo temporal no se representa como logout.

## 7. Session Manager

`AuthSessionManager` es TypeScript puro y recibe `AuthApi` y `ApiClient` por inyección.

Responsabilidades implementadas:

- access token en campo privado nativo `#accessToken`;
- inicialización compartida;
- snapshot del token por request;
- request autenticado sin exponer Bearer al consumidor;
- refresh automático solo ante 401 de requests normales;
- retry único;
- invalidación y notificación al Provider;
- control de sesión bloqueada durante logout;
- protección ante operaciones obsoletas;
- espera de logout antes de permitir un login nuevo.

Los endpoints `auth/login`, `auth/refresh`, `auth/logout` y `auth/me`, incluso con query/hash accidental, se excluyen del auto-refresh.

## 8. Single-flight refresh

Se mantiene una única `refreshPromise` compartida.

- La primera request con 401 crea el refresh.
- Las requests concurrentes esperan la misma promesa.
- Un refresh exitoso publica el token y cada consumidor reintenta solo una vez.
- Si otra request ya publicó un token nuevo, una respuesta 401 tardía reutiliza ese token y no crea otro refresh.
- Refresh 401 invalida sesión.
- Network/5xx se propaga sin declarar sesión expirada.
- El cleanup usa un identificador único de operación para no borrar una promesa perteneciente a una sesión posterior.
- Cinco requests concurrentes se cubren con una prueba que confirma exactamente un refresh y diez llamadas de transporte: cinco originales y cinco retries.

## 9. AuthProvider

API pública final:

```ts
interface AuthContextValue {
  state: AuthState
  login(credentials: LoginCredentials): Promise<void>
  logout(): Promise<void>
  retryInitialization(): void
}
```

El Provider:

- inicializa la sesión;
- publica estado y usuario;
- conecta login/logout;
- reacciona a invalidaciones del Session Manager;
- expone una segunda fachada mediante `useAuthenticatedApi()`.

No expone token, no conoce cookies, no decodifica JWT y no contiene la lógica de concurrencia.

La promesa de inicialización se comparte, por lo que el doble ciclo de efectos de React Strict Mode no duplica refresh ni `/me`.

## 10. Login implementado

- Página, formulario, marca y error general están separados.
- Email controlado, `type="email"`, `required`, `autoComplete="username"` y `trim()` antes de enviar.
- Password controlado, `type="password"`, `required`, `minLength={6}` y `autoComplete="current-password"`.
- El password no se recorta ni transforma.
- Submit semántico, compatible con Enter, loading y disabled.
- Doble submit bloqueado.
- Errores locales asociados a los inputs.
- Login 401 muestra un texto genérico que no revela cuenta u organización.
- Network/5xx muestra indisponibilidad temporal.
- El usuario no se considera autenticado hasta completar login y `/auth/me`.
- No se añadió visibilidad de contraseña porque Stitch no la muestra.

## 11. Routing

Rutas protegidas:

- `/dashboard`;
- `/tickets`;
- `/tickets/:id`;
- `/notifications`;
- `/settings`.

`ProtectedRoute` decide entre loader, indisponibilidad, redirect a login o `<Outlet />`. Al redirigir conserva `pathname + search + hash` en state.

`GuestOnlyRoute` evita que un autenticado permanezca en `/login` y resuelve su destino por rol.

El destino original:

- debe ser string interno;
- rechaza URL absoluta, protocol-relative y backslashes;
- debe corresponder a una ruta privada conocida;
- debe estar permitida para el rol;
- conserva query y hash solo después de validar.

Se agregó `RoleRoute` para impedir que USER permanezca en `/dashboard` incluso por navegación manual.

## 12. Roles

| Rol | Ruta inicial | Dashboard en navegación | Rutas compartidas |
|---|---|---:|---|
| ADMIN | `/dashboard` | Sí | Tickets, Notificaciones, Configuración |
| TECHNICIAN | `/dashboard` | Sí | Tickets, Notificaciones, Configuración |
| USER | `/tickets` | No | Tickets, Notificaciones, Configuración |

La matriz se limita a permisos confirmados en backend. Es UX, no un mecanismo de autorización.

## 13. Logout

Flujo final:

1. Captura internamente el token vigente.
2. Incrementa generación y bloquea la sesión.
3. Limpia inmediatamente token/user utilizables y publica estado anónimo.
4. Intenta logout remoto con el snapshot.
5. Si recibe 401, hace un refresh raw como máximo una vez.
6. Usa ese token únicamente para reintentar logout; nunca lo publica.
7. Finaliza siempre el logout local.

Una operación de refresh anterior no puede restaurar la sesión después del logout. Un login iniciado mientras el cierre remoto continúa espera su finalización para evitar que el backend invalide el refresh recién creado.

Ante network/5xx, la cookie `httpOnly` puede permanecer en el navegador porque solo el backend puede limpiarla. La sesión local permanece cerrada.

## 14. Seguridad

- JWT de acceso únicamente en memoria y dentro de un campo privado nativo.
- Sin `localStorage`, `sessionStorage`, IndexedDB o cookies JavaScript.
- Refresh token no se lee ni se replica.
- `credentials: "include"` se conserva en el cliente base.
- `/auth/me` es la autoridad para usuario, rol y tenant.
- No se decodifica JWT.
- No hay secrets, tokens o passwords hardcodeados.
- No se loggean credenciales ni tokens.
- No se exponen detalles internos en mensajes de error.
- 403 se propaga sin refresh ni logout.
- Los guards frontend no sustituyen autorización backend.
- `organizationId` se consume como dato del usuario; el aislamiento continúa siendo responsabilidad backend.

## 15. Tests

Resultado final:

```text
Test Files  13 passed (13)
Tests       90 passed (90)
```

Cobertura FE-02 agregada:

- API Auth: login, refresh, me, logout, Bearer, body y propagación de errores.
- Session Manager: memoria privada, bootstrap, 401, refresh, retry único, retry final 401, refresh 401, network, 5xx, 403, single-flight de cinco requests, token actualizado, generación, login nuevo, logout vs refresh, logout remoto fallido, exclusiones Auth y AbortSignal.
- AuthProvider: initializing, restauración, refresh 401, me 401, unavailable, retry, login, logout, fachada y Strict Mode.
- Login: render, atributos, validación, foco, email normalizado, password intacto, submit semántico, loading, doble submit, 401, network y sesión expirada.
- Routing: anonymous, authenticated, GuestOnly, initializing, unavailable, destino original/inválido, roles, ticket dinámico, 404 y ausencia de loops.
- AppLayout: usuario, logout, ADMIN, TECHNICIAN, USER y Dashboard oculto.

No se añadió E2E ni MSW.

## 16. Revisión visual

Se levantó Vite y una API Auth local temporal que respondió refresh 401 para mostrar Login, y login 401 demorado para observar estados. No se modificaron archivos ni backend para esta prueba.

Tamaños revisados:

| Vista | Resultado |
|---|---|
| Desktop 1360×746 | Tarjeta centrada, proporciones cercanas a Stitch, footer inferior |
| Tablet 768×1024 | Sin overflow, composición y footer estables |
| Mobile 320×568 | Sin overflow horizontal; tarjeta y footer legibles |

Estados revisados:

- normal;
- validación vacía y foco automático en email;
- loading con spinner;
- email, password y botón deshabilitados durante submit;
- error 401 seguro y anunciable;
- tarjeta móvil con scroll vertical esperado cuando aparecen errores en una altura corta.

Métricas mobile normales: `scrollWidth = innerWidth = 320`. En error de dos campos el alto crece a 590 sobre viewport 568, por lo que se habilita scroll vertical sin recortar contenido.

No se observaron warnings ni errores de consola durante la comprobación visual. El viewport se restauró y los servidores temporales se cerraron al finalizar.

## 17. Validaciones

| Comando | Resultado |
|---|---|
| `npm run lint` | Correcto |
| `npm run typecheck` | Correcto |
| `npm test` | 13 suites, 90 tests correctos |
| `npm run build` | Correcto; 112 módulos transformados |
| `git diff --check` | Correcto, sin errores de whitespace |
| `git status --short` | Working tree sucio esperado y autorizado |
| `git diff` | Revisado; incluye la base FE-01 no consolidada |

Build final:

```text
dist/index.html                   0.50 kB | gzip  0.32 kB
dist/assets/index-B0zYYJx2.css   17.33 kB | gzip  4.36 kB
dist/assets/index-eHCz8sm8.js   256.05 kB | gzip 81.76 kB
```

Git muestra avisos informativos de futura conversión LF→CRLF en archivos FE-01 del working tree de Windows. No son errores de `diff --check` ni se hizo una normalización masiva.

## 18. Archivos creados

```text
cidrix-web/src/app/providers/AppProviders.tsx
cidrix-web/src/app/layouts/AppLayout.test.tsx
cidrix-web/src/features/auth/api/auth.api.ts
cidrix-web/src/features/auth/api/auth.api.test.ts
cidrix-web/src/features/auth/components/AuthFormError.tsx
cidrix-web/src/features/auth/components/CidrixBrand.tsx
cidrix-web/src/features/auth/components/LoginForm.tsx
cidrix-web/src/features/auth/components/LoginForm.test.tsx
cidrix-web/src/features/auth/components/SessionLoader.tsx
cidrix-web/src/features/auth/context/auth-context.ts
cidrix-web/src/features/auth/context/AuthProvider.tsx
cidrix-web/src/features/auth/context/AuthProvider.test.tsx
cidrix-web/src/features/auth/hooks/useAuth.ts
cidrix-web/src/features/auth/hooks/useAuthenticatedApi.ts
cidrix-web/src/features/auth/index.ts
cidrix-web/src/features/auth/model/auth-errors.ts
cidrix-web/src/features/auth/model/auth.types.ts
cidrix-web/src/features/auth/pages/LoginPage.tsx
cidrix-web/src/features/auth/pages/SessionUnavailablePage.tsx
cidrix-web/src/features/auth/routing/GuestOnlyRoute.tsx
cidrix-web/src/features/auth/routing/ProtectedRoute.tsx
cidrix-web/src/features/auth/routing/RoleRoute.tsx
cidrix-web/src/features/auth/routing/role-routes.ts
cidrix-web/src/features/auth/routing/role-routes.test.ts
cidrix-web/src/features/auth/session/auth-session-manager.ts
cidrix-web/src/features/auth/session/auth-session-manager.test.ts
docs/FE-02-implementation-review.md
```

## 19. Archivos modificados

```text
cidrix-web/src/app/App.tsx
cidrix-web/src/app/layouts/AppLayout.tsx
cidrix-web/src/app/layouts/AuthLayout.tsx
cidrix-web/src/app/router/AppRoutes.tsx
cidrix-web/src/app/router/AppRoutes.test.tsx
cidrix-web/src/styles/tokens.css
```

Los demás cambios mostrados por Git pertenecen a FE-01 y se preservaron sin descartarlos.

## 20. Archivos eliminados

```text
cidrix-web/src/features/auth/pages/LoginPlaceholderPage.tsx
```

Fue reemplazado por `LoginPage` real.

## 21. Dependencias

No se agregaron, eliminaron ni actualizaron dependencias durante FE-02. No se modificaron `package.json` ni `package-lock.json` como parte de esta implementación.

La solución usa React, React Router, fetch, Tailwind, Vitest y React Testing Library ya presentes.

## 22. Desviaciones

- El árbol final incluye `RoleRoute.tsx` y `auth-errors.ts`, separaciones pequeñas justificadas por autorización UX y mensajes seguros.
- El logo es una aproximación SVG inline porque la captura no incluyó el asset original.
- No se creó `PasswordInput`: Stitch no muestra visibilidad de contraseña.
- No se implementó aviso visual persistente de logout remoto fallido porque no existe sistema de notificaciones global; el comportamiento y riesgo quedan documentados.
- No se añadieron enlaces falsos para recuperación de password o documentos legales.

## 23. Problemas encontrados

Problemas resueltos durante implementación:

- El `private` de TypeScript era enumerable al serializar la instancia. Se sustituyó el token por `#accessToken`, privado también en runtime.
- El cleanup inicial de la promesa de refresh dependía de autorreferenciar una promesa durante su construcción. Se sustituyó por `refreshOperationId`, evitando tanto el error del compilador estricto como limpiar una operación nueva por carrera.
- El footer de la primera iteración reducía el área de centrado y desplazaba la tarjeta frente a Stitch. Se corrigió el layout sin afectar móvil.

No quedaron fallos de pruebas, compilación o lint.

## 24. Riesgos pendientes

- Si logout remoto falla por red/5xx, la cookie puede seguir vigente y una recarga posterior podría restaurar sesión.
- Producción requiere frontend/API HTTPS y same-site para la cookie `SameSite=Strict`, además de CORS exacto.
- Backend refresh no vuelve a comprobar `organization.isActive`; `/me` tampoco comprueba nuevamente estados de usuario/organización.
- El backend mantiene un único hash de refresh por usuario; un login nuevo invalida la sesión refrescable anterior.
- FE-01 y FE-02 continúan mezclados en un working tree no consolidado por decisión explícita del Tech Lead.
- Falta reemplazar el isotipo aproximado si el equipo entrega el asset oficial.
- Recuperación de contraseña y páginas legales requieren definición/backend antes de convertir los textos en acciones.

## 25. Confirmación backend sin cambios

`git status --short -- cidrix-api` no devuelve cambios. No se modificaron controllers, servicios, guards, DTOs, configuración, Prisma, migraciones ni tests backend.

## 26. Fuera de alcance

- FE-03 Tickets funcional.
- Detalle real, comentarios y adjuntos.
- Dashboard con métricas.
- Notificaciones reales.
- Settings funcionales.
- Recuperación de contraseña.
- Páginas de Política y Términos.
- Dark mode.
- E2E e infraestructura nueva.
- Cambios de cookies, JWT o autorización backend.
- Commit, push, PR o merge.

## 27. Estado final

La implementación cumple el alcance aprobado, pasa todas las validaciones y queda detenida para revisión del Tech Lead y pruebas manuales contra un backend real.

FE-02 listo para revisión del Tech Lead y pruebas manuales
