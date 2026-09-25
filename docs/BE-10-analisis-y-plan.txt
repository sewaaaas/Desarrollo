# CIDRIX API — BE-10: Dashboard y Métricas

## Análisis técnico y plan de implementación

Fecha: 15 de agosto de 2026  
Repositorio: `C:\Users\Sewas\proyecto`  
Backend: `C:\Users\Sewas\proyecto\cidrix-api`  
Fuente de verdad inspeccionada: `main`  
Commit base: `5e2a9f08634392f8d0635cd9887acb088ecfbf37`  
Rama preparada: `feature/be-10-dashboard-metrics`

## 1. Estado inicial del repositorio

### Verificaciones Git

- La rama inicial era `main`.
- `main` y `origin/main` apuntaban al mismo commit:
  `5e2a9f08634392f8d0635cd9887acb088ecfbf37`.
- El commit base es `Merge pull request #3 from
  sewaaaas/feature/be-09-attachments` y su descripción es `BE-09 — Attachments`.
- La comparación `main...HEAD` era `0 0`; no había divergencia.
- El working tree estaba limpio.
- Dado que el repositorio estaba limpio, se creó la rama local solicitada
  `feature/be-10-dashboard-metrics` desde ese commit.
- No se hizo commit ni push.

No se detectaron anomalías funcionales ni trabajo pendiente sin versionar. El único
incidente operativo fue que el primer intento de crear la rama fue bloqueado por los
permisos del sandbox sobre `.git`; se repitió con autorización limitada y se creó
correctamente, sin cambios parciales.

### Alcance de esta fase

Esta entrega contiene exclusivamente análisis y diseño. No se modificó código del
backend, `schema.prisma`, migraciones, dependencias, Docker ni variables de entorno.
Los únicos archivos nuevos de esta fase son los dos informes solicitados.

## 2. Resumen ejecutivo

El modelo actual permite construir un dashboard operacional útil sin cambiar Prisma:

- `Ticket` conserva organización, estado, prioridad, categoría, creador, asignado,
  fecha de creación, fecha de primera respuesta, fecha de resolución y fecha de
  cierre.
- Los seis estados reales son `OPEN`, `IN_PROGRESS`, `PENDING`, `RESOLVED`, `CLOSED`
  y `CANCELLED`.
- Las cuatro prioridades reales son `LOW`, `MEDIUM`, `HIGH` y `CRITICAL`.
- Existe aislamiento multi-tenant consolidado mediante `organizationId` obtenido
  del JWT.
- Existen guards y decoradores reutilizables para permitir únicamente los roles
  aprobados.
- Los índices actuales cubren organización + estado, prioridad, asignado y fecha de
  creación.

Se recomienda implementar dos endpoints semánticos:

```http
GET /api/v1/dashboard/overview
GET /api/v1/dashboard/trends?period=30d
```

`overview` debe devolver la fotografía operacional actual: resumen por estado,
distribución por prioridad, distribución por categoría, carga por asignado y
promedios de resolución/cierre. `trends` debe devolver una serie diaria acotada a
`7d`, `30d` o `90d`.

Separar ambos recursos es preferible a llamarlos `stats` y `charts`: “overview” y
“trends” describen datos de dominio, no una decisión visual del frontend. También
permite refrescar la fotografía actual sin recalcular siempre la serie temporal.

Para el MVP se recomienda acceso a `ADMIN` y `TECHNICIAN` de la organización. `USER`
debe quedar fuera porque una métrica agregada de toda la organización ampliaría su
alcance actual, que en Tickets está limitado a sus propios tickets.

No se recomienda migración, índice nuevo, caché ni dependencia nueva antes de medir
el comportamiento con datos representativos y revisar `EXPLAIN (ANALYZE, BUFFERS)`.

## 3. Arquitectura actual relevante

### Flujo HTTP y módulos

El proyecto usa NestJS 11 con prefijo global `api/v1`. Los módulos se registran en
`AppModule`; `DatabaseModule` es global y expone una única instancia de
`PrismaService`.

El patrón predominante es:

```text
Controller
  -> Service
     -> PrismaService
```

Comments y Attachments agregan un Repository porque tienen transacciones, locks y
consultas de persistencia más especializadas. Dashboard tendrá varias agregaciones
y SQL parametrizado para series/promedios, por lo que un Repository independiente
está justificado y mantiene el controller delgado.

### Autenticación y autorización

- `JwtAuthGuard` valida el bearer token.
- `JwtStrategy` construye `RequestUser` con `id`, `email`, `role` y
  `organizationId`.
- `@CurrentUser()` obtiene ese contexto desde `req.user`.
- `RolesGuard` aplica la allowlist declarada mediante `@Roles()`.
- Los controllers actuales combinan explícitamente
  `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles(...)`.

Dashboard debe repetir ese patrón; no debe aceptar `organizationId` por query,
header, path ni body.

### Multi-tenancy existente

Tickets limita todas sus lecturas por `organizationId`. Comments, Timeline y
Attachments reforzaron el patrón mediante filtros tenant-first y, cuando aplica,
FKs compuestas. Dashboard no necesita consultar primero una entidad individual:
cada count, groupBy, lookup o raw query debe incluir el `organizationId` del usuario
autenticado directamente en su `WHERE`.

### Respuestas y errores

`ResponseInterceptor` envuelve globalmente cada retorno exitoso del controller en:

```json
{ "data": "<retorno del controller>" }
```

Por ello el dashboard debe retornar el payload semántico directamente y no construir
manualmente otro envelope. El contrato HTTP efectivo será `{ data: { ... } }`.
No se debe corregir ni cambiar globalmente el interceptor en BE-10.

`HttpExceptionFilter` conserva el contrato de error:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "..."
  }
}
```

Los valores inválidos de query serán rechazados por el `ValidationPipe` global con
whitelist, `forbidNonWhitelisted` y transformación explícita.

### Filtros y paginación actuales

Los DTOs usan `class-validator` y `class-transformer`. La paginación habitual es
`page=1`, `limit=20`, máximo 100; las colecciones se ordenan de forma determinista.
Las métricas del dashboard serán conjuntos pequeños y no deben paginarse en el MVP.
La serie temporal tiene un máximo cerrado de 90 filas.

### Pruebas actuales

El backend contiene suites unitarias para Comments, Timeline y Attachments, además
de DTOs y repositories relacionados. La suite e2e existente es todavía la prueba
básica del scaffold de Nest y no ofrece infraestructura PostgreSQL aislada para
probar agregaciones reales. BE-10 debe mantener el patrón de unit tests con Prisma
mockeado y puede añadir pruebas HTTP del controller con service/guards controlados;
no debe inventar infraestructura e2e de base de datos como efecto lateral.

## 4. Datos disponibles actualmente para métricas

### Ticket

| Campo | Existe | Uso viable en BE-10 | Observación |
|---|---:|---|---|
| `id` | Sí | Conteos | UUID global. |
| `organizationId` | Sí | Aislamiento obligatorio | Debe estar en toda consulta. |
| `status` | Sí | Resumen y carga | Enum con seis valores. |
| `priority` | Sí | Distribución | Enum con cuatro valores. |
| `categoryId` | Sí, nullable | Distribución por categoría | Representa la categoría actual. |
| `assignedToId` | Sí, nullable | Carga por asignado | Puede apuntar a TECHNICIAN o ADMIN. |
| `createdById` | Sí | Filtros futuros | No es necesario en el MVP del dashboard. |
| `firstResponseAt` | Sí, nullable | Métrica futura de respuesta | No equivale a SLA. |
| `resolvedAt` | Sí, nullable | Tiempo de resolución y tendencia | Se reinicia a null al reabrir. |
| `closedAt` | Sí, nullable | Tiempo de cierre y tendencia | Solo se establece al cerrar. |
| `createdAt` | Sí | Evolución y duración | Timestamp de origen. |
| `updatedAt` | Sí | Actividad aproximada | No identifica qué cambió. |
| `deletedAt` | No | No aplica | Ticket no tiene soft delete. |

### Estados reales y transiciones relevantes

```text
OPEN -> IN_PROGRESS | CANCELLED
IN_PROGRESS -> PENDING | RESOLVED | CANCELLED
PENDING -> IN_PROGRESS | CANCELLED
RESOLVED -> IN_PROGRESS | CLOSED
CLOSED -> sin transiciones
CANCELLED -> sin transiciones
```

El código considera terminales únicamente `CLOSED` y `CANCELLED`. Para una
definición alineada al dominio actual, la carga “activa” puede definirse como todos
los tickets no terminales: `OPEN`, `IN_PROGRESS`, `PENDING` y `RESOLVED`. Esta
definición necesita aprobación porque algunas operaciones podrían preferir excluir
`RESOLVED` al medir trabajo pendiente de ejecución.

### Semántica temporal comprobada

- Al pasar a `RESOLVED`, `resolvedAt` se establece con la hora del cambio.
- Si un ticket `RESOLVED` vuelve a `IN_PROGRESS`, `resolvedAt` se limpia.
- Una resolución posterior vuelve a establecer `resolvedAt`.
- Al pasar de `RESOLVED` a `CLOSED`, se establece `closedAt` y se conserva
  `resolvedAt`.

En consecuencia, `resolvedAt - createdAt` permite medir tiempo hasta la resolución
vigente o más reciente de tickets actualmente resueltos/cerrados. No permite medir
la primera resolución histórica ni todas las resoluciones de un ticket reabierto.
`closedAt - createdAt` sí representa el tiempo de creación a cierre para tickets
cerrados.

### Categorías

Category contiene `organizationId`, `name`, `isActive`, `deletedAt` y timestamps.
El ticket conserva el `categoryId` actual. Una categoría inactiva o eliminada
lógicamente continúa en la base de datos y puede seguir referenciada por tickets.

La distribución propuesta debe:

- agrupar por el `categoryId` actual del ticket;
- incluir un bucket explícito para `categoryId = null` (“Sin categoría”);
- resolver las categorías con `organizationId + id`;
- conservar buckets con tickets aunque la categoría esté inactiva o soft-deleted;
- devolver `isActive` e `isDeleted` para que el frontend no presente esos grupos
  como categorías vigentes;
- omitir categorías con cero tickets en esta distribución, ya que no contribuyen al
  gráfico y podrían aumentar el payload sin valor operacional.

Si el ticket cambió de categoría, el dashboard refleja solo su asociación actual.
Reconstruir distribución histórica requeriría interpretar TicketHistory y queda
fuera del MVP.

### Usuarios y asignaciones

User contiene `organizationId`, `fullName`, `role`, `status` y `deletedAt`. Los
usuarios se eliminan de forma lógica; los tickets no se reasignan automáticamente.
Además, Tickets permite asignar tanto `TECHNICIAN` como `ADMIN` activos.

Por precisión se recomienda llamar al bloque `assigneeWorkload` en lugar de
`technicianWorkload`, incluir solo `id`, `name`, `role`, `status` y conteos, y no
exponer email, avatar, login ni otros datos. Debe existir un conteo separado de
tickets no asignados.

### TicketHistory, Comments y Attachments

- TicketHistory permite reconstruir eventos, pero `changes` es JSON y no tiene un
  campo tipado dedicado para cada transición. Usarlo para el MVP temporal añade
  complejidad y semántica histórica que no hace falta para la fotografía actual.
- Comments aporta `firstResponseAt` al Ticket en la primera respuesta pública de un
  ADMIN/TECHNICIAN. No es necesario leer Comment para dashboard.
- Attachments no aporta métricas candidatas para BE-10 y no debe modificarse.

### SLA

No existe modelo `SlaPolicy`, deadline, target por prioridad/categoría, calendario
laboral ni estado de cumplimiento. `firstResponseAt` y el `slaPolicyId: null` de un
evento son solo preparación. No es posible clasificar “dentro”, “próximo a vencer”
o “vencido” de manera correcta. SLA queda expresamente fuera de BE-10.

## 5. Alcance recomendado para BE-10

### Endpoint de overview

Debe incluir:

1. Total actual de tickets de la organización.
2. Conteo para cada uno de los seis estados, siempre incluyendo ceros.
3. Conteo para cada una de las cuatro prioridades, siempre incluyendo ceros.
4. Distribución por categoría actual, incluido “Sin categoría”.
5. Carga activa por asignado y conteo sin asignar.
6. Promedio creación -> resolución vigente/más reciente.
7. Promedio creación -> cierre.

### Endpoint de trends

Debe incluir una fila diaria, en orden ascendente, para cada día del período aunque
todos los valores sean cero:

- tickets creados por `createdAt`;
- tickets resueltos por `resolvedAt` vigente/más reciente;
- tickets cerrados por `closedAt`.

El MVP soportará `7d`, `30d` y `90d`, con `30d` por defecto.

### Propiedades no funcionales

- tenant isolation fail-closed;
- RBAC explícito;
- payload estable y completamente tipado;
- controller sin lógica de agregación;
- consultas parametrizadas;
- orden determinista;
- respuesta válida para organizaciones sin datos;
- sin caché prematura;
- sin migración ni dependencias nuevas.

## 6. Alcance que NO debería entrar en BE-10

- SLA y políticas de vencimiento.
- Forecasting, IA o recomendaciones.
- BI, report builder o consultas arbitrarias.
- Exportación CSV/PDF.
- Gráficos o cambios de frontend.
- Métricas de Comments o Attachments.
- Métricas históricas exactas por categoría/asignado.
- Primera resolución histórica de tickets reabiertos.
- Percentiles, mediana, P95/P99 o histogramas de duración.
- Comparación contra período anterior.
- Filtros combinables de alta cardinalidad.
- Paginación de rankings.
- Caché Redis, tablas materializadas o jobs de preagregación.
- Cambios globales al response envelope o manejo de errores.
- Refactors de Auth, Users, Categories, Tickets, Comments, Timeline o Attachments.

## 7. Endpoints propuestos

### 7.1 Overview

```http
GET /api/v1/dashboard/overview
Authorization: Bearer <JWT>
```

Sin query params en el MVP.

Razones:

- evita que filtros diferentes hagan ambiguo el significado de los contadores;
- mantiene estable la fotografía operacional;
- permite que frontend refresque cards/rankings en una sola llamada;
- limita el número de combinaciones a probar.

### 7.2 Trends

```http
GET /api/v1/dashboard/trends?period=30d
Authorization: Bearer <JWT>
```

`period` es opcional y solo admite `7d`, `30d`, `90d`.

### Alternativas descartadas

- `GET /dashboard/stats` + `GET /dashboard/charts`: “charts” acopla la API a la
  presentación y no al dato.
- Un único `GET /dashboard`: simplifica una llamada, pero obliga a recalcular y
  transferir tendencias cuando solo se actualizan cards.
- Un endpoint por métrica: aumenta round-trips y fragmenta un MVP pequeño.

## 8. Contratos request/response

### 8.1 Request de overview

No tiene body ni filtros. `organizationId` y rol proceden exclusivamente de
`@CurrentUser()`.

### 8.2 Response efectivo de overview

```json
{
  "data": {
    "summary": {
      "total": 100,
      "byStatus": {
        "OPEN": 20,
        "IN_PROGRESS": 25,
        "PENDING": 10,
        "RESOLVED": 15,
        "CLOSED": 25,
        "CANCELLED": 5
      }
    },
    "byPriority": {
      "LOW": 15,
      "MEDIUM": 45,
      "HIGH": 30,
      "CRITICAL": 10
    },
    "byCategory": [
      {
        "categoryId": "uuid",
        "categoryName": "Hardware",
        "isActive": true,
        "isDeleted": false,
        "count": 30
      },
      {
        "categoryId": null,
        "categoryName": "Sin categoría",
        "isActive": false,
        "isDeleted": false,
        "count": 4
      }
    ],
    "assigneeWorkload": {
      "activeStatuses": ["OPEN", "IN_PROGRESS", "PENDING", "RESOLVED"],
      "unassignedTickets": 7,
      "assignees": [
        {
          "assigneeId": "uuid",
          "assigneeName": "Técnico Uno",
          "role": "TECHNICIAN",
          "status": "ACTIVE",
          "activeTickets": 8,
          "byStatus": {
            "OPEN": 2,
            "IN_PROGRESS": 3,
            "PENDING": 1,
            "RESOLVED": 2
          }
        }
      ]
    },
    "resolutionTime": {
      "resolvedTickets": 40,
      "averageResolutionSeconds": 86400,
      "closedTickets": 25,
      "averageClosureSeconds": 172800
    }
  }
}
```

Reglas del contrato:

- Los mapas de status/prioridad contienen todos los enum reales, incluso con cero.
- Los promedios se expresan en segundos enteros para evitar formatos ambiguos; el
  frontend decide cómo presentarlos.
- Si no hay muestras, el conteo es `0` y el promedio es `null`, nunca `NaN`.
- `summary.total` debe ser igual a la suma de todos los valores de `byStatus`.
- Los resultados por categoría se ordenan por `count DESC`, luego nombre e ID.
- Los asignados se ordenan por `activeTickets DESC`, luego nombre e ID.
- No se exponen emails, avatares, timestamps de usuarios ni IDs de organización.

### 8.3 Request de trends

```text
period?: 7d | 30d | 90d
default: 30d
```

### 8.4 Response efectivo de trends

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
        "resolved": 0,
        "closed": 0
      },
      {
        "date": "2026-07-18",
        "created": 5,
        "resolved": 3,
        "closed": 1
      }
    ]
  }
}
```

El rango es inclusivo por fecha y contiene exactamente 7, 30 o 90 días,
incluyendo el día actual. Internamente debe implementarse como intervalo
`[dateFrom 00:00:00, día posterior a dateTo 00:00:00)` para evitar errores de
milisegundos en el límite superior.

## 9. Métricas propuestas

### Resumen por estado

Contar todos los tickets de la organización por el estado actual. No usar términos
agregados ambiguos como `open` para representar varios estados; el mapa por enum
permite al frontend decidir agrupaciones visuales.

### Prioridad

Contar todos los tickets por prioridad actual. Si la prioridad cambió, se representa
la prioridad actual, no la histórica.

### Categoría

Contar por categoría actual. Incluir bucket null. Incluir categorías soft-deleted o
inactivas solo cuando aún tengan tickets, con flags explícitos.

### Carga por asignado

Definición recomendada: tickets cuyo estado no es terminal. Esto incluye
`RESOLVED`, ya que el dominio permite reabrirlo y no lo trata como terminal.
Presentar breakdown por estado evita esconder esa composición.

El modelo permite asignar a ADMIN, por lo que el nombre y contrato deben hablar de
“asignados”, no asumir que todos son TECHNICIAN. Debe incluir un bucket de no
asignados. Los usuarios inactivos o eliminados que conservan tickets asignados no
deben desaparecer silenciosamente del conteo; pueden aparecer con su status, usando
solo datos mínimos ya expuestos en tickets.

### Evolución temporal

- `created`: fecha de creación.
- `resolved`: `resolvedAt` vigente/más reciente.
- `closed`: `closedAt`.

La serie no debe afirmar que cuenta todos los eventos históricos de resolución. Un
ticket reabierto pierde el timestamp de su resolución previa.

### Tiempo promedio

Se pueden calcular de forma correcta, con la limitación descrita:

- `AVG(resolvedAt - createdAt)` para filas con `resolvedAt IS NOT NULL`;
- `AVG(closedAt - createdAt)` para filas con `closedAt IS NOT NULL`.

Ambos deben incluir conteo de muestra. No se deben promediar valores nulos ni usar
`updatedAt` como sustituto.

### Métrica de primera respuesta

El modelo permitiría `AVG(firstResponseAt - createdAt)`, pero no forma parte del
alcance mínimo pedido y podría confundirse con SLA. Se recomienda reservarla para
una ampliación aprobada, junto con una definición clara.

## 10. Filtros

| Filtro | Utilidad | Complejidad | Recomendación MVP | Validación/multi-tenancy |
|---|---|---:|---|---|
| `period` | Acota trends | Baja | Sí: 7d/30d/90d | Enum cerrado; nunca cambia tenant. |
| `dateFrom/dateTo` | Rangos arbitrarios | Media | No | Requiere límites, orden y timezone. |
| `categoryId` | Dashboard segmentado | Media | No | UUID y existencia `organizationId + id`. |
| `technicianId` / `assigneeId` | Vista individual | Media | No | UUID y usuario del mismo tenant. |
| `status` | Segmentación | Baja | No | Enum; vuelve ambiguo summary. |
| `priority` | Segmentación | Baja | No | Enum; no es necesario para MVP. |

No aceptar filtros desconocidos: el ValidationPipe global ya aplica
`forbidNonWhitelisted`.

## 11. RBAC

### Recomendación

| Rol | Overview | Trends | Motivo |
|---|---:|---:|---|
| `ADMIN` | Sí | Sí | Necesita visión operacional de su organización. |
| `TECHNICIAN` | Sí | Sí | Ya puede listar todos los tickets/categorías de su organización. |
| `USER` | No | No | Su lectura actual está limitada a tickets creados por él. |

Controller propuesto:

```ts
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
```

La restricción puede declararse a nivel de clase para ambos endpoints. El service
debe mantener una validación defensiva de roles si el equipo sigue el patrón de
defensa en profundidad; el control primario continúa en guards.

Permitir USER con métricas “solo mías” sería un contrato diferente y no debe
introducirse implícitamente. Puede evaluarse como una mejora futura.

## 12. Multi-tenancy

Reglas obligatorias:

1. El controller recibe `RequestUser`; nunca recibe `organizationId` del cliente.
2. El service pasa `currentUser.organizationId` al repository.
3. Cada operación Prisma incluye `where: { organizationId, ... }`.
4. Cada `$queryRaw` incluye `WHERE organization_id = ${organizationId}` mediante
   tagged template de Prisma, nunca concatenación de strings.
5. Toda resolución de categorías/asignados usa `organizationId + id`.
6. Los UUID de otros tenants nunca deben producir datos ni etiquetas.
7. Las pruebas deben inspeccionar los argumentos y demostrar que no hay consulta
   sin tenant.

No hace falta aceptar o validar un tenant externo. Un ADMIN sigue siendo administrador
solo de la organización indicada por su JWT.

## 13. Diseño del controller, service y repository

### DashboardController

- Define rutas, guards y roles.
- Obtiene `RequestUser` y DTO de query.
- Delega al service.
- No conoce Prisma ni hace cálculos.
- Retorna el DTO semántico sin envelope manual.

### DashboardService

- Valida/normaliza la semántica del período.
- Solicita agregados al repository.
- Inicializa mapas completos de enums con ceros.
- Une counts con categorías/usuarios de forma fail-closed y tenant-aware.
- Calcula el contrato final y orden determinista.
- No accede directamente a tablas.

### DashboardRepository

- Centraliza queries Prisma y SQL parametrizado.
- Recibe `organizationId` obligatorio en todos los métodos.
- Devuelve estructuras internas mínimas, no DTOs HTTP.
- Usa `groupBy`/`count` para estado, prioridad, categoría y asignado.
- Usa raw SQL únicamente donde Prisma no expresa bien `date_trunc`,
  `generate_series` o la resta/AVG entre dos columnas DateTime.

### Consistencia y concurrencia

No se necesita lock: el dashboard es de solo lectura. Ejecutar las agregaciones
independientes con `Promise.all` reduce latencia. Puede existir una diferencia de
milisegundos entre métricas si un ticket cambia concurrentemente; para un dashboard
operacional es una consistencia eventual aceptable.

No se recomienda `$transaction` solo para “paralelizar”: dentro de una transacción
las consultas comparten conexión y puede aumentar la duración. Si el Tech Lead exige
una fotografía estrictamente consistente, deberá aprobar una transacción de lectura
`REPEATABLE READ`, aceptando su coste.

## 14. Consultas Prisma necesarias

### Overview base

```ts
ticket.groupBy({
  by: ['status'],
  where: { organizationId },
  _count: { _all: true },
});

ticket.groupBy({
  by: ['priority'],
  where: { organizationId },
  _count: { _all: true },
});

ticket.groupBy({
  by: ['categoryId'],
  where: { organizationId },
  _count: { _all: true },
});
```

`summary.total` puede derivarse de los grupos de status para evitar una consulta
`count` adicional.

### Categorías

Resolver solo IDs presentes:

```ts
category.findMany({
  where: { organizationId, id: { in: categoryIds } },
  select: { id: true, name: true, isActive: true, deletedAt: true },
});
```

No añadir `deletedAt: null`, porque ocultaría buckets con tickets históricos aún
asociados.

### Carga

Agrupar por `assignedToId` y `status` con:

```ts
where: {
  organizationId,
  status: { in: ACTIVE_LOAD_STATUSES }
}
```

Después resolver IDs con `user.findMany` filtrando siempre `organizationId`. No
seleccionar email ni credenciales.

### Promedios

Prisma `aggregate` no calcula directamente el promedio de la diferencia entre dos
columnas. Se recomienda `$queryRaw` parametrizado con PostgreSQL:

```sql
COUNT(resolved_at),
AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))
```

y el equivalente para `closed_at`, siempre con
`WHERE organization_id = $tenant`.

### Trends

Prisma `groupBy` agrupa DateTime exacto, no por día. Se recomienda una consulta SQL
parametrizada que:

1. genere los días con `generate_series`;
2. agregue `created_at`, `resolved_at` y `closed_at` por `date_trunc('day', ...)`;
3. haga `LEFT JOIN` de cada agregado sobre la serie;
4. aplique `organization_id` y límites en cada subconsulta;
5. devuelva `0` con `COALESCE`;
6. ordene ascendente por día.

Los límites calculados por el service son parámetros Date, no texto SQL construido
desde el cliente.

## 15. Evaluación de performance

### Índices existentes relevantes

```text
(organization_id, status)
(organization_id, assigned_to_id)
(organization_id, priority)
(organization_id, created_at)
```

También existe el índice único `(organization_id, id)`.

Estos índices cubren adecuadamente el filtro tenant y las métricas principales del
MVP. Las agregaciones por categoría y las fechas `resolved_at`/`closed_at` no tienen
índices dedicados, pero el dashboard necesita inspeccionar una parte relevante de
los tickets del tenant para producir distribuciones globales. Añadir índices sin
volumen ni planes reales sería prematuro.

### Estrategia recomendada

- Ejecutar agregaciones independientes en paralelo cuando no dependan entre sí.
- Seleccionar solo columnas necesarias.
- Limitar trends a 90 días.
- Generar días en SQL para no transferir tickets individuales a Node.
- Calcular duración en PostgreSQL, no cargar todas las fechas en memoria.
- No usar Comments, History ni Attachments para las métricas MVP.
- No cachear en la primera versión.

### Seguimiento posterior

Con datos representativos, capturar `EXPLAIN (ANALYZE, BUFFERS)` para overview y
90d. Solo si se observa beneficio, evaluar:

```text
(organization_id, category_id)
(organization_id, resolved_at)
(organization_id, closed_at)
(organization_id, status, assigned_to_id)
```

Cada índice aumenta almacenamiento y coste de escritura; no debe aprobarse por
intuición.

## 16. Evaluación de índices y migraciones

Recomendación para BE-10 MVP:

```text
Migración requerida: No
Cambio en schema.prisma: No
Índice nuevo inicial: No
```

La decisión debe revisarse tras medir sobre una cardinalidad representativa. Si un
índice resulta necesario, deberá tratarse como una migración explícita separada y
justificada con el plan de ejecución.

## 17. Archivos que habría que crear

```text
cidrix-api/src/modules/dashboard/
├── __tests__/
│   ├── dashboard.controller.spec.ts
│   ├── dashboard-query.dto.spec.ts
│   ├── dashboard.repository.spec.ts
│   └── dashboard.service.spec.ts
├── dto/
│   ├── dashboard-query.dto.ts
│   └── dashboard-response.dto.ts
├── dashboard.controller.ts
├── dashboard.module.ts
├── dashboard.repository.ts
└── dashboard.service.ts
```

Puede añadirse `dashboard.constants.ts` únicamente si las constantes de período y
estados activos no quedan claras en service/DTO; no es obligatorio.

## 18. Archivos que habría que modificar

```text
cidrix-api/src/app/app.module.ts
```

Único cambio previsto: importar y registrar `DashboardModule`.

No se prevé modificar:

- `prisma/schema.prisma`;
- migraciones;
- `package.json` o lockfile;
- Auth/Users/Categories/Tickets/Comments/Timeline/Attachments;
- Docker o `.env`.

## 19. Estrategia de pruebas

### DashboardService

- completa todos los status/prioridades ausentes con cero;
- total coincide con suma por status;
- mapea categorías y bucket sin categoría;
- conserva categorías inactivas/eliminadas referenciadas;
- no mezcla entidades de otro tenant devueltas accidentalmente por un mock;
- orden determinista de categorías y asignados;
- calcula carga y breakdown por estados activos;
- incluye no asignados;
- maneja asignado ADMIN/inactivo/eliminado según decisión aprobada;
- promedios null con muestra cero;
- organización vacía devuelve estructura completa y no falla;
- período por defecto y límites inclusivos correctos.

### DashboardRepository

- cada count/groupBy contiene `organizationId`;
- lookups de Category/User contienen `organizationId + ids`;
- carga usa exclusivamente los estados aprobados;
- SQL de promedio y series es parametrizado y recibe tenant/rango;
- trends produce/normaliza cero para días sin eventos;
- no consulta Comments, Timeline ni Attachments.

### DTOs

- omisión de `period` usa `30d`;
- acepta exactamente `7d`, `30d`, `90d`;
- rechaza `1d`, `365d`, mayúsculas, fechas libres y enums desconocidos;
- rechaza propiedades no permitidas mediante el pipe global en prueba HTTP.

### Controller/autorización

- controller delega `organizationId` desde `RequestUser`, no desde query;
- metadata permite ADMIN y TECHNICIAN;
- USER recibe 403;
- request sin token recibe 401;
- payload no contiene `organizationId`, email ni campos sensibles;
- ambos endpoints conservan el envelope global.

### Integración/e2e

La suite e2e actual no prepara una base PostgreSQL aislada. Para BE-10 se recomienda:

- unit tests exhaustivos con Prisma mockeado;
- una prueba Nest HTTP con DashboardService mockeado para 401/403/200 y validación;
- no añadir contenedores, dependencias ni un harness e2e nuevo dentro de BE-10.

Cuando exista infraestructura e2e compartida, añadir fixtures de dos organizaciones y
verificar que ningún resultado del tenant B aparece en A.

## 20. Casos límite

| Caso | Comportamiento determinista esperado |
|---|---|
| Organización sin tickets | Total 0, todos los enums 0, arrays vacíos, promedios null, serie completa en cero. |
| Un ticket | Conteos 1/0 coherentes, sin división inválida. |
| Categoría sin tickets | No aparece en distribución MVP. |
| Categoría inactiva/eliminada con tickets | Aparece con flags y count. |
| Ticket sin categoría | Bucket `categoryId: null`. |
| Técnico sin tickets | No aparece si ranking es solo grupos con carga; evaluar incluir ceros si frontend lo necesita. |
| Ticket sin asignado | Incrementa `unassignedTickets` si está en estado de carga. |
| Asignado ADMIN | Aparece como assignee con role ADMIN. |
| Asignado inactivo/eliminado | No se pierde el count; aparece con status mínimo o bucket residual según decisión. |
| Ticket reabierto | Resolución previa no aparece; se usa resolución vigente posterior si existe. |
| Sin tickets resueltos/cerrados | Promedio null y muestra 0. |
| Límite de día | Rango semiabierto evita doble conteo. |
| Period inválido | 400 por ValidationPipe. |
| Filtro desconocido | 400 por forbidNonWhitelisted. |
| Sin JWT | 401. |
| USER autenticado | 403. |
| Tenant diferente | Nunca entra en WHERE ni lookup; resultado ausente. |
| Cambios concurrentes | Puede haber variación mínima entre agregados; documentada como eventual. |

## 21. Riesgos técnicos

1. **Semántica de resolución reabierta.** `resolvedAt` no conserva la primera
   resolución ni todas las resoluciones; el nombre del contrato debe explicarlo.
2. **Zona horaria.** Agrupar en UTC es determinista, pero puede diferir del día local
   de la organización. `Organization.settings` puede contener timezone, aunque no
   existe contrato validado para ese JSON.
3. **Usuarios soft-deleted asignados.** Ocultarlos rompe la reconciliación de carga;
   mostrarlos requiere una política de presentación mínima.
4. **ADMIN como asignado.** El modelo lo permite; llamar “technician workload” sería
   técnicamente incorrecto.
5. **Consistencia eventual.** Queries paralelas podrían observar cambios cercanos
   en el tiempo.
6. **Escala desconocida.** Sin cardinalidad ni EXPLAIN real, no se puede justificar
   todavía un índice o caché.
7. **JWT sin revalidación de estado.** La estrategia no consulta si el usuario fue
   desactivado tras emitir el token; es un riesgo transversal existente, no debe
   resolverse dentro de BE-10.
8. **Mojibake preexistente.** Diversos comentarios/documentos existentes muestran
   texto corrupto por codificación. No afecta la lógica de métricas y no debe
   corregirse dentro de esta fase.

## 22. Decisiones que necesitan aprobación del Tech Lead

1. **Endpoints:** aprobar `/dashboard/overview` y `/dashboard/trends` en lugar de
   `/stats` y `/charts` o un endpoint único.
2. **RBAC:** aprobar acceso organizacional para ADMIN + TECHNICIAN y exclusión de
   USER en el MVP.
3. **Carga activa:** aprobar `OPEN + IN_PROGRESS + PENDING + RESOLVED` por ser todos
   los estados no terminales, o excluir `RESOLVED` si “carga” significa trabajo aún
   no resuelto.
4. **Asignados:** aprobar `assigneeWorkload`, incluyendo ADMIN y usuarios
   inactivos/eliminados que aún conservan tickets, con datos mínimos.
5. **Categorías:** aprobar que la métrica represente la categoría actual, incluya
   “Sin categoría” y categorías inactivas/eliminadas con tickets, pero omita grupos
   con cero.
6. **Tiempo de resolución:** aprobar que se mida con `resolvedAt` y se documente como
   resolución vigente/más reciente, no primera resolución histórica.
7. **Trends:** aprobar `created/resolved/closed` y períodos 7d/30d/90d, con 30d por
   defecto.
8. **Timezone:** aprobar UTC para el MVP o exigir el timezone de
   `Organization.settings` con fallback/validación.
9. **Consistencia:** aceptar consultas paralelas eventualmente consistentes o exigir
   snapshot `REPEATABLE READ`.
10. **Índices:** aprobar no crear migración/índice hasta obtener métricas y EXPLAIN
    representativos.

## 23. Plan ordenado de implementación

1. Confirmar las diez decisiones anteriores y congelar contratos.
2. Crear `DashboardModule`, DTO de query y DTOs de respuesta.
3. Crear `DashboardRepository` con groupBy tenant-aware para status, prioridad,
   categoría y carga.
4. Añadir lookups tenant-aware mínimos de categorías y asignados.
5. Implementar SQL parametrizado para promedios y serie temporal diaria.
6. Crear `DashboardService` para completar ceros, unir etiquetas, ordenar y mapear
   contratos.
7. Crear `DashboardController` con JWT, RolesGuard, roles aprobados y endpoints.
8. Registrar `DashboardModule` en `AppModule`.
9. Implementar tests de DTO, repository, service y controller/autorización.
10. Ejecutar Prisma validate solo como verificación (sin format/generate si Prisma
    no cambió), tests completos, lint sin fix, build y `git diff --check`.
11. Revisar que el diff no toque módulos ajenos, schema, migraciones, dependencias,
    Docker ni `.env`.
12. Generar el informe de implementación y detenerse para revisión, sin commit ni
    push salvo instrucción posterior explícita.

## Conclusión

BE-10 es viable sobre el modelo actual y puede entregar valor operacional sin
modificar la base de datos. El diseño recomendado mantiene los límites del MVP,
reutiliza Auth/RBAC/multi-tenancy existentes y reserva SLA, históricos exactos,
caché e índices adicionales para fases justificadas por datos reales.

Estado de esta fase: **LISTO PARA REVISIÓN**.
