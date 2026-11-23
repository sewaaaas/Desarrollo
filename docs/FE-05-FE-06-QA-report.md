# CIDRIX — FE-05 + FE-06 QA Report

## 1. Resumen ejecutivo

| Módulo | PASS | FAIL | BLOCKED | NOT EXECUTED | Veredicto |
|---|---:|---:|---:|---:|---|
| FE-05 | 17 | 0 | 7 | 3 | NOT READY |
| FE-06 | 20 | 0 | 13 | 3 | NOT READY |
| Integración | 6 | 0 | 0 | 0 | READY |

No se confirmó ningún defecto funcional en los casos ejecutados. El veredicto conservador de FE-05 y FE-06 es `NOT READY` porque quedaron sin evidencia E2E obligatoria varias pruebas de fallos parciales, carreras forzadas, conteos exactos de requests y fixtures interceptados. No se asumió PASS a partir del código ni de tests unitarios.

## 2. Entorno

- Fecha/hora: 2026-10-18 18:47:21 -05:00 (America/Lima).
- OS: Microsoft Windows NT 10.0.26300.0.
- Node: v24.18.0.
- npm: 11.16.0.
- Base común: `1b80975c4d73368a7408bb1ccf6d0d3ca37988ca` (`Merge pull request #10 from sewaaaas/codex/fe-04-ticket-detail`).
- FE-05: rama `codex/fe-05-dashboard`, worktree `C:\Users\Sewas\proyecto`.
- FE-06: rama `codex/fe-06-notifications`, worktree `C:\Users\Sewas\proyecto-fe06`.
- PostgreSQL: contenedor `cidrix_postgres`, healthy, puerto 5432.
- API QA temporal: `http://192.168.18.25:3001/api/v1`; health 200. Se usó una variable de entorno temporal de CORS, sin editar `.env`.
- Frontend QA temporal: `http://192.168.18.25:5173`.
- Navegador: ChatGPT in-app browser basado en Playwright.
- Viewports: 390 × 844, 768 × 1024 y 1440 × 900.
- Evidencias: `C:\Users\Sewas\.codex\visualizations\2026\10\18\01a15157-1785-75c0-b6ea-4172ceb87884\qa-evidence`.
- No se registran secretos ni access tokens.

## 3. Estado Git inicial

### FE-05

```text
branch: codex/fe-05-dashboard
HEAD: 1b80975c4d73368a7408bb1ccf6d0d3ca37988ca
 M cidrix-web/src/app/router/AppRoutes.test.tsx
 M cidrix-web/src/app/router/AppRoutes.tsx
 D cidrix-web/src/features/dashboard/pages/DashboardPlaceholderPage.tsx
?? cidrix-web/src/features/dashboard/api/
?? cidrix-web/src/features/dashboard/components/
?? cidrix-web/src/features/dashboard/model/
?? cidrix-web/src/features/dashboard/pages/DashboardPage.test.tsx
?? cidrix-web/src/features/dashboard/pages/DashboardPage.tsx
?? docs/FE-05-implementation-review.md
```

### FE-06

```text
branch: codex/fe-06-notifications
HEAD: 1b80975c4d73368a7408bb1ccf6d0d3ca37988ca
 M cidrix-web/src/app/layouts/AppLayout.test.tsx
 M cidrix-web/src/app/layouts/AppLayout.tsx
 M cidrix-web/src/app/router/AppRoutes.test.tsx
 M cidrix-web/src/app/router/AppRoutes.tsx
 D cidrix-web/src/features/notifications/pages/NotificationsPlaceholderPage.tsx
?? cidrix-web/src/features/notifications/api/
?? cidrix-web/src/features/notifications/components/
?? cidrix-web/src/features/notifications/context/
?? cidrix-web/src/features/notifications/model/
?? cidrix-web/src/features/notifications/pages/NotificationsPage.test.tsx
?? cidrix-web/src/features/notifications/pages/NotificationsPage.tsx
?? docs/FE-06-implementation-review.md
```

Ambas implementaciones estaban sin commit y se probaron directamente, sin checkout, stash, reset ni cambios de rama.

## 4. FE-05 — Resultados

| Casos | PASS | FAIL | BLOCKED | NOT EXECUTED |
|---|---:|---:|---:|---:|
| FE05-01 a FE05-27 | 17 | 0 | 7 | 3 |

### FE05-01 — ADMIN puede acceder

- Estado: PASS
- Rol: ADMIN
- Precondición: API y FE-05 reales levantados.
- Pasos: login y apertura de `/dashboard`.
- Esperado: navegación visible, carga sin 401/403.
- Obtenido: `/dashboard?period=30d`, H1 Dashboard y datos reales visibles.
- Evidencia: `FE05-ADMIN-dashboard-1440x900.png`.
- Requests relevantes: login, overview y trends 30d exitosos.
- Consola: 0 errores/warnings.
- Observaciones: ninguna.

### FE05-02 — TECHNICIAN puede acceder

- Estado: PASS
- Rol: TECHNICIAN
- Precondición: misma organización que ADMIN.
- Pasos: logout ADMIN, login TECHNICIAN, abrir Dashboard.
- Esperado: acceso y misma métrica organizacional.
- Obtenido: total 14 en ambos roles; respuesta overview equivalente.
- Evidencia: `FE05-02-TECHNICIAN.png`.
- Requests relevantes: `GET /dashboard/overview` 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE05-03 — USER bloqueado

- Estado: PASS
- Rol: USER
- Precondición: sesión USER.
- Pasos: revisar navegación y navegar manualmente a `/dashboard`.
- Esperado: Dashboard ausente y redirección a Tickets.
- Obtenido: navegación sin Dashboard; redirección a `/tickets`.
- Evidencia: estado AX del navegador.
- Requests relevantes: API confirmó 403 para USER en overview.
- Consola: sin errores.
- Observaciones: la herramienta no expuso un conteo de red para demostrar ausencia absoluta de request previo a la redirección.

### FE05-04 — Overview contra API real

- Estado: PASS
- Rol: ADMIN
- Precondición: base real.
- Pasos: comparar API y UI.
- Esperado: campos coincidentes.
- Obtenido: total 14; estados 8/4/0/0/2/0; prioridades 0/13/1/0; categorías 12/1/1; sin asignar 2; workload 9 y 1; promedios y muestras coincidentes.
- Evidencia: respuesta API sanitizada y captura ADMIN.
- Requests relevantes: `GET /api/v1/dashboard/overview` 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE05-05 — KPIs

- Estado: PASS
- Rol: ADMIN
- Precondición: overview anterior.
- Pasos: verificar Total, Activos, Resueltos y Sin asignar.
- Esperado: 14, 12, 0 y 2.
- Obtenido: 14, 12, 0 y 2.
- Evidencia: captura ADMIN.
- Requests relevantes: overview 200.
- Consola: sin errores.
- Observaciones: Activos = 8 + 4 + 0.

### FE05-06 — Estados

- Estado: PASS
- Rol: ADMIN
- Precondición: overview cargado.
- Pasos: inspección visual/AX.
- Esperado: seis estados, incluidos ceros.
- Obtenido: Abierto 8, En progreso 4, Pendiente 0, Resuelto 0, Cerrado 2, Cancelado 0.
- Evidencia: captura ADMIN.
- Requests relevantes: overview 200.
- Consola: sin errores.
- Observaciones: orden correcto.

### FE05-07 — Prioridades

- Estado: PASS
- Rol: ADMIN
- Precondición: overview cargado.
- Pasos: inspección visual/AX.
- Esperado: Baja, Media, Alta, Crítica en orden, incluidos ceros.
- Obtenido: 0, 13, 1, 0 en orden.
- Evidencia: captura ADMIN.
- Requests relevantes: overview 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE05-08 — Categorías

- Estado: NOT EXECUTED
- Rol: ADMIN
- Precondición: dataset real con solo 3 filas.
- Pasos: se validaron nombres/count actuales.
- Esperado: además, inactivas/eliminadas y lista extensa con scroll.
- Obtenido: Sin categoría 12, Configuracion General 1, Hardware 1; no hubo dataset extenso ni interceptación disponible.
- Evidencia: captura ADMIN.
- Requests relevantes: overview 200.
- Consola: sin errores.
- Observaciones: parte básica observada; fixture largo/inactivo no ejecutado.

### FE05-09 — Workload

- Estado: PASS
- Rol: ADMIN/TECHNICIAN
- Precondición: overview real.
- Pasos: comparar API y UI en desktop/tablet/móvil.
- Esperado: técnico, activos y desglose coincidentes; tabla y cards responsivas.
- Obtenido: Técnico 9 (5/4/0), Admin 1 (1/0/0); tabla visible en 768/1440 y cards en 390.
- Evidencia: capturas FE05-23/24/25.
- Requests relevantes: overview 200.
- Consola: sin errores.
- Observaciones: no existían usuarios INACTIVE/DELETED devueltos por API.

### FE05-10 — Sin asignar

- Estado: PASS
- Rol: ADMIN
- Precondición: overview real.
- Pasos: comparar KPI y panel workload con API.
- Esperado: valor exacto backend.
- Obtenido: 2 en API y dos ubicaciones UI.
- Evidencia: captura ADMIN.
- Requests relevantes: overview 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE05-11 — Resolution Time

- Estado: NOT EXECUTED
- Rol: ADMIN
- Precondición: backend entregó muestras reales, no null.
- Pasos: se validó formato de 131716/132174 segundos y muestra 2.
- Esperado adicional: `null` => “Sin datos”, nunca `0 s`.
- Obtenido: “1 d 12 h”, basado en 2 tickets; caso null no pudo simularse sin interceptación.
- Evidencia: captura ADMIN.
- Requests relevantes: overview 200.
- Consola: sin errores.
- Observaciones: evidencia parcial real.

### FE05-12 — Trends 7d

- Estado: PASS
- Rol: ADMIN/TECHNICIAN
- Precondición: período 7d.
- Pasos: cambiar período y contar filas textuales.
- Esperado: 7 puntos, ceros conservados y URL correcta.
- Obtenido: API/UI 7 puntos, URL `period=7d`; rango 2026-10-12 a 2026-10-18.
- Evidencia: estado AX con siete filas.
- Requests relevantes: `GET /dashboard/trends?period=7d` 200.
- Consola: sin errores.
- Observaciones: 1 creado, 0 cerrados tras los datos QA.

### FE05-13 — Trends 30d

- Estado: PASS
- Rol: ADMIN
- Precondición: período 30d.
- Pasos: comparar serie API/UI.
- Esperado: 30 puntos y URL correcta.
- Obtenido: 30 puntos; rango 2026-09-19 a 2026-10-18; 6 creados y 1 cerrado.
- Evidencia: captura ADMIN.
- Requests relevantes: trends 30d 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE05-14 — Trends 90d

- Estado: PASS
- Rol: ADMIN
- Precondición: período 90d.
- Pasos: cambiar a 90d y contar filas.
- Esperado: 90 puntos y ceros conservados.
- Obtenido: API/UI 90 puntos; 15 creados y 2 cerrados.
- Evidencia: estado AX con 90 filas.
- Requests relevantes: trends 90d 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE05-15 — URL state y canonicalización

- Estado: PASS
- Rol: ADMIN
- Precondición: sesión autenticada.
- Pasos: abrir URLs ausente, 7d, 30d, 90d e INVALID; back/forward.
- Esperado: ausente/inválido a 30d y navegación coherente.
- Obtenido: ambos normalizaron a `?period=30d`; back 90d→7d conservó contenido.
- Evidencia: URLs capturadas por navegador.
- Requests relevantes: trends según período.
- Consola: sin errores.
- Observaciones: canonicalización ocurre tras el efecto inicial.

### FE05-16 — Cambio de período

- Estado: BLOCKED
- Rol: ADMIN
- Precondición: selector funcional.
- Pasos: 7→30→90 y verificación visual/URL.
- Esperado adicional: solo Trends, sin Overview.
- Obtenido: UI/URL correctas; navegador no expuso conteo de red por endpoint.
- Evidencia: estados AX.
- Requests relevantes: no cuantificables con la herramienta.
- Consola: sin errores.
- Observaciones: bloqueo de instrumentación, no fallo confirmado.

### FE05-17 — Carrera de períodos

- Estado: BLOCKED
- Rol: TECHNICIAN
- Precondición: integración temporal.
- Pasos: activación inmediata 7d→90d.
- Esperado: resultado final 90d.
- Obtenido: URL 90d y 90 filas; no fue posible retrasar 7d para forzar respuesta fuera de orden.
- Evidencia: salida del navegador.
- Requests relevantes: no interceptables.
- Consola: sin errores.
- Observaciones: smoke real pasó, carrera forzada bloqueada.

### FE05-18 — Refresh manual

- Estado: BLOCKED
- Rol: TECHNICIAN
- Precondición: período 90d.
- Pasos: doble activación rápida de Actualizar.
- Esperado: un overview + un trends, datos conservados, sin tormenta.
- Obtenido: período 90d conservado y mensaje “Dashboard actualizado”; sin conteo de red.
- Evidencia: salida del navegador.
- Requests relevantes: no cuantificables.
- Consola: sin errores.
- Observaciones: parte visual pasó.

### FE05-19 — Error parcial de Overview

- Estado: BLOCKED
- Rol: ADMIN
- Precondición: requiere interceptación temporal.
- Pasos: no ejecutado por falta de route interception.
- Esperado: error local y Trends sano.
- Obtenido: sin evidencia E2E.
- Evidencia: n/a.
- Requests relevantes: n/a.
- Consola: n/a.
- Observaciones: tests automatizados pasaron, pero no se usan como evidencia E2E.

### FE05-20 — Error parcial de Trends

- Estado: BLOCKED
- Rol: ADMIN
- Precondición: requiere interceptación temporal.
- Pasos: no ejecutado.
- Esperado: Overview sano y retry independiente.
- Obtenido: sin evidencia E2E.
- Evidencia: n/a.
- Requests relevantes: n/a.
- Consola: n/a.
- Observaciones: limitación de herramienta.

### FE05-21 — 403/network/5xx seguros

- Estado: BLOCKED
- Rol: ADMIN/USER
- Precondición: interceptación temporal.
- Pasos: se confirmó 403 real de USER por API; network/500 y `role=alert` no pudieron simularse.
- Esperado: copy seguro y alert.
- Obtenido: evidencia parcial 403, resto bloqueado.
- Evidencia: API 403.
- Requests relevantes: overview USER 403.
- Consola: sin errores.
- Observaciones: no se marca PASS parcial.

### FE05-22 — Empty/zero states

- Estado: NOT EXECUTED
- Rol: ADMIN
- Precondición: dataset real no estaba vacío.
- Pasos: se observaron ceros en status/prioridad/trend, pero no categorías/workload vacíos ni promedios null.
- Esperado: todos los empty states.
- Obtenido: cobertura parcial.
- Evidencia: captura ADMIN.
- Requests relevantes: overview/trends 200.
- Consola: sin errores.
- Observaciones: no hubo interceptación.

### FE05-23 — Responsive 390 × 844

- Estado: PASS
- Rol: ADMIN
- Precondición: viewport 390×844.
- Pasos: inspección visual, cards y anchos DOM.
- Esperado: sin overflow global.
- Obtenido: clientWidth 375, scrollWidth 375, bodyWidth 375; tabla oculta y cards visibles.
- Evidencia: `FE05-23-390x844.png`.
- Requests relevantes: overview/trends 200.
- Consola: sin errores.
- Observaciones: scrollbar reduce ancho útil a 375.

### FE05-24 — Responsive 768 × 1024

- Estado: PASS
- Rol: ADMIN
- Precondición: viewport 768×1024.
- Pasos: inspección visual y anchos DOM.
- Esperado: sin overflow global.
- Obtenido: 753/753/753; tabla visible, ancho 531.
- Evidencia: `FE05-24-768x1024.png`.
- Requests relevantes: overview/trends 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE05-25 — Responsive 1440 × 900

- Estado: PASS
- Rol: ADMIN
- Precondición: viewport 1440×900.
- Pasos: inspección visual y anchos DOM.
- Esperado: sin overflow global.
- Obtenido: 1425/1425/1425.
- Evidencia: `FE05-25-1440x900.png`.
- Requests relevantes: overview/trends 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE05-26 — Accesibilidad básica

- Estado: PASS
- Rol: ADMIN/TECHNICIAN
- Precondición: Dashboard cargado.
- Pasos: inspección AX/DOM y activación Enter.
- Esperado: H1, selector con aria-pressed, gráfico nombrado/leyenda/texto, aria-live y foco.
- Obtenido: todos presentes; Enter sobre “30 días” dejó BUTTON enfocado con `aria-pressed=true`.
- Evidencia: árbol AX y captura responsive.
- Requests relevantes: trends 30d 200.
- Consola: sin errores.
- Observaciones: no es auditoría WCAG completa.

### FE05-27 — Consola y red

- Estado: BLOCKED
- Rol: ADMIN/TECHNICIAN/USER
- Precondición: flujos normales ejecutados.
- Pasos: leer logs de consola y observar API.
- Esperado: 0 errores, sin loops/duplicados/tokens.
- Obtenido: 0 errores y 0 warnings del navegador; no se imprimieron tokens; conteos exactos/loops no disponibles en el navegador.
- Evidencia: `tab.dev.logs=[]`.
- Requests relevantes: no cuantificables por acción.
- Consola: limpia.
- Observaciones: no se marca PASS sin prueba completa de red.

## 5. FE-06 — Resultados

| Casos | PASS | FAIL | BLOCKED | NOT EXECUTED |
|---|---:|---:|---:|---:|
| FE06-01 a FE06-36 | 20 | 0 | 13 | 3 |

### FE06-01 — Acceso por roles

- Estado: PASS
- Rol: ADMIN, TECHNICIAN, USER
- Precondición: sesiones reales.
- Pasos: login y apertura de `/notifications`.
- Esperado: acceso para los tres.
- Obtenido: los tres cargaron H1 Notificaciones.
- Evidencia: `FE06-01-TECHNICIAN-notifications.png` y capturas USER.
- Requests relevantes: lista/count 200 por rol.
- Consola: sin errores.
- Observaciones: ninguna.

### FE06-02 — Aislamiento de sesión

- Estado: PASS
- Rol: ADMIN→TECHNICIAN→USER
- Precondición: datos distintos por cuenta.
- Pasos: logout/login secuencial.
- Esperado: badge/lista de la cuenta vigente, sin persistencia cruzada.
- Obtenido: ADMIN 0/3 items, TECHNICIAN 3 unread/24 items, USER 0 unread/6 items; contenido no se reutilizó.
- Evidencia: salidas DOM/AX.
- Requests relevantes: lista/count por usuario.
- Consola: sin errores.
- Observaciones: no se observó flash persistente.

### FE06-03 — Unread count y badge

- Estado: PASS
- Rol: USER/TECHNICIAN
- Precondición: 0 real y luego 3 notificaciones QA.
- Pasos: comparar endpoint y UI.
- Esperado: 0 oculta badge; >0 visible.
- Obtenido: USER 0 sin badge global; TECHNICIAN badge 3 con nombre accesible.
- Evidencia: captura TECHNICIAN.
- Requests relevantes: `GET /notifications/unread-count` 200.
- Consola: sin errores.
- Observaciones: errores de count se cubren en FE06-22.

### FE06-04 — Badge 99+

- Estado: BLOCKED
- Rol: TECHNICIAN
- Precondición: requiere interceptación count >99.
- Pasos: no ejecutado; no se generaron 100 eventos reales.
- Esperado: 99+ y nombre accesible con count real.
- Obtenido: sin evidencia E2E.
- Evidencia: n/a.
- Requests relevantes: n/a.
- Consola: n/a.
- Observaciones: bloqueo de instrumentación.

### FE06-05 — Listado

- Estado: PASS
- Rol: TECHNICIAN/USER
- Precondición: 24 y 6 items respectivamente.
- Pasos: comparar API/UI.
- Esperado: limit 20, metadata, orden y campos.
- Obtenido: página 1 con 20 de 24; tarjetas con lectura, tipo, título, mensaje, ticket, fecha y acciones.
- Evidencia: captura TECHNICIAN.
- Requests relevantes: `GET /notifications?page=1&limit=20` 200.
- Consola: sin errores.
- Observaciones: orden backend preservado.

### FE06-06 — Tipos

- Estado: PASS
- Rol: TECHNICIAN/USER
- Precondición: dataset real con tres tipos.
- Pasos: inspeccionar labels/mensajes.
- Esperado: Asignación, Estado, Comentario.
- Obtenido: los tres labels observados; mensajes coinciden con backend.
- Evidencia: captura TECHNICIAN y estado USER.
- Requests relevantes: lista 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE06-07 — Filtros

- Estado: PASS
- Rol: TECHNICIAN/USER
- Precondición: items leídos/no leídos.
- Pasos: Todas/No leídas/Leídas desde página 2.
- Esperado: query correcta, aria-pressed y reset página 1.
- Obtenido: `filter=unread&page=1`, 3 items, aria-pressed correcto.
- Evidencia: salida DOM.
- Requests relevantes: lista filtrada 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE06-08 — URL state

- Estado: PASS
- Rol: USER
- Precondición: sesión autenticada.
- Pasos: probar ausencia, valores válidos y filter/page inválidos.
- Esperado: canonicalización sin loops.
- Obtenido: todos normalizaron a combinaciones válidas; entero > MAX_SAFE_INTEGER a page 1.
- Evidencia: siete URLs capturadas.
- Requests relevantes: lista 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE06-09 — Paginación

- Estado: PASS
- Rol: TECHNICIAN
- Precondición: 24 notificaciones.
- Pasos: siguiente/anterior y extremos.
- Esperado: 20 + 4, totalPages 2.
- Obtenido: página 1 = 20; página 2 = 4; Siguiente deshabilitado al final y Anterior habilitado.
- Evidencia: salida navegador.
- Requests relevantes: page=1/page=2, limit=20.
- Consola: sin errores.
- Observaciones: metadata API total 24.

### FE06-10 — Back / Forward

- Estado: PASS
- Rol: TECHNICIAN
- Precondición: navegación entre páginas.
- Pasos: page 1→2, back, forward.
- Esperado: URL/contenido coherentes.
- Obtenido: back a page 1 y forward a page 2.
- Evidencia: URLs capturadas.
- Requests relevantes: listados 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE06-11 — Marcar una como leída

- Estado: PASS
- Rol: USER
- Precondición: notificación QA TKT-0015 no leída.
- Pasos: filtro unread y marcar.
- Esperado: desaparece, count baja y feedback.
- Obtenido: count 1→0, item desapareció, toast “Notificación marcada como leída”.
- Evidencia: `FE06-11-12-mark-read.png`.
- Requests relevantes: PATCH mark-read, refetch list/count.
- Consola: sin errores.
- Observaciones: dato creado por QA.

### FE06-12 — Doble submit individual

- Estado: BLOCKED
- Rol: USER
- Precondición: notificación QA no leída.
- Pasos: `dblclick` sobre Marcar como leída.
- Esperado: un solo PATCH efectivo.
- Obtenido: un solo feedback y estado final correcto, pero no hubo contador de requests de red.
- Evidencia: `FE06-11-12-mark-read.png`.
- Requests relevantes: no cuantificables.
- Consola: sin errores.
- Observaciones: no se asume PASS.

### FE06-13 — Marcar todas

- Estado: PASS
- Rol: TECHNICIAN
- Precondición: 3 unread, todos generados por esta QA; antes había 0.
- Pasos: filtro unread y Marcar todas.
- Esperado: updatedCount, lista/count refrescados y 0 unread.
- Obtenido: “Se marcaron 3 notificaciones como leídas”, empty unread y badge oculto.
- Evidencia: salida DOM.
- Requests relevantes: `PATCH /notifications/read-all` y refetches.
- Consola: sin errores.
- Observaciones: no se alteraron unread ajenos.

### FE06-14 — updatedCount = 0

- Estado: PASS
- Rol: TECHNICIAN
- Precondición: cuenta ya sin unread.
- Pasos: PATCH de contrato por API.
- Esperado: éxito válido con 0.
- Obtenido: `updatedCount: 0`.
- Evidencia: respuesta API sanitizada.
- Requests relevantes: `PATCH /notifications/read-all` 200.
- Consola: n/a.
- Observaciones: botón UI correctamente deshabilitado.

### FE06-15 — Ver ticket no marca lectura

- Estado: PASS
- Rol: USER
- Precondición: TKT-0015 unread.
- Pasos: Ver ticket, back.
- Esperado: sin marcado automático.
- Obtenido: volvió con 1 unread y botón Marcar visible.
- Evidencia: URLs y DOM capturados.
- Requests relevantes: navegación normal.
- Consola: sin errores.
- Observaciones: ninguna.

### FE06-16 — Navegación al ticket

- Estado: BLOCKED
- Rol: USER
- Precondición: notificación con ticketId.
- Pasos: abrir Link a `/tickets/fb72...`.
- Esperado adicional: ningún GET extra de enriquecimiento.
- Obtenido: URL directa correcta; herramienta sin conteo de requests.
- Evidencia: URL capturada.
- Requests relevantes: no cuantificables.
- Consola: sin errores.
- Observaciones: parte de navegación pasó.

### FE06-17 — Aislamiento entre usuarios

- Estado: PASS
- Rol: ADMIN/TECHNICIAN/USER
- Precondición: listas distintas.
- Pasos: comparar IDs y PATCH cruzado.
- Esperado: sin reutilización; USER recibe 404 sobre notificación TECHNICIAN.
- Obtenido: IDs disjuntos; PATCH a `a33d30ab-...` devolvió 404.
- Evidencia: respuestas API y sesiones UI.
- Requests relevantes: lista por cuenta; PATCH 404.
- Consola: sin errores.
- Observaciones: notificación técnica no se modificó.

### FE06-18 — Nota interna

- Estado: PASS
- Rol: ADMIN/TECHNICIAN/USER
- Precondición: ticket QA TKT-0015 asignado a técnico.
- Pasos: ADMIN publica nota INTERNAL; revisar TECHNICIAN y USER.
- Esperado: técnico la recibe; USER no ve contenido interno.
- Obtenido: técnico recibió “Nueva nota interna en TKT-0015”; USER no mostró nota ni mensaje.
- Evidencia: captura TECHNICIAN y salida USER.
- Requests relevantes: POST comentario INTERNAL; listas 200.
- Consola: sin errores.
- Observaciones: mensaje provino del backend.

### FE06-19 — Eventos reales

- Estado: PASS
- Rol: ADMIN/TECHNICIAN/USER
- Precondición: TKT-0015 QA.
- Pasos: asignar, comentar PUBLIC, comentar INTERNAL y cambiar estado.
- Esperado: destinatarios correctos.
- Obtenido: TECHNICIAN recibió Asignación, Comentario y Nota interna; USER recibió Estado; no hubo contenido interno para USER.
- Evidencia: captura TECHNICIAN y listas API.
- Requests relevantes: contratos públicos de tickets/comments.
- Consola: sin errores.
- Observaciones: ver Datos QA.

### FE06-20 — Refresh manual

- Estado: BLOCKED
- Rol: USER
- Precondición: página real.
- Pasos: Actualizar y observar nuevo evento.
- Esperado adicional: exactamente 1 GET lista + 1 GET count y doble click sin duplicación.
- Obtenido: lista/count se actualizaron y estado se conservó; sin conteo de red.
- Evidencia: cambio 0→1 unread.
- Requests relevantes: no cuantificables.
- Consola: sin errores.
- Observaciones: no se asume PASS completo.

### FE06-21 — Retry independiente lista

- Estado: BLOCKED
- Rol: cualquiera
- Precondición: requiere interceptación.
- Pasos: no ejecutado.
- Esperado: count sano y retry local.
- Obtenido: sin evidencia E2E.
- Evidencia: n/a.
- Requests relevantes: n/a.
- Consola: n/a.
- Observaciones: limitación de herramienta.

### FE06-22 — Retry independiente count

- Estado: BLOCKED
- Rol: cualquiera
- Precondición: requiere interceptación.
- Pasos: no ejecutado.
- Esperado: lista sana, badge desconocido y retry local.
- Obtenido: sin evidencia E2E.
- Evidencia: n/a.
- Requests relevantes: n/a.
- Consola: n/a.
- Observaciones: limitación de herramienta.

### FE06-23 — Estados de carga

- Estado: BLOCKED
- Rol: USER/TECHNICIAN
- Precondición: requests reales demasiado rápidos para observar todos los estados.
- Pasos: login, refresh y mutaciones reales.
- Esperado: skeleton, datos conservados y loading local.
- Obtenido: mutación/refresh completaron correctamente; no se forzó latencia.
- Evidencia: estados finales.
- Requests relevantes: reales 200.
- Consola: sin errores.
- Observaciones: no se marca PASS parcial.

### FE06-24 — Empty states

- Estado: NOT EXECUTED
- Rol: USER/TECHNICIAN
- Precondición: solo filtro unread quedó vacío de forma real.
- Pasos: revisar unread tras marcado.
- Esperado: textos de Todas, No leídas y Leídas vacíos.
- Obtenido: “No tienes notificaciones sin leer” correcto; All/Read no vacíos.
- Evidencia: `FE06-11-12-mark-read.png`.
- Requests relevantes: unread list 200.
- Consola: sin errores.
- Observaciones: cobertura parcial.

### FE06-25 — 404 al marcar

- Estado: BLOCKED
- Rol: USER
- Precondición: requiere 404 interceptado sobre propia tarjeta visible.
- Pasos: se comprobó 404 cruzado por API, no el flujo UI simulado.
- Esperado: mensaje seguro y refetch.
- Obtenido: sin evidencia UI.
- Evidencia: API 404.
- Requests relevantes: PATCH 404.
- Consola: sin errores.
- Observaciones: no se marca PASS.

### FE06-26 — 403/network/5xx

- Estado: BLOCKED
- Rol: varios
- Precondición: interceptación temporal.
- Pasos: no ejecutado.
- Esperado: mensajes seguros, alert y conservación.
- Obtenido: sin evidencia E2E.
- Evidencia: n/a.
- Requests relevantes: n/a.
- Consola: n/a.
- Observaciones: limitación de herramienta.

### FE06-27 — Carreras de filtros

- Estado: BLOCKED
- Rol: TECHNICIAN
- Precondición: requiere respuestas retrasadas.
- Pasos: cambios normales funcionaron; no se pudo retrasar all/unread/read.
- Esperado: respuesta vieja ignorada.
- Obtenido: sin carrera forzada.
- Evidencia: n/a.
- Requests relevantes: no interceptables.
- Consola: sin errores.
- Observaciones: ninguna falla confirmada.

### FE06-28 — Carrera página/back

- Estado: BLOCKED
- Rol: TECHNICIAN
- Precondición: requiere page 2 retrasada.
- Pasos: back/forward normal pasó.
- Esperado: respuesta page 2 no pisa page 1.
- Obtenido: no se forzó latencia.
- Evidencia: URLs normales.
- Requests relevantes: no interceptables.
- Consola: sin errores.
- Observaciones: ninguna falla confirmada.

### FE06-29 — Desmontaje/logout durante GET

- Estado: BLOCKED
- Rol: varios
- Precondición: GET lento controlado.
- Pasos: secuencia logout/login real pasó, pero no con GET retrasado.
- Esperado: respuesta vieja nunca reaparece.
- Obtenido: sin carrera forzada.
- Evidencia: aislamiento normal.
- Requests relevantes: no interceptables.
- Consola: sin errores.
- Observaciones: ninguna falla confirmada.

### FE06-30 — Seguridad XSS

- Estado: NOT EXECUTED
- Rol: cualquiera
- Precondición: fixture temporal con script.
- Pasos: no se guardó payload peligroso en DB; no hubo interceptación.
- Esperado: literal escapado, sin ejecución.
- Obtenido: sin evidencia E2E.
- Evidencia: n/a.
- Requests relevantes: n/a.
- Consola: n/a.
- Observaciones: obligatorio reintentar con route interception.

### FE06-31 — Texto largo

- Estado: NOT EXECUTED
- Rol: cualquiera
- Precondición: fixture largo/sin espacios.
- Pasos: no se creó dato persistente innecesario y no hubo interceptación.
- Esperado: sin overflow.
- Obtenido: sin evidencia específica.
- Evidencia: n/a.
- Requests relevantes: n/a.
- Consola: n/a.
- Observaciones: obligatorio reintentar con fixture temporal.

### FE06-32 — Responsive 390 × 844

- Estado: PASS
- Rol: USER
- Precondición: viewport 390×844.
- Pasos: inspección visual y anchos.
- Esperado: cards/acciones/badge sin overflow.
- Obtenido: clientWidth 375, scrollWidth 375, bodyWidth 375.
- Evidencia: `FE06-32-390x844.png`.
- Requests relevantes: lista/count 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE06-33 — Responsive 768 × 1024

- Estado: PASS
- Rol: USER
- Precondición: viewport 768×1024.
- Pasos: inspección visual y anchos.
- Esperado: sin overflow global.
- Obtenido: 753/753/753.
- Evidencia: `FE06-33-768x1024.png`.
- Requests relevantes: lista/count 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE06-34 — Responsive 1440 × 900

- Estado: PASS
- Rol: USER
- Precondición: viewport 1440×900.
- Pasos: inspección visual y anchos.
- Esperado: sin overflow global.
- Obtenido: 1425/1425/1425.
- Evidencia: `FE06-34-1440x900.png`.
- Requests relevantes: lista/count 200.
- Consola: sin errores.
- Observaciones: ninguna.

### FE06-35 — Accesibilidad básica

- Estado: PASS
- Rol: USER/TECHNICIAN
- Precondición: página real.
- Pasos: inspección AX/DOM y Enter sobre filtro Leídas.
- Esperado: H1, botones, grupo, aria-pressed, paginación, estado no solo color, nombres con ticket y foco.
- Obtenido: semántica presente; foco quedó en BUTTON “Leídas” con aria-pressed true; notificaciones anuncian “leída/no leída”.
- Evidencia: `FE06-35-keyboard-focus.png`.
- Requests relevantes: lista read 200.
- Consola: sin errores.
- Observaciones: no es auditoría WCAG completa.

### FE06-36 — Consola y red

- Estado: BLOCKED
- Rol: ADMIN/TECHNICIAN/USER
- Precondición: flujos normales.
- Pasos: revisar consola y resultados de acciones.
- Esperado: 0 errores, sin loops/polling, un PATCH/GET por acción.
- Obtenido: 0 errores y 0 warnings; no se imprimieron tokens; conteos exactos de red/polling no disponibles.
- Evidencia: `tab.dev.logs=[]`.
- Requests relevantes: no cuantificables por acción.
- Consola: limpia.
- Observaciones: no se asume PASS completo.

## 6. Integración FE-05 + FE-06

- Método: copia temporal en `C:\Users\Sewas\.codex\visualizations\2026\10\18\01a15157-1785-75c0-b6ea-4172ceb87884\qa-integration\cidrix-web`, creada desde FE-05 y superpuesta con los archivos FE-06. Los worktrees originales no se tocaron.
- INT-01 — PASS: ambos cambios pueden convivir. Existe solapamiento textual en `AppRoutes.tsx`/tests porque cada rama sustituye un placeholder; se reconcilió únicamente en la copia temporal usando `DashboardPage` y `NotificationsPage`. `AppLayout.tsx` usa el provider/badge de FE-06 sin romper Dashboard.
- INT-02 — PASS: lint, typecheck, 237 tests y build pasaron en la copia combinada. La primera corrida de Vitest dentro del sandbox tuvo `ENOENT` de caché; la repetición fuera del sandbox pasó.
- INT-03 — PASS: ADMIN vio Dashboard, Tickets, Notificaciones y Configuración; abrió Dashboard y Notifications.
- INT-04 — PASS: TECHNICIAN abrió Dashboard, Tickets y Notifications.
- INT-05 — PASS: USER no vio Dashboard, sí Tickets/Notifications; `/dashboard` redirigió a `/tickets`.
- INT-06 — PASS: a 390×844 ADMIN y USER tuvieron 375/375/375 de client/scroll/body width, sin overflow global.
- Evidencias: `INT-03-06-ADMIN-390x844.png`, `INT-05-06-USER-390x844.png`.
- Veredicto: `READY`, sujeto a realizar la reconciliación manual de los archivos compartidos al integrar las ramas reales.

## 7. Defectos encontrados

No se confirmó ningún `FAIL`; por tanto no se registran BUG-XX. Los casos bloqueados indican falta de evidencia, no comportamiento correcto ni defecto confirmado.

## 8. Datos QA creados

- Ticket: `fb72ea1e-33a0-4bb9-a0c5-5dd6353ef2e1`, número `TKT-0015`, título `QA-CODEX-FE06-20261018-1838-events`.
- Creador: USER `dbc64570-90bd-42be-abb4-9429efb9c41b`.
- Asignado a TECHNICIAN `68297c5e-7cf7-42a3-b4a7-9124999e0d75`.
- Comentario público: `789b10e1-d97f-44a4-a053-7c06a351b2b5`.
- Nota interna inicial por TECHNICIAN: `0117c9f9-6587-410e-943b-70027c47adb3` (no generó notificación porque el autor era el asignado, comportamiento backend esperado).
- Nota interna ADMIN→TECHNICIAN: `e98ff681-c0f3-4eb2-8d66-9400317c241c`.
- Estado final del ticket: `IN_PROGRESS`, versión 3.
- Notificación técnica usada en aislamiento: `a33d30ab-052f-4a09-9691-176c35121b1c`.
- Persistencia: el ticket, comentarios y notificaciones quedan en la base local. Las cuatro acciones se hicieron por contratos normales; no se usó SQL directo.
- Lecturas modificadas: una notificación USER QA se marcó leída y tres notificaciones TECHNICIAN QA se marcaron mediante read-all. Antes de la prueba ambas cuentas tenían 0 unread, por lo que no se alteró unread ajeno.

## 9. Validación automatizada

| Comando | FE-05 | FE-06 | Integración |
|---|---|---|---|
| npm run lint | PASS | PASS | PASS |
| npm run typecheck | PASS | PASS | PASS |
| npm test | PASS — 25 files / 176 tests | PASS — 25 files / 201 tests | PASS — 29 files / 237 tests |
| npm run build | PASS | PASS | PASS |
| git diff --check | PASS | PASS | PASS equivalente en copia; sin errores de whitespace, solo avisos CRLF al comparar directorios |

Nota ambiental: Vitest falló inicialmente dentro del sandbox con `ENOENT` sobre su caché temporal (FE-05: 21 suites sin cargar; integración: 28). Las repeticiones fuera del sandbox, sin editar archivos, pasaron por completo. FE-06 pasó en su primera ejecución fuera del sandbox.

## 10. Consola / Red

- Consola FE-05: 0 errores, 0 warnings de producto.
- Consola FE-06: 0 errores, 0 warnings de producto.
- Consola integración: 0 errores, 0 warnings de producto.
- La API registró únicamente los 401 esperados de refresh sin sesión, el 403 esperado de USER sobre Dashboard y el 404 esperado del PATCH cruzado.
- No se imprimieron tokens en este reporte.
- No se pudo obtener un HAR ni interceptar rutas desde el navegador disponible; por ello no se afirman conteos exactos de GET/PATCH, ausencia de polling ni cancelación de requests en carreras forzadas.

## 11. Responsive

| Módulo | Viewport | clientWidth | scrollWidth | bodyWidth | Resultado |
|---|---|---:|---:|---:|---|
| FE-05 | 390×844 | 375 | 375 | 375 | PASS |
| FE-05 | 768×1024 | 753 | 753 | 753 | PASS |
| FE-05 | 1440×900 | 1425 | 1425 | 1425 | PASS |
| FE-06 | 390×844 | 375 | 375 | 375 | PASS |
| FE-06 | 768×1024 | 753 | 753 | 753 | PASS |
| FE-06 | 1440×900 | 1425 | 1425 | 1425 | PASS |
| Integración ADMIN | 390×844 | 375 | 375 | 375 | PASS |
| Integración USER | 390×844 | 375 | 375 | 375 | PASS |

La diferencia de 15 px corresponde al scrollbar vertical del viewport; no hubo overflow horizontal de contenido.

## 12. Accesibilidad básica

Se verificaron H1, nombres accesibles, navegación principal, botones nativos, activación con Enter, `aria-pressed`, regiones `aria-live`, estados leída/no leída textuales, leyenda y datos textuales del gráfico, progressbars con nombre/valor y paginación etiquetada. Se guardó evidencia de foco de FE-06. No se ejecutó una auditoría WCAG completa, lector de pantalla real, contraste automatizado ni los `role=alert` de fallos simulados.

## 13. Estado Git final

Los estados de producto y tests permanecieron idénticos al snapshot inicial en ambos worktrees. `git diff --check` terminó 0 en ambos. La única diferencia nueva creada por esta QA en el repositorio principal es:

```text
?? docs/FE-05-FE-06-QA-report.md
```

Artefactos temporales fuera del repositorio:

- Evidencias PNG: `C:\Users\Sewas\.codex\visualizations\2026\10\18\01a15157-1785-75c0-b6ea-4172ceb87884\qa-evidence`.
- Copia integrada: `C:\Users\Sewas\.codex\visualizations\2026\10\18\01a15157-1785-75c0-b6ea-4172ceb87884\qa-integration`.

La API temporal de puerto 3001 y el Vite integrado se detuvieron. PostgreSQL no se detuvo. Los procesos previamente detectados en 3000/5173 no se terminaron al no poder demostrar de forma segura que no fueran usados por otra sesión.

## 14. Recomendación final

### FE-05

`NOT READY`

No hay defectos confirmados, pero deben ejecutarse con interceptación los casos FE05-16 a FE05-21/27 y completar fixtures de FE05-08/11/22 antes de un gate final.

### FE-06

`NOT READY`

No hay defectos confirmados, pero deben ejecutarse los casos de badge 99+, fallos/retries, carreras forzadas, XSS, texto largo y conteos exactos de red.

### Integración

`READY`

La copia combinada pasó lint, typecheck, 237 tests, build y smoke de roles/responsive. La integración real requiere reconciliar los solapamientos de rutas/tests identificados.
