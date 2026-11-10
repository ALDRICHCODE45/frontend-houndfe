# Intervención humana: propuesta del frontend

Respuesta del frontend al diseño `houndfe-chatbot/docs/intervencion-humana-diseno.md` (commit `29c2b6f`). Solo mapeo y propuesta: no hay implementación ni contrato cerrado.

## 1. Qué existe hoy y qué se reutiliza

| Pieza del diseño | Hoy en el frontend | Propuesta |
| --- | --- | --- |
| Bandeja «Chatbot → Solicitudes» | `src/features/POS/human-decisions/`: lista de RESTOCK y EXPIRATION (`PENDING`/`RESOLVED`), detalle en slideover, resolución con `expectedVersion` e idempotencia. Ruta `/pos/decisiones-pendientes`, permiso `read:HumanDecision`. | Carpeta nueva `src/features/chatbot/requests/` con su propio modelo. Se reutilizan `AppDataTable`, `ToolbarSelectFilter`, `StatusBadge`, `useServerTable` y el patrón de resolución con versión. Se conserva la URL actual (redirige) para no romper enlaces. |
| Paneles de Decisión (stock, caducidad) | `HumanDecisionResolutionControls`, `ExpirationDecisionResolutionControls`. | Se reutilizan como panel de acción del tipo Decisión. |
| Zona de entrega | Cola aparte en `/sistema/envios/validaciones` (`validate:DeliveryZone`) con cuenta regresiva (`shipping/delivery-zones/utils/urgency.ts`) y badge en el menú (polling 120 s). | Entra a la bandeja común; la cola de Sistema se retira o enlaza a la bandeja. `urgency.ts` se reutiliza para el semáforo verde/amarillo/rojo. |
| Comprobantes de transferencia | No hay pantalla (backend `08-transfer-receipts-review` sin frontend). `ReceiptEvidence` no está en `APP_SUBJECTS`, así que hoy ese permiso se descarta. | Se construye directamente como panel de la bandeja. |
| Detalle con 6 secciones | El detalle actual es un slideover de 576 px. | Página de detalle (`DetailPageFrame`), no slideover: ficha, conversación, contexto, qué se necesita, otras solicitudes y panel de acción no caben en un panel lateral. En móvil, secciones apiladas con el panel de acción fijo abajo. |
| Ficha del cliente | `CustomerDetail`: nombre, teléfono, `createdAt`, `globalPriceListName`; historial con `useCustomerSalesHistory`. No existe `isTrusted` en el frontend. | Reutilizar. El backend debe incluir el resumen del cliente en el detalle (ver §2). |
| Chat en vivo | No existe ningún componente de chat. | Componente nuevo (lista de mensajes, burbujas cliente/bot/personal, fotos con el visor `ProductImageLightbox` generalizado, compositor). Evaluar `UChatMessages`/`UChatPrompt` de Nuxt UI. |
| Campana y notificaciones | No hay tiempo real, ni campana (se quitó un placeholder en `DashboardLayout.vue`), ni `Notification` del navegador, ni sonido, ni service worker. Solo polling con TanStack Query. | Centro de notificaciones nuevo en la barra superior: campana con contador, lista, marcar leído. Notificación del navegador y sonido cuando la pestaña no está visible (`useDocumentVisibility`). |
| Preferencia de correo en el perfil | No hay pantalla de perfil (`useSidebar.ts` quitó «Perfil»); `AuthUser` no tiene preferencias. | Ruta nueva `/perfil` con un switch «Recibir avisos por correo» (y sonido / notificaciones del navegador, guardados localmente). |
| Tiempos límite y horario | `system/notifications` es otro modelo (listas de destinatarios); no sirve. El editor de horarios de Envíos (`shipping-settings` `OpeningHoursEditor` + `utils/openingHours.ts`) ya resuelve rangos semanales con zona `America/Mexico_City`. | Pantalla nueva en Sistema «Atención del chatbot»: horario (reutilizando el editor de Envíos si el cuerpo es el mismo `OpeningHoursBody`) y tabla de tiempos por tipo (tomar / resolver). |

## 2. Qué necesita el frontend del contrato del backend

**Lista** (`GET`, paginada, filtrable por estado, tipo, asignado a mí, sin asignar, vencidas):
- `id`, `type` (Decisión/Aclaración/Conversación + subtipo: stock, caducidad, zona, comprobante, hablar con persona, queja, pregunta, descuento), `status` (`NEW | IN_PROGRESS | RESOLVED | EXPIRED | CANCELLED`), `summary` (una línea del bot).
- Cliente: `customerId | null`, `displayName`, `phone` (o enmascarado según permiso).
- `assignee {id, name} | null`, `createdAt`, `claimDeadlineAt`, `resolveDeadlineAt`, `slaPaused` (fuera de horario), `whatsappWindowClosesAt`, `version`.
- Agrupación por cliente: cómo se ordena y pagina un grupo (¿la API devuelve grupos o filas con `customerKey` y el frontend agrupa la página?). Contadores por estado para pestañas y el badge del menú.

**Detalle:**
- Todo lo anterior, más `needs` (qué se necesita, en claro), el contexto (carrito/pedido en curso), otras solicitudes abiertas del mismo cliente, el resumen del cliente (desde cuándo, últimos pedidos, `isTrusted`, lista de precios) y las acciones permitidas para este usuario y estado (`allowedActions`, como hoy).
- Conversación con el bot paginada hacia atrás, con fotos (URLs firmadas o del CDN, con miniatura). Solo con permiso de historial; sin él, el bloque no viene.
- Auditoría: quién tomó, liberó, reasignó, respondió, canceló y cuándo.

**Comandos**, todos con `expectedVersion` e idempotencia y errores tipados (`409` ya tomada por otra persona, con el nombre; `409` cambió de estado):
- tomar, liberar, reasignar (lista de personas candidatas con permiso de atender), resolver Decisión (opción), responder Aclaración (texto), enviar mensaje en vivo, finalizar conversación (nota + clasificación de queja).

**Tiempo real** (un solo canal por usuario y tenant):
- Eventos: solicitud creada / tomada / liberada / reasignada / resuelta / cancelada / vencida, mensaje del cliente en mi conversación, estado de entrega de un mensaje enviado, notificación nueva.
- Transporte: preferimos **WebSocket o socket.io con token en el handshake**, porque `EventSource` no manda el header de autorización y el frontend ya refresca tokens con axios. Necesitamos reconexión con «desde» (último id de evento) para no perder nada; si no, el frontend vuelve a pedir la lista al reconectar.
- Mientras no exista, el frontend puede empezar con polling (lista 30 s, conversación abierta 3–5 s), pero el chat en vivo necesita tiempo real de verdad.

**Notificaciones:** lista paginada, contador de no leídas, marcar leída / todas; cada una con `type`, texto, `requestId` para abrirla y `createdAt`. Preferencia de correo por persona (`GET/PATCH`).

**Configuración:** horario y tiempos por tipo (`GET/PATCH`), con su permiso.

**Permisos:** el frontend solo acepta acciones de una lista cerrada (`create, read, update, delete, batch_delete, validate, manage`) y descarta en silencio los códigos que no conoce. Pedimos que el backend defina los códigos exactos. Propuesta: sujeto `ChatbotRequest` con acciones nuevas `attend`, `reassign`, `escalate` (más `read`), y `read:ChatbotConversation` para el historial; `update:ChatbotSettings` para la configuración. Con los códigos definidos, el frontend los registra en `ability.ts`, en la pantalla de roles y en las pruebas fijas. Corregir de paso `ReceiptEvidence`.

## 3. Huecos y riesgos que vemos en el diseño

1. **Bloqueo al tomar:** sin tiempo real, dos personas pueden pulsar «Atender» a la vez; el backend debe resolverlo con versión y el frontend mostrará «La tomó Juan». La leyenda «La está atendiendo Juan» necesita el asignado fresco.
2. **Grupos por cliente con paginación:** si un cliente tiene una solicitud nueva y otra vencida, ¿en qué orden sale el grupo? Sugerimos ordenar por la más urgente del grupo.
3. **Solicitudes de un teléfono sin cliente:** el detalle debe funcionar sin ficha y ofrecer «Crear cliente» o «Vincular».
4. **Chat en vivo con la ventana de 24 h cerrada:** el compositor debe bloquearse o avisar que se manda la plantilla pagada; el diseño no dice qué ve el personal.
5. **Mensajes no editables:** el diseño lo exige; el chat no tendrá editar ni borrar, y la corrección es un mensaje nuevo.
6. **Notificación del navegador:** el permiso del navegador se pide con un gesto del usuario (botón en la campana o en el perfil), no al cargar. Sin pestaña abierta no hay aviso del navegador: solo correo (no proponemos push con service worker en esta versión).
7. **Fuera de horario:** la bandeja debe mostrar que el reloj está pausado («En pausa hasta las 9:00») para no alarmar con rojos falsos.
8. **Varias pestañas abiertas:** el sonido y la notificación deben sonar una sola vez (coordinar pestañas con `BroadcastChannel`).
9. **Migración:** el permiso `read:HumanDecision` y la URL actual están en roles y enlaces; hace falta una equivalencia para no dejar a nadie sin acceso.

## 4. Preguntas para el dueño

1. ¿Quién puede ver el teléfono completo del cliente? ¿Todos los que ven la bandeja?
2. En una Conversación, ¿el personal puede mandar fotos o solo texto?
3. ¿Sonido activado por defecto o lo enciende cada persona?
4. ¿Las respuestas de Aclaración necesitan plantillas de texto rápidas (frases guardadas)?
5. ¿Las solicitudes resueltas se ven en la bandeja algunos días (como hoy, 7 días) o pasan a un historial aparte?
6. ¿La cola de validaciones de zona en Sistema se retira cuando la bandeja común esté lista?

## 5. Orden propuesto para el frontend

1. Bandeja común y detalle con los tipos de Decisión que ya existen (stock, caducidad, zona, comprobante), sobre el modelo común; campana con polling.
2. Tiempo real (canal único), notificaciones del navegador y perfil con preferencia de correo.
3. Aclaración y Conversación en vivo; quejas con clasificación al cerrar.
4. Configuración de horario y tiempos.
5. Descuentos (segunda etapa).

## 6. Alineación con las decisiones del dueño (2026-11-09, diseño `7e298b4` §7–§8)

Donde esta sección contradice lo anterior, manda esta. Las preguntas del §4 quedan respondidas.

| Decisión | Impacto en el frontend |
| --- | --- |
| Horario **por sucursal** con «aplicar a todas» (con permiso). | La pantalla «Atención del chatbot» edita el horario del tenant activo; botón «Aplicar a todas las sucursales» solo con su permiso, con confirmación que nombra cuántas sucursales cambian. |
| Feriados como días cerrados editables. | Lista de fechas cerradas en la misma pantalla (agregar, quitar). Sin fechas fijas. |
| Agenda fuera de horario: bloques de 30 min, 3 ofrecidos, tope de 3 por bloque y sucursal configurable; primero dentro de la ventana de 24 h. | Campo «Conversaciones por bloque» en la configuración. En la bandeja, las conversaciones agendadas muestran su hora («Agendada · mar 10:30») y si cae fuera de la ventana gratis. Se construye al final (orden 7 del diseño). |
| El bot se calla solo cuando una persona toma la conversación. | El panel de Conversación distingue «Esperando a una persona» (el bot sigue) de «La atiende <nombre>» (el bot callado). |
| Correo sin nombre ni teléfono, con link directo. | El link abre la página de detalle por id (`/chatbot/solicitudes/:id`); si la sesión venció, el login vuelve a esa ruta. |
| Teléfono completo con permiso aparte; si no, `55 **** 5678`. | El frontend nunca enmascara por su cuenta: muestra lo que manda el backend. Sin el permiso, ningún botón de «copiar» o «llamar» con el número completo. |
| Personal puede mandar fotos o PDF. | El compositor del chat acepta imagen y PDF con vista previa y progreso por archivo (mismo patrón de subida que la tira de imágenes de productos). |
| Audios del cliente guardados (10 MB, 12 meses). | Reproductor de audio en la burbuja del cliente; si el audio ya se borró, la burbuja dice «Audio no disponible». |
| Sonido activado por defecto, cada persona lo apaga. | Preferencia local en el perfil y en la campana (silenciar); se respeta entre pestañas. |
| Aprobar una zona resuelve todas las solicitudes de ese código postal. | La confirmación de aprobar dice cuántas solicitudes y clientes se resuelven («Resuelve 4 solicitudes de 3 clientes»); el backend debe mandar ese conteo. |
| Comprobante cerca del cierre o en día cerrado vence al cierre del siguiente día hábil. | Solo lectura del vencimiento que manda el backend; el semáforo usa ese dato. |
| Resueltas 7 días en la bandeja; después, historial aparte. | Vista «Historial» separada (filtros por tipo, fecha, quién resolvió), sin acciones. |
| Plantilla pagada solo por botón de quien atiende. | Con la ventana cerrada, el compositor se bloquea y muestra «La ventana de 24 h está cerrada» con el botón «Enviar plantilla» y su costo explicado; nunca se envía sola. |
| Clasificación de quejas solo se registra. | Selector obligatorio al finalizar una queja; no dispara acciones. |
| Se retira la cola de validación de zonas de Sistema cuando la bandeja esté lista. | Se quita la entrada del menú y su ruta redirige a la bandeja filtrada por zona. |

**Contraofertas del backend aceptadas:**

- **SSE sobre `fetch` con `Last-Event-ID`** en lugar de WebSocket: sirve, porque un `fetch` con stream sí manda el header de autorización (no usamos `EventSource`). Necesitamos: reintento con `Last-Event-ID`, un evento de latido para detectar cortes, y que un `401` corte el stream para refrescar el token y reconectar.
- **Acciones CASL existentes (`read`, `update`) con sujetos nuevos** en lugar de verbos nuevos: sirve y evita tocar la lista cerrada de acciones. Pedimos la lista exacta de códigos (ver, atender, reasignar, historial, escalamientos, teléfono completo, configuración, aplicar a todas) para registrarlos en `ability.ts`, en la pantalla de roles y en las pruebas.

**Segunda versión (no se construye ahora):** descuentos, pago parcial, cancelar o cambiar pedido, estado de pedido, mayoreo, quejas que disparan acciones, respuestas rápidas, transcripción de audios, conversaciones iniciadas por el personal y tablero de métricas. El diseño de la bandeja deja lugar para el tipo Descuento sin rehacer la lista.
