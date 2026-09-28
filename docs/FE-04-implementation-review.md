# CIDRIX — FE-04: Detalle de Ticket + Comentarios + Adjuntos + Timeline

## 1. Resumen ejecutivo

Se reemplazó el placeholder de `/tickets/:id` por una vista funcional de Help Desk con detalle, navegación de regreso, timeline unificado, comentarios, adjuntos y mutaciones de ticket. La UI deriva controles desde el rol, la asignación, el estado y la versión actuales, mientras el backend continúa siendo la autoridad final.

## 2. Base de trabajo

- Base: `main` actualizado desde `origin/main`.
- Commit base: `97a3c16` (`Merge pull request #9 from sewaaaas/codex/fe-03-tickets`).
- Rama local: `codex/fe-04-ticket-detail`.
- Working tree inicial limpio.
- Sin commit, push, PR ni merge.

## 3. Contratos backend confirmados

Se inspeccionaron los controladores, DTO, servicios y configuración de Tickets, Comments, Attachments, Users y Categories. Se confirmaron los endpoints documentados, el envelope global actual, la paginación, los roles, las transiciones, `version`, `multipart/form-data`, la descarga Bearer y la respuesta `204` de delete.

## 4. Arquitectura final

Se mantuvo Feature-First dentro de `src/features/tickets`: fachadas API separadas, tipos compartidos, reglas puras de permisos, componentes enfocados y una página orquestadora. No se duplicó auth, cliente HTTP, badges, categorías ni usuarios de FE-03.

## 5. Ticket Detail

La página carga `GET /tickets/:id` como recurso principal y muestra número, título, descripción, estado, prioridad, categoría, solicitante, técnico y fechas no nulas. Los errores 403 y 404 usan estados seguros sin filtrar información del ticket.

## 6. Navegación de regreso

`Volver a Tickets` reutiliza `location.state.from`, preservando query y hash de FE-03. Solo acepta destinos internos cuyo path comienza en `/tickets`; cualquier valor externo, protocol-relative o inválido cae en `/tickets`.

## 7. Ticket API

`tickets.api.ts` incorpora `update`, `assign`, `updateStatus` y `getTimeline`, codifica IDs en paths y usa la misma fachada autenticada de FE-02.

## 8. Optimistic locking

Update, assign y status envían siempre la `version` actualmente renderizada. Un `409` no se reintenta: se muestra “Este ticket fue modificado por otra persona” y el control `Recargar ticket` ejecuta un GET nuevo.

## 9. Edición

ADMIN puede editar tickets no terminales. TECHNICIAN solo si está asignado. USER no ve el control. El formulario valida título `1..255`, descripción mínima de 10, prioridad y categoría; la respuesta del backend reemplaza el ticket y conserva la nueva versión.

## 10. Asignación

Solo ADMIN ve el editor de asignación. Las opciones se filtran a `TECHNICIAN`. Desasignar se ofrece únicamente en `OPEN`; los tickets terminales no muestran el control.

## 11. Estados

No se usa un select indiscriminado. Se calculan botones únicamente para transiciones válidas. Los estados que requieren técnico no aparecen sin asignación. TECHNICIAN no recibe acciones CLOSED/CANCELLED y solo actúa sobre tickets asignados.

## 12. Timeline

El timeline consulta `order=desc`, página 20 elementos y permite “Cargar más”. Renderiza COMMENT y HISTORY, actor nulo como “Sistema”, labels humanos, cambios conocidos y fallback neutral para campos futuros. Después de comentario o mutación se refresca para mostrar el evento nuevo.

## 13. Comentarios

El composer valida `1..5000`, normaliza CRLF/trim, bloquea doble submit, limpia tras éxito y refresca timeline y detalle. Si el refresh del detalle falla después de crear, no se ofrece un retry del POST que pueda duplicar el comentario.

## 14. PUBLIC / INTERNAL

USER envía siempre PUBLIC y nunca recibe selector. ADMIN y TECHNICIAN asignado pueden escoger PUBLIC/INTERNAL. El frontend no reconstruye información ocultada por el backend.

## 15. Adjuntos

El panel lista nombre, tamaño, autor, fecha, visibilidad y acciones. Soporta upload general de ticket, descarga autenticada y delete visible solo para ADMIN. Los nombres largos usan `break-all` y se renderizan como texto.

## 16. Multipart

El upload construye `FormData` con `file` y `visibility`. No establece `Content-Type`; el navegador genera el boundary. `accept` incluye PDF, PNG, JPG/JPEG, WEBP, TXT, LOG y CSV, solo como ayuda de UX.

## 17. Download autenticado

La descarga usa la misma fachada autenticada FE-02 y `responseType: 'blob'`. Después crea un object URL, dispara un anchor temporal con `download=originalName` y lo revoca en `finally`.

## 18. Delete Attachment

Solo ADMIN ve Delete. La UI solicita confirmación, consume el `204`, refresca la lista y anuncia el resultado mediante la región accesible.

## 19. API client compartido

El cliente compartido se amplió mínimamente con `responseType: 'json' | 'blob'`. Mantiene token en memoria, credentials, AbortSignal, single-flight refresh y retry único de FE-02. Los errores de una descarga siguen intentando leer el envelope JSON. FormData conserva su comportamiento previo.

## 20. UX por rol

- USER: lectura propia, comentario/adjunto PUBLIC, descarga; sin edit, assign, status, INTERNAL o delete.
- TECHNICIAN asignado: edit, transiciones permitidas, PUBLIC/INTERNAL y download; sin assign, CLOSED, CANCELLED o delete.
- TECHNICIAN no asignado: lectura sin mutaciones.
- ADMIN: edit, assign/unassign válido, status, PUBLIC/INTERNAL, download y delete.

## 21. Estados terminales

CLOSED/CANCELLED no muestran composer, upload, edit, assign ni transiciones. Se evita enviar requests previsiblemente inválidos.

## 22. Loading / error / retry

Hay loading principal y por sección. Timeline y Attachments tienen errores/retry locales sin ocultar el Ticket. Se distinguen mensajes para 400, 403, 404, 409, 413, red y servidor. Todos los GET usan AbortSignal para evitar que una ruta anterior sobrescriba la nueva.

## 23. Responsive

Se validaron 390×844, 768×1024 y 1440×900. El contenido pasa de stack vertical a dos columnas en desktop, los controles envuelven y no se detectó overflow horizontal (`scrollWidth <= innerWidth`) en los tres tamaños.

## 24. Accesibilidad

Se incluyeron headings jerárquicos, labels, roles de dialog/tab/tablist/tabpanel, `aria-modal`, `aria-live`, estados de loading, errores con `role=alert`, botones reales, Escape para cerrar diálogos y contenido textual compatible con teclado.

## 25. Seguridad frontend

- Comentarios y filenames se renderizan como texto React.
- No existe `dangerouslySetInnerHTML` ni `innerHTML`.
- El token no llega a componentes ni se persiste.
- No hay fetch paralelo de auth.
- Los destinos de regreso se validan fail-closed.
- No hay secretos ni IDs seed en código productivo.
- Los permisos visuales no sustituyen la autorización backend.

## 26. Tests

Resultado final: 21 archivos de test, 137 tests aprobados, 0 fallos. Se cubrieron APIs, Blob/FormData, errores Blob, permisos, transiciones, terminales, 403/404, navegación, detalle, timeline, actor nulo, texto XSS, paginación, comentarios, versiones, 409, 413, upload/download/delete, object URL, errores parciales y refresh.

## 27. Pruebas manuales

- USER: ticket propio, comentario PUBLIC, timeline actualizado, sin INTERNAL ni acciones administrativas; ticket ajeno devuelve acceso restringido.
- ADMIN: detalle, edit, assign, status, comentario INTERNAL y timeline actualizado.
- TECHNICIAN asignado: edit, estados permitidos y selector PUBLIC/INTERNAL; sin assign/CLOSED/CANCELLED.
- TECHNICIAN no asignado: lectura sin composer ni mutaciones.
- Adjuntos: prueba HTTP local autenticada con archivo temporal INTERNAL; upload con ID, descarga íntegra y delete `204`.
- Responsive: 390×844, 768×1024 y 1440×900.

El selector nativo de archivos no fue accesible desde el navegador automatizado. La UI/FormData se validó con tests DOM y la transferencia real se validó contra API; no se consideró un fallo funcional del producto.

## 28. Validaciones

- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- `npm test`: aprobado, 21 suites / 137 tests.
- `npm run build`: aprobado, Vite 8.1.3, 127 módulos.
- `git diff --check`: aprobado.
- Revisión de status/diff: realizada.

## 29. Archivos creados

- `cidrix-web/src/features/tickets/api/attachments.api.ts`
- `cidrix-web/src/features/tickets/api/attachments.api.test.ts`
- `cidrix-web/src/features/tickets/api/comments.api.ts`
- `cidrix-web/src/features/tickets/api/comments.api.test.ts`
- `cidrix-web/src/features/tickets/components/AttachmentsPanel.tsx`
- `cidrix-web/src/features/tickets/components/CommentComposer.tsx`
- `cidrix-web/src/features/tickets/components/TicketActions.tsx`
- `cidrix-web/src/features/tickets/components/TicketDialog.tsx`
- `cidrix-web/src/features/tickets/components/TicketTimeline.tsx`
- `cidrix-web/src/features/tickets/model/ticket-detail.ts`
- `cidrix-web/src/features/tickets/model/ticket-detail.test.ts`
- `cidrix-web/src/features/tickets/pages/TicketDetailPage.tsx`
- `cidrix-web/src/features/tickets/pages/TicketDetailPage.test.tsx`
- `docs/FE-04-implementation-review.md`

## 30. Archivos modificados

- `cidrix-web/src/app/router/AppRoutes.tsx`
- `cidrix-web/src/app/router/AppRoutes.test.tsx`
- `cidrix-web/src/features/tickets/api/tickets.api.ts`
- `cidrix-web/src/features/tickets/api/tickets.api.test.ts`
- `cidrix-web/src/features/tickets/model/ticket.types.ts`
- `cidrix-web/src/shared/services/api/api-client.ts`
- `cidrix-web/src/shared/services/api/api-client.test.ts`

## 31. Archivos eliminados

- `cidrix-web/src/features/tickets/pages/TicketDetailPlaceholderPage.tsx`

## 32. Dependencias

No se agregaron ni actualizaron dependencias. `package.json` y lockfile permanecen sin cambios.

## 33. Desviaciones

Se eligió una página orquestadora con cinco componentes funcionales en lugar de copiar literalmente el árbol sugerido. Los adjuntos generales son obligatorios y quedaron implementados; asociarlos atómicamente al composer se mantuvo fuera de alcance según el prompt.

## 34. Problemas encontrados

El navegador de automatización no expuso su file chooser para `setFiles`. Se cubrió con tests de FormData/UX y una prueba HTTP real end-to-end. No se encontraron bugs backend que exigieran cambios.

## 35. Riesgos / deuda

- La lista visual de adjuntos consulta la primera página de 20; coincide con el límite activo por defecto, pero una configuración futura mayor a 20 requerirá paginación visual.
- Los diálogos son accesibles por rol, label y Escape; un focus trap completo puede añadirse durante el pulido FE-08.
- La prueba manual añadió dos comentarios de validación y cambió TKT-0012 a asignado/en progreso en la base local de desarrollo.

## 36. Backend

No se modificaron archivos de `cidrix-api`, Prisma, migraciones, controladores, servicios, DTO, guards ni storage.

## 37. Fuera de alcance

No se implementaron FE-05+, preview de archivos, adjuntos asociados a comentarios, librerías externas, cambios transversales del envelope ni correcciones backend.

## 38. Estado final

La implementación está funcional, validada y detenida sin commit/push/PR/merge para revisión del Tech Lead.

FE-04 listo para revisión del Tech Lead y pruebas manuales
