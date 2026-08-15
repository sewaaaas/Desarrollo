# CIDRIX — BE-09 Attachments Implementation Review

Fecha: 9 de agosto de 2026  
Repositorio: `C:\Users\Sewas\proyecto`  
Backend: `C:\Users\Sewas\proyecto\cidrix-api`  
Rama: `feature/be-09-attachments`  
Base: `e609c2b` (`main` y `origin/main` apuntaban al mismo commit)  
Commit/push: no realizados

## Resultado

BE-09 quedó implementado como un módulo independiente de Attachments con metadata
en PostgreSQL y binarios en filesystem local privado.

La implementación mantiene:

- Aislamiento multi-tenant mediante `organizationId + ticketId`.
- RBAC vigente de USER, TECHNICIAN y ADMIN.
- `CommentVisibility` existente para PUBLIC/INTERNAL.
- FKs compuestas tenant-first hacia Ticket, Comment y User.
- Descarga únicamente por endpoint autenticado.
- Soft-delete administrativo con borrado físico best-effort.
- Abstracción de storage preparada para un provider futuro.
- BE-07 y BE-08 sin cambios de lógica.

## Endpoints implementados

### Upload

```text
POST /api/v1/tickets/:ticketId/attachments
Content-Type: multipart/form-data
```

Campos:

- `file`: obligatorio; exactamente uno por request.
- `commentId`: UUID opcional.
- `visibility`: PUBLIC/INTERNAL; obligatorio para attachment general del ticket.

Si se indica `commentId`, la visibilidad se deriva obligatoriamente de
`Comment.visibility`. Si el cliente envía además una visibilidad incompatible, se
responde 400.

### List

```text
GET /api/v1/tickets/:ticketId/attachments
```

Filtros:

- `commentId` opcional.
- `visibility` opcional, sin capacidad de ampliar el acceso del rol.
- `page`, default 1.
- `limit`, default 20, máximo 100.
- `order`, default `asc`.

Orden estable: `createdAt + id`.

### Download

```text
GET /api/v1/tickets/:ticketId/attachments/:attachmentId/download
```

La descarga usa respuesta Express directa para no ser envuelta por el
`ResponseInterceptor` JSON global. Headers:

- `Content-Type` validado.
- `Content-Length` persistido.
- `Content-Disposition: attachment` con fallback ASCII y `filename*` UTF-8.
- `X-Content-Type-Options: nosniff`.

### Delete

```text
DELETE /api/v1/tickets/:ticketId/attachments/:attachmentId
```

- ADMIN-only mediante guard y defensa adicional en service.
- HTTP 204.
- Soft-delete de metadata.
- Borrado físico best-effort.
- Permitido incluso en CLOSED/CANCELLED.

## Schema Prisma

Se añadió `Attachment` con:

- `id` UUID.
- `organizationId` obligatorio.
- `ticketId` obligatorio.
- `commentId` opcional.
- `uploadedById` obligatorio.
- `originalName`.
- `storageKey` interno y unique.
- `mimeType`.
- `sizeBytes` como Int.
- `sha256` de 64 caracteres.
- `visibility` reutilizando `CommentVisibility`.
- `createdAt`.
- `deletedAt` y `deletedById` para soft-delete.

No se creó un enum nuevo de visibilidad.

### Relaciones tenant-first

- Attachment → Ticket:
  `(organizationId, ticketId)`.
- Attachment → Comment opcional:
  `(organizationId, ticketId, commentId)`.
- Attachment → uploadedBy:
  `(organizationId, uploadedById)`.
- Attachment → deletedBy opcional:
  `(organizationId, deletedById)`.

Para habilitar la FK fuerte hacia Comment se añadió exclusivamente al modelo Prisma
de BE-07:

```prisma
@@unique([organizationId, ticketId, id], name: "uq_comments_org_ticket_id")
```

No se modificaron controllers, services, repositories, DTOs o tests de Comments.

### Índices

- Unique global de `storageKey`.
- `(organizationId, ticketId, deletedAt, createdAt, id)`.
- `(organizationId, ticketId, visibility, deletedAt, createdAt, id)`.
- `(organizationId, commentId, deletedAt, createdAt, id)`.
- Unique de Comment `(organizationId, ticketId, id)` para la FK compuesta.

## Migración

Archivo:

```text
prisma/migrations/20260809000000_add_attachments/migration.sql
```

La migración:

1. Crea `attachments`.
2. Reutiliza el enum PostgreSQL `CommentVisibility` existente.
3. Crea índices y unique de `storageKey`.
4. Añade el unique compuesto de Comments.
5. Añade las cinco FKs tenant-first/restrict.

`prisma migrate dev --create-only` detectó correctamente el cambio y mostró solo el
warning esperado del nuevo unique, pero no creó el archivo porque Prisma Migrate no
admite ese comando en el entorno no interactivo actual.

Como alternativa segura se obtuvo el SQL mediante:

```text
prisma migrate diff --from-url <base actual> --to-schema-datamodel prisma/schema.prisma --script
```

El SQL generado fue incorporado sin cambios funcionales a la migración. La revisión
final automatizada confirmó:

```text
MIGRATION_MATCHES_PRISMA_DIFF=True
```

La migración no se aplicó a la base de datos local.

## Permisos implementados

### Upload

| Rol | Alcance | Visibilidad |
|---|---|---|
| USER | Ticket propio no terminal | PUBLIC |
| TECHNICIAN | Ticket asignado directamente y no terminal | PUBLIC / INTERNAL |
| ADMIN | Cualquier ticket no terminal de su organización | PUBLIC / INTERNAL |

La autorización se hace inicialmente mediante `TicketsService.findOne()` y vuelve a
validarse bajo `SELECT ... FOR UPDATE` antes de crear metadata. Esto cierra carreras
con cierre, cancelación y reasignación.

### Comment ownership

Cuando existe `commentId`:

- La consulta incluye `organizationId + ticketId + commentId`.
- El comentario debe pertenecer al mismo tenant y ticket.
- Solo su autor puede asociar posteriormente el archivo.
- La visibilidad se deriva del comentario.
- USER continúa bloqueado frente a INTERNAL.

### List/download

- USER: solo ticket propio y attachments PUBLIC.
- TECHNICIAN: cualquier ticket legible de la organización, PUBLIC + INTERNAL.
- ADMIN: cualquier ticket de la organización, PUBLIC + INTERNAL.
- Un filtro solicitado por USER nunca amplía a INTERNAL.
- Soft-deleted siempre queda excluido.

### CLOSED/CANCELLED

- Upload: 409.
- List: permitido conforme a lectura normal.
- Download: permitido conforme a lectura/visibilidad normal.
- Delete ADMIN: permitido.

## Storage

### Provider local privado

Se implementó `AttachmentStorage` con:

```ts
put(storageKey, data)
openReadStream(storageKey)
delete(storageKey)
```

`LocalAttachmentStorage`:

- Resuelve un root absoluto desde `STORAGE_LOCAL_PATH`.
- Crea el root al iniciar el módulo.
- Usa escritura exclusiva `wx` para no sobrescribir.
- Usa permisos de archivo `0600` cuando el sistema operativo los soporta.
- Verifica containment mediante `resolve + relative` en put/read/delete.
- Rechaza claves vacías, absolutas, NUL y traversal.
- Abre el file handle antes de entregar el stream, de modo que ENOENT ocurra antes
  de enviar headers.
- Hace delete idempotente frente a ENOENT.

Las claves son generadas por el servidor:

```text
attachments/<crypto.randomUUID()>
```

No contienen el nombre original ni datos proporcionados por el cliente.

### Driver futuro

El service depende del token `ATTACHMENT_STORAGE`, no de la clase local.

Si `STORAGE_DRIVER=s3`, el backend falla explícitamente al construir el provider con
un mensaje de driver no implementado. No existe fallback silencioso.

### Sin rutas estáticas

- No se añadió `ServeStaticModule`.
- No se añadió `express.static`.
- `storageKey` y paths nunca aparecen en DTOs.
- Los binarios no se guardan en PostgreSQL.

## Configuración

Se creó `src/config/storage.config.ts` y se registró en `AppModule`.

Variables:

```text
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=./uploads
ATTACHMENT_MAX_FILE_SIZE_BYTES=10485760
ATTACHMENT_MAX_FILES_PER_TICKET=20
ATTACHMENT_MAX_TOTAL_SIZE_PER_TICKET_BYTES=104857600
```

Joi permite reducir los límites por entorno, pero no aumentarlos por encima de las
decisiones del Tech Lead:

- 10 MiB por archivo.
- 20 activos por ticket.
- 100 MiB activos por ticket.

Se actualizó `.env.example`. No se modificó `.env` real.

Se añadió `/uploads` a `.gitignore`.

No se modificó `docker-compose.yml`; la API continúa ejecutándose en host.

## Validación de archivos

Se implementó una policy fail-closed sin dependencias nuevas.

### Permitidos

| MIME | Extensiones | Validación de contenido |
|---|---|---|
| `application/pdf` | `.pdf` | `%PDF-` |
| `image/png` | `.png` | Firma PNG completa |
| `image/jpeg` | `.jpg`, `.jpeg` | SOI JPEG |
| `image/webp` | `.webp` | `RIFF` + `WEBP` |
| `text/plain` | `.txt`, `.log` | UTF-8 fatal + sin NUL |
| `text/csv` | `.csv` | UTF-8 fatal + sin NUL |

### Rechazados

- Ejecutables.
- Scripts.
- HTML.
- SVG.
- ZIP/RAR/7z.
- Office.
- `application/octet-stream`.
- Extensión/MIME incompatibles.
- Magic bytes incompatibles.
- Extensiones peligrosas intermedias como `.exe.pdf`.
- Archivo vacío.
- Tamaño declarado inconsistente con Buffer.
- Nombre con slash, backslash, controles, NUL o más de 255 caracteres.
- Texto con bytes NUL o UTF-8 inválido.

El nombre original se normaliza a Unicode NFC y se conserva solo como metadata.

## Cuotas y consistencia

- Multer acepta un único archivo por request.
- Multer limita el payload por archivo.
- El validator repite la comprobación de tamaño como defensa en profundidad.
- Count y sum activos se calculan después de bloquear el ticket.
- Todos los uploads de un ticket pasan por el mismo row lock, evitando carreras de
  cuota.

### Compensación upload

1. Validación preliminar de acceso/asociación/archivo.
2. Escritura del objeto local.
3. Lock y revalidación dentro de transacción DB.
4. Creación de metadata.
5. Ante cualquier fallo DB, intento de borrar el objeto escrito.
6. Si también falla el cleanup, se registra el objeto huérfano sin ocultar el error
   original.

### Soft-delete

1. Actualización atómica de metadata con tenant/ticket/attachment y `deletedAt=null`.
2. Desde ese momento list/download ya no pueden encontrarlo.
3. Borrado físico best-effort.
4. Si el borrado físico falla, se registra el error y no se revierte metadata.

## Archivos modificados

- `cidrix-api/.env.example`
- `cidrix-api/.gitignore`
- `cidrix-api/prisma/schema.prisma`
- `cidrix-api/src/app/app.module.ts`
- `cidrix-api/src/config/app.config.ts`

## Archivos creados

- `cidrix-api/prisma/migrations/20260809000000_add_attachments/migration.sql`
- `cidrix-api/src/config/storage.config.ts`
- `cidrix-api/src/modules/attachments/attachments.controller.ts`
- `cidrix-api/src/modules/attachments/attachments.module.ts`
- `cidrix-api/src/modules/attachments/attachments.repository.ts`
- `cidrix-api/src/modules/attachments/attachments.service.ts`
- `cidrix-api/src/modules/attachments/dto/attachment-filters.dto.ts`
- `cidrix-api/src/modules/attachments/dto/attachment-response.dto.ts`
- `cidrix-api/src/modules/attachments/dto/upload-attachment.dto.ts`
- `cidrix-api/src/modules/attachments/storage/attachment-storage.interface.ts`
- `cidrix-api/src/modules/attachments/storage/attachment-storage.token.ts`
- `cidrix-api/src/modules/attachments/storage/local-attachment.storage.ts`
- `cidrix-api/src/modules/attachments/validation/attachment-file.validator.ts`
- `cidrix-api/src/modules/attachments/__tests__/attachment-dtos.spec.ts`
- `cidrix-api/src/modules/attachments/__tests__/attachment-file.validator.spec.ts`
- `cidrix-api/src/modules/attachments/__tests__/attachments.repository.spec.ts`
- `cidrix-api/src/modules/attachments/__tests__/attachments.service.spec.ts`
- `cidrix-api/src/modules/attachments/__tests__/local-attachment.storage.spec.ts`
- `docs/BE-09-implementation-review.md`

Documento de análisis todavía no trackeado:

- `docs/BE-09-analisis-y-plan.md`

## Archivos deliberadamente no modificados

- `docker-compose.yml`.
- `package.json` y `package-lock.json`.
- `src/integrations/events/event-types.ts`.
- Services/controllers/repositories/DTOs/tests de Comments.
- Archivos de Ticket Timeline/BE-08.
- Auth/JWT.
- `ResponseInterceptor`.

No se añadieron dependencias, eventos ni entradas de timeline.

## Tests

Comando final:

```text
npm.cmd test -- --runInBand
```

Resultado:

- 9 suites aprobadas de 9.
- 119 tests aprobados de 119.
- 0 snapshots.
- Baseline previo: 46 tests.
- Tests añadidos por BE-09: 73 casos ejecutados.

Cobertura añadida:

- RBAC de upload/list/download/delete.
- USER PUBLIC-only.
- TECHNICIAN asignado/no asignado.
- ADMIN.
- Aislamiento multi-tenant.
- Revalidación bajo lock.
- CLOSED/CANCELLED.
- Ownership y visibilidad de Comment.
- Límites y cuotas.
- Compensación storage/DB.
- Soft-delete y fallo físico best-effort.
- Autorización de download.
- Filtros y orden estable del repository.
- DTOs multipart/list.
- PDF, PNG, JPEG, WebP, TXT, LOG y CSV.
- MIME/extensión/magic bytes.
- UTF-8/NUL.
- Nombres peligrosos y traversal.
- Storage local put/read/delete/no-overwrite.
- Fallo explícito de S3.

No se creó una infraestructura e2e PostgreSQL nueva, conforme a la decisión del Tech
Lead. Las pruebas manuales reales contra API/PostgreSQL quedan para la siguiente fase.

## Prisma

Comandos finales:

```text
npx.cmd prisma format
npx.cmd prisma validate
npx.cmd prisma generate
```

Resultados:

- Schema formateado correctamente.
- Schema válido.
- Prisma Client 6.19.3 generado correctamente.

## ESLint

Se ejecutó sin `--fix` y con `--max-warnings=0` sobre todos los archivos creados y
modificados de TypeScript.

Resultado: 0 errores, 0 warnings.

Las únicas supresiones nuevas están limitadas a archivos de test para reglas de
tipado de mocks/matchers Jest (`unbound-method` y asignaciones/argumentos unsafe).
No hay supresiones nuevas en código productivo.

## Build

Comando:

```text
npm.cmd run build
```

Resultado: exitoso, sin errores TypeScript/Nest.

## Git diff

`git diff --check`: exitoso, sin errores de whitespace.

Resumen antes de contar este informe:

- 5 archivos existentes modificados.
- 18 archivos nuevos de implementación, migración y tests.
- 73 tests nuevos.
- Aproximadamente 2,523 líneas añadidas y 20 eliminadas en backend/migración/tests.
- La mayor parte del volumen nuevo corresponde a tests y validación de seguridad.

No se hizo commit, push ni cambio de rama.

## Desviaciones

### Generación de migración

`prisma migrate dev --create-only` no puede ejecutarse en el entorno no interactivo.
Se utilizó `prisma migrate diff`, que es read-only respecto a la base, y se verificó
que la migración guardada coincide exactamente con su SQL. No se aplicó la migración.

### Sin e2e PostgreSQL

No se añadió infraestructura e2e nueva por instrucción expresa. Controller multipart,
headers HTTP y migración aplicada deberán comprobarse manualmente contra API/DB.

No hubo otras desviaciones respecto a las decisiones aprobadas.

## Riesgos conocidos

### Antivirus

La allowlist y magic bytes no sustituyen un motor antivirus. PDF e imágenes válidas
pueden contener exploits para software cliente. La descarga forzada y `nosniff`
reducen exposición web, pero AV/quarantine sigue siendo una mejora futura.

### Atomicidad DB/filesystem

No existe transacción distribuida. La compensación cubre fallos normales, pero una
caída abrupta entre put y metadata puede dejar objetos huérfanos. Se recomienda una
tarea futura de reconciliación.

### Filesystem local

Es adecuado para una instancia en host. No soporta múltiples réplicas sin storage
compartido. Antes de escalar, implementar el provider object storage.

### Memory storage

Multer mantiene hasta 10 MiB por upload en memoria. Bajo concurrencia alta puede
presionar heap. Mantener límites equivalentes en reverse proxy y observar memoria.

### Access tokens de usuarios eliminados

Se conserva el comportamiento actual: un access token emitido puede ser válido hasta
expirar aunque el usuario sea soft-deleted. No se corrigió Auth en BE-09.

### Borrado físico fallido

El objeto queda huérfano pero inaccesible por API. Hace falta logging operacional y
cleanup/retry futuro.

### Backups

Metadata y filesystem requieren backup coordinado para evitar restauraciones
inconsistentes.

## Puntos para revisión del Tech Lead

1. Revisar y aprobar la migración antes de aplicarla.
2. Ejecutar prueba manual de migration deploy sobre una copia/entorno de desarrollo.
3. Probar multipart real con los siete formatos permitidos.
4. Verificar headers y nombre UTF-8 en download con navegador/curl.
5. Confirmar que `totalPages=1` para lista vacía debe seguir la convención de
   Comments.
6. Confirmar que permitir un valor `visibility` redundante, siempre que coincida con
   el Comment, es preferible a rechazar siempre dicho campo.
7. Configurar límites equivalentes en reverse proxy si existe.
8. Registrar tareas futuras para AV/quarantine, reconciliación de huérfanos, object
   storage, backups y revocación inmediata de tokens.
9. Verificar permisos efectivos del directorio `uploads` en el host de despliegue.
10. Confirmar que el volumen de tests y las supresiones ESLint limitadas a mocks son
    aceptables.

## Conclusión

BE-09 está implementado, compilado y cubierto por pruebas unitarias amplias. La
migración está generada y verificada, pero deliberadamente no aplicada. El worktree
queda listo para revisión manual del Tech Lead, sin commit ni push.
