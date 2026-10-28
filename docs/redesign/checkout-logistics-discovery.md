# Checkout, identidad y logística: evidencia y propuesta provisional

Estado: planificación, no contrato listo para implementar. Reglas existentes del chatbot no equivalen a reglas aprobadas para la web.
Fuente: agente del chatbot, informe inicial `4a5e7db3-008f-4d85-b4ff-2237d1029ec9` y aclaración correctiva `80f084c8-804f-4934-a159-c029d884c6e9`;  inspección estática acotada, sin cambios, tests, DB/API/red ni lectura de configuración desplegada. Frontend no leyó ese repositorio directamente.
Leer con [estrategia](catalog-product-strategy.md), [contrato](product-contract-proposal.md) y [hoja de ruta](implementation-roadmap.md).

## 1. Alcance indicado por el usuario

El flujo debe considerar reconocimiento/alta de clientes, direcciones guardadas/nuevas, sesión, entrega propia, cotizaciones Skydropx/Envíos Perros y restricciones territoriales/de contacto. Fuente indicada: «el chatbot tiene las reglas hermano, estoy seguro. preguntale a el.»
La sesión inicial estaba corrupta; el usuario pidió reenviar. El agente de reemplazo respondió el informe citado. La investigación logística duplicada del backend se canceló; ese agente conserva evidencia previa, no produjo un informe nuevo aquí.
Postergar el chatbot sigue siendo posibilidad, no decisión. D25 aprueba pago completo anticipado mediante web; D29 aprueba reserva temporal al iniciar pago; pasarela, ciclo técnico pedido/pago/reserva, momento de descuento de stock y compra de guía siguen pendientes. Las decisiones previas mantienen su alcance salvo la recomendación provisional de saldo en puerta, descartada para web.

## 2. Evidencia del chatbot

Todas las rutas siguientes son relativas a `houndfe-chatbot`. Implementado no significa activado en producción. Ausencia en búsqueda acotada no significa ausencia exhaustiva ni autoriza inventar reemplazos.

| Área | Hallazgo y límite | Evidencia reportada |
| --- | --- | --- |
| Identidad mínima | Usa remitente WhatsApp, no teléfono escrito; normaliza México 52/521 y diez dígitos. No equivale a identidad web. | `src/sale-flow/domain/mexican-whatsapp-phone.ts:37` |
| Contexto cliente | Solo resultado unique muestra direcciones; ambiguous/not_found no exponen registros. Error no se interpreta como cliente inexistente. | `src/llm-agent/application/minimal-checkout.service.ts:238` |
| Direcciones | Referencias opacas, borrador local, revalidación de dirección/versión; saved/savedCorrected/new. Corrección conserva campos no modificados. | `src/llm-agent/application/minimal-checkout.service.ts:293,317,585` |
| Persistencia cliente/dirección | Contrato existingUpdated con addressId/expectedVersion, newSaved y createIfAbsent. Nuevas/corregidas exigen bandera atómica antes de ordenar. Deduplicación real es del backend, no verificada aquí. | `src/chatbot-api/domain/dtos/checkout.dto.ts:40`; `src/llm-agent/domain/minimal-order-confirmation.ts:82` |
| Ruta antigua | Lookup/upsert separados y teléfono por argumento. No copiar como autorización de consulta web. | `src/sale-flow/application/tools/get-customer-by-phone.tool.ts:13`; `src/sale-flow/application/tools/upsert-customer.tool.ts:22` |
| Skydropx | Proveedor registrado solo si SHIPPING_QUOTES_ENABLED es true; origen configurable. Activación real no consultada. | `src/shipping/shipping.module.ts:55–66`; `src/shipping/infrastructure/skydropx-shipping-quote.provider.ts:81`; `src/config/configuration.ts:145–160` |
| Empaquetado | Perfil medido configurable debe coincidir exactamente con productos/variantes/cantidades; no es un motor de empaquetado arbitrario. | `src/shipping/application/measured-demo-parcel-profile.ts:101` |
| Peso/paquetes | Candidato de un paquete hasta 25 kg hardcoded; exceso requiere resolución manual. No constituye política web aprobada. | `src/shipping/domain/package-readiness.ts:10,79` |
| Selección de tarifa | Menor precio, desempate ETA/nombres/ID; no elección libre del cliente. | `src/shipping/application/shipping-quote-draft.ts:35–51` |
| Crédito de envío | Hardcoded: $120 MXN por unidad con unitPriceCents mayor a $500 MXN, acumulable; cliente paga excedente. No usa precio promocional final. D24 aprueba para web una base diferente: precio final después de descuentos; no modifica este comportamiento del bot. | `src/shipping/domain/shipping-credit.ts:8–9,55` |
| Vigencia | Ruta mínima limita cotización a 30 minutos y vencimientos de proveedor/tarifa. Mappers actuales devuelven expiraciones null. | `src/llm-agent/domain/minimal-shipping.ts:26,160`; `src/shipping/infrastructure/skydropx-rate.mapper.ts:66`; `src/shipping/infrastructure/skydropx-quotation.mapper.ts:68` |
| Fallos de cotización | Sin medidas, fallo o ausencia de tarifas no genera precio alternativo automático. No se encontró recargo propio; consume total del proveedor. | `src/shipping/application/shipping-quote-orchestrator.ts:142` |
| Entrega propia | Hay reglas documentadas/históricas, detalladas debajo; motor territorial específico no localizado. Validación postal no acredita cobertura. | `docs/chatbot-requirements.md:123–124,269`; `docs/minimal-shipping.md:50`; `src/shipping/domain/shipping-quote.request.ts:54` |
| Otros proveedores/guías | Envíos Perros documentado como uso humano histórico e integración diferida; adaptador/configuración no localizados. Compra/generación de guía no hallada. | `docs/chatbot-requirements.md:129,272`; `docs/conversation-analysis.md:31–44,79`; `odd/tasks/shipping-quotes-skydropx.md:19–26` |
| Restricciones comerciales | No se encontraron listas de domicilios/zonas/teléfonos prohibidos ni fuente o excepciones. Allowlist experimental de remitentes no es blacklist de clientes. | `src/config/configuration.ts:25–34`; `src/llm-agent/application/minimal-catalog-agent.service.ts:402` |
| Rutas alcanzables | Ruta mínima depende de banderas/remitente; si no maneja turno, continúa AgentRunner. Legado no puede considerarse inactivo. | `src/config/configuration.ts:68–85`; `src/whatsapp/application/webhook-dispatcher.service.ts:343–382`, contrastado por agente principal |
| Precio cero | Carrito mínimo acepta cero: no satisface D19. Menor elegible/sin acumulación D18 no demostrado; evaluación delegada a backend. | `src/llm-agent/application/minimal-cart.service.ts:105,296` |
| API usada por bot | Autenticación de servicio y sucursal, no API pública ni permiso para consultar clientes por teléfono desde web. | `src/chatbot-api/infrastructure/chatbot-api-http.client.ts:818` |

### Corrección de evidencia: documentos e historia recuperados

La primera búsqueda por símbolos fue insuficiente: no cubría documentación histórica. El usuario pidió consultar de nuevo al chatbot en vez de ubicar él los archivos. La aclaración amplió lectura local de docs/odd/openspec/src/prompts/configuración fuente y memoria, sin configuración desplegada. No volver a presentar estas reglas documentadas como inexistentes.

- **Cobertura propia:** `docs/chatbot-requirements.md:123–124` limita gratuidad a ciertas zonas metropolitanas, no toda CDMX; `:269` deja lista de CP/zonas pendiente del propietario. `docs/minimal-shipping.md:50` reconoce pendientes free-zone/surcharge/carrier-only y selección CDMX; línea contrastada por agente principal. No se localizó catálogo operativo de cobertura/tarifas/horarios.
- **Antecedente territorial:** Engram backend #2330, 14 de junio, topic `project/delivery-and-payment-rules`, reportado por chatbot y posteriormente releído por agente backend, sin verificación operativa: FREE = reparto propio gratuito; SURCHARGE = propio con $50–70 MXN variable por caso y confirmación humana; CARRIER_ONLY = fuera de cobertura propia, paquetería; UNKNOWN = consulta humana una vez y persistencia de clasificación para siguientes consultas. Proponía CP, no polígonos rígidos; delivery-zones futuro/diferido, no motor implementado acreditado.
- **Antecedente de pago/entrega:** la misma memoria permite salida de reparto propio con pago pendiente, pero entrega con pago completo o cobro del resto en efectivo en puerta; paquetería exige pago total antes de despacho. Es antecedente de otros canales, no garantía del backend: D25 descarta saldo en puerta para pedidos web y exige prepago completo en ambas modalidades.
- **Envíos Perros:** requisitos `:129,272` describen agregador secundario histórico y dejan API/manual pendiente. `docs/conversation-analysis.md:31–44,79` registra cotización humana EP/Skydropx y consulta Amazon, crédito $120 por unidad >$500 y aprobación humana antes de comunicar tarifa; prioriza Skydropx. Amazon/cobertura/25 kg son contexto histórico, no un proveedor nuevo aprobado. `odd/tasks/shipping-quotes-skydropx.md:19–26` excluye EP del adaptador inicial. Engram chatbot #14162, 10 de octubre, `shipping/provider-rollout`, recuerda «por ahora skydropx porque envios perros hay algo que hacer antes ... se va a incorporar envios perros despues»; prerrequisito no especificado, memoria no revalidada externamente. No inferir fallback/comparación automática actual.
- **Direcciones:** `src/llm-agent/domain/minimal-checkout-confirmation.ts:108–123` exige nombre, calle, número exterior (admite S/N), colonia, CP, estado y ciudad O municipio. `src/llm-agent/domain/mexican-state.ts:1–64` contiene estados/alias; `src/llm-agent/application/minimal-order.service.ts:473–476` rechaza estado no reconocible en dirección no guardada. Completitud no equivale a cobertura ni blacklist.
- **Teléfonos:** `docs/conversation-analysis.md:23` y `docs/chatbot-requirements.md:250` describen al cliente bloqueando llamadas desconocidas: pedir contacto alcanzable/desbloqueo. No es HoundFe bloqueando al cliente. `docs/minimal-checkout-confirmation.md:40` deja carrierPhone opcional. Normalización/allowlist experimental tampoco son restricciones comerciales. No se localizó fuente concreta de blacklist.

Fuente externa concreta referida en `docs/conversation-analysis.md:1`: `houndfe-backend/openspec/changes/archive/2026-06-11-whatsapp-ai-chatbot/conversation-analysis.md`. El agente principal backend corroboró ese archivo y Engram #2330 en el informe `2b82c97f-cbbf-4bb2-a4a3-4f861a3040af`, sin exploración duplicada ni acceso directo frontend. Archivo `:3–5`: una conversación del 26–28 mayo, archivada el 11 junio; memoria del 14 junio agrega resolución posterior. Archivo `:27–36` confirma crédito acumulable $120 por ítem estrictamente >$500: dos bolsas dan $240, tarifa $310 implica $70 de excedente (NO el recargo propio $50–70). `:42` exige aprobación humana en v1; no prueba runtime. `:19,91` menciona transferencia/depósito/Link EVO, cuya integración seguía pendiente. `:59–61` deja ciclo pago/envío abierto: no contradicción demostrada con memoria posterior. `:21,84` confirma cliente bloqueando llamadas, no blacklist comercial; `:47–52` no acredita autenticación web. No aporta CP concretos ni ruta de mapa/nota. Fuentes históricas reconciliadas; D23 confirma el modelo de cuatro categorías para web, no los demás parámetros ni operación actual. El mapa/nota de voz citado por la memoria no tiene ruta confirmada. No pedir al usuario localizar reglas ya recuperadas.

### Secuencia y efectos observados

1. Carrito consulta catálogo/stock/evaluación backend; cambios válidos persisten carrito local, sin reserva local (`src/llm-agent/application/minimal-cart.service.ts:213,296`).
2. Dirección → borrador → resumen y SÍ; todavía no crea cliente/pedido (`src/llm-agent/domain/minimal-checkout-confirmation.ts:108,130`).
3. Si envío habilitado: cotización, persistencia local y aprobación humana, incluso gratuita (`src/llm-agent/application/minimal-shipping.service.ts:81`). No inferir un segundo aprobador administrativo.
4. Resumen final y SÍ ligados al evento/resumen enviado; ventana de confirmación de cinco minutos y nueva comprobación (`src/llm-agent/domain/minimal-order-confirmation.ts:19,367`).
5. Clave idempotente persistida antes del POST. Éxito vacía carrito/registra venta local; resultado incierto conserva protección contra duplicados (`src/llm-agent/application/minimal-order.service.ts:437,612`). Esto no demuestra efectos transaccionales internos del backend sobre stock, cliente o venta.
6. Después, instrucciones de transferencia, no cobro online (`src/llm-agent/application/minimal-order.service.ts:640`). Comprobante responde PENDING, no confirma pago (`src/chatbot-api/infrastructure/chatbot-api-http.client.ts:769`).
7. updateDelivery solo modifica metadatos, no compra guía (`src/sale-flow/application/tools/update-delivery.tool.ts:14`).

Bloqueos técnicos de identidad, dirección desactualizada, promoción pendiente o cotización no aprobada/vencida no son listas negras (`src/llm-agent/application/minimal-checkout.service.ts:585`; `src/llm-agent/application/minimal-order.service.ts:355–400`).

### Modelo territorial aprobado para web (D23)

El usuario respondió «si hermano, esta perfecto» al modelo de cuatro categorías. Esta decisión actual confirma su uso en diseño web, no operación ya implementada:

| Categoría | Regla aprobada |
| --- | --- |
| FREE | Reparto propio sin cargo. |
| SURCHARGE | Reparto propio con importe confirmado por una persona; no automatizar un importe variable. |
| CARRIER_ONLY | Paquetería para destino fuera de cobertura propia; no implica cualquier proveedor habilitado. |
| UNKNOWN | Consultar al equipo y guardar la clasificación para próximas consultas; no inferir gratuidad ni rechazo definitivo. |

No se aprueban por extensión los CP/zonas concretos, un recargo fijo de $50–70, crédito logístico, condiciones históricas de pago ni activación de Envíos Perros. Cobertura y restricciones comerciales son controles distintos. Persistencia, alcance de clasificación y permisos de mantenimiento requieren contrato técnico; no importar automáticamente mapas o reclasificar direcciones existentes.

### Apoyo de paquetería aprobado para web (D24)

El usuario respondió «si hermano» a $120 MXN por unidad cuyo precio final D18, después de descuentos y sin envío, sea estrictamente >$500 MXN. Es por unidad, no por total de línea/pedido. Sumar aportes y limitar el aplicado al costo real cotizado; no generar saldo a favor. No aplicarlo automáticamente a recargos de reparto propio.

Para una cotización comparable de paquetería: apoyo aplicado = mínimo(cotización, $120 × unidades que califican); cargo de envío = cotización − apoyo aplicado. Dos unidades elegibles y cotización $310 → apoyo $240, cargo $70; cotización $200 → apoyo $200, cargo $0 sin remanente. Precio unitario final $480 o $500 no califica. Estas son comprobaciones de especificación, no pruebas del sistema.

Diferencia deliberada respecto del bot: su base observada no usa precio promocional final. D24 no autoriza cambiar ese canal ni POS. No usar precio de lista previo al descuento ni sumar envío para alcanzar umbral. Contrato de impuestos/redondeo y asignación entre paquetes queda por precisar, sin duplicar apoyo por paquete.

### Pago web completo por adelantado (D25)

El usuario pide «que todo este pagado desde el principio mediante la web» y aclara que completar en puerta corresponde solo a ciertos clientes de confianza, no al público general. El flujo web exige pago íntegro anticipado (mercancía y envío confirmado) para reparto propio y paquetería. No inferir excepciones por login, mayoreo, acuerdo particular o identidad conocida. No construir una clasificación de confianza para conceder crédito en este alcance.

No trasladar reglas de saldo en puerta del bot/POS ni modificarlas. Primero resolver cobertura, recargo y cotización; UNKNOWN o SURCHARGE sin importe confirmado no permiten un cobro final supuesto. D26 aprueba guardar solicitud de cotización pendiente antes de pagar; no equivale a pedido pagado ni autoriza despacho. Diseño concreto de pedido/intento de pago pendiente.

Pago fallido, pendiente, comprobante recibido o retorno del navegador no deben habilitar el pedido como pagado. Verificación autoritativa de pago, reintentos idempotentes, reservas, caducidad de cotización durante pago, cancelaciones/reembolsos y proveedor requieren contrato antes de implementar. D25 no elige pasarela ni demuestra soporte actual de cobro online.

### Cotización pendiente aprobada (D26)

Con zona y tarifa confirmadas, el cliente revisa total y puede pagar. Con zona desconocida, recargo pendiente o cotización no disponible, guarda una solicitud de cotización sin cobro ni promesa de envío. Personal autorizado resuelve cobertura y costo dentro del sistema; un aviso permite al cliente volver, revisar el total actualizado y decidir si paga. No hay transferencia obligatoria al chatbot.

La solicitud no fija precios/disponibilidad, no reserva inventario ni autoriza despacho. Revalidar precios, disponibilidad y vigencia de cotización antes del pago, con aceptación del total actualizado; no cobrar silenciosamente tras revisión interna. Las condiciones privadas siguen sujetas a identidad/autorización, también al retomar desde el aviso. D35 aprueba avisos por correo verificado y consulta de estado en la cuenta web para cotización lista, pago confirmado, pedido enviado e incidencias/novedades de reembolso; no correos por cambios menores ni notas internas, WhatsApp posterior opcional. D37 exige total y fecha/hora de vencimiento visibles según vigencia sostenible de tarifa, sin plazo fijo inventado. Conservar solicitud/carrito vencidos y ofrecer «Actualizar cotización»: revalidar precio, disponibilidad y envío, pedir aceptación si cambia y volver a revisión humana si no puede actualizarse, sin cobro/reserva. Iniciar apartado D34 solo con total sostenible durante sus 15 minutos. Formatos, plazos concretos respaldados y cancelación de solicitud siguen pendientes; no inventar enlace público que revele datos privados ni plazos de respuesta.

Aceptación futura: cada causa (UNKNOWN, recargo pendiente, tarifa no disponible) permite solicitar revisión sin cobro/reserva; resolver no cobra por sí mismo; aviso/retoma muestra total actualizado; cotización vencida o cambios en precio/stock exigen nueva evaluación antes de pagar. D36 resuelve revisión con entrega imposible: cerrar solicitud con «No podemos ofrecer entrega en esta dirección», avisar por correo verificado y mostrar en cuenta, sin cobro/reserva. Otra dirección permite nueva cotización con revalidación de precios/disponibilidad. No rechazo automático de UNKNOWN/CARRIER_ONLY, bloqueo comercial, retiro en sucursal ni handoff obligatorio a WhatsApp. Este cierre corresponde a la solicitud revisada, no impone prohibición permanente sobre la dirección.

### Identificación para cotización y pago (D27)

Explorar y armar carrito sigue abierto. Solicitar cotización o pagar requiere cliente identificado con correo verificado; registro breve conserva carrito. Direcciones guardadas y condiciones particulares necesitan además vínculo comercial autorizado D22: no se obtienen por conocer correo/teléfono ni por verificar un correo cualquiera. No otorga crédito ni cambia D25.

Aceptación futura: visitante arma carrito sin registro; al solicitar cotización/pagar se exige identificación verificada sin perder ítems; tras identificar se revalidan contexto y precios D18/D19, sin acceder a datos de otro cliente ni cobrar automáticamente. Contrato de sesión, recuperación y reconciliación de carritos aún pendiente, sin elegir proveedor.

### Restricciones comerciales aprobadas (D28)

Restricción vigente de teléfono/domicilio y coincidencia confirmada impiden solicitar cotización o pagar para ese caso. Coincidencia dudosa requiere revisión del equipo antes de continuar, sin cobro ni rechazo automático por parecido. Personal autorizado registra motivo, alcance y actor al agregar/retirar; el cliente recibe mensaje neutral y posibilidad de contacto, sin información interna ni acusaciones.

No bloquear automáticamente por intento fallido, apellido o domicilio parecido. No convertir zona fuera de cobertura propia en bloqueo comercial; D23 sigue permitiendo modalidad de paquetería donde corresponda. Revisión de riesgo D28 y cotización pendiente D26 son motivos distintos, no vías para eludir una restricción confirmada.

Aceptación futura: coincidencia confirmada/vigente impide cotización/pago; dudosa no cobra ni rechaza definitivamente, queda a revisión; similitud aislada no crea restricciones; solo actor autorizado agrega/retira y queda traza, sin exposición de motivos internos. Definir normalización, evidencia para coincidencia, estados/resultado de revisión y alcance en servidor antes de implementar. No se carga una blacklist real ni se cambia bot/POS con esta aprobación.

### Reserva temporal al iniciar pago (D29)

Carrito y solicitud de cotización no reservan. Antes de iniciar pago, revalidar checkout y reservar temporalmente unidades disponibles de forma indivisible; si faltan, avisar antes del cobro. No prometer la última unidad a dos compradores. Pago confirmado convierte la reserva en asignación del pedido una sola vez, sin doble afectación de inventario.

Liberar ante fallo/cancelación/vencimiento confirmados según estado autoritativo; cerrar pestaña o perder conexión no demuestra esos estados. D34 fija objetivo de 15 minutos para tarjeta, sujeto a validar cierre seguro; D37 exige total sostenible durante toda la ventana. D31 define pago tardío: intentar asegurar pedido completo al total aceptado, sin afectar reservas ajenas; si no puede cumplirse, resolución/reembolso sin sustituciones ni cargos extra automáticos. No garantiza stock por haber recibido dinero.

Aceptación futura: dos intentos sobre última unidad no duplican reserva; carrito/cotización no retienen unidades; pago confirmado repetido no duplica asignación; liberación confirmada repetida no incrementa disponibilidad dos veces; cierre de pestaña/error de red no libera por sí solo. Resolver carreras entre confirmación y vencimiento con autoridad única backend; pruebas de integración pendientes, no capacidades verificadas.

### Actualización acotada: datos operativos por obtener

Informe del agente principal chatbot `efc33c26-4e04-4867-8d18-5ed61c61fa1c`: una pasada local y notas, sin red, tests, env, DB/API, repositorios externos ni modificaciones. Revisó personalmente el perfil medido. Complementa evidencia anterior; no demuestra configuración desplegada ni datos empresariales poblados.

| Pregunta acotada | Resultado y evidencia reportada |
| --- | --- |
| Fuente recuperable de cobertura | Sin ruta/dataset identificado. Engram #2330 menciona mapa/voz sin adjunto; `docs/chatbot-requirements.md:269` y `docs/minimal-shipping.md:50` mantienen pendiente el conjunto territorial. No es prueba de inexistencia universal ni tabla lista para importar. |
| Prerrequisito Envíos Perros | Sigue no especificado en #14162/#14166. `docs/chatbot-requirements.md:272` pregunta API/manual, pero no demuestra que esa sea la condición pendiente. No inferir trámite, contrato o responsable. |
| Medidas | `src/shipping/application/measured-demo-parcel-profile.ts:16–24`: perfil versionado, ítems con producto/variante/cantidad y peso en gramos, largo/ancho/alto en cm; bulto con sus propias medidas. `:95–98` exige carrito exacto. Es esquema validado, no fichas reales ni algoritmo general de empaquetado. |
| Origen | `src/shipping/application/measured-demo-shipping-config.ts:26–40,53–70`: CP, estado, municipio y colonia; ausente/inválido retorna null. No se leyeron valores particulares o configuración desplegada. |
| Varios bultos | `src/shipping/domain/package-readiness.ts:43–60,138–150`: candidato de un paquete; división `manual_unresolved` con `minimumPackageCount`. Contrato genérico multibulto no acredita preparación/cotización operativa. `docs/chatbot-requirements.md:274` deja división Amazon abierta, no proveedor nuevo aprobado. |
| Plazos | `src/shipping/domain/shipping-quote.result.ts:2–16` contiene estimación y vigencias; `src/shipping/infrastructure/skydropx-rate.mapper.ts:75,94` transforma days en estimatedDeliveryDays. No son tiempo de preparación, corte, calendario hábil ni SLA del negocio. |

Datos concretos para negocio/proveedor, sin pedir credenciales: listado vigente CP/zona/excepciones o mapa identificable con versión y responsable; condición exacta de EP y criterio de cumplimiento; ficha postal autorizada de despacho; medidas de SKU/variante y bulto realmente armado, combinaciones/embalaje; preparación, corte y días operativos; capacidad real de varios bultos y límites por servicio. La lista de junta está en el [resumen de negocio](business-meeting-brief.md#datos-concretos-para-llevar-a-la-junta).

Investigación cerrada en este alcance: no repetir una búsqueda general ni presentar estas brechas como nuevos acuerdos. No se ha elegido operación manual o automatizada adicional, prometido fecha de entrega ni aprobado parámetros de envío por inferencia.

## 3. Recorrido web propuesto, condicionado a decisiones y contratos

No copiar el flujo conversacional ni usar el teléfono declarado como identidad. Propuesta para revisión, no flujo aprobado:

1. **Carrito:** mostrar presentaciones/cantidades y precios autoritativos D18/D19 dentro del contexto permitido D20. Informar cambios antes de aceptar un total distinto.
2. **Identificación:** D27 permite explorar/armar carrito sin cuenta y exige identificación con correo verificado al solicitar cotización o pagar, conservando carrito. Para recuperar direcciones/condiciones privadas se requiere además vínculo D21/D22. Capturar dirección nueva no concede acceso a registros ajenos; deduplicación interna no debe revelar cuentas ni vincularlas por coincidencia de datos.
3. **Dirección:** elegir una propia autorizada o capturar/corregir. Separar borrador de guardado en libreta; definir el momento de alta/actualización mediante contrato idempotente y control de versión. Un error de consulta no equivale a ausencia y no justifica crear duplicado.
4. **Restricciones y cobertura:** aplicar D28 por separado: coincidencia confirmada con restricción vigente impide solicitar cotización/pagar; dudosa requiere revisión sin cobro ni rechazo por parecido. Aplicar D23 sobre territorio verificado: UNKNOWN consulta al equipo, SURCHARGE importe confirmado. Fuera de cobertura propia no implica bloqueo comercial y CP válido no prueba cobertura. Catálogo territorial y criterios técnicos de coincidencia siguen pendientes.
5. **Cotización:** usar origen/destino y paquete real. Skydropx observado no resuelve cualquier carrito; nunca inventar costo cero. D26 permite solicitud pendiente ante zona desconocida, recargo pendiente o tarifa no disponible; equipo resuelve y avisa para revisión/pago, sin cobrar ni reservar stock automáticamente. Faltantes de medidas/exceso de peso requieren diagnóstico y resolución, no cobertura inventada. Entrega propia y Envíos Perros requieren contrato antes de habilitarse.
6. **Resumen:** productos, descuentos aplicables, destino, modalidad, cargo de envío y total calculado, con vigencia real. Un cambio relevante exige nueva evaluación; no reutilizar cotización de otro carrito/dirección. Aplicar D24 en paquetería sobre precio final D18; no copiar la base anterior a promociones del bot ni duplicar el apoyo.
7. **Confirmación y pago:** revalidar identidad, permisos, dirección, precios, stock y cotización; total final aceptado antes de iniciar pago D25, con idempotencia y recuperación sin duplicados. Distinguir intención de pedido, intento de pago y pago confirmado: confirmación de resumen no acredita cobro. No despachar un pedido web sin pago completo confirmado ni crear saldo en puerta. D29 exige reserva temporal al iniciar pago y conversión única al confirmarse; implementación de reserva, momento de registro/descuento, guía y efectos transaccionales requieren contrato acordado.
8. **Seguimiento:** mostrar estado real y recuperar resultado existente si falla refresco. No presentar comprobante recibido como pago confirmado ni inventar promesa de entrega.

## 4. Pendientes que bloquean solo el checkout afectado

| Pendiente | Evidencia o decisión necesaria |
| --- | --- |
| Reconciliación logística | Documentos e historia de entrega propia/EP corroborados; D23 confirma cuatro categorías para web. Resto de reglas históricas por reconciliar. Falta catálogo territorial operativo y prerrequisito EP; blacklist comercial sigue sin fuente localizada. No pedir al usuario ubicar archivos ya identificados ni dar historia por operación actual. |
| Apoyo, peso, tarifa y vigencia | D24 resuelve importe/umbral/base y tope del apoyo web. Precisar impuestos/redondeo y reparto entre paquetes; peso, selección de tarifa y vigencia siguen pendientes. No confundir comportamiento del bot con capacidad web implementada. |
| Identificación D27 | Recorrido aprobado: explorar/armar sin cuenta, cotizar/pagar con correo verificado. Precisar mecanismo de sesión y conservación/reconciliación de carrito; datos privados requieren vínculo autorizado D22. |
| Alta/vínculo/dirección y efectos del pedido | Contrastar backend real: unicidad, concurrencia, idempotencia, versión, stock/reserva y momento de creación. No usar auth de servicio del bot desde navegador. |
| Pago web D25/D31 | Prepago completo; D31 permite cancelación automática antes de preparación y revisión después, y recuperación de pago tardío o resolución/reembolso si no puede cumplirse. Precisar proveedor, estados/verificación, expiración y ejecución/seguimiento del reembolso; sin crédito por confianza. |
| Reutilización entre canales | Extraer o centralizar reglas autoritativas con contratos explícitos; no asumir paridad de bot/web/POS ni reescribirlos en este trabajo documental. |

## 5. Verificación y límites

Este documento registra evidencia reportada y propuesta, no prueba runtime. No se ejecutaron tests, llamadas a proveedores, consultas de datos ni generación de guías. Configuración desplegada no inspeccionada. Primera búsqueda negativa por símbolos insuficiente, corregida por revisión textual de documentos, conversaciones y memoria en español/inglés: reparto/envío propio, Envíos Perros, cobertura, colonia, CP/zonas, bloqueados, blacklist/denylist, falsos pedidos, fraude y teléfonos. Persisten negativos acotados sobre implementación territorial y blacklist, no sobre existencia de antecedentes logísticos. No avala disponibilidad productiva, seguridad exhaustiva ni completitud histórica.
