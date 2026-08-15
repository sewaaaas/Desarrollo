# CIDRIX — BE-09 Attachments

## Análisis técnico y plan de implementación

Fecha: 8 de agosto de 2026  
Repositorio: `C:\Users\Sewas\proyecto`  
Backend: `C:\Users\Sewas\proyecto\cidrix-api`  
Rama usada como fuente de verdad: `main`  
Commit inspeccionado: `e609c2b092466c11c2b0dc724900f506c1af14c6`

## Alcance de esta entrega

Este documento contiene únicamente análisis y planificación. No se implementó
BE-09, no se modificó código del backend, no se creó ninguna migración y no se hizo
commit ni push.

El checkout actual se llama `feature/be-09-attachments`, pero `HEAD`, `main` y
`origin/main` apuntan exactamente al mismo commit `e609c2b`. El worktree estaba
limpio antes de crear este informe, por lo que el código analizado coincide con el
`main` actual.

## Resumen ejecutivo

CIDRIX no tiene todavía soporte funcional ni persistencia para adjuntos. Sí existen
dos variables preparatorias (`STORAGE_DRIVER` y `STORAGE_LOCAL_PATH`) y una carpeta
vacía `src/modules/attachments`, pero no hay modelo Prisma, módulo NestJS, provider
de almacenamiento, endpoints, rutas estáticas, uploads en disco ni pruebas de
archivos.

La recomendación para el MVP es:

- Guardar únicamente metadata en PostgreSQL.
- Guardar los binarios en filesystem local detrás de una interfaz de storage.
- Usar un volumen persistente cuando la API se ejecute en Docker.
- No servir `/uploads` como contenido estático.
- Descargar siempre mediante un endpoint autenticado y tenant-aware.
- Hacer que todo Attachment pertenezca obligatoriamente a un Ticket y,
  opcionalmente, a un Comment del mismo ticket y organización.
- Persistir visibilidad `PUBLIC` o `INTERNAL` en Attachment.
- Aplicar las reglas actuales de lectura y escritura de tickets/comentarios.
- Usar nombres físicos opacos generados por el servidor y no derivados de
  `originalName`.
- Aplicar validación conjunta de tamaño, extensión, MIME declarado y firma real.

No es recomendable almacenar los binarios en PostgreSQL ni exponer directamente el
filesystem por HTTP.

## Estado actual encontrado

### Stack verificado

- Node.js 24.
- NestJS 11.
- TypeScript 5.8.
- PostgreSQL 16 en Docker.
- Prisma CLI y Client 6.19.3.
- Express mediante `@nestjs/platform-express`.
- JWT, EventEmitter2, class-validator y class-transformer.

No se requiere actualizar el stack.

### Baseline de pruebas

Se ejecutó:

```text
npm.cmd test -- --runInBand
```

Resultado:

- 4 suites aprobadas de 4.
- 46 pruebas aprobadas de 46.
- 0 snapshots.

### Attachments/uploads existentes

Se encontró:

- `src/modules/attachments/`: directorio vacío, sin archivos.
- `STORAGE_DRIVER=local` en `.env.example` y `.env`.
- `STORAGE_LOCAL_PATH=./uploads` en `.env.example` y `.env`.
- Validación Joi que acepta `STORAGE_DRIVER` con valores `local` o `s3`.

No se encontró:

- Modelo `Attachment`.
- Enum de visibilidad o estado de adjuntos.
- Migración de attachments.
- Controller, service, repository o DTOs.
- Provider de filesystem o S3.
- Directorio `uploads` existente.
- Exclusión de `/uploads` en `.gitignore`.
- `ServeStaticModule`, `express.static`, `useStaticAssets` o rutas estáticas.
- Interceptors de upload/download.
- Validadores MIME o de firmas de archivo.
- Eventos de attachment.
- Tests relacionados con archivos.

### Multer y multipart

`multer` no es una dependencia directa de CIDRIX. Está presente de forma transitiva
y soportada por:

```text
@nestjs/platform-express@11.1.28
└── multer@2.2.0
```

No está instalado `@types/multer`.

Para el MVP se puede usar `FileInterceptor` de `@nestjs/platform-express` sin
importar `multer` directamente y definir una interfaz interna mínima para el archivo
recibido. Así no hace falta añadir dependencias. Si el equipo prefiere usar
`Express.Multer.File`, deberá aprobar `@types/multer` como dependencia de desarrollo.

### Configuración actual

`app.config.ts` valida `STORAGE_DRIVER` y `STORAGE_LOCAL_PATH`, pero no los incluye
en la función `appConfig()` ni en `AppConfig`. En consecuencia, hoy las variables
son aceptadas por Joi pero no existe un objeto de configuración inyectable que las
exponga a un servicio.

Se recomienda crear una configuración separada `storage` y registrarla en
`ConfigModule`.

### Docker actual

`docker-compose.yml` contiene exclusivamente PostgreSQL y el volumen
`cidrix_postgres_data`. No existe:

- Servicio Docker para `cidrix-api`.
- `Dockerfile` de la API.
- Volumen de uploads montado en un contenedor API.

Mientras la API se ejecute directamente en el host, `./uploads` será un directorio
local del proyecto. No tiene sentido declarar un volumen Docker sin un servicio API
que pueda montarlo.

### Arquitectura actual de services/repositories

- `TicketsService`, `UsersService` y `CategoriesService` usan `PrismaService`
  directamente.
- `CommentsService` usa `CommentsRepository` porque su escritura requiere una
  transacción y `SELECT ... FOR UPDATE`.
- `TicketTimelineService` usa `TicketsService.findOne()` para autorización de
  lectura y Prisma para la proyección combinada.
- `DatabaseModule` es global y expone una sola instancia de `PrismaService`.

Attachments combina reglas de negocio, base de datos y un recurso externo
(filesystem). Se recomienda separar:

- Controller HTTP/multipart.
- Service de negocio y orquestación.
- Repository de persistencia y locks.
- Interfaz/provider de almacenamiento.
- Validador de contenido de archivos.

## Reglas existentes que BE-09 debe conservar

### Lectura de tickets

`TicketsService.findOne()` implementa:

- Siempre consulta por `id + organizationId`.
- `USER` solo puede leer tickets creados por él.
- `TECHNICIAN` puede leer cualquier ticket de su organización, aunque no esté
  asignado.
- `ADMIN` puede leer cualquier ticket de su organización.

Listar y descargar adjuntos debe reutilizar este pipeline.

### Escritura sobre tickets

El patrón de Comments es la referencia más cercana:

- `USER`: solo su propio ticket.
- `TECHNICIAN`: solo tickets asignados directamente a él.
- `ADMIN`: cualquier ticket de su organización.
- No se permite escribir en tickets `CLOSED` o `CANCELLED`.
- La comprobación de escritura se repite dentro de una transacción con lock sobre
  el ticket para evitar carreras con cierre, cancelación o reasignación.

El upload debe seguir el mismo patrón. No basta con validar antes de almacenar el
archivo, porque el ticket podría cerrarse o reasignarse durante la operación.

### Visibilidad

- `USER` nunca puede leer ni crear contenido `INTERNAL`.
- `TECHNICIAN` y `ADMIN` pueden leer `PUBLIC` e `INTERNAL`.
- Comments son inmutables y su visibilidad no cambia después de crearse.

### Usuarios eliminados

`User` sí tiene soft delete mediante `status=DELETED` y `deletedAt`. La fila se
conserva y el refresh token se invalida.

El JWT access token no vuelve a consultar el estado del usuario en cada request. Un
token ya emitido puede seguir siendo aceptado hasta expirar, actualmente 15 minutos.
Este comportamiento no debe cambiarse silenciosamente dentro de BE-09; se registra
como riesgo transversal para decisión del Tech Lead.

### Tickets eliminados

El modelo `Ticket` no tiene `deletedAt`, estado `DELETED` ni endpoint DELETE. Por
tanto, hoy no existe borrado lógico de tickets. `CLOSED` y `CANCELLED` son estados
terminales, no borrado lógico.

## Diseño recomendado del modelo Prisma

### Asociación recomendada

Todo Attachment debe pertenecer directamente a un Ticket. Puede pertenecer además,
de forma opcional, a un Comment del mismo ticket.

Esto evita un modelo ambiguo con dos padres mutuamente excluyentes:

- `ticketId` obligatorio: define siempre el agregado y simplifica autorización,
  listado, cuotas y cleanup.
- `commentId` opcional: indica que el archivo forma parte de un comentario concreto.
- `commentId = null`: archivo general del ticket.

No se recomienda un modelo polimórfico basado en `entityType + entityId`, porque
Prisma/PostgreSQL no podrían garantizar las FKs y el aislamiento tenant-first de
ambos destinos.

### Visibilidad propia

Attachment debe persistir `visibility`:

- En adjuntos de comentario, el servidor la deriva de `Comment.visibility`.
- En adjuntos generales del ticket, el cliente debe elegir explícitamente PUBLIC o
  INTERNAL y el service valida el rol.

Aunque un adjunto de comentario replique la visibilidad del comentario, esta metadata
es útil para consultas seguras y no duplica contenido. Comments son inmutables, por
lo que no existe riesgo de divergencia posterior.

### Schema propuesto

```prisma
enum AttachmentVisibility {
  PUBLIC
  INTERNAL
}

model Attachment {
  id             String               @id @default(uuid())
  organizationId String               @map("organization_id")
  ticketId       String               @map("ticket_id")
  commentId      String?              @map("comment_id")
  uploadedById   String               @map("uploaded_by_id")
  originalName   String               @map("original_name") @db.VarChar(255)
  storageKey     String               @unique @map("storage_key") @db.VarChar(500)
  mimeType       String               @map("mime_type") @db.VarChar(100)
  sizeBytes      Int                  @map("size_bytes")
  sha256         String               @db.Char(64)
  visibility     AttachmentVisibility
  createdAt      DateTime             @default(now()) @map("created_at")
  deletedAt      DateTime?            @map("deleted_at")
  deletedById    String?              @map("deleted_by_id")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  ticket       Ticket       @relation(fields: [organizationId, ticketId], references: [organizationId, id], onDelete: Restrict)
  comment      Comment?     @relation(fields: [organizationId, ticketId, commentId], references: [organizationId, ticketId, id], onDelete: Restrict)
  uploadedBy   User         @relation("AttachmentUploadedBy", fields: [organizationId, uploadedById], references: [organizationId, id], onDelete: Restrict)
  deletedBy    User?        @relation("AttachmentDeletedBy", fields: [organizationId, deletedById], references: [organizationId, id], onDelete: Restrict)

  @@index([organizationId, ticketId, deletedAt, createdAt, id], name: "idx_attachments_org_ticket_created")
  @@index([organizationId, ticketId, visibility, deletedAt, createdAt, id], name: "idx_attachments_org_ticket_visibility_created")
  @@index([organizationId, commentId, deletedAt, createdAt, id], name: "idx_attachments_org_comment_created")
  @@map("attachments")
}
```

Relaciones inversas previstas:

- `Organization.attachments`.
- `Ticket.attachments`.
- `Comment.attachments`.
- `User.attachmentsUploaded` con relación `AttachmentUploadedBy`.
- `User.attachmentsDeleted` con relación `AttachmentDeletedBy`.

### Cambio necesario en Comment

Para garantizar en base de datos que el comentario opcional pertenece al mismo
tenant y ticket, Comment necesita:

```prisma
@@unique([organizationId, ticketId, id], name: "uq_comments_org_ticket_id")
```

La FK de Attachment usará los tres campos:

```text
(organization_id, ticket_id, comment_id)
    -> comments(organization_id, ticket_id, id)
```

Este índice compuesto es redundante respecto al PK global de `id`, pero es necesario
para una FK tenant-first que también garantice pertenencia al ticket. Es el único
cambio previsto sobre el modelo de BE-07; no requiere modificar controller, service,
repository, DTOs ni tests de Comments.

### Campos no recomendados

- Binario/BLOB/ByteA: no almacenar en PostgreSQL.
- URL pública permanente: no debe existir para storage local privado.
- Ruta absoluta: depende del entorno y filtra detalles internos.
- Nombre físico derivado del nombre original: riesgo de traversal y colisiones.
- Extensión separada: puede derivarse del nombre original validado y no es necesaria
  para localizar el objeto.

`storageKey` es una clave lógica portable entre filesystem y object storage, no una
ruta absoluta.

## Migración prevista

Crear una migración Prisma, por ejemplo:

```text
prisma/migrations/<timestamp>_add_attachments/migration.sql
```

La migración deberá:

1. Crear enum `AttachmentVisibility`.
2. Añadir el índice unique compuesto a Comments.
3. Crear tabla `attachments`.
4. Crear unique de `storage_key`.
5. Crear índices de listado, visibilidad y comment.
6. Crear FK a Organization.
7. Crear FK tenant-first a Ticket.
8. Crear FK tenant-first a Comment usando organización + ticket + comentario.
9. Crear FKs tenant-first a uploader y deletedBy.

Antes de entregar la implementación:

```text
npx prisma format
npx prisma validate
npx prisma generate
```

La migración debe revisarse manualmente, especialmente los nombres reales de los
índices compuestos, porque las migraciones anteriores ya documentan diferencias
entre `name` de Prisma Client y el nombre generado en PostgreSQL.

## Estrategia de almacenamiento

### Recomendación MVP: filesystem local privado

Ventajas:

- No introduce infraestructura ni SDKs.
- Funciona con las dependencias actuales.
- Es suficiente para una sola instancia del API.
- Simplifica desarrollo y pruebas.

Condiciones obligatorias:

- El root se resuelve una sola vez a una ruta absoluta.
- Los archivos se guardan fuera de cualquier directorio estático.
- No se configura `ServeStaticModule` ni `express.static`.
- Toda lectura pasa por autorización y consulta de metadata.
- `/uploads` se añade a `.gitignore`.
- En contenedor, el root debe estar montado en un volumen persistente.

### Abstracción propuesta

```ts
interface AttachmentStorage {
  put(storageKey: string, data: Buffer): Promise<void>;
  openReadStream(storageKey: string): Promise<NodeJS.ReadableStream>;
  delete(storageKey: string): Promise<void>;
}
```

Providers iniciales/futuros:

- `LocalAttachmentStorage`: BE-09 MVP.
- `S3AttachmentStorage`: implementación futura sin cambiar service/controller ni
  metadata.

El service debe depender de un token, por ejemplo `ATTACHMENT_STORAGE`, no de la
clase local concreta.

### Object storage

S3 o compatible es preferible cuando existan múltiples réplicas, alta disponibilidad,
CDN privado, lifecycle o almacenamiento remoto. No se recomienda implementarlo en
BE-09 sin credenciales, bucket, política de URLs firmadas y requisitos operativos
confirmados.

El valor `STORAGE_DRIVER=s3` ya es aceptado por Joi, pero no existe provider. Para el
MVP, seleccionar `s3` debe fallar al arrancar con un error explícito; nunca debe caer
silenciosamente a local.

## Consistencia entre filesystem y PostgreSQL

No existe una transacción atómica que abarque ambos sistemas.

Upload recomendado:

1. Multer limita y recibe un único archivo en memoria.
2. Validar nombre, tamaño, MIME, extensión y firma real.
3. Validar preliminarmente acceso al ticket.
4. Generar `storageKey` seguro y guardar el binario.
5. Abrir transacción de base de datos.
6. Bloquear el ticket con `SELECT ... FOR UPDATE` filtrado por organizationId.
7. Revalidar estado, asignación, propietario, comment, visibilidad y cuotas.
8. Crear metadata.
9. Confirmar transacción.
10. Si cualquier paso desde el lock falla, eliminar el archivo como compensación.

El archivo se escribe antes del lock para no mantener una transacción abierta durante
I/O. Una caída del proceso entre filesystem y metadata puede dejar un archivo
huérfano; se recomienda una tarea futura de reconciliación.

Delete recomendado:

1. Soft-delete de metadata con `organizationId + ticketId + attachmentId`.
2. El archivo deja de ser accesible inmediatamente por la API.
3. Intentar borrar el objeto físico.
4. Si falla el borrado físico, registrar error y permitir cleanup/reintento; no
   restaurar visibilidad de metadata.

Esta secuencia prioriza evitar acceso a un archivo que debía eliminarse.

## Límites recomendados

Para el MVP:

- Un archivo por request.
- Máximo 10 MiB por archivo (`10_485_760` bytes).
- Máximo 20 adjuntos activos por ticket.
- Máximo 100 MiB activos acumulados por ticket.
- Nombre original normalizado con máximo de 255 caracteres/longitud compatible con
  el campo de base de datos.

El count y sum de cuotas deben ejecutarse dentro de la transacción que bloquea el
ticket. Así dos uploads concurrentes no pueden superar el límite por carrera.

No se propone todavía una cuota total por organización porque no existe un sistema
de planes/cuotas implementado, aunque `Organization.plan` ya está disponible para el
futuro.

## MIME y extensiones recomendadas

Allowlist conservadora inicial:

| MIME | Extensiones |
|---|---|
| `application/pdf` | `.pdf` |
| `image/png` | `.png` |
| `image/jpeg` | `.jpg`, `.jpeg` |
| `image/webp` | `.webp` |
| `text/plain` | `.txt`, `.log` |
| `text/csv` | `.csv` |

Excluir inicialmente:

- Ejecutables y scripts.
- HTML.
- SVG, porque puede contener contenido activo.
- ZIP/RAR/7z y otros archivos comprimidos.
- Office con macros.
- `application/octet-stream` genérico.
- Extensiones dobles no reconocidas.

La allowlist debe estar en código, ser fail-closed y tener pruebas. No se recomienda
permitir cualquier MIME mediante variable de entorno, porque convertiría una policy
de seguridad en configuración accidental.

Para binarios se deben comprobar magic bytes. Para texto se debe comprobar que sea
UTF-8 válido y no contenga bytes NUL. El MIME declarado por el cliente nunca es
suficiente.

La allowlist anterior permite implementar un sniffer pequeño y explícito con APIs
nativas de Node, sin añadir dependencias. Si el Tech Lead amplía la lista a Office o
formatos complejos, se recomienda una librería mantenida de detección por contenido y
deberá justificarse como dependencia directa.

## Nombres y claves seguras

### Nombre físico/storage key

- Generar con `crypto.randomUUID()`.
- No conservar la extensión en el nombre físico salvo que exista una necesidad
  operativa demostrada.
- Ejemplo lógico:

```text
organizations/<organizationId>/tickets/<ticketId>/<uuid>
```

- Los componentes procedentes del request no se concatenan sin validación.
- `originalName` nunca se usa como path.
- Escritura con creación exclusiva para evitar sobrescritura.

### Nombre original

- Conservar solo como metadata y para `Content-Disposition`.
- Aplicar `path.basename`.
- Eliminar NUL, controles y separadores.
- Normalizar Unicode.
- Recortar longitud.
- Rechazar nombre vacío después de normalizar.

### Prevención de path traversal

El provider local debe:

1. Resolver el root con `path.resolve`.
2. Resolver la clave final bajo ese root.
3. Obtener `path.relative(root, target)`.
4. Rechazar si el resultado empieza por `..`, es absoluto o escapa del root.
5. No seguir claves recibidas del cliente.

Estas comprobaciones deben aplicarse en put, read y delete.

## Seguridad de descarga

- Endpoint autenticado; nunca URL estática directa.
- Consultar por `attachmentId + ticketId + organizationId + deletedAt=null`.
- Reutilizar acceso de lectura del ticket.
- Forzar PUBLIC para USER.
- No devolver `storageKey`, path absoluto ni checksum interno salvo decisión expresa.
- Enviar `Content-Type` validado desde metadata.
- Enviar `Content-Length` desde metadata.
- Enviar `Content-Disposition: attachment` con filename escapado.
- Enviar `X-Content-Type-Options: nosniff`.
- No renderizar inline en el MVP.

El `ResponseInterceptor` global envuelve respuestas JSON. Para descargar un stream
sin alterar ese interceptor ni BE-07/BE-08, el controller de attachments puede usar
la respuesta Express de forma explícita únicamente en el endpoint download. El
service devolverá stream + metadata; el controller establecerá headers y hará
pipeline. Esto debe estar cubierto por e2e.

## Endpoints propuestos

### Upload

```text
POST /api/v1/tickets/:ticketId/attachments
Content-Type: multipart/form-data
```

Campos:

- `file`: obligatorio, exactamente uno.
- `commentId`: UUID opcional.
- `visibility`: obligatorio para adjunto general del ticket; para un adjunto de
  comentario se deriva del comentario y un valor incompatible se rechaza.

Respuesta: metadata de Attachment, nunca el binario ni `storageKey`.

### List

```text
GET /api/v1/tickets/:ticketId/attachments
```

Query propuesta:

- `page`, default 1.
- `limit`, default 20, máximo 100.
- `order`, default asc.
- `commentId`, opcional para filtrar.
- `visibility`, filtro opcional que nunca amplía lo permitido por el rol.

Orden estable: `createdAt + id`.

### Download

```text
GET /api/v1/tickets/:ticketId/attachments/:attachmentId/download
```

Devuelve stream privado con headers seguros.

### Delete

```text
DELETE /api/v1/tickets/:ticketId/attachments/:attachmentId
```

Recomendación MVP: ADMIN únicamente y soft-delete de metadata. La política de delete
es una decisión pendiente del Tech Lead detallada al final.

No se considera necesario un endpoint metadata individual en el MVP; list y download
cubren el caso de uso.

## DTO de respuesta propuesto

```ts
class AttachmentResponseDto {
  id: string;
  ticketId: string;
  commentId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: AttachmentVisibility;
  uploadedBy: {
    id: string;
    name: string;
    role: UserRole;
  };
  createdAt: Date;
}
```

No exponer:

- `storageKey`.
- Path absoluto.
- `deletedAt`/`deletedById` en list normal.
- Metadata interna del provider.

La paginación debe seguir el patrón `{ data, meta }` de los services actuales. El
envelope HTTP anidado existente no se corrige como parte de BE-09.

## Permisos propuestos

### Lectura/list/download

| Rol | Ticket | PUBLIC | INTERNAL |
|---|---|---:|---:|
| USER | Solo ticket propio | Sí | Nunca |
| TECHNICIAN | Cualquier ticket legible de su organización | Sí | Sí |
| ADMIN | Cualquier ticket de su organización | Sí | Sí |

Estas reglas coinciden con Comments y Timeline.

### Upload

| Rol | Alcance | Visibilidad permitida |
|---|---|---|
| USER | Solo ticket propio no terminal | PUBLIC |
| TECHNICIAN | Solo ticket asignado directamente y no terminal | PUBLIC / INTERNAL |
| ADMIN | Cualquier ticket no terminal de su organización | PUBLIC / INTERNAL |

Si `commentId` está presente:

- El comentario debe existir con `organizationId + ticketId + commentId`.
- El comentario debe ser del usuario que hace el upload; no se debe modificar
  retrospectivamente el mensaje de otra persona.
- La visibilidad efectiva se deriva de Comment.
- USER nunca puede vincular a un comentario INTERNAL.

### Delete

Recomendación inicial:

- ADMIN puede eliminar cualquier adjunto de su organización.
- USER y TECHNICIAN no eliminan en el MVP.
- Delete se permite incluso en tickets CLOSED/CANCELLED para retirar malware, datos
  sensibles o contenido indebido.

Alternativa pendiente: permitir al uploader borrar su propio archivo mientras el
ticket no sea terminal. Esta opción es más amigable, pero debilita inmutabilidad y
auditoría y necesita definir ventanas de tiempo y comportamiento tras reasignación.

## Tickets CLOSED/CANCELLED

- Upload: rechazar con 409 para todos los roles, igual que Comments.
- List: permitido según acceso normal.
- Download: permitido según acceso y visibilidad normal.
- Delete administrativo: permitido por razones de seguridad/moderación.

La revalidación de estado debe ocurrir bajo lock dentro de la transacción que crea
metadata.

## Usuarios, comments y tickets eliminados

### Usuario soft-deleted

- La fila User permanece, por lo que uploader y deletedBy siguen resolviéndose.
- Las FKs usan `onDelete: Restrict`.
- Los adjuntos no se borran cuando el usuario se elimina lógicamente.
- Los nuevos refresh/login están bloqueados por el estado actual.
- Riesgo existente: access token vigente hasta expirar.

### Comment

Comment es inmutable y no tiene delete. Los adjuntos asociados permanecen.

### Ticket

No existe borrado lógico ni endpoint delete. Si se introduce en el futuro:

- Los adjuntos deben quedar inaccesibles cuando el ticket quede fuera de las reglas
  de lectura.
- La metadata y binarios no deben borrarse automáticamente sin una policy de
  retención aprobada.
- La FK `Restrict` evita hard delete accidental mientras existan adjuntos.

### Organization

Las FKs `Restrict` evitan borrar físicamente una organización con attachments. Una
política futura de offboarding debe exportar o purgar storage y metadata de manera
coordinada.

## Multi-tenancy

Todas las operaciones deben usar explícitamente:

- `organizationId` del JWT.
- `ticketId` de la ruta.
- `attachmentId` cuando corresponda.

Reglas por consulta:

- Ticket: `id + organizationId`.
- Comment: `id + ticketId + organizationId`.
- Attachment: `id + ticketId + organizationId`.
- List/count/sum: `ticketId + organizationId` y visibilidad permitida.
- Uploader/deleter: resolver con `id + organizationId`, no solo por id.

No confiar únicamente en FKs simples ni en haber validado el ticket en una consulta
anterior. Las FKs compuestas propuestas aportan defensa en profundidad.

Para recursos de otra organización se recomienda responder 404, evitando confirmar
su existencia. Para USER sobre un ticket ajeno del mismo tenant se conserva el 403
actual de `TicketsService.findOne()`.

## Configuración y variables de entorno previstas

Crear `src/config/storage.config.ts` con una interfaz similar a:

```ts
interface StorageConfig {
  driver: 'local' | 's3';
  localPath: string;
  maxFileSizeBytes: number;
  maxFilesPerTicket: number;
  maxTotalSizePerTicketBytes: number;
}
```

Variables:

```text
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=./uploads
ATTACHMENT_MAX_FILE_SIZE_BYTES=10485760
ATTACHMENT_MAX_FILES_PER_TICKET=20
ATTACHMENT_MAX_TOTAL_SIZE_PER_TICKET_BYTES=104857600
```

Cambios previstos:

- Registrar `storageConfig` en `ConfigModule.forRoot(load: ...)`.
- Añadir validación Joi numérica con mínimos/máximos razonables.
- Actualizar `.env.example`.
- No modificar secretos reales en `.env` durante la implementación salvo necesidad
  local explícita.
- Añadir `/uploads` a `.gitignore`.

## Docker y despliegue

### Estado actual

Solo PostgreSQL está dockerizado.

### Si la API continúa ejecutándose en host

- No cambiar `docker-compose.yml`.
- Usar `./uploads` en el host.
- Añadirlo a `.gitignore`.
- Documentar backup y permisos del directorio.

### Si BE-09 debe dockerizar también la API

Será necesario un alcance adicional:

- Crear Dockerfile de la API.
- Añadir servicio `api` a Compose.
- Añadir volumen, por ejemplo `cidrix_uploads:/app/uploads`.
- Configurar `STORAGE_LOCAL_PATH=/app/uploads`.
- Ejecutar API con usuario no root y permisos restringidos sobre el volumen.
- Definir estrategia de backup del volumen.

No se recomienda añadir un volumen sin consumidor. El Tech Lead debe decidir si la
dockerización de la API forma parte de BE-09 o de una tarea de infraestructura.

## Arquitectura de módulo propuesta

```text
src/modules/attachments/
├── attachments.controller.ts
├── attachments.module.ts
├── attachments.service.ts
├── attachments.repository.ts
├── dto/
│   ├── upload-attachment.dto.ts
│   ├── attachment-filters.dto.ts
│   └── attachment-response.dto.ts
├── storage/
│   ├── attachment-storage.interface.ts
│   ├── attachment-storage.token.ts
│   └── local-attachment.storage.ts
├── validation/
│   └── attachment-file.validator.ts
└── __tests__/
    ├── attachments.service.spec.ts
    ├── attachment-file.validator.spec.ts
    ├── local-attachment.storage.spec.ts
    └── upload-attachment.dto.spec.ts
```

Responsabilidades:

- Controller: multipart, params/query, headers y stream de download.
- Service: RBAC, visibilidad, estados, cuotas, compensación storage/DB.
- Repository: queries tenant-first, transacciones, lock y metadata.
- Storage: I/O sin reglas de negocio.
- Validator: allowlist y detección de contenido.

`AttachmentsModule` importará `TicketsModule` para reutilizar
`TicketsService.findOne()` en lectura. Para escritura tendrá su propio lock
tenant-first, siguiendo Comments sin modificar BE-07.

## Archivos previstos

### Nuevos

- `src/modules/attachments/attachments.controller.ts`
- `src/modules/attachments/attachments.module.ts`
- `src/modules/attachments/attachments.service.ts`
- `src/modules/attachments/attachments.repository.ts`
- DTOs, storage, validation y tests indicados arriba.
- `src/config/storage.config.ts`
- `prisma/migrations/<timestamp>_add_attachments/migration.sql`
- Tests e2e de attachments en `test/` si se habilita DB de prueba.

### Modificados

- `prisma/schema.prisma`.
- `src/app/app.module.ts`.
- `.env.example`.
- `.gitignore`.
- `docker-compose.yml` únicamente si se aprueba dockerizar la API.
- Posiblemente `src/integrations/events/event-types.ts` solo si se aprueban eventos
  AttachmentAdded/AttachmentDeleted.

### No previstos

- `src/modules/comments/comments.service.ts`.
- `src/modules/comments/comments.repository.ts`.
- Controllers/DTOs/tests de BE-07.
- `ticket-timeline.service.ts` o archivos de BE-08.
- `ResponseInterceptor`.
- Versiones del stack.

El único cambio en Comment sería la relación/unique compuesta en Prisma necesaria
para integridad referencial tenant-first.

## Pruebas unitarias necesarias

### Service/RBAC

- ADMIN sube PUBLIC e INTERNAL en ticket del tenant.
- TECHNICIAN sube solo en ticket asignado.
- TECHNICIAN no sube en ticket no asignado aunque pueda leerlo.
- USER sube PUBLIC en ticket propio.
- USER no sube INTERNAL.
- USER no accede a ticket ajeno.
- Ticket fuera de organización devuelve 404.
- CLOSED/CANCELLED rechazan upload con 409.
- ADMIN/TECH listan PUBLIC + INTERNAL.
- USER lista/descarga únicamente PUBLIC.
- Filtro visibility nunca amplía acceso.
- Comment debe pertenecer a organization + ticket.
- Comment-linked attachment deriva visibilidad.
- No se puede adjuntar a comment de otro autor.
- Uploader y deletedBy se resuelven dentro del tenant.

### Validación de archivos

- Sin archivo.
- Más de un archivo.
- Archivo mayor al límite.
- Extensión no permitida.
- MIME no permitido.
- MIME permitido pero magic bytes incompatibles.
- PDF/PNG/JPEG/WebP válidos.
- TXT/LOG/CSV UTF-8 válidos.
- Texto con NUL rechazado.
- Nombre vacío, controles, separadores y traversal.
- Doble extensión peligrosa.
- Nombre Unicode y longitud máxima.

### Storage local

- Genera/escribe bajo root.
- No usa originalName como path.
- Rechaza `../`, paths absolutos y escape del root.
- No sobrescribe claves existentes.
- Abre stream válido.
- Elimina objeto.
- Maneja objeto ausente.
- Crea directorios con permisos esperados.

### Consistencia y cuotas

- DB failure después de put elimina el archivo.
- Storage put failure no crea metadata.
- Count máximo bloquea upload.
- Total de bytes máximo bloquea upload.
- Requests concurrentes se serializan por lock del ticket.
- Delete marca metadata antes de retirar el objeto.
- Falla de borrado físico no vuelve accesible la metadata.

## Pruebas e2e necesarias

- Upload multipart real y respuesta de metadata.
- List paginado y orden estable.
- Download conserva bytes exactos.
- Headers `Content-Type`, `Content-Length`, `Content-Disposition` y `nosniff`.
- ResponseInterceptor no envuelve el stream.
- Aislamiento entre dos organizaciones.
- USER nunca lista ni descarga INTERNAL usando ids conocidos.
- TECHNICIAN asignado/no asignado.
- Ticket inexistente.
- Comment inexistente, de otro ticket y de otra organización.
- CLOSED/CANCELLED.
- Delete ADMIN y descarga posterior 404.
- Path traversal en originalName.
- Payload superior al límite retorna 413 sin metadata ni archivo residual.

Los e2e deben usar un directorio temporal y limpiarlo de forma segura. No deben usar
el storage real del desarrollador.

## Riesgos técnicos

### Filesystem local y escalado

Dos réplicas de API no comparten filesystem. Antes de escalar horizontalmente se
debe migrar a object storage o usar un volumen compartido apropiado.

### Backup

PostgreSQL y uploads requieren backups coordinados. Restaurar solo metadata o solo
archivos deja inconsistencias.

### Atomicidad

DB y filesystem no tienen transacción conjunta. La compensación reduce el riesgo,
pero una caída abrupta puede dejar huérfanos. Hace falta reconciliación futura.

### Malware

Magic bytes y allowlist no sustituyen antivirus. PDF e imágenes pueden contener
exploits para lectores vulnerables. `Content-Disposition: attachment` y `nosniff`
reducen exposición del navegador, pero no analizan malware.

### Tokens de usuarios eliminados

El access token existente no consulta `User.status`; un usuario soft-deleted puede
conservar acceso hasta que expire. Es una deuda de Auth existente, no específica de
Attachments.

### Borrado físico

Si falla, quedan objetos huérfanos pero no accesibles por API. Es necesario logging,
métricas y cleanup.

### MIME de texto

La detección de texto es heurística. No debe aceptarse `application/octet-stream`
como fallback.

### Nombres en Content-Disposition

El header requiere escaping estricto y soporte RFC 5987 para UTF-8. No concatenar
`originalName` directamente.

### Memoria

Multer memory storage mantiene hasta 10 MiB por request. Bajo concurrencia alta puede
presionar heap. Deben existir límites en reverse proxy y aplicación; si el volumen
crece, migrar a streaming/temp file con cleanup.

## Decisiones pendientes del Tech Lead

Antes de implementar, confirmar:

1. **Modelo de asociación:** aprobar `ticketId` obligatorio + `commentId` opcional.
2. **Unique en Comment:** aprobar el índice compuesto
   `(organizationId, ticketId, id)` para la FK tenant-first.
3. **Visibilidad:** aprobar AttachmentVisibility propia y derivada de Comment cuando
   exista `commentId`.
4. **Allowlist:** aprobar PDF, PNG, JPEG, WebP, TXT/LOG y CSV; confirmar si Office o
   ZIP son requisitos del MVP.
5. **Límites:** aprobar 10 MiB/archivo, 20 archivos/ticket y 100 MiB/ticket.
6. **Delete:** aprobar ADMIN-only con soft-delete, o definir si el uploader puede
   eliminar y bajo qué condiciones.
7. **Comment ownership:** aprobar que solo el autor pueda añadir un archivo a un
   comentario ya existente.
8. **Storage MVP:** confirmar filesystem local y que S3 quede solo detrás de la
   interfaz futura.
9. **Docker:** decidir si BE-09 incluye dockerizar la API y montar volumen o si la API
   seguirá ejecutándose en host.
10. **Antivirus:** decidir si la primera versión puede salir sin escaneo AV. La
    recomendación es documentar esta limitación y mantener una allowlist estricta.
11. **Eventos:** decidir si se requieren `attachment.added` y
    `attachment.deleted` ahora o en un sprint de integraciones.
12. **Timeline:** confirmar que los adjuntos no se incorporan a BE-08 en esta tarea.
13. **Auth transversal:** decidir si el access token de usuarios soft-deleted debe
    revocarse inmediatamente en otra tarea.
14. **Tipos Multer:** aprobar interfaz interna sin nueva dependencia o autorizar
    `@types/multer` como devDependency.
15. **Orden de listado:** confirmar `createdAt + id` ascendente por consistencia con
    Comments/Timeline.

## Plan de implementación después de la aprobación

1. Cerrar las decisiones de producto y seguridad anteriores.
2. Añadir modelo, relaciones e índices Prisma.
3. Generar y revisar migración.
4. Crear `storage.config.ts`, actualizar validación y `.env.example`.
5. Añadir `/uploads` a `.gitignore`.
6. Implementar interfaz y provider local con protección de paths.
7. Implementar validador de archivo fail-closed.
8. Implementar repository con consultas tenant-first y lock de ticket.
9. Implementar service con RBAC, cuotas, visibilidad y compensación.
10. Implementar controller multipart, list, download y delete aprobado.
11. Registrar `AttachmentsModule` en AppModule.
12. Añadir tests unitarios.
13. Añadir e2e con storage temporal y PostgreSQL de prueba si la infraestructura está
    disponible.
14. Ejecutar Prisma format/validate/generate.
15. Ejecutar tests completos, e2e, lint y build.
16. Revisar migration SQL, git diff y ausencia de archivos binarios en Git.
17. Entregar informe de implementación sin commit ni push.

## Recomendación final

La propuesta más segura y simple para BE-09 es filesystem local privado con un
provider abstracto, metadata tenant-first en PostgreSQL, acceso exclusivamente por
endpoints autenticados y una allowlist conservadora validada por contenido.

Las decisiones más importantes antes de codificar son el alcance Docker, la política
de delete, los tipos de archivo y si se acepta salir sin antivirus. Ninguna de ellas
debe asumirse silenciosamente durante la implementación.
