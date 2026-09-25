# CIDRIX API — BE-10: Dashboard y Métricas

## Informe de implementación para revisión técnica

Fecha: 15 de agosto de 2026  
Repositorio: `C:\Users\Sewas\proyecto`  
Backend: `C:\Users\Sewas\proyecto\cidrix-api`  
Rama: `feature/be-10-dashboard-metrics`  
Commit base: `5e2a9f08634392f8d0635cd9887acb088ecfbf37`

## 1. Estado inicial

Antes de implementar se confirmó:

- rama actual `feature/be-10-dashboard-metrics`;
- `HEAD` exactamente en `5e2a9f08634392f8d0635cd9887acb088ecfbf37`;
- commit base `Merge pull request #3 from
  sewaaaas/feature/be-09-attachments`;
- BE-09 presente en el commit base;
- working tree limpio excepto por los informes de análisis aprobados:
  `docs/BE-10-analisis-y-plan.md` y `.txt`;
- sin trabajo de código previo que pudiera sobrescribirse.

No se hizo commit, push, merge, Pull Request ni cambio de rama durante la
implementación.

## 2. Resumen de la implementación

Se implementó un módulo NestJS independiente `DashboardModule` con la arquitectura
aprobada:

```text
DashboardController
  -> DashboardService
     -> DashboardRepository
        -> Prisma / PostgreSQL
```

El módulo proporciona:

```http
GET /api/v1/dashboard/overview
GET /api/v1/dashboard/trends?period=30d
```

El overview incluye conteos por estado y prioridad, distribución por categoría,
carga activa por asignado y tiempos promedio de resolución/cierre. Trends entrega
una serie UTC diaria de tickets creados y cerrados para 7, 30 o 90 días.

## 3. Archivos creados

### Código productivo

```text
cidrix-api/src/modules/dashboard/dashboard.constants.ts
cidrix-api/src/modules/dashboard/dashboard.controller.ts
cidrix-api/src/modules/dashboard/dashboard.module.ts
cidrix-api/src/modules/dashboard/dashboard.repository.ts
cidrix-api/src/modules/dashboard/dashboard.service.ts
cidrix-api/src/modules/dashboard/dto/dashboard-query.dto.ts
cidrix-api/src/modules/dashboard/dto/dashboard-response.dto.ts
```

### Pruebas

```text
cidrix-api/src/modules/dashboard/__tests__/dashboard.controller.spec.ts
cidrix-api/src/modules/dashboard/__tests__/dashboard-query.dto.spec.ts
cidrix-api/src/modules/dashboard/__tests__/dashboard.repository.spec.ts
cidrix-api/src/modules/dashboard/__tests__/dashboard.service.spec.ts
```

### Documentación de implementación

```text
docs/BE-10-implementation-review.md
docs/BE-10-implementation-review.txt
```

## 4. Archivo modificado

```text
cidrix-api/src/app/app.module.ts
```

Único cambio: importar y registrar `DashboardModule`.

No se modificó ningún otro módulo funcional.

## 5. Arquitectura implementada

### DashboardController

- Define las rutas `overview` y `trends`.
- Aplica `JwtAuthGuard` y `RolesGuard` a nivel de controller.
- Declara la allowlist de roles ADMIN y TECHNICIAN.
- Obtiene el tenant desde `@CurrentUser()`.
- Recibe exclusivamente `DashboardQueryDto` para trends.
- Delega al service y retorna el payload semántico.
- No llama Prisma, no ejecuta SQL y no crea `{ data: ... }` manualmente.

### DashboardService

- Recibe `RequestUser` y usa solo su `organizationId`.
- Ejecuta agregaciones independientes con `Promise.all`.
- Completa todos los estados y prioridades ausentes con cero.
- Deriva `summary.total` de la suma exacta de `byStatus`.
- Resuelve categorías y asignados tenant-aware.
- Omite de forma fail-closed etiquetas no resueltas dentro del tenant.
- Aplica orden determinista.
- Normaliza promedios a segundos enteros o null.
- Calcula rangos UTC semiabiertos.
- Aplica una segunda defensa para excluir cualquier estado inesperado del workload.

### DashboardRepository

- Encapsula todo acceso a Prisma.
- Exige `organizationId` en cada método.
- Usa Prisma `groupBy` y `findMany` para agregaciones/labels.
- Usa `$queryRaw` tagged y parametrizado solo para promedios y serie temporal.
- Selecciona únicamente datos mínimos de Category/User.
- No conoce contratos HTTP ni el response envelope.

## 6. Endpoints finales

### Overview

```http
GET /api/v1/dashboard/overview
```

No acepta filtros ni `organizationId` externo.

### Trends

```http
GET /api/v1/dashboard/trends?period=30d
```

Valores permitidos:

```text
7d
30d
90d
```

Default: `30d`.

Se rechazan períodos arbitrarios, mayúsculas y campos desconocidos mediante el DTO
y el ValidationPipe global.

## 7. RBAC final

Roles permitidos:

```text
ADMIN
TECHNICIAN
```

Rol excluido:

```text
USER
```

Decoración aplicada a nivel de controller:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
```

Las pruebas verifican allowlist, ADMIN/TECHNICIAN permitidos, USER rechazado y 401
cuando JwtAuthGuard no recibe un usuario autenticado.

## 8. Estrategia multi-tenant

Flujo implementado:

```text
JWT
 -> RequestUser.organizationId
 -> DashboardService
 -> DashboardRepository
 -> Prisma / PostgreSQL
```

No existe parámetro HTTP para organización. Todas las consultas incluyen tenant:

- groupBy status: `where.organizationId`;
- groupBy priority: `where.organizationId`;
- groupBy category: `where.organizationId`;
- groupBy workload: `where.organizationId`;
- Category lookup: `organizationId + ids`;
- User lookup: `organizationId + ids`;
- promedios raw: `WHERE organization_id = ${organizationId}`;
- agregados created/closed de trends: cada subquery contiene
  `WHERE organization_id = ${organizationId}`.

Los raw queries usan tagged templates de Prisma. No existe concatenación SQL con
valores del request.

## 9. Contrato de overview

El controller retorna el payload semántico y el interceptor global produce el único
envelope efectivo:

```json
{
  "data": {
    "summary": {
      "total": 0,
      "byStatus": {
        "OPEN": 0,
        "IN_PROGRESS": 0,
        "PENDING": 0,
        "RESOLVED": 0,
        "CLOSED": 0,
        "CANCELLED": 0
      }
    },
    "byPriority": {
      "LOW": 0,
      "MEDIUM": 0,
      "HIGH": 0,
      "CRITICAL": 0
    },
    "byCategory": [],
    "assigneeWorkload": {
      "activeStatuses": ["OPEN", "IN_PROGRESS", "PENDING"],
      "unassignedTickets": 0,
      "assignees": []
    },
    "resolutionTime": {
      "resolutionSampleCount": 0,
      "averageResolutionSeconds": null,
      "closureSampleCount": 0,
      "averageClosureSeconds": null
    }
  }
}
```

No se modificó `ResponseInterceptor`.

## 10. Contrato de trends

```json
{
  "data": {
    "period": "30d",
    "timezone": "UTC",
    "dateFrom": "2026-07-17",
    "dateTo": "2026-08-15",
    "series": [
      {
        "date": "2026-07-17",
        "created": 0,
        "closed": 0
      }
    ]
  }
}
```

La serie contiene únicamente `created` y `closed`. No existe campo `resolved` ni
consulta de `resolvedAt` dentro de trends.

## 11. Active workload final

La constante única `ACTIVE_WORKLOAD_STATUSES` contiene exactamente:

```text
OPEN
IN_PROGRESS
PENDING
```

No incluye:

```text
RESOLVED
CLOSED
CANCELLED
```

Repository aplica esa allowlist en el groupBy. Service vuelve a filtrar mediante un
type guard defensivo. `unassignedTickets` usa el mismo conjunto. `byStatus` de cada
asignado siempre contiene solo OPEN, IN_PROGRESS y PENDING, completados con cero.

## 12. Queries Prisma implementadas

### groupBy

- Ticket por `status`.
- Ticket por `priority`.
- Ticket por `categoryId`.
- Ticket por `assignedToId + status`, limitado a active workload.

Todos usan `where: { organizationId }`.

### Lookups

- Category por `organizationId + id IN (...)`.
- User por `organizationId + id IN (...)`.

No se consulta cuando el conjunto de IDs está vacío.

Campos Category seleccionados:

```text
id, name, isActive, deletedAt
```

Campos User seleccionados:

```text
id, fullName, role, status
```

No se seleccionan email, avatar, organizationId, credenciales ni timestamps de
usuario.

## 13. Raw SQL implementado

### Promedios

Una consulta tagged calcula:

```sql
COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)
ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))))
COUNT(*) FILTER (WHERE closed_at IS NOT NULL)
ROUND(AVG(EXTRACT(EPOCH FROM (closed_at - created_at))))
```

Incluye `WHERE organization_id = <parámetro>`.

### Trends

La consulta usa:

- `generate_series` para producir todos los días;
- `date_trunc('day', created_at)`;
- `date_trunc('day', closed_at)`;
- `LEFT JOIN` para días vacíos;
- `COALESCE(..., 0)`;
- `ORDER BY day ASC`;
- filtros `[start, end)` en ambos agregados;
- conversión explícita `AT TIME ZONE 'UTC'` para no depender del timezone de sesión.

No consulta `resolved_at`.

## 14. Categorías activas, inactivas y eliminadas

- Se agrupa por el `categoryId` actual del ticket.
- Los tickets con `categoryId = null` forman el bucket “Sin categoría”.
- No se aplica filtro `isActive` ni `deletedAt` en el lookup, por lo que una categoría
  inactiva o soft-deleted con tickets permanece visible.
- `isDeleted` se deriva de `deletedAt !== null`.
- Categorías con cero tickets no aparecen porque el lookup parte de IDs agrupados.
- Etiquetas no resueltas dentro del tenant se omiten fail-closed.
- Orden: count DESC, nombre ASC, ID ASC.
- No se usa TicketHistory para reconstruir categorías históricas.

## 15. Usuarios inactivos o eliminados

El lookup de asignados no filtra status ni deletedAt. Así un ADMIN/TECHNICIAN
inactivo o soft-deleted que conserva tickets asignados mantiene su count.

Solo se expone:

```text
assigneeId
assigneeName
role
status
activeTickets
byStatus
```

El contrato usa `assigneeWorkload` porque el dominio permite asignar tanto
TECHNICIAN como ADMIN.

## 16. Promedios

Contrato final:

```text
resolutionSampleCount
averageResolutionSeconds
closureSampleCount
averageClosureSeconds
```

Los promedios se redondean a segundos enteros. Si no hay muestras o el valor no es
finito, se retorna null; nunca NaN ni Infinity.

`resolvedAt` se interpreta como la resolución vigente/más reciente. No se presenta
como primera resolución histórica. `closedAt` mide creación a cierre.

## 17. Timezone y límites

- Timezone fijo del MVP: UTC.
- No se lee `Organization.settings.timezone`.
- El día actual se obtiene con componentes UTC.
- El inicio es el día UTC actual menos `days - 1`.
- El fin es el comienzo UTC del día siguiente.
- Intervalo: `[start, end)`.
- Se generan exactamente 7, 30 o 90 días, incluido el día actual.

## 18. Casos límite cubiertos

- Organización sin tickets: estructura completa en cero/null.
- Estados y prioridades ausentes: keys presentes con cero.
- Total derivado de byStatus.
- Ticket sin categoría.
- Categorías activa, inactiva y soft-deleted.
- Etiqueta de categoría no resuelta/ajena: omitida.
- TECHNICIAN y ADMIN asignados.
- Usuario inactivo o eliminado con carga.
- Usuario no solicitado/ajeno: omitido.
- Ticket activo sin asignado.
- RESOLVED/CLOSED/CANCELLED fuera de workload incluso ante datos inesperados.
- Promedios sin muestras y valores no finitos.
- Rangos UTC 7d, 30d y 90d.
- Períodos y campos desconocidos inválidos.
- Orden determinista de categorías, asignados y series.

## 19. Tests añadidos

Se añadieron cuatro suites y 31 tests:

```text
dashboard-query.dto.spec.ts
dashboard.repository.spec.ts
dashboard.service.spec.ts
dashboard.controller.spec.ts
```

La suite completa pasó de 119 a 150 tests.

## 20. Resultado completo de tests

Comando final:

```text
npm.cmd test -- --runInBand
```

Resultado:

```text
Test Suites: 13 passed, 13 total
Tests:       150 passed, 150 total
Snapshots:   0 total
```

Incidencias corregidas durante la implementación:

1. El primer targeted run no compiló un test por usar `Array.at`, no disponible con
   target ES2021. Se sustituyó por índice compatible.
2. El primer full run tuvo 149/150: una expectativa textual no incluía la nueva
   conversión UTC explícita del SQL. Se actualizó el test para verificar la forma
   UTC exacta. El run final pasó 150/150.

No se ocultaron ni ignoraron tests fallidos.

## 21. Resultado del build

Comando:

```text
npm.cmd run build
```

Resultado: PASS.

Durante la primera compilación Prisma no pudo inferir correctamente el tipo de
retorno de `groupBy` cuando se retornaba directamente con una anotación explícita.
Se materializó el resultado antes de retornarlo; no se cambió schema ni query. Las
compilaciones posteriores pasaron.

## 22. Resultado de lint

El script `npm run lint` contiene `--fix`, por lo que no se ejecutó para evitar
modificar archivos ajenos. Se usó ESLint sin autofix.

### Lint del alcance BE-10

```text
npx.cmd eslint "src/modules/dashboard/**/*.ts" "src/app/app.module.ts" --max-warnings=0
```

Resultado: PASS, cero errores y cero warnings.

### Lint global sin autofix

```text
npx.cmd eslint "{src,apps,libs,test}/**/*.ts"
```

Resultado final: FAIL por deuda preexistente fuera del alcance, con 219 problemas
(213 errores y 6 warnings), principalmente finales CRLF/Prettier y reglas de
TypeScript en Auth, Users, Categories, Tickets y Comments. Las observaciones que sí
pertenecían a los tests nuevos fueron corregidas; el lint específico de todo el diff
BE-10 pasa con cero errores y cero warnings.

No se ejecutó autofix ni se alteraron módulos existentes para limpiar esa deuda.

## 23. Resultado de Prisma validate

Comando:

```text
npx.cmd prisma validate
```

Resultado:

```text
The schema at prisma\schema.prisma is valid
```

No se ejecutó `prisma generate`, migrate ni se creó migración porque el schema no
cambió.

## 24. Resultado de git diff --check

Comando:

```text
git diff --check
```

Resultado: PASS, sin errores de whitespace. Git mostró únicamente el warning de
conversión futura LF -> CRLF para `src/app/app.module.ts`; no representa un error del
diff ni produjo cambios adicionales.

## 25. Warnings existentes

1. El lint global del repositorio no está limpio en el commit base; arreglarlo
   requeriría cambios masivos fuera de BE-10.
2. Los tests existentes de Attachments y Comments imprimen logs informativos de
   Nest durante el run; no representan fallos.
3. El response interceptor global sigue produciendo el envelope existente. BE-10 no
   lo modifica.
4. Git informa que `app.module.ts` podrá convertirse de LF a CRLF la próxima vez que
   Git lo escriba, según la configuración local de line endings.

## 26. Desviaciones del plan

No hubo desviaciones funcionales del prompt aprobado.

Ajuste técnico menor:

- Se añadió `dashboard.constants.ts`, permitido por el plan, para mantener en una
  única fuente `ACTIVE_WORKLOAD_STATUSES`, períodos y duración en días.
- Service aplica defensa adicional para estados de workload, además del filtro del
  repository.
- SQL de trends convierte parámetros explícitamente a UTC, reforzando el contrato.

No se añadieron endpoints, filtros ni métricas opcionales.

## 27. Riesgos y deuda técnica restante

1. `resolvedAt` no conserva resoluciones anteriores después de una reapertura; el
   promedio solo representa resolución vigente/más reciente.
2. Las consultas de overview son independientes y eventualmente consistentes, según
   decisión aprobada.
3. No existe caché, materialización ni índices específicos de dashboard; debe
   evaluarse con volumen real antes de optimizar.
4. Los raw queries están cubiertos unitariamente en estructura, parámetros y
   contrato, pero el proyecto aún no dispone de un harness PostgreSQL e2e aislado
   para ejecutar escenarios multi-tenant reales.
5. Los modelos Ticket -> assignedTo/category usan relaciones históricas existentes;
   Dashboard vuelve a aplicar organizationId al resolver etiquetas y omite cualquier
   referencia que no pueda resolver dentro del tenant.
6. El lint global preexistente permanece pendiente como tarea transversal.

## 28. Confirmaciones de alcance

```text
schema.prisma modificado: No
migraciones creadas: No
dependencias modificadas: No
package-lock modificado: No
Docker modificado: No
.env modificado: No
Auth modificado: No
Users modificado: No
Categories modificado: No
Tickets modificado: No
Comments modificado: No
Timeline modificado: No
Attachments modificado: No
SLA añadido: No
TicketHistory usado: No
frontend modificado: No
commit/push/PR/merge: No
```

## 29. Lista exacta del diff de implementación

```text
M  cidrix-api/src/app/app.module.ts
?? cidrix-api/src/modules/dashboard/__tests__/dashboard-query.dto.spec.ts
?? cidrix-api/src/modules/dashboard/__tests__/dashboard.controller.spec.ts
?? cidrix-api/src/modules/dashboard/__tests__/dashboard.repository.spec.ts
?? cidrix-api/src/modules/dashboard/__tests__/dashboard.service.spec.ts
?? cidrix-api/src/modules/dashboard/dashboard.constants.ts
?? cidrix-api/src/modules/dashboard/dashboard.controller.ts
?? cidrix-api/src/modules/dashboard/dashboard.module.ts
?? cidrix-api/src/modules/dashboard/dashboard.repository.ts
?? cidrix-api/src/modules/dashboard/dashboard.service.ts
?? cidrix-api/src/modules/dashboard/dto/dashboard-query.dto.ts
?? cidrix-api/src/modules/dashboard/dto/dashboard-response.dto.ts
?? docs/BE-10-implementation-review.md
?? docs/BE-10-implementation-review.txt
```

Además continúan sin versionar los dos documentos de análisis generados y aprobados
antes de implementar:

```text
docs/BE-10-analisis-y-plan.md
docs/BE-10-analisis-y-plan.txt
```

## 30. Estado final

La implementación funcional de BE-10 está completa y cubierta por tests. No se
realizaron cambios de schema, migraciones, dependencias o módulos ajenos.

Estado: **LISTO PARA REVISIÓN**, sujeto a la observación transparente del lint global
preexistente indicada en este informe.
