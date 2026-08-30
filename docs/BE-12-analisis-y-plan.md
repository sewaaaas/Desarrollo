# CIDRIX API — BE-12: Configuración del sistema / Settings

## Análisis técnico y plan de implementación

Fecha: 30 de agosto de 2026  
Repositorio: `C:\Users\Sewas\proyecto`  
Backend: `C:\Users\Sewas\proyecto\cidrix-api`

## 1. Estado inicial

Antes del análisis se verificó:

- `main` contiene BE-11 — Notifications.
- `main`, `origin/main` y `origin/HEAD` apuntan al mismo commit.
- La base local tiene las siete migraciones actuales aplicadas y Prisma reporta
  `Database schema is up to date!`.
- No existían cambios locales de código.
- Solo estaban sin versionar los cuatro documentos históricos conocidos de BE-10:
  - `docs/BE-10-analisis-y-plan.md`;
  - `docs/BE-10-analisis-y-plan.txt`;
  - `docs/BE-10-implementation-review.md`;
  - `docs/BE-10-implementation-review.txt`.
- Esos documentos no fueron borrados, editados, staged ni incluidos en BE-12.
- No se modificó backend, Prisma, migraciones, dependencias, `.env` ni módulos
  terminados durante esta fase.

## 2. Rama y commit base

```text
Rama creada: feature/be-12-settings
Commit base: 25b89fb4ef472209ef06651dbf26b6ab91b7d0fd
Commit: Merge pull request #5 from sewaaaas/feature/be-11-notifications
main alineado con origin/main: Sí
BE-11 integrado: Sí
```

## 3. Resumen ejecutivo

CIDRIX ya tiene persistencia suficiente para un Settings MVP:
`Organization.settings` es un JSONB no nulo con default `{}`. Sin embargo, no
existen endpoints, DTOs, contrato TypeScript ni lectura de ese campo en runtime. El
seed es el único escritor y guarda `timezone`, `language` y `dateFormat`.

Se recomienda un MVP deliberadamente pequeño con un único setting soportado:

```text
timezone
```

Razones:

- ya está previsto y poblado por el seed;
- tiene un contrato estándar mediante nombres IANA;
- puede validarse con `@IsTimeZone()` de la dependencia ya instalada;
- sirve a todos los roles como configuración de presentación;
- no obliga a modificar Tickets, Dashboard, Attachments o Notifications;
- puede persistirse en el JSONB actual sin migración.

BE-12 debe crear un SettingsModule con `GET /api/v1/settings` para los tres roles y
`PATCH /api/v1/settings` solo para ADMIN. El service puede usar Prisma directamente;
un repository no aporta valor para dos operaciones simples sobre una sola entidad.

Dashboard debe seguir respondiendo en UTC. Integrar la zona organizacional en sus
rangos diarios cambia semántica de métricas y debe ser una mejora posterior con
diseño y tests propios.

## 4. Modelo Organization actual

| Campo | Tipo Prisma / DB | Regla |
|---|---|---|
| `id` | String / TEXT | PK, UUID generado por Prisma |
| `name` | String / VARCHAR(255) | obligatorio |
| `slug` | String / VARCHAR(100) | único global |
| `plan` | OrgPlan | default `FREE` |
| `isActive` | Boolean | default `true` |
| `settings` | Json / JSONB | no nulo, default `{}` |
| `createdAt` | DateTime | default `now()` |
| `updatedAt` | DateTime | `@updatedAt` |

Relaciones:

```text
users
categories
tickets
ticketCounters
comments
attachments
notifications
```

Restricciones e índices:

- primary key en `id`;
- unique global en `slug`;
- no hay índices adicionales de Organization;
- no existe `deletedAt` ni soft delete para Organization;
- la activación se representa exclusivamente con `isActive`.

La única creación encontrada es el `upsert` del seed por `slug = cidrix-demo`. No
existe OrganizationsModule, onboarding API ni endpoint para crear/editar una
organización.

## 5. Campo settings actual

Schema:

```prisma
/// Solo para configuración variable (timezone, logo, idioma).
/// Nunca para lógica de negocio.
settings Json @default("{}") @db.JsonB
```

Características reales:

- PostgreSQL impide SQL NULL por el `NOT NULL` de la migración inicial;
- JSONB aún puede contener el literal JSON `null`, un array, scalar u objeto con
  estructura arbitraria si un escritor interno lo guarda;
- `{}` es el único default de persistencia;
- no hay constraint sobre keys o valores;
- Prisma lo expone como `JsonValue`, no como un contrato de dominio tipado;
- actualizarlo mediante Prisma actualiza también `Organization.updatedAt`.

## 6. Uso real de settings encontrado

No hay consumo runtime de `Organization.settings`.

La búsqueda global confirmó:

- ningún controller expone settings;
- ningún service los lee o actualiza;
- no existen DTOs, tipos, constantes ni tests de settings;
- Auth no incluye settings en tokens ni en `/auth/me`;
- Dashboard declara y devuelve `timezone: 'UTC'` de forma explícita;
- Tickets y Notifications formatean `TKT-` directamente en código;
- Attachments usa configuración técnica global desde environment/ConfigService;
- la política de Notifications no consulta preferencias organizacionales.

## 7. Datos y seeds existentes

El seed crea o reutiliza `cidrix-demo` con:

```json
{
  "timezone": "America/Bogota",
  "language": "es",
  "dateFormat": "DD/MM/YYYY"
}
```

La consulta de solo lectura a la base local confirmó una organización activa con
exactamente esos valores. No se encontraron otros writers ni estructuras de
settings.

Implicación: `language` y `dateFormat` son datos legacy previstos, pero todavía no
son contrato público ni tienen comportamiento. BE-12 no debe borrarlos al guardar
timezone.

## 8. Limitaciones actuales

- JSON libre sin validación.
- Ninguna API de lectura o escritura.
- Defaults efectivos no definidos para organizaciones con `{}`.
- No existe tratamiento de JSON malformado/legacy.
- No existe control RBAC para settings.
- No hay contrato que separe keys soportadas de keys internas/legacy.
- `Organization.updatedAt` es compartido por toda la entidad, no específico de
  settings.
- Un access token no revalida `Organization.isActive` en cada request; Auth solo lo
  comprueba en login.
- No hay auditoría ni versión/optimistic lock para settings.

## 9. Alcance recomendado BE-12

1. Crear SettingsModule.
2. Exponer la configuración efectiva de la organización autenticada.
3. Permitir a ADMIN actualizar únicamente timezone.
4. Validar timezone como zona IANA mediante `@IsTimeZone()`.
5. Aplicar default efectivo `UTC` si falta o es inválido.
6. Preservar keys JSON legacy al actualizar.
7. Rechazar propiedades no soportadas en request.
8. Resolver siempre la organización desde `CurrentUser.organizationId`.
9. Impedir lectura/escritura si la organización no existe o está inactiva.
10. Mantener PATCH idempotente, evitando escribir si el valor efectivo no cambia.
11. Añadir tests de DTO, service y controller.

## 10. Fuera de alcance

- CRUD de Organization, name, slug, plan o activación.
- Locale, idioma, date format e i18n.
- Ticket prefix y numbering configurable.
- Default priority/category y permisos de selección.
- Auto-assignment.
- Auto-close/reopen.
- Preferencias de Notifications.
- Branding, logos y colores.
- SLA, business hours, deadlines o eventos SLA.
- Límites tenant de Attachments.
- Retention, archive y políticas internas.
- Cache, eventos, history o audit de settings.
- Cambios de comportamiento en módulos existentes.
- Secrets, variables de entorno o configuración de infraestructura.

## 11. Settings candidatos evaluados

| Candidato | Soporte actual | Impacto para activarlo | Recomendación MVP |
|---|---|---|---|
| timezone | seed + JSONB; Dashboard aún UTC | solo persistencia/API | Sí |
| locale/language | valor seed sin consumidor | i18n/frontend | No |
| dateFormat | valor seed sin consumidor | frontend | No |
| organization name | columna explícita | ownership de Organizations | No |
| ticket prefix | `TKT` hardcoded en dos módulos | Tickets + Notifications + histórico | No |
| default priority | MEDIUM hardcoded al omitir | modificar Tickets | No |
| default category | no existe | modificar Tickets/Categories | No |
| user category selection | USER prohibido | modificar BE-06 | No |
| user priority selection | actualmente permitido | modificar BE-06/contrato | No |
| auto-assignment | sin infraestructura | motor nuevo | No |
| notification flag | Notifications siempre activas | modificar BE-11 | No |
| notification preferences | sin modelo | modelo/política nueva | No |
| branding | sin frontend/storage de logo org | varios módulos | No |
| SLA/business hours | placeholders solamente | feature completa | No |
| attachment limits | env global + límites seguridad | Attachments/config | No |
| allowed MIME | allowlist de seguridad en código | riesgo seguridad | No |
| retention | no existe | jobs/políticas | No |

## 12. Settings recomendados para MVP

Contrato efectivo único:

```ts
interface SupportedOrganizationSettings {
  timezone: string;
}
```

Default:

```ts
const DEFAULT_ORGANIZATION_SETTINGS = {
  timezone: 'UTC',
} as const;
```

El API siempre devuelve timezone, aunque el JSON almacenado sea `{}` o no contenga
esa key. El default se materializa en la respuesta, no se persiste automáticamente
en GET.

## 13. Settings descartados y motivo

- `language`, `locale`, `dateFormat`: no existe i18n ni consumidor frontend; hacerlos
  públicos congelaría prematuramente enums y semántica.
- `organizationName`: ya es columna de dominio y debe pertenecer a un futuro
  OrganizationsModule, no duplicarse dentro del JSON.
- `ticketPrefix`: requiere cambiar TicketsService y NotificationsService; además,
  los números se formatean al leer, por lo que un cambio afectaría visualmente a
  tickets históricos mientras mensajes snapshot de Notification conservarían el
  prefijo anterior.
- `defaultPriority`: el DTO permite priority opcional y el service aplica MEDIUM;
  activarlo requiere cambiar BE-06 y aclarar si USER puede anular el default.
- settings de category/assignment/status: implican nuevas reglas de negocio en
  Tickets y exceden un módulo de configuración.
- Notifications: un flag organizacional alteraría la matriz de recipients ya
  aprobada; preferencias requieren modelo propio.
- Attachments: sus límites son guardrails técnicos globales y un tenant nunca debe
  poder superar los máximos de infraestructura.
- SLA: no existe feature funcional.

## 14. Timezone

Timezone sí debe entrar al MVP como valor de presentación organizacional.

Reglas propuestas:

- formato: identificador aceptado por IANA/Intl, por ejemplo `America/Lima`;
- validación: `@IsTimeZone()` existente en class-validator 0.14.4;
- default efectivo: `UTC`;
- `null`, string vacío, número o zona inválida: 400;
- opcionalmente aplicar `trim` antes de validar;
- canonicalizar con `Intl.DateTimeFormat(...).resolvedOptions().timeZone` antes
  de comparar/persistir, evitando diferencias solo por casing;
- almacenar el valor IANA canonicalizado, sin inventar offsets fijos como `UTC-5`;
- no persistir default durante GET;
- el seed `America/Bogota` ya es válido.

Pruebas locales de la dependencia confirmaron que acepta `UTC`, `America/Lima`,
`America/Bogota` y rechaza `GMT+5`, vacío e `Invalid/Zone`.

BE-12 solo persiste/expone timezone. Dashboard debe seguir en UTC porque cambiar sus
límites de día, labels y response contract requiere una mejora posterior específica.

## 15. Locale e idioma

No se recomienda exponerlos en el MVP.

`language` suele identificar idioma (`es`, `en`); `locale` combina reglas regionales
(`es-PE`, `en-US`). El seed solo tiene `language: es`, sin enum ni consumidor. Crear
ambos ahora generaría solapamiento y obligaría a decidir fallback, traducciones,
formato numérico y catálogos inexistentes.

Estrategia: preservar `language` y `dateFormat` como keys legacy al hacer PATCH,
pero no devolverlas ni aceptar cambios vía API hasta diseñar i18n/frontend.

## 16. Ticket prefix

`TKT` está hardcoded en:

- `TicketsService.formatNumber()`;
- `NotificationsService.formatTicketNumber()`.

La base almacena solo el entero secuencial y la unicidad es
`organizationId + number`; el prefijo no participa en constraints. Cambiarlo sería
técnicamente posible, pero produciría representación dinámica retroactiva en
Tickets, mientras los mensajes de Notification ya almacenados son snapshots.

Conclusión: fuera de BE-12 MVP. Si se aborda después, debe definirse si el prefijo se
snapshottea por ticket, su validación, longitud, colisiones y migración de contratos.

## 17. Priority default

`CreateTicketDto.priority` es opcional y acepta cualquier TicketPriority para los
tres roles. `TicketsService.create()` usa `MEDIUM` cuando se omite. Por tanto:

- ya existe un default estable;
- USER actualmente puede elegir prioridad;
- un setting organizacional exigiría consultar Settings desde Tickets y decidir si
  el cliente puede anularlo;
- TicketHistory y el evento `ticket.created` también reflejan el valor efectivo.

Recomendación: conservar MEDIUM y dejar cualquier cambio para una tarea de Tickets.

## 18. Category behavior

Aunque `categoryId` existe en CreateTicketDto, TicketsService prohíbe expresamente
que USER lo envíe; solo ADMIN/TECHNICIAN pueden categorizar. Las categorías deben ser
activas, no eliminadas y del mismo tenant.

`allowUserCategorySelection` o `defaultCategoryId` requerirían modificar BE-06,
resolver una FK lógica tenant-aware, definir fallback al eliminar/desactivar una
categoría y ampliar tests. Quedan fuera del MVP.

## 19. Auto-assignment

No existe motor de auto-assignment, round-robin, skills, carga o reglas por categoría.
La asignación es explícita y ADMIN-only en el endpoint correspondiente. Un setting
sin consumidor sería engañoso; queda fuera.

## 20. Attachments

Estado actual:

- tamaño máximo por archivo: environment, máximo validado de 10 MiB;
- máximo de archivos activos por ticket: environment, hasta 20;
- tamaño total por ticket: environment, hasta 100 MiB;
- MIME/extensiones: allowlist de seguridad en código;
- driver/local path: configuración técnica del servidor.

Son límites globales de seguridad e infraestructura. BE-12 no debe permitir que un
tenant los aumente ni redefina MIME. Un futuro límite tenant solo podría ser igual o
menor que el máximo global y exigiría cambios explícitos en Attachments.

## 21. Notifications

BE-11 no consulta settings y aplica una matriz de recipients estable. No se recomienda
un flag `notificationsEnabled` porque introduciría una segunda política global y
modificaría el listener/service recién aprobados. Preferencias por tipo, rol o
usuario requieren modelo y UX propios. BE-12 no debe tocar Notifications.

## 22. SLA

No existe implementación funcional de SLA. Solo hay:

- `slaPolicyId: null` en el evento de creación;
- interfaces/nombres para warning y breached sin productor;
- timestamps de ticket preparados para métricas futuras.

No se diseñan tiempos objetivo, business hours, calendarios, deadlines ni reglas por
prioridad dentro de Settings.

## 23. Persistencia: JSON vs columnas vs tabla

### Opción A — Reutilizar JSONB tipado

Ventajas:

- ya existe y tiene default;
- no requiere schema ni migración;
- adecuado para una propiedad de presentación;
- permite preservar datos legacy.

Riesgos:

- DB no valida estructura;
- requiere normalización y DTO cerrado;
- búsquedas/constraints por key serían débiles si el alcance creciera.

### Opción B — Columnas explícitas en Organization

Ventajas: tipo y constraint DB claros.  
Desventajas: migración y crecimiento de Organization por una propiedad que ya tiene
espacio previsto en JSONB. No aporta suficiente valor para el MVP.

### Opción C — OrganizationSettings 1:1

Ventajas: separación y evolución tipada.  
Desventajas: tabla, relación, migración y lifecycle adicional para un único setting.
Es sobreingeniería actual.

## 24. Estrategia recomendada

Reutilizar `Organization.settings` con contrato API cerrado.

Principios:

- `SupportedOrganizationSettings`, no `Record<string, any>`;
- Prisma.JsonObject/JsonValue solo en la frontera de persistencia;
- respuesta allowlist con timezone;
- request allowlist con timezone;
- shallow merge explícito de esa key;
- keys legacy almacenadas se conservan, pero no se exponen;
- arrays/scalars/JSON null se consideran documento inconsistente.

No cambiar schema, seed ni migraciones.

## 25. Defaults

Fuente única del default efectivo: una constante backend en SettingsModule:

```text
timezone = UTC
```

El default Prisma seguirá siendo `{}`. GET aplica la constante cuando timezone falta
o el valor legacy no es un timezone válido. No se debe mutar DB durante una lectura.

El seed conserva `America/Bogota`, que prevalece sobre el default.

## 26. Semántica de merge y PATCH

`PATCH /settings` debe hacer merge parcial allowlist, no reemplazo total ni deep
merge genérico.

Reglas:

1. Leer `settings` del organizationId autenticado y comprobar `isActive`.
2. Si es objeto JSON, copiar superficialmente sus keys para preservar legacy.
3. Aplicar únicamente `timezone` si fue enviado.
4. Nunca copiar propiedades desconocidas del request.
5. Canonicalizar el timezone validado antes de compararlo y persistirlo.
6. `timezone: null` se rechaza; para volver al default el cliente envía `UTC`.
7. PATCH vacío es no-op válido: devuelve settings efectivos y no escribe.
8. Si timezone efectivo ya coincide, no escribir y no cambiar `updatedAt`.
9. Si el documento persistido es array/scalar/JSON null, PATCH responde conflicto y
   no lo sobrescribe silenciosamente.
10. Un timezone legacy inválido puede corregirse enviando uno válido si el documento
   raíz sí es objeto.

Con un único campo mutable, dos PATCH concurrentes usan semántica last-write-wins.
No se justifica optimistic locking en el MVP; debe revisarse si se agregan más keys.

## 27. RBAC

### GET

```text
ADMIN
TECHNICIAN
USER
```

Timezone no es sensible y cualquier frontend autenticado puede necesitarlo para
presentar fechas. Limitarlo obligaría a duplicar el valor por otra vía.

### PATCH

```text
ADMIN únicamente
```

TECHNICIAN y USER reciben 403 por RolesGuard. Sin JWT, 401.

## 28. Multi-tenancy

- `organizationId` proviene solo de CurrentUser/JWT.
- No se acepta en path, query ni body.
- GET consulta por `id = currentUser.organizationId` e `isActive = true`.
- PATCH actualiza por el mismo id y debe mantener `isActive = true` en el filtro de
  escritura para cerrar una carrera con desactivación.
- Un ADMIN nunca puede seleccionar otra organización.
- Organización inexistente/inactiva obtiene respuesta uniforme, recomendada 404
  (`Organización no encontrada o inactiva`).

El ID de Organization es ya la clave tenant; no hace falta una FK adicional.

## 29. Endpoints

```http
GET   /api/v1/settings
PATCH /api/v1/settings
```

Se prefiere `/settings` porque:

- corresponde al nombre del feature;
- no existe OrganizationsModule ni convención `/organization/...`;
- ambos endpoints siempre resuelven la organización autenticada;
- evita `/settings/:organizationId`, expresamente inseguro.

No se proponen endpoints por categoría ni secretos.

## 30. DTOs

### UpdateSettingsDto

```ts
export class UpdateSettingsDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @IsTimeZone()
  timezone?: string;
}
```

Se usa `@ValidateIf(... !== undefined)` en vez de `@IsOptional()`: el segundo también
omite validación para `null`, mientras que el contrato exige aceptar ausencia y
rechazar null. La ValidationPipe global ya usa transform, whitelist y
forbidNonWhitelisted. Por tanto `organizationId`, `language`, `dateFormat` o
cualquier key futura no aprobada producen 400.

### SettingsResponseDto

```ts
export class SettingsResponseDto {
  timezone!: string;
}
```

No incluye raw JSON, organizationId, isActive, plan ni timestamps.

## 31. Contratos request/response

PATCH request:

```json
{
  "timezone": "America/Lima"
}
```

GET/PATCH valor retornado por controller:

```json
{
  "timezone": "America/Lima"
}
```

Respuesta HTTP efectiva por ResponseInterceptor:

```json
{
  "data": {
    "timezone": "America/Lima"
  }
}
```

No se debe envolver manualmente ni modificar ResponseInterceptor.

## 32. Seguridad

- No aceptar organizationId ni userId externos.
- No aceptar JSON arbitrario.
- No devolver raw settings ni keys legacy.
- No permitir secrets, JWT, DB, SMTP, storage credentials, env vars o roles.
- No exponer name, slug, plan o estado por este endpoint.
- Rechazar zonas inválidas y tipos no string.
- Fallar cerrado para organización inactiva/inexistente.
- Seleccionar de Organization solo `settings` e `isActive`/campos indispensables.
- No registrar el documento JSON completo en logs.

## 33. Eventos

No emitir `organization.settings.updated` en el MVP.

No existe consumidor real y añadir un evento sin uso aumenta contratos, tests y
riesgo de acoplamiento. Si una integración futura necesita reaccionar a cambios, se
podrá definir evento con `organizationId`, keys cambiadas y occurredAt, sin incluir
secretos ni el JSON completo.

Settings no se mezcla con TicketHistory ni crea auditoría propia en BE-12.

## 34. Repository pattern

No se recomienda repository.

Settings requiere una lectura mínima y una actualización de una sola entidad. Los
módulos Users/Categories/Auth ya usan PrismaService directamente cuando la
abstracción adicional no aporta valor.

Arquitectura propuesta:

```text
SettingsController -> SettingsService -> PrismaService
```

Si en el futuro Settings usa varias tablas, historial, preferencias o transacciones,
se podrá extraer repository entonces.

## 35. Performance

- Consulta por PK de Organization.
- Documento y response pequeños.
- Sin listas ni paginación.
- Sin necesidad de índice nuevo.
- Sin cache, Redis, raw SQL, materialized view o jobs.
- No consultar settings desde Dashboard/Tickets por cada request durante BE-12.

## 36. Migración

```text
Migración requerida: No
```

`Organization.settings` ya existe como JSONB NOT NULL con default `{}`. El MVP no
necesita tabla, columna, enum, index ni backfill. Tampoco debe reescribir datos legacy.

## 37. Archivos a crear

```text
cidrix-api/src/modules/settings/
├── __tests__/
│   ├── settings.controller.spec.ts
│   ├── settings.service.spec.ts
│   └── update-settings.dto.spec.ts
├── dto/
│   ├── settings-response.dto.ts
│   └── update-settings.dto.ts
├── settings.constants.ts
├── settings.controller.ts
├── settings.module.ts
└── settings.service.ts
```

No se propone `settings.repository.ts` ni validator custom porque class-validator ya
incluye `@IsTimeZone()`.

## 38. Archivos a modificar

```text
cidrix-api/src/app/app.module.ts
```

Único cambio esperado: importar y registrar SettingsModule.

No modificar `schema.prisma`, seed, migraciones, Auth, Users, Tickets, Dashboard,
Attachments, Notifications ni env.

## 39. Estrategia de tests

### DTO

- timezone válido: UTC, America/Lima y America/Bogota;
- timezone inválido, offset, vacío, whitespace, número y null;
- trim de strings;
- canonicalización IANA y no-op ante diferencias solo por casing;
- DTO vacío válido;
- unknown fields rechazados con la ValidationPipe global;
- organizationId no aceptado.

### Service

- GET con settings completo;
- `{}` devuelve UTC;
- timezone ausente/inválido devuelve UTC;
- JSON null/array/scalar en GET devuelve respuesta determinista sin crash;
- keys legacy no aparecen en response;
- PATCH parcial actualiza timezone;
- conserva language/dateFormat y keys desconocidas persistidas;
- no permite que request introduzca keys arbitrarias;
- PATCH vacío no escribe;
- mismo valor no escribe ni cambia updatedAt;
- JSON raíz inconsistente en PATCH produce conflicto;
- organización inexistente/inactiva produce error uniforme;
- cada query/update usa organizationId del usuario;
- update mantiene `isActive: true` en el filtro;
- concurrencia/last-write-wins documentada o simulada cuando sea útil.

### Controller

- GET permite ADMIN, TECHNICIAN y USER;
- PATCH permite ADMIN;
- PATCH rechaza TECHNICIAN/USER con 403;
- sin JWT, 401;
- delega CurrentUser.organizationId, no IDs externos;
- rutas exactas GET/PATCH `/settings`;
- mantiene ResponseInterceptor global cuando el harness lo permita.

No hace falta test de repository porque no se recomienda esa capa.

## 40. Casos límite

| Caso | Resultado recomendado |
|---|---|
| settings `{}` | GET `{ timezone: UTC }` |
| key timezone ausente | default UTC |
| JSON literal null/array/scalar | GET default; PATCH conflicto |
| key desconocida en request | 400 |
| key legacy almacenada | preservar, no exponer |
| timezone inválido en request | 400 |
| timezone inválido legacy | GET UTC; PATCH válido lo corrige |
| PATCH vacío | no-op, sin write |
| PATCH mismo valor | no-op, updatedAt sin cambio |
| múltiples campos request | solo existe timezone; unknown -> 400 |
| tenant A/B | solo organizationId del JWT |
| USER/TECHNICIAN PATCH | 403 |
| ADMIN PATCH | permitido en su tenant |
| organización inactiva/inexistente | 404 uniforme |
| dos PATCH simultáneos | last-write-wins para timezone |
| default no persistido | se materializa solo en response |

## 41. Riesgos técnicos

1. JSONB no garantiza estructura; lectores deben validar defensivamente.
2. Datos legacy existen sin contrato y no deben borrarse accidentalmente.
3. `@IsTimeZone()` depende del ICU disponible en Node, aunque Node 24 estándar cubre
   zonas IANA requeridas.
4. Timezone será persistido pero no cambiará Dashboard todavía; debe comunicarse para
   evitar expectativa de efecto inmediato.
5. `Organization.updatedAt` es general; cualquier write cambia el timestamp de toda
   la entidad.
6. JWT no revalida isActive por request; Settings debe comprobarlo localmente.
7. Last-write-wins es suficiente para una key, pero no para un documento futuro con
   varios editores/campos.
8. Si raw settings es JSON root inconsistente, se necesita decisión operativa para
   corregirlo sin pérdida.

## 42. Deuda técnica

- Integrar timezone en Dashboard con rangos y labels de día organizacional.
- OrganizationsModule para name/slug/plan/lifecycle.
- Diseño i18n de locale/language/date formats.
- Auditoría específica de settings si aparece requisito compliance.
- Optimistic locking/version cuando haya varios settings editables.
- Herramienta administrativa de saneamiento de JSON legacy inconsistente.
- Preferencias de Notifications como feature independiente.
- Revalidación transversal de usuario y organización activos en JWT requests.
- Modelo tipado/tabla separada si Settings crece hacia lógica de negocio consultable.

## 43. Decisiones pendientes de aprobación

1. Aprobar que el único setting MVP sea `timezone`.
2. Aprobar que `language`, `dateFormat` y demás candidatos queden fuera aunque
   existan como keys legacy del seed.
3. Aprobar `GET /api/v1/settings` y `PATCH /api/v1/settings`.
4. Aprobar GET para ADMIN, TECHNICIAN y USER.
5. Aprobar PATCH solo para ADMIN.
6. Aprobar reutilizar `Organization.settings` JSONB.
7. Aprobar que no haya migración ni cambios de schema/seed.
8. Aprobar default efectivo `UTC` como constante backend no persistida en GET.
9. Aprobar validación mediante `@IsTimeZone()` y rechazo de null.
10. Aprobar shallow merge allowlist que preserve keys legacy almacenadas.
11. Aprobar PATCH vacío y mismo valor como no-op sin write.
12. Aprobar GET fallback y PATCH conflictivo para documentos JSON raíz inconsistentes.
13. Aprobar no exponer ni aceptar language/dateFormat todavía.
14. Aprobar arquitectura sin repository.
15. Aprobar no emitir evento ni crear audit/history.
16. Aprobar que timezone no modifique Dashboard en BE-12.
17. Aprobar que ningún otro módulo existente requiera cambios funcionales.

## 44. Plan de implementación

1. Confirmar las decisiones de la sección 43.
2. Crear `settings.constants.ts` con default UTC y contrato soportado.
3. Crear DTO de update con trim, IsString, IsNotEmpty e IsTimeZone.
4. Crear DTO de response allowlist con timezone.
5. Crear SettingsService con lectura defensiva de JsonValue.
6. Implementar GET efectivo, fallback y validación de organización activa.
7. Implementar PATCH allowlist, preservación legacy e idempotencia sin write.
8. Rechazar PATCH sobre JSON root inconsistente para evitar pérdida.
9. Crear SettingsController con JWT/RolesGuard y RBAC aprobado.
10. Crear SettingsModule y registrarlo únicamente en AppModule.
11. Añadir suites DTO, service y controller.
12. Ejecutar tests del módulo, tests completos y build.
13. Ejecutar lint sin autofix solo sobre BE-12 y documentar deuda global si aplica.
14. Confirmar que Prisma/schema/migrations no cambiaron.
15. Revisar diff, multi-tenancy, response allowlist y ausencia de `.txt`.
16. Generar informe de implementación Markdown y detenerse, sin commit ni push.

## Conclusión

BE-12 puede cerrar el backend con una API de settings segura y pequeña sin inventar
features inexistentes. Reutilizar el JSONB actual es la opción proporcional siempre
que el contrato público sea estrictamente tipado y fail-closed. Timezone es el único
setting con base real y valor próximo; todo lo demás debe permanecer fuera hasta que
un consumidor concreto justifique ampliar el contrato.

Estado: **LISTO PARA REVISIÓN**.
