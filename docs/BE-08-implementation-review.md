# CIDRIX — BE-08 Implementation Review

Fecha: 8 de agosto de 2026  
Repositorio: `C:\Users\Sewas\proyecto`  
Backend: `C:\Users\Sewas\proyecto\cidrix-api`  
Rama: `main`  
Base inspeccionada: `f2bed64` (`origin/main`)  
Commit/push: no realizados

## Resultado

BE-08 quedó implementado como una proyección de lectura que combina `Comment` y
`TicketHistory` sin crear ni modificar registros de ninguna de las dos tablas.

Endpoint implementado:

```text
GET /api/v1/tickets/:ticketId/history
```

El endpoint conserva la autenticación JWT, el control de roles y el response
envelope actuales del proyecto.

## Archivos modificados

- `cidrix-api/src/modules/tickets/tickets.controller.ts`
  - Añade `GET :ticketId/history`.
  - Mantiene el controller delgado y delega en `TicketTimelineService`.
- `cidrix-api/src/modules/tickets/tickets.module.ts`
  - Registra `TicketTimelineService` como provider.

## Archivos creados

- `cidrix-api/src/modules/tickets/ticket-timeline.service.ts`
- `cidrix-api/src/modules/tickets/dto/ticket-timeline-filters.dto.ts`
- `cidrix-api/src/modules/tickets/dto/ticket-timeline-response.dto.ts`
- `cidrix-api/src/modules/tickets/__tests__/ticket-timeline.service.spec.ts`
- `cidrix-api/src/modules/tickets/__tests__/ticket-timeline-filters.dto.spec.ts`
- `docs/BE-08-implementation-review.md`

Documento de análisis creado en la fase anterior y todavía presente como archivo
no trackeado:

- `docs/BE-08-analisis-y-plan.txt`

## Decisiones implementadas

### Acceso al ticket

- Se reutiliza `TicketsService.findOne(currentUser, ticketId)` como fuente de
  verdad para el acceso de lectura.
- `USER` solo puede consultar tickets creados por él.
- `TECHNICIAN` conserva el alcance actual: puede leer cualquier ticket de su
  organización, aunque no esté asignado.
- `ADMIN` puede leer cualquier ticket de su organización.
- Un ticket inexistente o fuera de la organización no provoca lecturas posteriores
  de `Comment` o `TicketHistory`.

### Multi-tenancy

- Las consultas a `Comment` incluyen siempre `organizationId + ticketId`.
- Las consultas a `TicketHistory` incluyen siempre `organizationId + ticketId`.
- Los actores de `TicketHistory` se resuelven mediante una consulta separada a
  `User` que vuelve a filtrar por `organizationId`.
- No se confía únicamente en la relación `TicketHistory.changedBy`, cuya FK actual
  no es tenant-first.
- Si un actor no se encuentra dentro de la organización, el timeline retorna
  `actor: null` y no expone `changedById`.

### Visibilidad de comentarios

- `USER`: únicamente `PUBLIC`.
- `TECHNICIAN`: `PUBLIC` e `INTERNAL`.
- `ADMIN`: `PUBLIC` e `INTERNAL`.

### TicketHistory para USER

Se implementó una allowlist explícita y fail-closed. Solo se copian estos campos
desde `changes`:

- `title`
- `description`
- `priority`
- `status`
- `firstResponseAt`

Para `USER` se omiten:

- `triggerCommentId`
- `assignedToId`
- `categoryId`
- cualquier campo futuro no incluido expresamente en la allowlist

Si `changes` tiene una forma inesperada, es un array, un escalar o no contiene
campos públicos, se retorna `changes: null` para `USER`.

`ADMIN` y `TECHNICIAN` reciben `changes` completo.

### DTO unificado

Se usa una unión discriminada mediante `type`:

- `COMMENT`: `id`, `type`, `timestamp`, `actor`, `content`, `visibility`.
- `HISTORY`: `id`, `type`, `timestamp`, `actor`, `action`, `changes`.

Esto permite distinguir ambos orígenes sin duplicar datos ni inferir el tipo a
partir de campos nullable.

### Orden

- Orden predeterminado: ascendente.
- Criterio determinista:
  1. `timestamp`.
  2. `COMMENT` antes que `HISTORY` cuando comparten timestamp.
  3. `id` como último desempate.
- `COMMENT` permanece antes que `HISTORY` en empates incluso cuando se solicita
  `order=desc`, para conservar la semántica del comentario antes de
  `FIRST_RESPONSE`.

### Paginación

- Defaults: `page=1`, `limit=20`, `order=asc`.
- `limit` máximo: 100.
- Se consultan los dos conjuntos permitidos.
- Se transforman, combinan y ordenan primero.
- La paginación se aplica una sola vez sobre el conjunto combinado.
- `total` y `totalPages` se calculan sobre el timeline completo visible.
- Un timeline vacío retorna `totalPages: 1`, siguiendo el comportamiento de
  comentarios de BE-07.

### FIRST_RESPONSE

- El comentario y su evento `FIRST_RESPONSE` se conservan como dos elementos
  diferentes.
- No se crea ninguna entrada nueva ni se realiza deduplicación.
- Para `USER`, `firstResponseAt` permanece visible y `triggerCommentId` se elimina.

### Response envelope

No se modificó `ResponseInterceptor`. El endpoint sigue el patrón paginado actual,
por lo que el HTTP envelope efectivo permanece:

```json
{
  "data": {
    "data": [],
    "meta": {}
  }
}
```

## Validaciones ejecutadas

### Prisma

Comando:

```text
npx.cmd prisma validate
```

Resultado:

```text
The schema at prisma\schema.prisma is valid
```

### Tests completos

Comando final:

```text
npm.cmd test -- --runInBand
```

Resultado final:

- Test suites: 4 aprobadas de 4.
- Tests: 46 aprobados de 46.
- Snapshots: 0.
- Se añadieron 19 pruebas específicas de BE-08.

Cobertura funcional añadida:

- ADMIN con PUBLIC + INTERNAL + historial completo.
- TECHNICIAN y su alcance real de lectura.
- USER solo PUBLIC.
- Allowlist y comportamiento fail-closed para USER.
- Ticket ajeno y ticket inexistente/fuera del tenant.
- Filtros `organizationId + ticketId`.
- Resolución tenant-safe de actores.
- Combinación de ambas fuentes.
- Orden cronológico y desempates deterministas.
- Orden descendente con precedencia COMMENT/HISTORY estable.
- Paginación posterior a la combinación.
- Timeline vacío.
- Coexistencia de Comment y FIRST_RESPONSE.
- Validación y transformación del DTO de query.

Durante la primera ejecución, la suite aislada del DTO requirió importar
`reflect-metadata`, porque el entorno Jest no lo inicializaba antes de evaluar
`@Type()`. Se corrigió en el propio test. La ejecución final completa quedó verde.

### Build

Comando final:

```text
npm.cmd run build
```

Resultado: exitoso, sin errores TypeScript/Nest.

### ESLint

Se ejecutó ESLint sin `--fix` sobre todos los archivos creados o modificados de
BE-08 con `--max-warnings=0`.

Resultado final: exitoso, sin errores ni warnings.

### Diff check

Comando:

```text
git diff --check
```

Resultado: sin errores de whitespace.

## Resumen del git diff

Cambios productivos y de pruebas de BE-08:

- 2 archivos existentes modificados.
- 5 archivos TypeScript nuevos.
- Aproximadamente 835 líneas añadidas y 5 eliminadas antes de contar este informe.
- 499 de las líneas nuevas corresponden a pruebas.

Estado esperado:

```text
M  cidrix-api/src/modules/tickets/tickets.controller.ts
M  cidrix-api/src/modules/tickets/tickets.module.ts
?? cidrix-api/src/modules/tickets/ticket-timeline.service.ts
?? cidrix-api/src/modules/tickets/dto/ticket-timeline-filters.dto.ts
?? cidrix-api/src/modules/tickets/dto/ticket-timeline-response.dto.ts
?? cidrix-api/src/modules/tickets/__tests__/ticket-timeline.service.spec.ts
?? cidrix-api/src/modules/tickets/__tests__/ticket-timeline-filters.dto.spec.ts
?? docs/BE-08-analisis-y-plan.txt
?? docs/BE-08-implementation-review.md
```

No se modificaron:

- `prisma/schema.prisma`.
- migraciones Prisma.
- `package.json` o `package-lock.json`.
- módulo comments / BE-07.
- interceptor global.
- dependencias o versiones del stack.

No se hizo commit ni push.

## Riesgos y desviaciones

### Riesgo aceptado del MVP: paginación en memoria

Para garantizar una paginación combinada correcta sin introducir SQL crudo, el
servicio carga todos los comentarios e historiales visibles del ticket antes de
ordenar y aplicar `slice`.

Esto es simple y correcto para el volumen previsto del MVP, pero su consumo de
memoria crece linealmente con el número de eventos de un ticket. Si aparecen tickets
con historiales muy grandes, convendrá migrar a un `UNION ALL` paginado o a cursor.

### Pruebas unitarias, no integración PostgreSQL

Las reglas nuevas tienen cobertura unitaria amplia y el proyecto completo compila,
pero el repositorio no dispone actualmente de una infraestructura e2e de tickets con
PostgreSQL para probar este endpoint contra datos reales. No se añadió esa
infraestructura porque habría ampliado el alcance.

### Envelope anidado

El envelope paginado anidado se mantiene deliberadamente por decisión aprobada. No
es una regresión de BE-08, pero deberá abordarse como tarea transversal.

### Actor visible

El historial expone actor con `id`, `name` y `role`, consistente con los DTO actuales
de comentarios y tickets. Cuando el actor es de sistema, fue eliminado o no se puede
verificar dentro del tenant, se retorna `null`.

## Puntos para revisión del Tech Lead

1. Confirmar que el DTO discriminado `COMMENT | HISTORY` satisface el contrato que
   consumirá el frontend.
2. Confirmar la decisión de retornar todas las acciones de historial a `USER`, pero
   con `changes` sanitizado por allowlist.
3. Revisar si `actor.id`, `actor.name` y `actor.role` deben mantenerse visibles para
   `USER`; esta implementación sigue los patrones existentes.
4. Confirmar que `totalPages: 1` para timeline vacío debe seguir la convención de
   comments y no la de otros módulos más antiguos.
5. Registrar como deuda futura la paginación SQL/cursor si el volumen real por ticket
   supera las expectativas del MVP.
6. Decidir si se desea añadir una prueba e2e con PostgreSQL en una tarea posterior.

## Conclusión

BE-08 está implementado y validado sin cambios de schema, migraciones, dependencias
ni BE-07. El worktree queda preparado para revisión manual del Tech Lead, sin commit
ni push.
