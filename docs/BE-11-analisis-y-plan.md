# CIDRIX API — BE-11: Notificaciones

## Análisis técnico y plan de implementación

Fecha: 30 de agosto de 2026
Repositorio: `C:\Users\Sewas\proyecto`
Backend: `C:\Users\Sewas\proyecto\cidrix-api`
Fuente de verdad inspeccionada: `main`
Commit base: `f950bdecf200807933ddd2bfe278ef8c68887c60`

## 1. Estado inicial del repositorio

Se verificó el estado real antes de analizar BE-11:

- Rama actual: `main`.
- `HEAD`: `f950bdecf200807933ddd2bfe278ef8c68887c60`.
- Último commit: `Merge pull request #4 from
  sewaaaas/feature/be-10-dashboard-metrics`.
- `main` y `origin/main` apuntan exactamente al mismo commit.
- `main...origin/main` devuelve `0 0`; no existe divergencia local/remota.
- BE-10 está integrado y su módulo Dashboard está registrado en `AppModule`.
- No existen cambios locales de código.
- Permanecen sin versionar cuatro documentos de BE-10:
  - `docs/BE-10-analisis-y-plan.md`;
  - `docs/BE-10-analisis-y-plan.txt`;
  - `docs/BE-10-implementation-review.md`;
  - `docs/BE-10-implementation-review.txt`.

El prompt indica crear `feature/be-11-notifications` únicamente si el repositorio
está limpio. Como el working tree no está limpio, aunque solo sea por documentación
conocida, no se creó la rama. La base correcta para crearla sigue siendo
`f950bde`; antes de implementar, el equipo debe conservar/versionar/gestionar esos
documentos y crear la rama desde este `main`.

Durante esta fase no se modificó backend, Prisma, dependencias, Docker ni eventos.
El único entregable nuevo es este documento.

## 2. Rama y commit base

```text
Rama inspeccionada: main
Commit base: f950bdecf200807933ddd2bfe278ef8c68887c60
BE-10 integrado: Sí
main alineado con origin/main: Sí
Rama BE-11 creada: No, por working tree no limpio
Rama prevista: feature/be-11-notifications
```

## 3. Resumen ejecutivo

CIDRIX no tiene actualmente modelo, tabla, módulo, endpoints ni listeners de
notificaciones. Sí tiene una base event-driven suficiente para el MVP:

- `@nestjs/event-emitter@3.1.0` y `eventemitter2@6.4.9` instalados;
- `EventEmitterModule.forRoot()` registrado globalmente;
- contratos y nombres centralizados en `src/integrations/events/event-types.ts`;
- eventos post-commit emitidos desde Tickets y Comments;
- payloads con `organizationId` y `occurredAt`.

Se recomienda implementar notificaciones internas persistidas, personales y
relacionadas obligatoriamente con un ticket. El MVP debe consumir:

- `ticket.created`, solo cuando el ticket nace asignado;
- `ticket.assigned`, solo para una nueva asignación/reasignación real;
- `comment.added`, con política distinta para PUBLIC e INTERNAL;
- `ticket.status.changed`, notificando al creador.

No debe consumir `ticket.first.response` ni `ticket.closed`, porque duplicarían
respectivamente `comment.added` y `ticket.status.changed`.

Se propone una tabla `notifications`, un enum pequeño, dos índices tenant/user, una
migración, un `NotificationsModule` desacoplado mediante listeners y cuatro endpoints
personales. No se requieren dependencias nuevas.

## 4. Infraestructura de eventos existente

`AppModule` registra:

```ts
EventEmitterModule.forRoot({
  wildcard: false,
  delimiter: '.',
  maxListeners: 20,
  verboseMemoryLeak: true,
})
```

Consecuencias:

- el bus es in-process;
- los nombres se comparan de forma exacta (`wildcard: false`);
- productores y consumidores pueden desacoplarse mediante `EVENTS`;
- no existe persistencia, retry, broker ni garantía de entrega tras caída del
  proceso;
- no se encontró ningún `@OnEvent`, listener o módulo consumidor actual.

Los contratos exigen por convención `organizationId` y `occurredAt`. La anotación en
`event-types.ts` que decía que el wiring llegaría en BE-11 quedó desactualizada: el
módulo ya está registrado y Tickets/Comments ya emiten eventos.

## 5. Eventos encontrados

### Eventos realmente emitidos

| Evento | Productor | Payload real relevante | Momento | Cobertura actual |
|---|---|---|---|---|
| `ticket.created` | `TicketsService.create` | ticketId, ticketNumber, priority, categoryId, createdBy, assignedTo, org, occurredAt | Después de la transacción | Sin tests específicos del emisor |
| `ticket.assigned` | `TicketsService.assign` | ticketId, assignedTo, assignedBy, previousAssignee, org, occurredAt | Después de la transacción | Sin tests específicos del emisor |
| `ticket.status.changed` | `TicketsService.updateStatus` | ticketId, from, to, changedBy, org, occurredAt | Después de la transacción | Sin tests específicos del emisor |
| `ticket.closed` | `TicketsService.updateStatus` al cerrar | ticketId, resolvedBy, durationMs, org, occurredAt | Después de la transacción | Sin tests específicos del emisor |
| `comment.added` | `CommentsService.create` | commentId, ticketId, authorId, isInternal, org, occurredAt | Después de la transacción | Emisión indirectamente mockeada; no hay aserción específica del payload |
| `ticket.first.response` | `CommentsService.create` cuando gana el CAS | ticketId, authorId, firstResponseAt, triggerCommentId, org, occurredAt | Después de la transacción | Sí: emisión/no emisión y rollback |

### Eventos declarados pero no emitidos

```text
sla.warning
sla.breached
user.created
user.role.changed
```

No deben utilizarse en BE-11 porque no existe productor real.

### Hallazgo de contrato

`TicketAssignedEvent.assignedTo` está tipado como `string`, pero
`TicketsService.assign()` emite también al desasignar y pasa `string | null`. Como
`EventEmitter2.emit()` no está tipado contra la interfaz, TypeScript no detecta la
divergencia. Para BE-11 debe corregirse el contrato a `string | null`; el listener
ignorará `null`. No hace falta modificar la lógica de Tickets para ello.

### Eventos dentro o después de transacciones

Todos los eventos candidatos se emiten después de que la transacción principal haya
resuelto. Comments tiene además una prueba que demuestra que no emite si la
transacción falla. Por tanto, el diseño actual evita notificaciones fantasma por
rollback.

## 6. Modelo Notification actual

No existe.

No se encontró:

- `model Notification`;
- enum de tipo de notificación;
- tabla/migración;
- relación inversa en Organization/User/Ticket;
- controller, service, repository o listener;
- DTOs o tests de notificaciones.

## 7. Campos e índices actuales

No hay campos ni índices de Notification porque la entidad no existe.

El schema sí ofrece las claves necesarias para relaciones tenant-first:

- `User @@unique([organizationId, id])`;
- `Ticket @@unique([organizationId, id])`.

Esto permite que Notification referencie recipient y ticket usando claves compuestas
y que PostgreSQL impida cruces de tenant.

## 8. Limitaciones del modelo actual

Sin una tabla nueva no es posible:

- persistir una bandeja;
- consultar por usuario;
- contar no leídas;
- marcar una o todas como leídas;
- mantener historial tras reinicio;
- vincular de forma segura recipient, ticket y organización.

Los eventos por sí solos no sustituyen persistencia. Tampoco existe información de
deduplicación como `eventId` o `sourceEventId`.

## 9. Alcance recomendado

BE-11 MVP debe incluir:

1. Persistencia de Notification en PostgreSQL.
2. Generación desde cuatro eventos/escenarios aprobados.
3. Bandeja paginada del usuario autenticado.
4. Filtro opcional `isRead`.
5. Conteo separado de no leídas.
6. Mark read idempotente.
7. Read all idempotente y eficiente.
8. RBAC para ADMIN, TECHNICIAN y USER, siempre sobre su propia bandeja.
9. Relaciones tenant-first y filtros `organizationId + userId` en cada consulta.
10. Contenido textual mínimo, sin comment body ni datos sensibles.

## 10. Fuera de alcance

- Email, WhatsApp, Teams, SMS y push móvil.
- WebSockets y Server-Sent Events.
- Redis, colas, brokers, outbox y retries.
- Preferencias de notificación.
- Digest, cron, cleanup o retention automática.
- Archivar, eliminar o volver a no leída.
- Broadcast a todos los agentes.
- SLA, IA o frontend.
- Metadata libre, iconos, colores o decisiones visuales.
- Reconstrucción histórica a partir de TicketHistory.

## 11. Política de destinatarios

Reglas comunes propuestas:

1. Nunca notificar al actor de su propia acción.
2. Un recipient debe existir en el mismo `organizationId`.
3. Solo generar para recipient `ACTIVE` y `deletedAt = null`.
4. Toda notificación debe relacionarse con un ticket del mismo tenant.
5. No hacer broadcast.
6. No enviar contenido interno a USER.
7. No persistir email, avatar, credenciales ni comment content.
8. Si no existe recipient válido, omitir silenciosamente y registrar debug/warn
   contextual sin datos sensibles.
9. Si el contexto ticket/user no puede resolverse dentro del tenant, fallar cerrado:
   no crear notificación.

## 12. Política por evento

| Evento/condición | Actor | Recipient | No notificar cuando |
|---|---|---|---|
| Ticket creado con assignee | `createdBy` | assignee | sin assignee; actor=assignee; recipient inactivo/eliminado |
| Ticket asignado/reasignado | `assignedBy` | nuevo assignee | desasignación; mismo assignee anterior; actor=nuevo assignee; recipient inválido |
| Comentario PUBLIC de USER | `authorId` | assignee actual | ticket sin assignee; actor=recipient; recipient inválido |
| Comentario PUBLIC de ADMIN/TECHNICIAN | `authorId` | creador del ticket | actor=creador; recipient inválido |
| Comentario INTERNAL | `authorId` | assignee actual | sin assignee; actor=assignee; recipient USER o inválido |
| Cambio de estado | `changedBy` | creador del ticket | actor=creador; recipient inválido |

Los estados notificados son todos los destinos reales posibles:
`IN_PROGRESS`, `PENDING`, `RESOLVED`, `CLOSED` y `CANCELLED`. Cada uno representa un
cambio operacional visible; no se recomienda una allowlist menor en el MVP.

## 13. Comentarios públicos

El listener de `comment.added` debe resolver de forma tenant-aware:

- ticket: número, createdById y assignedToId;
- actor: id y role dentro de la organización;
- recipient: activo, no eliminado y dentro de la organización.

Política:

- USER comenta: notificar al assignee.
- ADMIN/TECHNICIAN comenta: notificar al creador.
- No self-notify.

No se debe incluir el texto del comentario en Notification. Un mensaje genérico como
“Hay un nuevo comentario en TKT-0042” minimiza filtraciones y evita duplicar datos.

## 14. Comentarios internos

USER no puede crear ni leer INTERNAL. La notificación interna nunca debe dirigirse
al creador por defecto, porque habitualmente es USER.

Política recomendada:

- recipient único: assignee actual, solo si es ADMIN/TECHNICIAN activo;
- si quien escribió es el propio assignee, no crear nada;
- no hacer broadcast a otros técnicos;
- usar título/mensaje genérico (“Nueva nota interna en TKT-0042”);
- no persistir contenido ni exponer que existe una nota a USER.

Esta política permite que un ADMIN deje una nota para el agente asignado sin ampliar
la visibilidad del dominio.

## 15. Asignación y reasignación

Hay dos caminos reales:

1. Asignación al crear: solo se emite `ticket.created`; no se emite
   `ticket.assigned` adicional. El listener de created debe usar `assignedTo`.
2. Assign endpoint: se emite `ticket.assigned` después del commit.

Reglas:

- notify al nuevo assignee;
- en A -> B se notifica B, no A;
- en desasignación (`assignedTo = null`) no se notifica;
- A -> A se considera no-op para notificaciones aunque hoy Tickets actualice/emita;
- si ADMIN se asigna a sí mismo, no self-notify;
- no notificar al creador por la asignación.

La supresión A -> A en listener evita ruido sin modificar BE-06.

## 16. Cambios de estado

Consumir `ticket.status.changed`, no `ticket.closed`.

Recipient: creador del ticket, si está activo y no es el actor.

El listener debe resolver el ticket usando `organizationId + ticketId`, obtener su
número y createdById, y construir un snapshot genérico:

```text
El ticket TKT-0042 cambió de PENDING a IN_PROGRESS
```

No hace falta notificar al assignee: el actor TECHNICIAN suele ser el propio
assignee y ADMIN tiene visión general; añadir otro recipient aumentaría ruido.

## 17. First response

No consumir `ticket.first.response` para Notification en BE-11.

La primera respuesta pública ya genera `comment.added`; el recipient y mensaje son
los mismos que para cualquier respuesta pública de agente. Escuchar ambos produciría
dos notificaciones por un único comentario.

El evento se conserva para métricas/integraciones futuras, pero no tendrá listener
de Notification.

## 18. RBAC

Los tres roles necesitan su bandeja personal:

```text
ADMIN
TECHNICIAN
USER
```

Controller propuesto:

```ts
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER)
```

No debe existir `/users/:userId/notifications`. El recipient se toma siempre de
`RequestUser.id`.

## 19. Multi-tenancy

Invariantes:

```text
notification.organizationId == recipient.organizationId
notification.organizationId == ticket.organizationId
```

Protección en tres capas:

1. Listener/service pasa el `organizationId` del evento.
2. Repository filtra y resuelve ticket/usuarios por `organizationId + id`.
3. FKs compuestas de PostgreSQL impiden insertar recipient o ticket de otro tenant.

Lectura/escritura de bandeja siempre usa:

```text
organizationId = currentUser.organizationId
userId = currentUser.id
```

Mark read de ID inexistente, ajeno o de otro tenant debe responder 404 sin distinguir
la causa.

## 20. Endpoints propuestos

```http
GET   /api/v1/notifications
GET   /api/v1/notifications/unread-count
PATCH /api/v1/notifications/:id/read
PATCH /api/v1/notifications/read-all
```

Decisiones:

- `PATCH` es apropiado porque modifica parcialmente `readAt`.
- `unread-count` separado permite polling liviano sin cargar la bandeja.
- `read-all` entra al MVP porque es parte del objetivo funcional y puede resolverse
  con un solo `updateMany`.
- No se implementa mark unread, delete ni archive.

## 21. DTOs y contratos

### NotificationResponseDto

```json
{
  "id": "uuid",
  "type": "TICKET_STATUS_CHANGED",
  "title": "Estado de ticket actualizado",
  "message": "El ticket TKT-0042 cambió de PENDING a IN_PROGRESS",
  "ticketId": "uuid",
  "ticketNumber": "TKT-0042",
  "isRead": false,
  "readAt": null,
  "createdAt": "2026-08-30T15:00:00.000Z"
}
```

`isRead` se deriva; no se persiste.

### Listado

El service sigue el patrón actual y retorna `{ data, meta }`. Con el interceptor
global, la respuesta HTTP efectiva seguirá siendo:

```json
{
  "data": {
    "data": [],
    "meta": {
      "total": 0,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

No se modifica `ResponseInterceptor`.

### Unread count

```json
{ "data": { "count": 3 } }
```

### Read all

```json
{ "data": { "updatedCount": 3 } }
```

Mark read retorna la Notification actualizada; una segunda llamada devuelve el mismo
recurso sin error.

## 22. Paginación y filtros

`NotificationFiltersDto` propuesto:

```text
page?: integer, default 1, min 1
limit?: integer, default 20, min 1, max 100
isRead?: boolean
```

No se propone `unreadOnly` porque duplicaría `isRead=false`. No se propone filtro por
tipo en el MVP: la campana necesita una lista unificada y mantener un único filtro
reduce combinaciones y tests.

Orden fijo:

```text
createdAt DESC
id DESC
```

No se expone `order` al cliente. Categorías, assignees, fechas y texto quedan fuera.

## 23. Read/unread

Fuente única:

```text
readAt == null  -> no leída
readAt != null  -> leída
```

No debe existir columna `isRead` redundante.

Mark read:

- busca por `organizationId + userId + notificationId`;
- 404 si no está en alcance;
- si ya tiene readAt, devuelve el recurso sin modificarlo;
- si está pendiente, establece una fecha UTC;
- dos llamadas concurrentes siguen siendo funcionalmente idempotentes.

Read all usa `updateMany` limitado a `readAt: null`, tenant y usuario. Sin pendientes
retorna `updatedCount: 0`.

## 24. Unread count

Debe ejecutarse como count en PostgreSQL:

```ts
notification.count({
  where: {
    organizationId,
    userId,
    readAt: null,
  },
});
```

Nunca cargar notificaciones en memoria para contar.

## 25. Arquitectura Controller/Service/Repository

```text
NotificationsController
  -> NotificationsService
     -> NotificationsRepository
        -> Prisma
```

Controller:

- guards, roles, CurrentUser, DTOs y ParseUUIDPipe;
- sin Prisma ni lógica de destinatarios.

Service:

- operaciones de bandeja;
- política por evento;
- no self-notify;
- construcción de título/mensaje;
- mapeo seguro del response.

Repository:

- consultas tenant + user;
- group context de ticket/actor/recipient;
- creación;
- count;
- mark read;
- updateMany read-all;
- selects mínimos.

Repository Pattern está justificado por la cantidad de filtros de seguridad y por
compartir persistencia entre HTTP y listeners.

## 26. Arquitectura de listeners/eventos

```text
TicketsService / CommentsService
  -> EventEmitter2
     -> NotificationEventsListener
        -> NotificationsService
           -> NotificationsRepository
```

Se recomienda un listener único con métodos `@OnEvent` para:

- `EVENTS.TICKET_CREATED`;
- `EVENTS.TICKET_ASSIGNED`;
- `EVENTS.TICKET_STATUS_CHANGED`;
- `EVENTS.COMMENT_ADDED`.

El listener debe ser delgado y delegar cada payload tipado al service. No debe
importarse NotificationsModule desde Tickets/Comments; AppModule registra todos los
módulos y EventEmitter rompe el ciclo.

Contratos y nombres continúan en `src/integrations/events/event-types.ts`. No crear
magic strings paralelos.

## 27. Consistencia transaccional

Los seis eventos actuales se emiten post-commit. Esto evita:

```text
emit antes de commit -> rollback -> notificación fantasma
```

La notificación se crea en una transacción separada después de la operación principal.
No hay atomicidad entre ticket/comment y Notification; una caída entre ambos puede
perder la notificación.

Para el MVP se acepta esta consistencia best-effort. Outbox, broker y transacción
distribuida quedan fuera por complejidad y por decisión explícita del alcance.

## 28. Política ante fallo del listener

La versión instalada de `@nestjs/event-emitter` envuelve listeners y, por defecto,
usa `suppressErrors: true`: captura/reporta el error. Además los productores llaman
`emit()`, no `emitAsync()`, y no esperan al listener async.

Recomendación explícita:

```ts
@OnEvent(EVENTS.COMMENT_ADDED, { suppressErrors: true })
```

Si la notificación falla:

- la operación principal ya confirmada no se revierte;
- el request original sigue siendo exitoso;
- se registra error con event name, organizationId y ticketId, sin contenido
  sensible;
- la notificación puede perderse;
- no hay retry en BE-11.

No se recomienda hacer fallar ticket/comment por una funcionalidad secundaria.

## 29. Prevención de duplicados

No se propone unique/dedupe key porque los eventos actuales no tienen eventId y dos
comentarios o transiciones iguales pueden ser legítimos.

Prevención semántica suficiente para el MVP:

- created con assignee se maneja solo desde `ticket.created`;
- `ticket.assigned` no se emite al crear actualmente;
- ignorar assign si nuevo == anterior;
- ignorar desasignación;
- no escuchar `ticket.first.response`;
- no escuchar `ticket.closed`;
- no self-notify.

Si en el futuro se agregan retries/outbox, será necesario un `sourceEventId` único.

## 30. Seguridad y privacidad

- No aceptar organizationId/userId del cliente.
- No devolver recipientId ni organizationId.
- No persistir/retornar email, avatar o credenciales.
- No incluir body de comentarios.
- No incluir título/descripción del ticket; el número inmutable basta.
- INTERNAL solo genera para agente asignado autorizado.
- Relaciones y lookups son tenant-first.
- 404 uniforme para notificación ajena/inexistente.
- La relación viva al ticket permite navegación; title/message son snapshots
  inmutables del evento.
- Si el ticket/recipient no puede resolverse dentro del tenant, no crear.

## 31. Performance

Consultas dominantes:

```sql
WHERE organization_id = ? AND user_id = ?
ORDER BY created_at DESC, id DESC
```

```sql
WHERE organization_id = ? AND user_id = ? AND read_at IS NULL
```

La bandeja está paginada a máximo 100. Unread usa `count`; read-all usa `updateMany`.
No se requiere caché, raw SQL, Redis ni materialización.

PostgreSQL puede recorrer un B-tree ascendente en sentido inverso, por lo que no es
necesario declarar índices DESC específicos para el MVP.

## 32. Índices

Se recomiendan dos índices en la tabla nueva:

```prisma
@@index([organizationId, userId, createdAt, id],
  name: "idx_notifications_org_user_created")

@@index([organizationId, userId, readAt, createdAt, id],
  name: "idx_notifications_org_user_read_created")
```

El primero cubre listado general. El segundo cubre unread count/listado filtrado y
read-all. No se recomienda índice por ticketId ni type porque el MVP no consulta por
ellos. Tampoco partial index raw sin evidencia.

## 33. Necesidad de migración y modelo recomendado

Migración requerida: **Sí**.

Modelo propuesto para aprobación:

```prisma
enum NotificationType {
  TICKET_ASSIGNED
  TICKET_STATUS_CHANGED
  COMMENT_ADDED
}

model Notification {
  id             String           @id @default(uuid())
  organizationId String           @map("organization_id")
  userId         String           @map("user_id")
  ticketId       String           @map("ticket_id")
  type           NotificationType
  title          String           @db.VarChar(160)
  message        String           @db.VarChar(500)
  readAt         DateTime?        @map("read_at")
  createdAt      DateTime         @default(now()) @map("created_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  recipient    User         @relation("NotificationRecipient", fields: [organizationId, userId], references: [organizationId, id], onDelete: Restrict)
  ticket       Ticket       @relation(fields: [organizationId, ticketId], references: [organizationId, id], onDelete: Restrict)

  @@index([organizationId, userId, createdAt, id], name: "idx_notifications_org_user_created")
  @@index([organizationId, userId, readAt, createdAt, id], name: "idx_notifications_org_user_read_created")
  @@map("notifications")
}
```

Relaciones inversas necesarias:

```text
Organization.notifications
User.notificationsReceived @relation("NotificationRecipient")
Ticket.notifications
```

Decisiones de diseño:

- ticketId obligatorio: todos los tipos MVP son de ticket.
- Sin `isRead`: derivado de readAt.
- Sin updatedAt: solo cambia readAt y ya conserva su timestamp.
- Sin soft delete/archive en MVP.
- Sin actorId: solo se usa durante recipient policy y no hace falta exponerlo.
- Sin metadata JSON: evita payload arbitrario y redundancia.
- title/message se almacenan como snapshots; ticketNumber se resuelve de la relación
  viva porque Ticket.number es inmutable.
- Sin unique de deduplicación porque no existe eventId.

La migración debe crear enum, tabla, FKs compuestas e índices. No debe modificar datos
existentes ni crear notificaciones retroactivas.

## 34. Archivos a crear

```text
cidrix-api/src/modules/notifications/
├── __tests__/
│   ├── notification-filters.dto.spec.ts
│   ├── notifications.controller.spec.ts
│   ├── notifications.repository.spec.ts
│   ├── notifications.service.spec.ts
│   └── notification-events.listener.spec.ts
├── dto/
│   ├── notification-filters.dto.ts
│   └── notification-response.dto.ts
├── listeners/
│   └── notification-events.listener.ts
├── notifications.controller.ts
├── notifications.module.ts
├── notifications.repository.ts
└── notifications.service.ts

cidrix-api/prisma/migrations/<timestamp>_add_notifications/migration.sql
```

## 35. Archivos a modificar

```text
cidrix-api/prisma/schema.prisma
cidrix-api/src/app/app.module.ts
cidrix-api/src/integrations/events/event-types.ts
```

Cambios previstos:

- schema: enum/model/relaciones inversas;
- AppModule: registrar NotificationsModule;
- event-types: hacer nullable `TicketAssignedEvent.assignedTo` para reflejar el
  payload real.

No se prevé modificar TicketsService, CommentsService, Auth, Users, Attachments,
Timeline o Dashboard.

## 36. Estrategia de tests

### DTO

- defaults page 1/limit 20;
- límites 1..100;
- transformación numérica;
- `isRead=true/false` estrictos;
- valores booleanos inválidos;
- propiedades desconocidas con ValidationPipe.

### Repository

- listado filtra organizationId + userId;
- filtro readAt derivado de isRead;
- orden createdAt DESC + id DESC;
- paginación y count con mismo where;
- unread count en DB;
- find/mark filtra tenant + user + id;
- read-all updateMany tenant + user + readAt null;
- creación usa organizationId, recipient y ticket correctos;
- contexto ticket/actor/recipient siempre tenant-aware;
- select no expone campos sensibles.

### Service HTTP

- usuario sin notificaciones;
- paginación/meta;
- map isRead/ticketNumber;
- mark read;
- mark read dos veces;
- notificación ajena y tenant ajeno -> 404;
- read-all con/sin pendientes;
- unread count sin cargar filas.

### Listener/política

- assignment al crear;
- ticket creado sin assignee;
- asignación y A -> B;
- A -> A y desasignación;
- no self-notify;
- USER public -> assignee;
- agent public -> creator;
- INTERNAL -> assignee agente, nunca USER;
- ticket sin assignee;
- todos los status destino;
- recipient inactive/deleted;
- context de otro tenant no crea;
- first response no tiene listener;
- closed no tiene listener;
- fallo de service bajo `suppressErrors` no afecta productor en prueba de integración
  del evento cuando sea viable.

### Controller

- ADMIN/TECHNICIAN/USER permitidos;
- sin JWT 401;
- endpoints solo usan CurrentUser;
- UUID inválido 400;
- delegación y envelope global cuando el harness lo permita.

No crear un nuevo stack e2e PostgreSQL si el proyecto todavía no lo ofrece; priorizar
unit tests exhaustivos y añadir e2e tenant real cuando exista infraestructura común.

## 37. Casos límite

| Caso | Comportamiento recomendado |
|---|---|
| Usuario sin notificaciones | Lista vacía, meta coherente, unread 0 |
| Cientos de notificaciones | Paginación, máximo 100, índices |
| Ticket sin assignee | No notification de created/comment USER/internal |
| Assign A -> A | No notification |
| Reassign A -> B | Solo B |
| Unassign | Ninguna |
| Actor = recipient | Ninguna |
| Recipient inactive/deleted | Ninguna nueva; históricas permanecen |
| PUBLIC de USER | Assignee activo |
| PUBLIC de ADMIN/TECH | Creador activo |
| INTERNAL | Solo assignee agente; nunca USER |
| RESOLVED/CLOSED/CANCELLED | Notificar al creador mediante status.changed |
| Mark read dos veces | Éxito idempotente, mismo readAt lógico |
| Read-all sin pendientes | updatedCount 0 |
| Notificación otro tenant/usuario | 404 al acceder por id; no aparece en lista |
| Ticket inexistente/ajeno en evento | Fail-closed, no crear |
| Evento semánticamente duplicado | Reglas de supresión; sin unique artificial |
| Listener falla | Log, operación principal no revierte, posible pérdida |
| Organización sin actividad | Sin filas, count 0 |

## 38. Riesgos

1. Entrega best-effort: una caída o error puede perder la notificación.
2. No hay retry ni outbox; es una decisión consciente del MVP.
3. Payload `ticket.assigned` tiene hoy una discrepancia nullable que debe corregirse
   en el contrato.
4. Los productores de Tickets no tienen unit tests específicos de eventos.
5. El JWT no revalida status del usuario en cada request; un token de un usuario
   recién desactivado puede vivir hasta expirar. Es deuda transversal, no BE-11.
6. Sin política de retention, la tabla crecerá indefinidamente; aceptable para MVP.
7. Titles/messages persistidos no tienen i18n; el producto actual opera en español.
8. No existe eventId; deduplicación fuerte no es posible sin ampliar contratos.

## 39. Deuda técnica

- Outbox/retry para entrega durable.
- Retention/archive de notificaciones antiguas.
- Preferencias por tipo/canal.
- Realtime mediante WebSocket/SSE.
- Internacionalización de mensajes.
- sourceEventId/dedupe key si aparecen reintentos.
- e2e con dos tenants sobre PostgreSQL real.
- Revalidación global de usuario activo para JWT.
- Tipado estricto entre `EVENTS` y payloads de `emit()`.

Nada de esta deuda debe incorporarse silenciosamente en BE-11 MVP.

## 40. Decisiones pendientes de aprobación del Tech Lead

1. Aprobar tipos: `TICKET_ASSIGNED`, `TICKET_STATUS_CHANGED`, `COMMENT_ADDED`.
2. Aprobar eventos consumidos: created con assignment, assigned, comment.added y
   status.changed.
3. Aprobar ignorar first.response y ticket.closed para evitar duplicados.
4. Aprobar la matriz exacta de recipients y regla no self-notify.
5. Aprobar INTERNAL solo para assignee ADMIN/TECHNICIAN.
6. Aprobar notificar al creador en todos los cambios de estado reales.
7. Aprobar RBAC de bandeja personal para los tres roles.
8. Aprobar cuatro endpoints, incluido unread-count separado y read-all.
9. Aprobar filtro MVP único `isRead`, sin type/unreadOnly/order.
10. Aprobar modelo sin actorId, metadata, isRead, updatedAt ni soft delete.
11. Aprobar title/message snapshot y ticketNumber resuelto desde Ticket.
12. Aprobar migración y dos índices propuestos.
13. Aprobar `TicketAssignedEvent.assignedTo: string | null`.
14. Aprobar política best-effort con `suppressErrors: true`, sin rollback/retry.
15. Aprobar deduplicación semántica sin unique/sourceEventId.
16. Decidir cómo gestionar los cuatro documentos BE-10 sin versionar antes de crear
    la rama BE-11.

## 41. Plan de implementación

1. Gestionar los documentos BE-10 pendientes y crear
   `feature/be-11-notifications` desde `f950bde` (o el main vigente aprobado).
2. Congelar las decisiones de la sección 40.
3. Añadir NotificationType, Notification, relaciones e índices a schema.prisma.
4. Generar/revisar una única migración `add_notifications`; no hacer backfill.
5. Corregir la nulabilidad del contrato TicketAssignedEvent.
6. Crear DTOs y contratos de respuesta.
7. Crear NotificationsRepository con filtros tenant + user en todos los métodos.
8. Crear NotificationsService para bandeja/read y políticas de generación.
9. Crear NotificationEventsListener con cuatro eventos y suppressErrors explícito.
10. Crear NotificationsController con JWT/RBAC para los tres roles y UUID pipe.
11. Crear NotificationsModule y registrarlo en AppModule.
12. Añadir tests DTO, repository, service, listener y controller.
13. Ejecutar Prisma format/validate/generate según corresponda, tests completos,
    lint sin autofix, build y `git diff --check`.
14. Revisar migración y diff: tenant filters, privacidad, no duplicados y alcance.
15. Generar informe de implementación y detenerse para revisión, sin commit ni push.

## Conclusión

BE-11 requiere persistencia nueva, pero puede implementarse con la infraestructura
event-driven ya existente y sin acoplar Notifications a Tickets/Comments. El diseño
propuesto mantiene el MVP pequeño: cuatro eventos/escenarios, tres tipos, cuatro
endpoints personales, readAt como única fuente y entrega best-effort post-commit.

Estado: **LISTO PARA REVISIÓN**.
