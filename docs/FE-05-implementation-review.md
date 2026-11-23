# FE-05 — Dashboard: implementation review

## 1. Resumen ejecutivo

Se reemplazó el placeholder de `/dashboard` por un Dashboard funcional para ADMIN y TECHNICIAN. La pantalla consume exclusivamente `dashboard/overview` y `dashboard/trends`, muestra métricas organizacionales reales, mantiene Overview y Trends como recursos independientes y no añade dependencias ni cambios backend.

## 2. Base de trabajo

- Rama base actualizada: `main`.
- Rama de trabajo: `codex/fe-05-dashboard`.
- El working tree estaba limpio antes de implementar.
- No se realizó commit, push, pull request ni merge.

## 3. Contratos backend confirmados

- `GET /api/v1/dashboard/overview` consolida resumen, prioridad, categoría, workload y tiempos promedio.
- `GET /api/v1/dashboard/trends?period=7d|30d|90d` devuelve una serie diaria completa y ascendente.
- La fachada frontend recibe el payload ya desempaquetado por el cliente autenticado existente.
- El backend devuelve conteos cero, promedios `null` sin muestra y `timezone = UTC`.

## 4. Roles y autorización

Se conservó `RoleRoute allowedRoles={['ADMIN', 'TECHNICIAN']}`. ADMIN y TECHNICIAN ven las métricas de toda su organización. USER no ve Dashboard en navegación, la navegación directa se redirige a Tickets y no monta la página ni dispara requests de Dashboard.

## 5. Arquitectura final

La feature se separó en `api`, `model`, `components` y `pages`. Los contratos, constantes y helpers no están duplicados en la página; estados y prioridades reutilizan tipos, orden y labels de Tickets.

## 6. Dashboard API

`createDashboardApi` expone `getOverview(signal)` y `getTrends(period, signal)`. Ambas operaciones usan el `ApiClient` autenticado de FE-02, propagan `AbortSignal` y no administran tokens dentro de componentes.

## 7. Overview

Overview se carga independientemente de Trends. Un fallo de Overview no destruye una tendencia válida; un fallo durante refresh conserva los últimos datos disponibles y habilita reintento local.

## 8. KPIs

Se muestran Total, Activos, Resueltos y Sin asignar. Activos suma únicamente OPEN, IN_PROGRESS y PENDING. Resueltos usa el conteo RESOLVED recibido, y Sin asignar usa `assigneeWorkload.unassignedTickets`.

## 9. Estados

Se muestran siempre OPEN, IN_PROGRESS, PENDING, RESOLVED, CLOSED y CANCELLED, incluidos valores cero, con los labels de negocio de FE-03/04 y valor textual además de la barra.

## 10. Prioridades

Se muestran siempre LOW, MEDIUM, HIGH y CRITICAL en orden explícito, incluidos valores cero, con labels Baja, Media, Alta y Crítica.

## 11. Categorías

Se muestra nombre y conteo, incluida “Sin categoría”. Las categorías inactivas y eliminadas no se ocultan y reciben indicadores discretos. Una lista extensa usa scroll vertical interno accesible; no se inventó paginación.

## 12. Workload por técnico

Se usa `activeTickets` del backend y se desglosa OPEN, IN_PROGRESS y PENDING. Usuarios INACTIVE o DELETED continúan visibles con su estado. Desktop/tablet usa tabla; móvil usa cards.

## 13. Tickets sin asignar

El valor `unassignedTickets` se presenta en los KPIs y de forma destacada dentro de Workload, sin recalcularlo desde la lista de assignees.

## 14. Resolution Time

Los segundos se convierten a duración humana sin dependencia externa. Los promedios incluyen tamaño de muestra. Un valor `null` se muestra como “Sin datos” y nunca como `0 s`.

## 15. Trends

Se conservan todos los días recibidos, incluidos días en cero. Creados y Cerrados aparecen como dos series, con totales en la leyenda y serie diaria completa disponible para tecnología asistiva.

## 16. Selector de período

El selector soporta 7, 30 y 90 días. El período se persiste como `?period=7d|30d|90d`; un valor ausente o inválido se normaliza a `30d`. Cambiar período solicita solo Trends.

## 17. Timezone / fechas

`YYYY-MM-DD` se interpreta como fecha calendario entregada por backend. El helper usa componentes explícitos y abreviaturas deterministas en español, por lo que no aplica conversión de zona horaria ni puede desplazar el día.

## 18. Visualización del gráfico

Se implementó SVG responsive sin librerías. Escala con máximo mínimo de 1, evita NaN/Infinity, dibuja dos polilíneas y muestra todos los labels de 7 días; para series largas muestrea seis labels deterministas, incluidos extremos.

## 19. Loading

Overview y Trends tienen skeletons independientes. Durante refresh se conservan los datos previos cuando existen, se comunica “Actualizando dashboard” mediante `aria-live` y se evita un spinner global con layout shift fuerte.

## 20. Empty states

Se implementaron los textos aprobados para categorías, workload, tendencia sin actividad y promedios sin muestra. Cero datos se considera respuesta válida.

## 21. Error / Retry

Se distinguen respuestas 403, red y 5xx con mensajes seguros. Overview y Trends tienen errores y botones Reintentar independientes; un error parcial no desmonta el recurso sano.

## 22. Race conditions / AbortSignal

Cada ejecución crea su propio `AbortController`, aborta al cambiar dependencias o desmontar, e ignora resoluciones de controladores abortados. La prueba rápida 7d → 90d demuestra que la respuesta antigua no puede reemplazar el período vigente.

## 23. Manual Refresh

“Actualizar” incrementa las versiones de Overview y Trends una sola vez, conserva el período seleccionado y bloquea doble activación mientras las solicitudes están en curso. No se añadió polling.

## 24. Responsive

Validación manual realizada en 390 × 844, 768 × 1024 y 1440 × 900. KPIs, selector, gráfico, breakdowns y workload se adaptan sin overflow documental. En móvil, navegación mantiene su scroll interno previsto y workload cambia a cards.

Durante la prueba 390 × 844 se detectó que una tabla `sr-only` de datos del gráfico ensanchaba el documento. Se reemplazó por una lista semántica `sr-only`; tras la corrección, `documentElement.scrollWidth` quedó dentro del ancho útil en los tres viewports.

## 25. Accesibilidad

El gráfico tiene nombre accesible dependiente del período, leyenda textual, totales y lista diaria oculta visualmente. Barras exponen label y valor, selector usa estado pressed, mensajes dinámicos usan `aria-live` y errores usan `role=alert`.

## 26. Seguridad

No hay tokens, secretos, IDs seed ni HTML inyectado en la feature. No se usa localStorage/sessionStorage. El frontend mantiene el guard visual, y el backend continúa como autoridad de autorización y aislamiento multi-tenant.

## 27. Tests automatizados

- API: Overview, 7d, 30d, 90d, serialización, AbortSignal y propagación de errores.
- Utils: duración, null, activos, fechas UTC sin off-by-one, período válido/inválido, escala cero y muestreo.
- Componentes: estados, prioridades, categorías, workload y gráfico 7/90/todo-cero/accesibilidad.
- Página: loading, ambos roles, éxitos, errores parciales, retries independientes, URL, 7/30/90, carrera, refresh, vacíos y null.
- Routing: USER bloqueado y sin requests de Dashboard.
- Resultado final: 25 archivos de test, 176 tests pasados.

## 28. Pruebas manuales

Se levantaron PostgreSQL, `cidrix-api` y `cidrix-web` localmente.

- ADMIN: acceso, Overview, períodos 7d/30d/90d, refresh, categorías, workload, tiempos, responsive y consola limpia.
- TECHNICIAN: acceso y las mismas métricas organizacionales, sin error de permisos.
- USER: Dashboard ausente en navegación y acceso directo redirigido a `/tickets`.
- Comparación API/UI: `summary.total = 12`, `unassignedTickets = 2`, Técnico CIDRIX con `activeTickets = 7`.
- Trends reales: 7d/30d/90d devolvieron respectivamente 7/30/90 puntos, período correcto y `timezone = UTC`.
- Consola del navegador: sin warnings ni errores.

## 29. Validaciones finales

- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: OK, 176/176.
- `npm run build`: OK, Vite produjo el bundle de producción.
- `git diff --check`: OK.
- Revisión de diff: sin backend, FE-06+, secretos, persistencia de token, IDs seed ni dependencias nuevas.

## 30. Archivos creados

- `cidrix-web/src/features/dashboard/api/dashboard.api.ts`
- `cidrix-web/src/features/dashboard/api/dashboard.api.test.ts`
- `cidrix-web/src/features/dashboard/components/CategoryBreakdown.tsx`
- `cidrix-web/src/features/dashboard/components/DashboardComponents.test.tsx`
- `cidrix-web/src/features/dashboard/components/DashboardSectionState.tsx`
- `cidrix-web/src/features/dashboard/components/DashboardSummary.tsx`
- `cidrix-web/src/features/dashboard/components/MetricBreakdown.tsx`
- `cidrix-web/src/features/dashboard/components/PeriodSelector.tsx`
- `cidrix-web/src/features/dashboard/components/PriorityBreakdown.tsx`
- `cidrix-web/src/features/dashboard/components/ResolutionMetrics.tsx`
- `cidrix-web/src/features/dashboard/components/StatusBreakdown.tsx`
- `cidrix-web/src/features/dashboard/components/TrendsChart.tsx`
- `cidrix-web/src/features/dashboard/components/WorkloadPanel.tsx`
- `cidrix-web/src/features/dashboard/model/dashboard.constants.ts`
- `cidrix-web/src/features/dashboard/model/dashboard.types.ts`
- `cidrix-web/src/features/dashboard/model/dashboard.utils.ts`
- `cidrix-web/src/features/dashboard/model/dashboard.utils.test.ts`
- `cidrix-web/src/features/dashboard/pages/DashboardPage.tsx`
- `cidrix-web/src/features/dashboard/pages/DashboardPage.test.tsx`
- `docs/FE-05-implementation-review.md`

## 31. Archivos modificados

- `cidrix-web/src/app/router/AppRoutes.tsx`
- `cidrix-web/src/app/router/AppRoutes.test.tsx`

## 32. Archivos eliminados

- `cidrix-web/src/features/dashboard/pages/DashboardPlaceholderPage.tsx`

## 33. Dependencias

No se añadió, eliminó ni actualizó ninguna dependencia. `package.json` y lockfile no cambiaron.

## 34. Desviaciones

No hubo desviaciones funcionales del prompt. La estructura de componentes incorpora un componente genérico de breakdown y estados compartidos para evitar duplicación, manteniendo la arquitectura Feature-First solicitada.

## 35. Problemas encontrados

El único problema funcional encontrado durante validación fue el overflow móvil producido por la tabla accesible oculta del gráfico. Quedó corregido y revalidado en los tres viewports. No quedan bloqueos conocidos.

## 36. Riesgos / deuda detectada

El gráfico SVG es deliberadamente ligero y no ofrece interacción hover; toda la información esencial sí está disponible en leyenda y resumen accesible. Una futura visualización más avanzada debe seguir evitando dependencias sin aprobación y conservar la semántica UTC.

## 37. Backend

No se modificó ningún archivo de `cidrix-api`, Prisma, migraciones, controladores, guards, servicios ni repositories. Los endpoints y DTOs actuales resultaron suficientes.

## 38. Fuera de alcance

No se implementaron notificaciones, settings, dark mode, exportaciones, custom range, realtime, websockets, polling, drill-down ni rediseño de AppLayout.

## 39. Estado final

La implementación, pruebas automatizadas, validación real por rol, validación de datos, responsive, accesibilidad básica, build y revisión del diff están completas. La rama queda sin commit ni push para revisión.

FE-05 listo para revisión del Tech Lead y pruebas manuales
