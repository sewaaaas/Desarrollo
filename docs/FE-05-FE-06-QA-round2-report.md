# CIDRIX — QA Round 2 FE-05 + FE-06

Fecha: 2026-10-19 (America/Lima)  
Alcance: únicamente los 26 casos `BLOCKED` / `NOT EXECUTED` de Round 1.  
Política: QA sin correcciones de producto, tests, configuración, backend, Prisma ni datos seed.

## 1. Resumen ejecutivo

| Módulo | Pendientes iniciales | PASS | FAIL | BLOCKED | NOT EXECUTED | Veredicto |
|---|---:|---:|---:|---:|---:|---|
| FE-05 | 10 | 9 | 1 | 0 | 0 | READY WITH MINOR ISSUES |
| FE-06 | 16 | 16 | 0 | 0 | 0 | READY |

Resultado total: **25 PASS / 1 FAIL / 0 BLOCKED / 0 NOT EXECUTED**.

Se confirmó un defecto P3 en FE-05: categorías con texto largo expanden el documento móvil de 390 px a 800 px. No se corrigió código ni tests.

## 2. Instrumentación usada

- Playwright sobre Chrome headless instalado localmente.
- API temporal: `http://192.168.18.25:3002/api/v1`.
- Vite temporal, un worktree a la vez: `http://192.168.18.25:5174`.
- CORS temporal de proceso: origen LAN y orígenes localhost del puerto 5174; ningún `.env` fue modificado.
- Scripts temporales fuera del repositorio:
  - `C:\Users\Sewas\.codex\visualizations\2026\10\18\01a15157-1785-75c0-b6ea-4172ceb87884\qa-round2\fe05-round2.cjs`
  - `C:\Users\Sewas\.codex\visualizations\2026\10\18\01a15157-1785-75c0-b6ea-4172ceb87884\qa-round2\fe06-round2.cjs`
- Evidencia visual fuera del repositorio: mismo directorio `qa-round2`, archivos PNG.
- Interceptación de rutas con `page.route`, respuestas JSON envelopadas, `route.abort('failed')`, HTTP 403/404/500 y demoras de 1.2–2.0 s.
- Conteo mediante eventos `request` por método y URL. `OPTIONS` no se contó como request funcional.
- Auditoría mediante `requestfailed`, `console`, `pageerror`, URL final, DOM, dimensiones y estados ARIA.
- Los 401 de `auth/refresh` previos al login son esperados y fueron separados de errores inesperados.
- Los servidores temporales fueron detenidos al terminar. PostgreSQL preexistente no fue detenido.

## 3. Estado Git inicial

### FE-05

- Worktree: `C:\Users\Sewas\proyecto`
- Rama: `codex/fe-05-dashboard`
- HEAD: `1b80975 Merge pull request #10 from sewaaaas/codex/fe-04-ticket-detail`
- Había cambios de implementación FE-05 sin commit y los reportes preexistentes `docs/FE-05-FE-06-QA-report.md` y `docs/FE-05-implementation-review.md`.

### FE-06

- Worktree: `C:\Users\Sewas\proyecto-fe06`
- Rama: `codex/fe-06-notifications`
- HEAD: `1b80975 Merge pull request #10 from sewaaaas/codex/fe-04-ticket-detail`
- Había cambios de implementación FE-06 sin commit y `docs/FE-06-implementation-review.md`.

`git worktree list` confirmó ambos worktrees sobre el mismo HEAD. No se alteró el historial Git.

## 4. FE-05

### FE05-08 — Categorías extremas
- Estado: **FAIL**.
- Rol: ADMIN.
- Instrumentación: fixture de 36 categorías; `Sin categoría`, inactivas, eliminadas y cadenas sin espacios; viewports 1440×900 y 390×844.
- Pasos: cargar Dashboard, esperar lista, verificar badges, scroll interno, medir `clientWidth`, `scrollWidth` y `body.scrollWidth` y tomar capturas.
- Esperado: lista con scroll interno y sin overflow global en ambos viewports.
- Obtenido: 1440 px correcto (`clientWidth=1440`, `scrollWidth=1440`, `bodyWidth=1440`). A 390 px, la lista sí tuvo scroll interno y mostró indicadores, pero el documento se expandió a 800 px (`clientWidth=390`, `scrollWidth=800`, `bodyWidth=800`).
- Requests: por viewport, 1 GET Overview + 1 GET Trends 30d.
- Evidencia: `01-fe05-08-categorias-1440.png` y `02-fe05-08-categorias-390.png` en el directorio temporal de evidencia.
- Consola: 0 errores JS inesperados; 0 warnings relevantes.
- Observaciones: el card `Por categoría` llegó a 784 px y su lista a 734 px. Registrado como BUG-R2-01.

### FE05-11 — Resolution Time null
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: Overview con ambos promedios `null` y muestras 0; después se retiró la interceptación.
- Pasos: validar estado nulo, restaurar tráfico real y usar `Actualizar`.
- Esperado: dos `Sin datos`, sin `0 s`, NaN o Infinity; recuperación real.
- Obtenido: dos `Sin datos`, sin etiqueta de muestra ni valores inválidos; al restaurar tráfico, los datos reales reaparecieron.
- Requests: fixture 1 Overview + 1 Trends; recuperación 1 Overview + 1 Trends.
- Evidencia: DOM y conteo del arnés temporal.
- Consola: limpia.
- Observaciones: layout estable.

### FE05-16 — Cambio de período y conteo exacto
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: fixture Trends según query y contadores por período.
- Pasos: 30d → 7d → 30d → 90d.
- Esperado: un Trends por cambio y ningún Overview innecesario.
- Obtenido: Overview=1 total; Trends 30d=2, 7d=1, 90d=1. Sin loops ni duplicados.
- Requests: 1 GET Overview; 4 GET Trends, exactamente los esperados.
- Evidencia: contadores del arnés.
- Consola: limpia.
- Observaciones: `OPTIONS` excluidos.

### FE05-17 — Carrera 7d → 90d
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: Trends 7d demorado 1800 ms; Trends 90d inmediato; dos repeticiones.
- Pasos: seleccionar 7d, esperar ~100 ms y seleccionar 90d; liberar 7d después.
- Esperado: URL y UI finales de 90d.
- Obtenido: en 2/2 repeticiones terminó `?period=90d`, gráfico de 90 días; la respuesta 7d fue abortada o ignorada.
- Requests: por repetición, Trends 30d inicial + 7d + 90d; 1 Overview inicial.
- Evidencia: secuencia temporal del arnés.
- Consola: sin errores JS; aborts esperados separados.
- Observaciones: no hubo overwrite tardío.

### FE05-18 — Refresh manual y doble click
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: período 90d, 1200 ms de demora en refresh y conteo por endpoint.
- Pasos: estabilizar 90d, doble clic rápido en `Actualizar`; repetir 20 veces.
- Esperado: por intento, 1 Overview + 1 Trends; datos previos visibles y período conservado.
- Obtenido: 20/20 intentos con delta exacto Overview=1 y Trends=1; botón bloqueado durante carga, datos previos presentes y URL 90d.
- Requests: por intento de refresh, 2 requests funcionales exactos.
- Evidencia: matriz de 20 repeticiones del arnés.
- Consola: limpia.
- Observaciones: sin request storm.

### FE05-19 — Error parcial Overview
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: variantes Overview 500 y network failure; Trends sano.
- Pasos: carga sana, refresh fallido y retry local.
- Esperado: error local seguro, Trends preservado y retry sin solicitar Trends.
- Obtenido: en ambas variantes se conservaron Overview previo y Trends; retry recuperó Overview.
- Requests: por variante, Overview=3 (inicial, fallo, retry); Trends=2 (inicial y refresh), sin Trends adicional en retry.
- Evidencia: alertas y contadores del arnés.
- Consola: solo errores HTTP/red simulados esperados.
- Observaciones: copy 500 y network seguro.

### FE05-20 — Error parcial Trends
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: segundo Trends responde 500; tercero recupera.
- Pasos: carga sana, refresh, error Trends y retry local.
- Esperado: Overview sano y retry sin volver a pedir Overview.
- Obtenido: tendencia previa visible con alerta; retry recuperó solo Trends.
- Requests: Overview=2; Trends=3; el retry agregó exclusivamente el tercer Trends.
- Evidencia: DOM y contadores del arnés.
- Consola: solo 500 simulado esperado.
- Observaciones: recurso sano no se desmontó.

### FE05-21 — 403 / network / 5xx seguros
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: tres contextos; primer Overview falla y el retry responde 200.
- Pasos: validar alerta, texto, ausencia de payload técnico y retry.
- Esperado: copy seguro, `role=alert`, recurso sano presente y retry independiente.
- Obtenido: mensajes correctos para 403, red y 500; no aparecieron `SECRET_*`, stack ni mensaje interno; todos recuperaron.
- Requests: por variante, Overview=2 y Trends=1.
- Evidencia: DOM, alertas y contadores.
- Consola: fallos simulados esperados; 0 errores JS.
- Observaciones: retry no pidió Trends.

### FE05-22 — Empty / zero states completos
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: Overview todo cero/vacío y Trends de 30 días todo cero.
- Pasos: cargar fixture y validar cada sección.
- Esperado: empty states, ceros válidos y sin valores inválidos.
- Obtenido: mensajes de categorías, workload y actividad correctos; dos `Sin datos`; ceros renderizados sin error.
- Requests: 1 Overview + 1 Trends.
- Evidencia: `fe05-22-empty.png` en evidencia temporal.
- Consola: limpia.
- Observaciones: sin NaN/Infinity.

### FE05-27 — Consola y red completa
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: listeners de consola, `pageerror`, request y `requestfailed` durante FE05-16 a FE05-22.
- Pasos: clasificar fallos simulados y aborts, buscar loops, warnings y tokens en URL.
- Esperado: 0 errores JS inesperados, 0 warnings relevantes, 0 loops y 0 tokens.
- Obtenido: 0 `pageerror`, 0 warnings, 0 errores inesperados, 0 token en URL y conteos coherentes por caso.
- Requests: detallados en la sección 6.
- Evidencia: auditoría del arnés temporal.
- Consola: limpia tras excluir 401 pre-login y errores simulados conocidos.
- Observaciones: no hubo polling.

## 5. FE-06

### FE06-04 — Badge 99+
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: unread-count=120; 390×844 y 1440×900.
- Pasos: login, esperar badge, inspeccionar texto, nombre accesible y anchos DOM.
- Esperado: visual `99+`, accesible 120 y sin overflow.
- Obtenido: `99+`, `aria-label="120 notificaciones sin leer"`; `scrollWidth` y `bodyWidth` no excedieron `clientWidth` en ambos viewports.
- Requests: 1 GET count por viewport.
- Evidencia: `fe06-04-badge-390.png` y `fe06-04-badge-1440.png`.
- Consola: limpia.
- Observaciones: navegación móvil se mantuvo contenida.

### FE06-12 — Doble submit individual
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: PATCH demorado 1000 ms y contadores.
- Pasos: doble activación rápida sobre `Marcar como leída`.
- Esperado: un PATCH, un feedback y una sola actualización de recursos.
- Obtenido: PATCH=1; feedback único; list y count hicieron un refetch cada uno; sin 404 secundario.
- Requests: list=2, count=2, PATCH=1.
- Evidencia: contadores y estado DOM.
- Consola: limpia.
- Observaciones: control local bloqueado durante mutación.

### FE06-16 — Ver ticket sin enriquecimiento extra
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: captura de GET ticket y PATCH notificación.
- Pasos: cargar Notifications, inspeccionar `href` y pulsar `Ver ticket`.
- Esperado: navegación por `ticketId`, sin PATCH ni GET previo de enriquecimiento.
- Obtenido: href `/tickets/fb72ea1e-33a0-4bb9-a0c5-5dd6353ef2e1`; 0 PATCH y 0 GET ticket antes del clic; navegación directa correcta. Los GET posteriores de Ticket Detail se consideraron válidos.
- Requests: antes del clic, list=1, count=1, PATCH=0, ticket GET=0.
- Evidencia: URL, href y log de requests.
- Consola: limpia.
- Observaciones: no hubo marcado automático.

### FE06-20 — Refresh manual
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: filtro `unread`, demoras de 1200 ms y doble clic.
- Pasos: estabilizar `filter=unread&page=1`, doble clic en `Actualizar`.
- Esperado: un GET list y uno count, datos previos y query preservados.
- Obtenido: delta list=1 y count=1; tarjeta previa visible; botón deshabilitado; URL conservada.
- Requests: sesión del caso list=3 (inicial, filtro, refresh), count=2; el refresh agregó exactamente uno de cada.
- Evidencia: contadores, URL y DOM.
- Consola: limpia.
- Observaciones: sin duplicación.

### FE06-21 — Retry independiente lista
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: variantes list 500 y network failure.
- Pasos: carga fallida, validar count sano y pulsar retry listado.
- Esperado: retry no solicita count.
- Obtenido: ambas variantes recuperaron el listado con count intacto.
- Requests: por variante list=2, count=1.
- Evidencia: alertas y contadores.
- Consola: solo fallo simulado esperado.
- Observaciones: error local con `role=alert`.

### FE06-22 — Retry independiente count
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: primer unread-count abortado; segundo responde 3.
- Pasos: validar listado, ausencia de falso cero y retry count.
- Esperado: retry no pide listado.
- Obtenido: no apareció `0 sin leer`; después del retry apareció `3 sin leer`.
- Requests: list=1, count=2.
- Evidencia: DOM y contadores.
- Consola: fallo de red simulado esperado.
- Observaciones: badge permaneció desconocido, no cero.

### FE06-23 — Estados de carga
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: list/count 2000 ms, PATCH 1800 ms.
- Pasos: observar carga inicial, refresh con datos previos y mutación individual.
- Esperado: skeleton inicial, actualización no destructiva, loading local y acciones incompatibles bloqueadas.
- Obtenido: skeleton inicial; refresh mostró `Actualizando notificaciones…` y conservó tarjeta; mutación tuvo `aria-busy=true`; `Actualizar`, filtros y mark-all quedaron deshabilitados; count no sustituyó la página por spinner global.
- Requests: carga inicial 1 list + 1 count; refresh 1 list + 1 count; mutación 1 PATCH seguida de 1 list + 1 count.
- Evidencia: `fe06-23-loading-list.png`, `fe06-23-loaded.png`, `fe06-23-refresh-preserves-data.png`, `fe06-23-mutation-loading.png`.
- Consola: limpia.
- Observaciones: cuatro capturas tomadas durante/tras latencia.

### FE06-24 — Empty states completos
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: listas vacías por filtro.
- Pasos: recorrer Todas, No leídas y Leídas.
- Esperado: copy distinto y paginación coherente.
- Obtenido: `No tienes notificaciones.`, `No tienes notificaciones sin leer.` y `No tienes notificaciones leídas.`; en cada filtro `Página 1 de 1 · 0 notificaciones`.
- Requests: list=3, count=1.
- Evidencia: DOM y queries finales.
- Consola: limpia.
- Observaciones: sin estado de error.

### FE06-25 — 404 al marcar
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: PATCH individual responde 404 con mensaje técnico controlado.
- Pasos: marcar tarjeta visible y esperar refetch.
- Esperado: mensaje seguro, refetch list/count y UI consistente.
- Obtenido: `La notificación ya no está disponible.`; mensaje interno no visible; ambos recursos se refrescaron.
- Requests: list=2, count=2, PATCH=1.
- Evidencia: alerta, DOM y contadores.
- Consola: 404 simulado esperado.
- Observaciones: sin envelope técnico.

### FE06-26 — 403 / network / 5xx
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: matriz 3 recursos × 3 fallos: list/count/mutación contra 403/network/500.
- Pasos: ejecutar nueve contextos, validar alerta, copy y ausencia de detalles.
- Esperado: mensajes seguros, `role=alert`, sin crash y retry independiente.
- Obtenido: 9/9 combinaciones mostraron copy seguro; no se expusieron `SECRET_*`, stack ni password. La independencia de retries quedó corroborada por FE06-21, FE06-22 y el refetch controlado de FE06-25.
- Requests: cada contexto list=1 y count=1; escenarios de mutación PATCH=1.
- Evidencia: matriz del arnés y alertas DOM.
- Consola: solo errores simulados conocidos.
- Observaciones: la aplicación permaneció operable.

### FE06-27 — Carrera all → unread → read
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: all 1800 ms, unread 1200 ms y read inmediato; dos repeticiones.
- Pasos: cambiar all → unread → read con 50 ms entre los dos últimos.
- Esperado: URL y contenido read, sin overwrite tardío.
- Obtenido: 2/2 finalizaron `filter=read&page=1` y solo `Resultado read`; unread/all tardíos fueron abortados o ignorados.
- Requests: por repetición, 3 GET list y 1 GET count.
- Evidencia: secuencia temporal y URL final.
- Consola: sin errores JS; aborts esperados.
- Observaciones: orden de respuesta read → unread/all.

### FE06-28 — Carrera page 2 → back
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: page 2 demorada 1800 ms.
- Pasos: ir a page 2, esperar 100 ms y volver a page 1 antes de liberar page 2.
- Esperado: page 1 final sin datos obsoletos.
- Obtenido: URL page 1 y `Página uno vigente`; `Página dos obsoleta` nunca apareció.
- Requests: list page1 inicial + page2 + page1 al volver; count=1.
- Evidencia: URL, contenido y orden temporal.
- Consola: limpia.
- Observaciones: respuesta page2 ignorada.

### FE06-29 — Logout durante GET
- Estado: **PASS**.
- Rol: A=ADMIN; B=TECHNICIAN.
- Instrumentación: list A demorada 1800 ms; list B inmediata.
- Pasos: iniciar GET A, logout, login B y liberar A.
- Esperado: ningún dato A en B; recursos solo de B.
- Obtenido: `Datos usuario B vigentes` y `tecnico@cidrix.dev`; nunca apareció `Datos usuario A obsoletos`.
- Requests: list A=1 abortada/ignorada; list B=1; counts aislados por proveedor de sesión.
- Evidencia: DOM final, usuario activo y secuencia del arnés.
- Consola: limpia.
- Observaciones: el retorno post-login correcto fue Notifications.

### FE06-30 — Seguridad XSS
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: título `<img ... onerror>` y mensaje `<script>...</script>` solo en respuesta interceptada.
- Pasos: renderizar, inspeccionar texto, DOM y bandera JS.
- Esperado: literal escapado, sin ejecución ni nodos peligrosos.
- Obtenido: ambos payloads visibles como texto; `window.__xss` indefinido; 0 `article img` y 0 `article script` provenientes del payload.
- Requests: list=1, count=1.
- Evidencia: DOM y evaluación JS.
- Consola: limpia; sin alert.
- Observaciones: payload no persistido.

### FE06-31 — Texto extremo
- Estado: **PASS**.
- Rol: ADMIN.
- Instrumentación: título/mensaje/ticketNumber con 420 caracteres sin espacios, acentos, Unicode latino, CJK y cirílico; 390×844.
- Pasos: cargar tarjeta, medir DOM y comprobar acciones.
- Esperado: wrap y acciones accesibles sin overflow.
- Obtenido: `documentWidth` y `bodyWidth` no superaron `clientWidth=390`; acciones conservaron nombre accesible.
- Requests: list=1, count=1.
- Evidencia: `fe06-31-extreme-390.png` y métricas DOM.
- Consola: limpia.
- Observaciones: sin desplazamiento horizontal global.

### FE06-36 — Consola y red completa
- Estado: **PASS**.
- Rol: ADMIN y TECHNICIAN en FE06-29.
- Instrumentación: listeners globales durante la matriz, búsqueda de tokens/JWT, duplicados y polling.
- Pasos: clasificar fallos intencionales, aborts y 401 pre-login; revisar requests funcionales.
- Esperado: un PATCH por acción, 0 errores JS inesperados, 0 polling y 0 secretos.
- Obtenido: PATCH individuales exactos, 0 `pageerror`, 0 warnings, 0 errores inesperados, 0 token en URL/consola y 0 polling.
- Requests: detallados en sección 6.
- Evidencia: auditoría del arnés temporal.
- Consola: limpia tras excluir fallos deliberados.
- Observaciones: `OPTIONS` no contado como duplicación.

## 6. Conteos de red

| Caso | Endpoint | Esperado | Observado | Resultado |
|---|---|---:|---:|---|
| FE05-16 | Overview | 1 | 1 | PASS |
| FE05-16 | Trends 30d / 7d / 90d | 2 / 1 / 1 | 2 / 1 / 1 | PASS |
| FE05-17 | Trends por repetición | 3 | 3 | PASS |
| FE05-18 | Overview por refresh | 1 | 1 en 20/20 | PASS |
| FE05-18 | Trends 90d por refresh | 1 | 1 en 20/20 | PASS |
| FE05-19 | retry Overview, Trends extra | 1 / 0 | 1 / 0 | PASS |
| FE05-20 | retry Trends, Overview extra | 1 / 0 | 1 / 0 | PASS |
| FE05-21 | Overview / Trends por variante | 2 / 1 | 2 / 1 | PASS |
| FE06-12 | PATCH / list refetch / count refetch | 1 / 1 / 1 | 1 / 1 / 1 | PASS |
| FE06-16 | PATCH y ticket GET antes del clic | 0 / 0 | 0 / 0 | PASS |
| FE06-20 | list / count por refresh | 1 / 1 | 1 / 1 | PASS |
| FE06-21 | retry list / count extra | 1 / 0 | 1 / 0 | PASS |
| FE06-22 | retry count / list extra | 1 / 0 | 1 / 0 | PASS |
| FE06-25 | PATCH / list refetch / count refetch | 1 / 1 / 1 | 1 / 1 / 1 | PASS |
| FE06-27 | list por repetición | 3 | 3 | PASS |
| FE06-28 | list page1/page2/page1 | 3 | 3 | PASS |
| FE06-29 | list A / list B | 1 / 1 | 1 / 1 | PASS |

## 7. Race conditions

### FE05-17

- Repeticiones: 2.
- Request A (7d): `t+0 ms`.
- Request B (90d): aproximadamente `t+100 ms`.
- Respuesta B: inmediata, antes de `t+200 ms`.
- Liberación A: aproximadamente `t+1800 ms`.
- URL final: `?period=90d`.
- Estado final: gráfico accesible de últimos 90 días; A no sobrescribió.

### FE06-27

- Repeticiones: 2.
- A=all a `t+0 ms`, demora 1800 ms.
- B=unread después de A, demora 1200 ms.
- C=read aproximadamente 50 ms después de B, respuesta inmediata.
- Orden efectivo: read primero; unread/all se abortaron o liberaron después y fueron ignoradas.
- URL final: `filter=read&page=1`.
- Estado final: solo contenido read.

### FE06-28

- Request page2: `t+0 ms`, demora 1800 ms.
- Back/page1: aproximadamente `t+100 ms`, respuesta inmediata.
- Liberación page2: aproximadamente `t+1800 ms`.
- URL final: `page=1`.
- Estado final: contenido page1; page2 no apareció.

### FE06-29

- GET A: `t+0 ms`, demora 1800 ms.
- Logout: antes de la respuesta A.
- Login B y GET B: posterior al logout, respuesta inmediata.
- Liberación A: después de mostrar B; abortada o ignorada.
- Estado final: usuario y listado B exclusivamente.

## 8. Errores simulados

| Caso | Endpoint | Error simulado | UI esperada | UI obtenida | Resultado |
|---|---|---|---|---|---|
| FE05-19 | dashboard/overview | 500 | error local, Trends sano | correcto, retry independiente | PASS |
| FE05-19 | dashboard/overview | network | error local, Trends sano | correcto, retry independiente | PASS |
| FE05-20 | dashboard/trends | 500 | error local, Overview sano | correcto, retry independiente | PASS |
| FE05-21 | dashboard/overview | 403/network/500 | copies seguros y alert | 3/3 correctos, sin leak | PASS |
| FE06-21 | notifications list | 500/network | count sano, retry list | 2/2 correctos | PASS |
| FE06-22 | unread-count | network | sin falso cero, retry count | correcto | PASS |
| FE06-25 | markRead | 404 | mensaje seguro y refetch | correcto | PASS |
| FE06-26 | list/count/mutation | 403/network/500 | alert segura, sin crash | 9/9 correctos | PASS |

## 9. Seguridad

- XSS: payloads de script e imagen se mostraron como texto, sin ejecución.
- DOM: no se crearon nodos `script` ni `img` desde payloads.
- Consola: 0 errores JS inesperados y 0 warnings relevantes.
- Secretos: no se observaron JWT, access tokens, stacks, passwords ni envelopes técnicos en UI, consola o query strings.
- Autenticación: los 401 de refresh previos al login fueron esperados; no hubo bypass.
- Aislamiento de sesión: FE06-29 confirmó que datos tardíos de A no llegan a B.

## 10. Responsive extremo

- FE05 categorías, 1440×900: correcto; ancho 1440/1440/1440 y scroll interno.
- FE05 categorías, 390×844: **FAIL**; `clientWidth=390`, `document.scrollWidth=800`, `body.scrollWidth=800`.
- FE06 badge 120, 390×844 y 1440×900: `99+`, nombre accesible 120, sin overflow.
- FE06 texto extremo, 390×844: cadenas de 420 caracteres, Unicode y acentos ajustaron correctamente; anchos ≤390.

## 11. Bugs

### BUG-R2-01 — Categorías largas provocan overflow horizontal global en móvil
- Severidad: **P3**.
- Módulo: FE-05 Dashboard.
- Caso: FE05-08.
- Reproducibilidad: 2/2 ejecuciones focalizadas a 390×844; 1440×900 no afectado.
- Pasos: interceptar Overview con 36 categorías, incluir nombres con 80 caracteres sin espacios, abrir Dashboard a 390×844 y medir el documento.
- Esperado: card y lista contenidos a 390 px, con scroll solamente vertical interno.
- Actual: `clientWidth=390`, `document.scrollWidth=800`, `body.scrollWidth=800`; card `Por categoría` de 784 px.
- Evidencia: `02-fe05-08-categorias-390.png`; métricas y lista de elementos ofensores en el arnés.
- Requests: 1 Overview + 1 Trends; sin duplicación ni loop.
- Consola: limpia.
- Hipótesis de causa: el item/grid del card conserva un ancho mínimo basado en contenido; el `break-words` interno no reduce el min-content del contenedor en esa composición.
- Impacto: desplazamiento horizontal y contenido fuera del viewport en móviles cuando existen nombres de categoría largos. No afecta seguridad ni datos.

No se incluyó patch.

## 12. Automatización final

| Comando | FE-05 | FE-06 |
|---|---|---|
| `npm run lint` | PASS | PASS |
| `npm run typecheck` | PASS | PASS |
| `npm test` | PASS — 25 archivos, 176/176 | PASS — 25 archivos, 201/201 |
| `npm run build` | PASS | PASS |
| `git diff --check` | PASS | PASS |

Nota: la primera ejecución FE-05 de Vitest dentro del sandbox falló antes de ejecutar 24 suites por `ENOENT` en el directorio temporal del propio sandbox. Se repitió fuera de ese aislamiento y pasó 25/25, 176/176. No fue un fallo del producto.

## 13. Estado Git final

- FE-05 continúa en `codex/fe-05-dashboard`, HEAD `1b80975`.
- FE-06 continúa en `codex/fe-06-notifications`, HEAD `1b80975`.
- Los cambios de producto/tests listados al inicio permanecen iguales.
- FE-06 no recibió archivos nuevos de QA.
- La única diferencia nueva dentro del repositorio FE-05 causada por Round 2 es este archivo:
  - `docs/FE-05-FE-06-QA-round2-report.md`
- El reporte Round 1 permanece intacto.
- No se ejecutaron commit, push, PR, merge, rebase, stash, reset, clean ni restore.
- Harness, resultados y screenshots permanecen fuera del repositorio.

## 14. Veredicto

- FE-05: **READY WITH MINOR ISSUES** — 9 PASS / 1 FAIL P3 / 0 BLOCKED / 0 NOT EXECUTED.
- FE-06: **READY** — 16 PASS / 0 FAIL / 0 BLOCKED / 0 NOT EXECUTED.
- Round 2 global: **READY WITH MINOR ISSUES**.

Se detectó un fallo visual P3. No se realizó ninguna corrección. Esperar aprobación del Tech Lead antes de modificar código.
