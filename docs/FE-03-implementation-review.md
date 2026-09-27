# FE-03 — Tickets: revisión de implementación

## 1. Resumen ejecutivo

Se implementó la experiencia funcional de Tickets sobre FE-01/FE-02: listado real, búsqueda explícita, filtros, ordenamiento y paginación de servidor, creación por rol, navegación al placeholder de detalle, estados de carga/vacío/error, URL state, responsive y accesibilidad. La implementación usa exclusivamente la fachada autenticada de FE-02 y no manipula tokens.

## 2. Base de trabajo

- Rama base actualizada: `main` en `c9cdc42` (`Merge pull request #7 from sewaaaas/codex/fe-01-frontend-base`).
- Rama de trabajo: `codex/fe-03-tickets`.
- Working tree confirmado limpio antes de empezar.
- No se realizó commit, push, PR ni merge.

## 3. Contratos backend confirmados

- `GET /api/v1/tickets`: ADMIN, TECHNICIAN y USER; USER recibe sus tickets por la regla del service.
- `POST /api/v1/tickets`: ADMIN, TECHNICIAN y USER.
- `GET /api/v1/categories`: solo ADMIN y TECHNICIAN.
- `GET /api/v1/users`: solo ADMIN.
- USER no puede enviar `categoryId` ni `assignedToId` al crear; el service responde 403.
- ADMIN y TECHNICIAN pueden enviar categoría al crear. Aunque el service permite `assignedToId` a TECHNICIAN, ese rol no puede listar Users para poblar un selector seguro.
- La fachada de FE-02 desempaqueta el primer envelope global y entrega correctamente `{ data, meta }` a Tickets.

## 4. Arquitectura final de Tickets

La feature quedó encapsulada en `api/`, `components/`, `model/` y `pages/`. La página orquesta estado de URL y requests; la API recibe el `ApiClient` autenticado; los componentes concentran filtros, listado, badges y alta; el modelo contiene contratos, constantes y serialización.

## 5. Modelo frontend

Se agregaron tipos frontend estrictos para Ticket, usuarios resumidos, categorías, estados, prioridades, sort, filtros, payload de creación y respuestas paginadas. No dependen de Prisma ni usan `any`.

## 6. Tickets API

`createTicketsApi()` ofrece `list`, `get` preparado para FE-04, `create`, `listCategories` y `listActiveUsers`. Todas las llamadas usan el cliente inyectado por `useAuthenticatedApi`; no hay lectura directa del access token ni duplicación de refresh.

## 7. Listado de Tickets

Desktop/tablet usa tabla semántica con número, título, estado, prioridad, categoría, solicitante, asignado y fecha. Móvil usa cards/lista con número, título, estado, prioridad y fecha. Número y título navegan a `/tickets/:id`.

## 8. Búsqueda y filtros

- Búsqueda por submit explícito para evitar requests por pulsación.
- Filtros: status, priority y categoría para los roles que pueden listar Categories.
- ADMIN: filtros adicionales por asignado y creador usando Users.
- TECHNICIAN: no solicita Users y evita un 403 previsible.
- USER: no solicita Categories ni Users; no se muestran controles que dependan de esos endpoints.
- Cualquier cambio reinicia `page` a 1.
- Se añadió `Limpiar filtros` cuando hay filtros activos.

## 9. URL state

Los filtros, búsqueda, sort, dirección, página y límite se leen de query string. Los defaults se omiten de la URL visible y los enums/números inválidos vuelven a defaults seguros. Back/forward y refresh conservan la vista. Los links al detalle guardan además el origen en `location.state` para FE-04.

## 10. Ordenamiento

Se soportan `createdAt`, `updatedAt`, `priority`, `status` y `number`, con dirección `asc`/`desc`. Siempre se envían al backend; no se reordena localmente una página parcial.

## 11. Paginación

La UI consume `total`, `page`, `limit` y `totalPages`, muestra página actual/total, anterior/siguiente y selector 20/50/100. Cambiar el límite reinicia la página. Para un resultado vacío, `totalPages = 0` se normaliza visualmente a una sola página sin renderizar controles innecesarios.

## 12. Creación de Ticket

Se implementó un diálogo accesible con título, descripción, prioridad y campos opcionales autorizados. Valida título requerido/máximo 255 y descripción mínima 10; usa un lock síncrono además del estado visual para impedir doble submit. En éxito cierra, resetea, devuelve foco, anuncia el ticket mediante `aria-live` y refresca desde backend.

## 13. Categorías

ADMIN y TECHNICIAN consultan `GET /categories?isActive=true&page=1&limit=100`; las opciones se reutilizan en filtro y alta. USER no consulta este endpoint porque el controller lo prohíbe y el service de Tickets también prohíbe `categoryId` al crear como USER.

## 14. Usuarios / técnicos

Solo ADMIN consulta `GET /users?status=ACTIVE&page=1&limit=100`. El selector de asignación filtra TECHNICIAN; el filtro de creador usa usuarios activos. TECHNICIAN y USER no consultan Users. No hay IDs ni nombres hardcodeados en producción.

## 15. UX por rol

- ADMIN: listado completo, filtros de categoría/asignado/creador y alta con categoría/asignación.
- TECHNICIAN: listado completo, filtro y alta con categoría; sin selector de Users que provocaría 403.
- USER: tickets propios según backend, búsqueda/status/priority/sort, alta sin categoría ni asignación, y sin acciones administrativas.
- Parámetros `assignedToId`/`createdById` inyectados en URL se eliminan para roles no ADMIN antes de consultar.

## 16. Responsive

Se validó 390×844, 768×1024 y 1440×900. A 390 px se muestran cards; a partir de `md` se usa tabla con scroll horizontal contenido si hace falta. `documentElement.scrollWidth` coincidió con `clientWidth` en los tres tamaños, sin overflow global.

## 17. Accesibilidad

Hay headings y labels visibles, tabla semántica, textos en badges (no solo color), `role=status` en loading, errores con `role=alert`, confirmación `aria-live`, diálogo con nombre/descripción, foco inicial, cierre con Escape, ciclo de Tab y restauración de foco al CTA. Los controles conservan el focus visible global.

## 18. Manejo de errores

Se distinguen mensajes seguros para red, 400, 403 y error inesperado. El listado ofrece Reintentar. El alta mantiene el diálogo y los datos ante error. Los 401 siguen en la infraestructura de sesión FE-02, sin refresh paralelo.

## 19. Tests

- 17 archivos de test, 113 tests aprobados.
- API: GET, query params, omisión de vacíos, paginación/sort, POST/payload, opciones y propagación de errores.
- Query state: defaults, valores inválidos, round-trip y omisión de defaults.
- Página: loading, datos, vacíos, filtros, limpiar, error/retry, URL, sort, límite, navegación, paginación y roles.
- Alta: apertura/cierre, labels, Escape/foco, validaciones, submit, doble submit, loading, error, éxito y reset.
- La suite previa de FE-01/FE-02 continúa aprobada.

## 20. Pruebas manuales

Se levantaron PostgreSQL, `cidrix-api` y `cidrix-web` localmente y se probó con los tres usuarios seed:

- ADMIN: listado, categorías, Users, asignación y creación `TKT-0010`.
- TECHNICIAN: listado, categorías, ausencia de controles Users y creación `TKT-0011`.
- USER: solo 4 tickets propios, ausencia de Categories/Users y creación `TKT-0012` sin campos prohibidos.
- Se verificaron búsqueda + status en URL, limpiar, navegación al placeholder y back conservando query.
- Consola del navegador: sin warnings ni errores.
- Responsive revisado en desktop, tablet y móvil.

Los tres tickets de prueba permanecen en la base local; no se borraron para evitar una operación destructiva fuera del alcance solicitado.

## 21. Validaciones

- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- `npm test`: aprobado, 113/113.
- `npm run build`: aprobado; 119 módulos transformados.
- `git diff --check`: aprobado.
- `git status --short` y diff completo revisados.

## 22. Ajuste FE-02 (`2023 -> 2026`)

Se cambió únicamente el copyright del login de `Copyright © CIDRIX 2023` a `Copyright © CIDRIX 2026`.

## 23. Archivos creados

- `cidrix-web/src/features/tickets/api/tickets.api.ts`
- `cidrix-web/src/features/tickets/api/tickets.api.test.ts`
- `cidrix-web/src/features/tickets/components/CreateTicketDialog.tsx`
- `cidrix-web/src/features/tickets/components/CreateTicketDialog.test.tsx`
- `cidrix-web/src/features/tickets/components/TicketBadge.tsx`
- `cidrix-web/src/features/tickets/components/TicketFiltersPanel.tsx`
- `cidrix-web/src/features/tickets/components/TicketsList.tsx`
- `cidrix-web/src/features/tickets/model/ticket.types.ts`
- `cidrix-web/src/features/tickets/model/ticket.constants.ts`
- `cidrix-web/src/features/tickets/model/ticket-query.ts`
- `cidrix-web/src/features/tickets/model/ticket-query.test.ts`
- `cidrix-web/src/features/tickets/pages/TicketsPage.tsx`
- `cidrix-web/src/features/tickets/pages/TicketsPage.test.tsx`
- `docs/FE-03-implementation-review.md`

## 24. Archivos modificados

- `cidrix-web/src/app/layouts/AuthLayout.tsx`
- `cidrix-web/src/app/router/AppRoutes.tsx`
- `cidrix-web/src/app/router/AppRoutes.test.tsx`

## 25. Archivos eliminados

- `cidrix-web/src/features/tickets/pages/TicketsPlaceholderPage.tsx`, reemplazado por la página funcional.

## 26. Dependencias

No se añadieron ni actualizaron dependencias. No cambió ningún lockfile.

## 27. Desviaciones

- USER no recibe filtro/selector de categoría porque `GET /categories` no autoriza USER y `POST /tickets` rechaza `categoryId` para ese rol. Se priorizó no provocar 403 previsible.
- TECHNICIAN no recibe filtros/asignación basados en Users porque `GET /users` es ADMIN-only, aunque el service de creación acepte técnicamente `assignedToId` para TECHNICIAN.
- Fechas `dateFrom`/`dateTo` están soportadas en tipos/serialización, pero no se añadieron controles para mantener el filtro principal compacto; el prompt las marcaba opcionales.

## 28. Problemas encontrados

- La primera prueba de doble submit detectó que el estado React por sí solo dejaba una ventana síncrona antes del re-render. Se corrigió con un `ref` de bloqueo inmediato y quedó cubierto por test.
- Vitest 5 no acepta `--runInBand`; la suite válida del proyecto es `npm test` (`vitest run`).
- En un dato histórico del entorno aparece `Prueba BE-11 notificaci�n`; es contenido ya persistido y ajeno a FE-03, no texto generado por esta UI.

## 29. Riesgos pendientes

- El backend aplica primero `createdById = currentUser.id` para USER, pero después permite que `filters.createdById` lo sobrescriba. El frontend elimina ese parámetro para USER, pero un cliente HTTP directo podría intentar explotar esa inconsistencia. Requiere corrección backend separada y revisión de seguridad.
- Los selects de opciones usan el máximo actual de 100; organizaciones con más de 100 usuarios/categorías necesitarán autocomplete/paginación o un endpoint de opciones.
- FE-04 deberá consumir `location.state.from` o permitir volver conservando la query; hoy browser back ya la conserva.

## 30. Backend

No se modificó ningún archivo de `cidrix-api`, Prisma, migraciones, controllers, services, DTOs ni guards. La inspección del backend fue únicamente de lectura. La prueba manual sí insertó tres tickets mediante endpoints existentes.

## 31. Fuera de alcance

No se implementaron detalle completo, timeline, comentarios, adjuntos, edición, cambio de estado, dashboard, notificaciones ni settings. `/tickets/:id` continúa usando el placeholder de FE-04.

## 32. Estado final

La rama queda sin commit ni push, con frontend implementado, pruebas automatizadas y manuales aprobadas, y lista para inspección del diff por el Tech Lead.

FE-03 listo para revisión del Tech Lead y pruebas manuales
