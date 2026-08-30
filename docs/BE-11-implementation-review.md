# CIDRIX API — BE-11: Implementation Review

Fecha: 30 de agosto de 2026  
Estado: **LISTO PARA REVISIÓN DEL TECH LEAD**

## 1. Estado inicial

- `main` contenía BE-10 y apuntaba al commit aprobado.
- `main` y `origin/main` estaban alineados.
- No existían cambios locales de código.
- Se conservaron sin editar ni incluir los cuatro documentos históricos de BE-10.
- `docs/BE-11-analisis-y-plan.md` también estaba sin versionar y se conservó como
  documento base aprobado.

## 2. Rama

```text
feature/be-11-notifications
```

La rama se creó desde el `main` vigente antes del primer cambio de código.

## 3. Commit base

```text
f950bdecf200807933ddd2bfe278ef8c68887c60
```

Commit: `Merge pull request #4 from sewaaaas/feature/be-10-dashboard-metrics`.

## 4. Archivos creados

```text
cidrix-api/prisma/migrations/20260830000000_add_notifications/migration.sql
cidrix-api/src/modules/notifications/__tests__/notification-events.listener.spec.ts
cidrix-api/src/modules/notifications/__tests__/notification-filters.dto.spec.ts
cidrix-api/src/modules/notifications/__tests__/notifications.controller.spec.ts
cidrix-api/src/modules/notifications/__tests__/notifications.repository.spec.ts
cidrix-api/src/modules/notifications/__tests__/notifications.service.spec.ts
cidrix-api/src/modules/notifications/dto/notification-filters.dto.ts
cidrix-api/src/modules/notifications/dto/notification-response.dto.ts
cidrix-api/src/modules/notifications/listeners/notification-events.listener.ts
cidrix-api/src/modules/notifications/notifications.controller.ts
cidrix-api/src/modules/notifications/notifications.module.ts
cidrix-api/src/modules/notifications/notifications.repository.ts
cidrix-api/src/modules/notifications/notifications.service.ts
docs/BE-11-implementation-review.md
```

No se generó ningún reporte `.txt`.

## 5. Archivos modificados

```text
cidrix-api/prisma/schema.prisma
cidrix-api/src/app/app.module.ts
cidrix-api/src/integrations/events/event-types.ts
```

No se modificaron TicketsService, CommentsService, Auth, Users, Dashboard,
Attachments, Timeline ni frontend.

## 6. Schema final

Se añadió exactamente el enum aprobado:

```prisma
enum NotificationType {
  TICKET_ASSIGNED
  TICKET_STATUS_CHANGED
  COMMENT_ADDED
}
```

`Notification` contiene únicamente:

```text
id
organizationId
userId
ticketId
type
title
message
readAt
createdAt
```

También se añadieron las relaciones inversas en `Organization`, `User` y `Ticket`.
No existen `isRead`, `updatedAt`, soft delete, archive, actorId, metadata ni
sourceEventId.

## 7. Migración final

Migración única:

```text
20260830000000_add_notifications
```

Crea:

- enum PostgreSQL `NotificationType`;
- tabla `notifications`;
- primary key;
- FK a Organization;
- FK compuesta tenant-first a User;
- FK compuesta tenant-first a Ticket;
- los dos índices aprobados.

No contiene reset, delete, backfill ni notificaciones retroactivas.

## 8. Índices

```text
idx_notifications_org_user_created
  (organization_id, user_id, created_at, id)

idx_notifications_org_user_read_created
  (organization_id, user_id, read_at, created_at, id)
```

No se añadieron índices por `ticketId`, `type` o actor.

## 9. Contrato de evento corregido

Se corrigió únicamente la nulabilidad real de desasignación:

```ts
TicketAssignedEvent.assignedTo: string | null
```

No se modificó la lógica productora de Tickets.

## 10. Arquitectura

```text
TicketsService / CommentsService
  -> EventEmitter2
     -> NotificationEventsListener
        -> NotificationsService
           -> NotificationsRepository
              -> Prisma / PostgreSQL
```

Los productores continúan desacoplados. Notifications no se inyectó en Tickets ni
Comments.

## 11. Eventos escuchados

```text
ticket.created
ticket.assigned
ticket.status.changed
comment.added
```

Todos usan constantes de `EVENTS` y `suppressErrors: true`.

## 12. Eventos ignorados

No existen listeners de Notification para:

```text
ticket.first.response
ticket.closed
sla.warning
sla.breached
user.created
user.role.changed
```

Esto evita la duplicación first-response/comment y closed/status-changed.

## 13. Recipient matrix final

| Escenario | Recipient | Supresiones principales |
|---|---|---|
| Ticket creado asignado | nuevo assignee | sin assignee, self, recipient inválido |
| Ticket asignado A -> B | B | A -> A, A -> null, self |
| Comentario PUBLIC de USER | assignee actual | sin assignee, self, recipient inválido |
| Comentario PUBLIC de ADMIN/TECHNICIAN | creator | self, recipient inválido |
| Comentario INTERNAL | assignee agente | sin assignee, USER, self, recipient inválido |
| Cambio de estado | creator | self, recipient inválido, estado no aprobado |

## 14. Política INTERNAL

- Recipient único: assignee actual.
- Solo se crea si el assignee es ADMIN o TECHNICIAN.
- El recipient debe estar ACTIVE y no eliminado.
- Nunca se envía a USER.
- No hay broadcast.
- No se persiste el body del comentario.
- Título y mensaje son genéricos.

## 15. Política self-notify

Todas las rutas de creación comparan actor y recipient antes de persistir. Se
suprimen asignaciones propias, comentarios propios al recipient y cambios de estado
realizados por el creator.

## 16. Multi-tenancy

La protección existe en tres niveles:

1. HTTP obtiene `organizationId` y `userId` exclusivamente de `CurrentUser`.
2. Repository filtra la bandeja con `organizationId + userId`, y los contextos con
   `organizationId + id`.
3. PostgreSQL impide recipient o ticket cross-tenant mediante FKs compuestas.

Mark read usa `organizationId + userId + id`. Read-all y unread count usan
`organizationId + userId`. No existe endpoint para consultar una bandeja arbitraria.

## 17. RBAC

Los endpoints permiten exclusivamente la bandeja personal de:

```text
ADMIN
TECHNICIAN
USER
```

Se aplicaron `JwtAuthGuard`, `RolesGuard` y `@Roles(...)` a nivel de controller.

## 18. Endpoints

```http
GET   /api/v1/notifications
GET   /api/v1/notifications/unread-count
PATCH /api/v1/notifications/:id/read
PATCH /api/v1/notifications/read-all
```

No se añadieron mark unread, delete, archive ni preferences.

## 19. DTO y filtros

`NotificationFiltersDto` admite únicamente:

```text
page?: integer >= 1, default 1
limit?: integer 1..100, default 20
isRead?: boolean estricto
```

`isRead=true` e `isRead=false` se transforman correctamente. Valores como `yes`,
`1`, `TRUE`, cadena vacía o números son rechazados. Las propiedades desconocidas se
rechazan bajo la configuración del ValidationPipe global.

Orden fijo: `createdAt DESC, id DESC`.

## 20. Read/unread

`readAt` es la única fuente de verdad. `isRead` se deriva como `readAt !== null`.
Mark read:

- usa UUID v4;
- devuelve 404 uniforme si el recurso no pertenece al tenant/usuario;
- no modifica un `readAt` existente;
- usa `updateMany` condicionado por `readAt: null` para preservar idempotencia ante
  concurrencia.

## 21. Unread count

Se ejecuta mediante `notification.count` con:

```text
organizationId
userId
readAt = null
```

No carga la bandeja en memoria.

## 22. Read-all

Usa una sola operación `updateMany` con tenant, usuario y `readAt: null`. Devuelve
`updatedCount`, incluyendo cero cuando no hay pendientes.

## 23. Política best-effort

Los cuatro decorators declaran `suppressErrors: true`. El listener además captura y
registra fallos con datos contextuales seguros:

```text
event name
organizationId
ticketId
error técnico
```

El error no se propaga al productor. No hay retry, outbox ni broker; una notificación
puede perderse tras el commit de la operación principal.

## 24. Duplicados

La prevención es semántica:

- created cubre la asignación inicial;
- assigned cubre cambios posteriores;
- A -> A se ignora;
- desasignación se ignora;
- self-notify se ignora;
- no hay listener de first response;
- no hay listener de ticket.closed.

No se agregó unique artificial, sourceEventId ni dedupe key.

## 25. Seguridad y privacidad

- Los response selects no incluyen `organizationId` ni `userId`.
- No se seleccionan objetos completos de recipient, organization o ticket.
- Del ticket solo se selecciona `number` para generar `ticketNumber`.
- No se persiste ni retorna comment body, descripción del ticket, email, avatar o
  metadata arbitraria.
- Recipient debe ser ACTIVE, `deletedAt = null` y pertenecer al mismo tenant.
- Un ticket/contexto no resoluble dentro del tenant produce fail-closed.
- No hay broadcast.

## 26. Tests añadidos

Se añadieron cinco suites:

```text
notification-filters.dto.spec.ts
notifications.controller.spec.ts
notifications.repository.spec.ts
notifications.service.spec.ts
notification-events.listener.spec.ts
```

Cubren DTO estricto, paginación, select mínimo, filtros tenant/user, read/unread,
idempotencia, RBAC, UUID, matriz de recipients, INTERNAL, todos los estados
aprobados, recipients inválidos, contexto cross-tenant, duplicados y fallo del
listener.

## 27. Resultado completo de tests

Comando final:

```text
npm test -- --runInBand
```

Resultado:

```text
Test Suites: 18 passed, 18 total
Tests:       224 passed, 224 total
Snapshots:   0 total
```

Suite aislada BE-11:

```text
Test Suites: 5 passed, 5 total
Tests:       74 passed, 74 total
```

## 28. Build

Comando:

```text
npm run build
```

Resultado: **PASS**.

## 29. Prisma validate/generate

```text
npx prisma format    PASS
npx prisma validate  PASS
npx prisma generate  PASS (ejecución final estándar)
```

En el primer intento, `prisma generate` encontró un `EPERM` temporal al renombrar
`query_engine-windows.dll.node`, aparentemente bloqueado por otro proceso de
Windows. Se generaron primero los tipos con `--no-engine`; al reintentar al final,
la generación estándar completó correctamente.

## 30. Estado y aplicación de migración

Antes de aplicar, `prisma migrate status` reportó únicamente
`20260830000000_add_notifications` como pendiente, sin drift ni solicitud de reset.

Se ejecutó:

```text
npx prisma migrate deploy
```

Resultado: **APLICADA** correctamente sobre la base local `cidrix_db`. La validación
final reportó: `Database schema is up to date!`.

## 31. Lint

Lint del alcance BE-11, sin autofix:

```text
npx eslint "src/modules/notifications/**/*.ts" \
  "src/app/app.module.ts" \
  "src/integrations/events/event-types.ts"
```

Resultado: **PASS**, exit code 0, sin errores ni warnings.

Lint global sin autofix:

```text
npx eslint "{src,apps,libs,test}/**/*.ts"
```

Resultado: **FAIL por deuda preexistente fuera de BE-11**:

```text
218 problems (212 errors, 6 warnings)
197 errors and 6 warnings potentially fixable with --fix
```

Predominan diferencias históricas de Prettier/CRLF y algunos hallazgos tipados en
módulos ajenos. No se ejecutó `--fix` global para no modificar archivos fuera del
alcance. Los archivos tocados por BE-11 sí pasan el lint.

## 32. git diff --check

Resultado: **PASS**, exit code 0.

Git informa que tres archivos tracked con LF serán convertidos a CRLF cuando Git los
vuelva a tocar; no es un error de whitespace del diff.

## 33. git status

Estado al preparar este informe:

```text
Rama: feature/be-11-notifications
Tracked modificados: schema.prisma, app.module.ts, event-types.ts
Untracked BE-11: migración, módulo Notifications e informe
Untracked preservados: documentos BE-10 y análisis BE-11
```

No se hizo stage, commit, push, PR ni merge.

## 34. Warnings

1. El lint global del repositorio no está limpio por deuda previa; BE-11 sí lo está.
2. La generación inicial de Prisma sufrió un file lock temporal de Windows; el
   reintento estándar pasó.
3. Git muestra avisos de futura normalización LF -> CRLF en tres archivos tracked.
4. La infraestructura continúa siendo best-effort in-process y puede perder una
   notificación entre el commit y su persistencia.

## 35. Desviaciones del plan

- No hubo desviaciones funcionales.
- Se usó `prisma migrate deploy` para aplicar de forma no interactiva la migración
  previamente creada y revisada. `migrate status` había confirmado que era la única
  pendiente y que no existía drift.
- Para una lista vacía, `totalPages` es `0` mediante `Math.ceil(0 / limit)`, según la
  decisión explícita del prompt de implementación.

## 36. Riesgos y deuda técnica

- Sin outbox/retry no hay entrega durable.
- Sin sourceEventId no hay deduplicación fuerte ante futuros retries.
- No existe retention/archive; la tabla crecerá indefinidamente.
- No hay realtime, preferencias ni i18n en el MVP.
- El JWT no revalida globalmente el estado ACTIVE en cada request; es deuda
  transversal preexistente.
- Queda pendiente sanear el lint global en una tarea transversal separada.

## 37. Lista exacta del diff BE-11

Modificados:

```text
cidrix-api/prisma/schema.prisma
cidrix-api/src/app/app.module.ts
cidrix-api/src/integrations/events/event-types.ts
```

Creados:

```text
cidrix-api/prisma/migrations/20260830000000_add_notifications/migration.sql
cidrix-api/src/modules/notifications/__tests__/notification-events.listener.spec.ts
cidrix-api/src/modules/notifications/__tests__/notification-filters.dto.spec.ts
cidrix-api/src/modules/notifications/__tests__/notifications.controller.spec.ts
cidrix-api/src/modules/notifications/__tests__/notifications.repository.spec.ts
cidrix-api/src/modules/notifications/__tests__/notifications.service.spec.ts
cidrix-api/src/modules/notifications/dto/notification-filters.dto.ts
cidrix-api/src/modules/notifications/dto/notification-response.dto.ts
cidrix-api/src/modules/notifications/listeners/notification-events.listener.ts
cidrix-api/src/modules/notifications/notifications.controller.ts
cidrix-api/src/modules/notifications/notifications.module.ts
cidrix-api/src/modules/notifications/notifications.repository.ts
cidrix-api/src/modules/notifications/notifications.service.ts
docs/BE-11-implementation-review.md
```

Dependencias nuevas: **No**.

## 38. Estado final

```text
Modelo Notification: CREADO
Migración: CREADA Y APLICADA
Endpoints: 4/4
Listeners aprobados: 4/4
Tests: 224/224 passing
Build: PASS
Prisma validate: PASS
Prisma generate: PASS
Lint BE-11: PASS
git diff --check: PASS
Commit/push: NO
Estado: LISTO PARA REVISIÓN
```
