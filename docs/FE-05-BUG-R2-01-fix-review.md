# CIDRIX — FE-05 BUG-R2-01 Fix Review

Fecha: 2026-10-19 (America/Lima)  
Rama: `codex/fe-05-dashboard`  
HEAD: `1b80975 Merge pull request #10 from sewaaaas/codex/fe-04-ticket-detail`

## 1. Bug y métricas antes

`BUG-R2-01 — Categorías largas provocan overflow horizontal global en móvil`.

Round 2 reprodujo el defecto 2/2 veces a 390×844 con 36 categorías y nombres sin espacios:

- `document.documentElement.clientWidth = 390`
- `document.documentElement.scrollWidth = 800`
- `document.body.scrollWidth = 800`
- El card `Por categoría` llegó aproximadamente a 784 px.
- El scroll vertical interno, los badges y los conteos sí funcionaban, pero el documento completo tenía desplazamiento horizontal.
- A 1440×900 no se reproducía.

## 2. Causa raíz

`CategoryBreakdown` es un hijo directo del grid que comparte fila con `ResolutionMetrics` en desktop y ocupa una pista implícita en tamaños menores. Su `Card` mantenía el tamaño mínimo automático de un grid item (`min-width: auto`).

El texto ya tenía `break-words` y su hijo flex tenía `min-w-0`, pero `overflow-wrap: break-word` no reduce por sí solo el min-content usado para calcular el mínimo automático del card. Una categoría con aproximadamente 80 caracteres sin espacios elevaba ese min-content y el card expandía la pista y el documento hasta ~800 px.

El elemento que generaba el ancho excesivo era el `Card` raíz de `CategoryBreakdown`, no `MetricBreakdown`, `DashboardSectionState` ni el gráfico.

## 3. Cambio realizado

Se añadió únicamente `className="min-w-0"` al `Card` raíz de `CategoryBreakdown`.

Esto permite que el grid item reduzca su ancho por debajo del min-content de la cadena larga. El hijo flex existente con `min-w-0` y el texto con `break-words` pueden entonces envolver el contenido dentro del ancho disponible. No se oculta, trunca ni elimina información.

No se modificaron otros componentes, estilos globales, rutas, configuración, backend ni dependencias.

## 4. Test de regresión

Se añadió un caso a `DashboardComponents.test.tsx` que:

- renderiza una categoría con una cadena de 80 caracteres sin espacios;
- verifica que el card conserve la clase de contención `min-w-0`;
- confirma que el nombre completo y el conteo siguen renderizados.

jsdom no calcula layout real ni `scrollWidth` de forma fiable, por lo que el test protege la precondición CSS concreta y la medición geométrica se valida mediante E2E real.

Resultado focal: **1 archivo / 9 tests PASS**.  
Resultado completo: **25 archivos / 177 tests PASS**.

## 5. Revalidación E2E

Dataset interceptado:

- 36 categorías;
- `Sin categoría`;
- 8 badges `Inactiva`;
- 6 badges `Eliminada`;
- nombres largos;
- cadena de 80 caracteres sin espacios;
- conteos 1–36.

| Viewport | clientWidth | document.scrollWidth | body.scrollWidth | Resultado |
|---|---:|---:|---:|---|
| 390×844 | 390 | 390 | 390 | PASS |
| 768×1024 | 768 | 768 | 768 | PASS |
| 1440×900 | 1440 | 1440 | 1440 | PASS |

Detalles adicionales:

| Viewport | Ancho card | Borde derecho card | Texto largo | Scroll vertical | Conteos |
|---|---:|---:|---|---|---|
| 390×844 | 358 px | 374 px | 3 líneas, visible | Sí | 36/36 |
| 768×1024 | 480 px | 744 px | 2 líneas, visible | Sí | 36/36 |
| 1440×900 | 560 px | 832 px | 2 líneas, visible | Sí | 36/36 |

Consola E2E:

- errores inesperados: 0;
- warnings: 0;
- `pageerror`: 0.

Evidencia fuera del repositorio:

- `C:\Users\Sewas\.codex\visualizations\2026\10\18\01a15157-1785-75c0-b6ea-4172ceb87884\qa-fix-r2-01\results.json`
- `C:\Users\Sewas\.codex\visualizations\2026\10\18\01a15157-1785-75c0-b6ea-4172ceb87884\qa-fix-r2-01\fe05-bug-r2-01-390x844.png`
- `C:\Users\Sewas\.codex\visualizations\2026\10\18\01a15157-1785-75c0-b6ea-4172ceb87884\qa-fix-r2-01\fe05-bug-r2-01-768x1024.png`
- `C:\Users\Sewas\.codex\visualizations\2026\10\18\01a15157-1785-75c0-b6ea-4172ceb87884\qa-fix-r2-01\fe05-bug-r2-01-1440x900.png`

## 6. Validación funcional

- No existe overflow horizontal global en ninguno de los tres viewports.
- La lista conserva scroll vertical interno.
- `Sin categoría` permanece visible.
- Los badges `Inactiva` y `Eliminada` permanecen visibles.
- La cadena de 80 caracteres se envuelve sin truncarse.
- Los 36 conteos siguen presentes, incluido el primero (`1`) y el último (`36`).
- El layout desktop no tuvo regresión visual.
- La consola permaneció limpia.

## 7. Automatización

| Comando | Resultado |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 25 archivos, 177/177 tests |
| `npm run build` | PASS |
| `git diff --check` | PASS |

La primera ejecución completa de Vitest dentro del sandbox falló antes de ejecutar 24 suites por un `ENOENT` en el directorio temporal del propio sandbox. Se repitió fuera de ese aislamiento sin cambiar configuración y pasó 25/25 archivos, 177/177 tests.

## 8. Archivos modificados

- `cidrix-web/src/features/dashboard/components/CategoryBreakdown.tsx` — fix mínimo `min-w-0`.
- `cidrix-web/src/features/dashboard/components/DashboardComponents.test.tsx` — test de regresión.
- `docs/FE-05-BUG-R2-01-fix-review.md` — este reporte.

No se modificó FE-06.

## 9. Estado Git

El worktree ya contenía la implementación FE-05 y reportes sin commit antes de este fix. Se conservaron intactos. El estado final mantiene esos cambios preexistentes y añade únicamente los tres archivos del alcance descrito arriba.

```text
 M cidrix-web/src/app/router/AppRoutes.test.tsx
 M cidrix-web/src/app/router/AppRoutes.tsx
 D cidrix-web/src/features/dashboard/pages/DashboardPlaceholderPage.tsx
?? cidrix-web/src/features/dashboard/api/
?? cidrix-web/src/features/dashboard/components/
?? cidrix-web/src/features/dashboard/model/
?? cidrix-web/src/features/dashboard/pages/DashboardPage.test.tsx
?? cidrix-web/src/features/dashboard/pages/DashboardPage.tsx
?? docs/FE-05-BUG-R2-01-fix-review.md
?? docs/FE-05-FE-06-QA-report.md
?? docs/FE-05-FE-06-QA-round2-report.md
?? docs/FE-05-implementation-review.md
```

No se ejecutaron commit, push, PR, merge, rebase, stash, reset, clean ni restore.

## 10. Veredicto

**BUG-R2-01 FIXED**

El cambio localizado elimina el overflow global en 390×844, 768×1024 y 1440×900, conserva contenido y comportamiento, y supera la regresión automatizada completa.
