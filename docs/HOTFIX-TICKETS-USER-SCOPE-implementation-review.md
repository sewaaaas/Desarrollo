# HOTFIX — Tickets USER scope: revisión de implementación

## 1. Resumen ejecutivo

Se corrigió una vulnerabilidad de autorización en `TicketsService.findAll()`. Antes, el backend aplicaba `createdById = currentUser.id` para USER y después permitía que `filters.createdById` reemplazara ese scope. Ahora el scope del USER siempre tiene precedencia sobre el input del cliente. Un USER obtiene exclusivamente sus propios tickets aunque envíe un UUID propio, ajeno o arbitrario válido.

## 2. Aislamiento del trabajo

- FE-03 permaneció intacto en `C:\Users\Sewas\proyecto`, rama `codex/fe-03-tickets`, con exactamente el mismo status previo.
- El hotfix se trabajó en el worktree separado `C:\Users\Sewas\proyecto-hotfix`.
- Rama: `fix/be-tickets-user-scope`.
- Base: `origin/main` en `c9cdc42` (`Merge pull request #7 from sewaaaas/codex/fe-01-frontend-base`).
- No se hizo stash/pop, checkout sobre FE-03, commit, push, PR ni merge.

Para reutilizar la misma toolchain sin instalar dependencias se enlazó localmente el `node_modules` ignorado por Git. También se enlazó el `.env` local ignorado por Git para la prueba HTTP. Ninguno aparece en el diff.

## 3. Causa raíz

El método construía inicialmente:

```ts
if (role === UserRole.USER) {
  where['createdById'] = userId;
}
```

pero más adelante ejecutaba para todos los roles:

```ts
if (filters.createdById) {
  where['createdById'] = filters.createdById;
}
```

El segundo bloque otorgaba precedencia al input controlado por el cliente y permitía sustituir la restricción de autorización.

## 4. Corrección aplicada

La asignación quedó mutuamente excluyente:

```ts
if (role === UserRole.USER) {
  where['createdById'] = userId;
} else if (filters.createdById) {
  where['createdById'] = filters.createdById;
}
```

Así, USER siempre queda limitado por `currentUser.id`; ADMIN y TECHNICIAN conservan el filtro solicitado. No se cambió el contrato ni se agregó un 403.

## 5. Archivos modificados

- Modificado: `cidrix-api/src/modules/tickets/tickets.service.ts`.
- Creado: `cidrix-api/src/modules/tickets/__tests__/tickets.service.spec.ts`.
- Creado: `docs/HOTFIX-TICKETS-USER-SCOPE-implementation-review.md`.

No hay otros archivos rastreados modificados.

## 6. Tests agregados/modificados

La nueva suite cubre:

1. USER sin `createdById`: usa el ID autenticado.
2. USER con `createdById` de otro usuario: ignora el filtro y mantiene el ID autenticado.
3. USER con su propio `createdById`: conserva el scope correcto.
4. ADMIN con `createdById`: respeta el filtro.
5. TECHNICIAN con `createdById`: respeta el filtro.
6. `organizationId` permanece en `findMany` y `count` para USER, ADMIN y TECHNICIAN.

El test valida explícitamente que `findMany` y `count` reciben el mismo `where` seguro.

## 7. Resultado de pruebas

- Suite focalizada: 1 suite aprobada, 8 tests aprobados, 0 fallidos.
- Suite backend completa: 22 suites aprobadas, 289 tests aprobados, 0 fallidos.
- Snapshots: 0.

## 8. Prueba manual

Se levantó el backend del worktree contra la base local y se realizaron requests autenticados sin imprimir ni persistir tokens:

- USER, `GET /tickets`: 4 tickets.
- USER, `GET /tickets?createdById=<ID_PROPIO>`: 4 tickets; conjunto idéntico al baseline.
- USER, `GET /tickets?createdById=<ID_ADMIN>`: 4 tickets; conjunto idéntico al baseline y todos con owner USER.
- ADMIN filtrando por el USER: 4 tickets; filtro respetado.
- TECHNICIAN filtrando por el ADMIN: 7 tickets; filtro respetado.

No se crearon, modificaron ni borraron datos durante esta prueba.

## 9. Multi-tenant

`where` continúa inicializándose con `organizationId: currentUser.organizationId`. La corrección solo decide el `createdById` efectivo y no altera el tenant scope. La prueba de regresión confirma `organizationId` tanto en `findMany` como en `count` para los tres roles.

## 10. Regresión ADMIN / TECHNICIAN

ADMIN y TECHNICIAN continúan pudiendo filtrar por `filters.createdById`. Esto se confirmó en tests unitarios y mediante requests HTTP reales.

## 11. Revisión defensiva

Se inspeccionó el resto de `findAll()` buscando el patrón “restricción de autorización seguida por filtro del cliente”. No se encontró otro caso equivalente que amplíe el acceso del USER. `status`, `priority`, `categoryId`, `assignedToId`, fechas y búsqueda solo estrechan o transforman el listado dentro de `organizationId`; no sustituyen otro scope de autorización.

## 12. Validaciones

- `npm test -- --runInBand`: aprobado, 22/22 suites y 289/289 tests.
- `npm run build`: aprobado.
- `git diff --check`: aprobado.
- ESLint focalizado del test nuevo: aprobado.
- `npm run lint`: ejecutado, pero no queda verde por deuda heredada en `origin/main`. El script global usa `--fix`, intentó reformatear 50 archivos fuera de alcance y luego reportó 15 errores preexistentes en `auth.controller.ts` y `comments.service.spec.ts`. Todo el reformateo automático ajeno fue restaurado; el único error inicialmente atribuible al test nuevo se corrigió y su lint focalizado pasa.
- No existe script `typecheck` separado en `cidrix-api/package.json`; `npm run build` ejecutó la compilación TypeScript correctamente.

## 13. Fuera de alcance

- `cidrix-web` no fue modificado.
- FE-03 no fue modificado.
- FE-04 no fue iniciado.
- Prisma y `schema.prisma` no fueron modificados.
- No se crearon migraciones.
- No se cambiaron DTOs, controllers, guards, roles ni contrato público.
- No se corrigieron errores de lint heredados fuera del hotfix.

## 14. Riesgos pendientes

- El lint global del backend no está verde en la base `origin/main` por 15 errores heredados en Auth/Comments. Conviene abordarlos en una tarea de calidad separada; corregirlos aquí ampliaría indebidamente un hotfix de seguridad aislado.
- La propiedad queda cubierta en el service y por prueba HTTP manual. No se añadió una nueva prueba e2e persistente porque la regresión está demostrada con mocks de las dos consultas Prisma y la suite HTTP existente no ofrece una fixture aislada específica para este caso sin ampliar el alcance.

## 15. Estado final

El hotfix queda aislado en su worktree y rama, con la vulnerabilidad corregida, regresión automatizada, suite completa y build aprobados. El único validador no verde corresponde a deuda de lint preexistente y está documentado sin modificar archivos ajenos.

HOTFIX-TICKETS-USER-SCOPE listo para revisión del Tech Lead
