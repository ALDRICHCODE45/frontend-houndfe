# Hoja de ruta retomable: catálogo y operación en paralelo

Para la junta: [resumen central de decisiones y capacidades de negocio](business-meeting-brief.md), sin detalle técnico y con pendientes visibles.

**Estado: planificación; no lista para implementación integral ni autorización de ejecución.**
Organizar entregas revisables de catálogo y operación interna con igual prioridad, sin esperar a completar todo abastecimiento/finanzas.
Este documento no aprueba esquemas, APIs, migraciones, movimientos de stock/dinero, borrados, publicación ni despliegue.

## 1. Ruta de lectura y autoridad

1. Leer [estrategia de catálogo](catalog-product-strategy.md), incluidas D8/D9/D13 y las respuestas textuales originales; contrastar el [contrato descriptivo propuesto](product-contract-proposal.md).
2. Leer [plan operativo](procurement-inventory-plan.md), especialmente decisiones aprobadas y registro de respuestas comerciales.
3. Retomar por la unidad y puerta afectadas; registrar autorización, evidencia y siguiente paso antes de avanzar.

Las respuestas específicas más recientes precisan los resúmenes iniciales: N2–N8 tienen aprobaciones parciales, no están completamente cerradas.
La evidencia técnica heredada es estática y acotada; no demuestra capacidades nuevas ni pruebas de integración exitosas.
No se inspeccionó código ni backend para esta hoja. La verificación backend futura corresponde al agente del repositorio principal, no al agente frontend.

## 2. Decisiones aceptadas y límites vigentes

| Referencia | Aceptado | No implica |
| --- | --- | --- |
| D1–D4 y prioridad reciente | Rediseño profundo para mascotas/animales; minorista y mayorista con igual importancia; ambos carriles en paralelo. | Dirección visual aprobada, taxonomía cerrada ni paridad actual de canales. |
| D8 | Lotes/caducidades por variante cuando corresponda. | Capacidad existente, obligatoriedad para todo producto ni diseño técnico aprobado. |
| D9 | Plan detallado y retomable; ejecución desatendida como objetivo posterior. | Autorización actual de implementación o efectos reales. |
| D10/N1 | CEDIS y sucursales de la misma empresa; traslados internos. | Compraventa entre sucursales ni eliminación del aislamiento técnico. |
| D13 | Una versión descriptiva publicada y un único borrador privado persistente por producto; retomar, preview/diff, publicación atómica y descarte con protección concurrente. | Segundo aprobador obligatorio, roles fijos, múltiples ramas, historial ilimitado ni snapshot/restauración operativa. |
| N2/N3 | Contado/crédito, abonos, anticipos y recepciones parciales; exigibilidad variable por proveedor. | Disparador único de CxP ni pago implícito al recibir. |
| N3 y respuesta reciente | Separar y revisar mercancía dañada, vencida o distinta antes de disponibilidad vendible. | Aceptación automática, liberación de vencidos ni deuda resuelta por su presencia física. |
| N3 | Reembolso realmente recibido o saldo a favor del proveedor para compras pagadas canceladas/devueltas. | Caja incrementada por una promesa ni doble recuperación del mismo importe. |
| N4 | Fuentes configurables con tipos operativos controlados; RBAC granular existente y roles configurados por el usuario. | Roles fijos, límites monetarios, segunda aprobación obligatoria ni conexión bancaria. |
| N5 | Costo nuevo muestra impacto; precios de venta cambian solo por acción autorizada explícita. | Valuación elegida, reprecificación automática ni recálculo de ventas históricas. |
| N6 | Bloquear venta de vencidos; prioridad FEFO entre lotes válidos, registrando el entregado. | Excepción de venta por rol ni equivalencia FEFO = FIFO de costos. |
| N7/N8 | Avisos iniciales 60/30/7 días configurables por familia; ajustes auditados sustituyen edición directa. | Política temporal completa, plantillas concretas cerradas ni transición de contratos resuelta. |

El modelo híbrido de atributos tipados/familias está **aprobado conceptualmente (D11)**. D12 exige vocabularios iniciales amplios, no selectores mínimos. Recomendación técnica: binding por familia `product` o `sellable`, sin herencia P→V, fallback ni variantes ficticias; contrastar la matriz inicial explícita del vocabulario por familia. Los mínimos de publicación de las siete familias están aprobados en D14 ([vocabularios, sección 7](product-vocabularies.md)), con sus condiciones de pertinencia y campos sugeridos opcionales. D17 aprueba el diccionario y las plantillas comunes de empresa, sin compartir automáticamente productos, stock, precios ni clientes. Siguen pendientes representación/autorización de ese ámbito, vocabulario curado concreto y aplicabilidad técnica por subtipo; el esquema físico y la adopción en productos existentes no están aprobados.
D13 sustituye la recomendación mínima de guardar solo ediciones válidas de publicados. Es requisito actual de C3, no ampliación opcional ni pregunta comercial abierta. Permisos existentes separan editar/guardar de publicar; el usuario los combina en roles sin exigir otra persona que apruebe. Los detalles técnicos propuestos requieren verificación backend, no nuevas aprobaciones de negocio para querer borradores.

D15 elimina la continuidad pública del catálogo actual como requisito de transición: no exigir convivencia de dos catálogos ni un mecanismo de disponibilidad continua por ese motivo. Preparación, revisión de fichas y habilitación del nuevo catálogo pueden organizarse separadamente. Preservar datos y operación; no inferir permiso para apagar, borrar, migrar ni desplegar. G0 y los criterios de liberación siguen vigentes.

D16 aprueba conservar valores válidos ya publicados y sus filtros al retirar opciones del diccionario, con elegibilidad vigente y advertencia administrativa. No permitir nuevas asignaciones; republicación exige reemplazo/retiro de la opción cumpliendo D14. Información incorrecta/peligrosa exige corrección o retiro explícito. No extender esta regla a variantes o medios archivados. Incluir estos casos en aceptación futura de C3.2/C3.3, sin reabrir la política como decisión pendiente.

Evidencia backend `bb06be94-7b84-4d3e-9c87-d1e035df626c`: no se encontró vínculo empresarial verificable entre tenants en el alcance inspeccionado; evaluador runtime de permisos pendiente de contraste. G1 requiere resolver dueño del diccionario en servidor y autorizar pertenencia/acción vigentes antes de habilitar mutaciones compartidas; no usar nombres, roles globales o allowlist improvisada. La matriz inicial de atributos propone sellable para diferencias entre presentaciones y product para contenido común, sin afirmar capacidades operativas nuevas. Ver evidencia y límites en [contrato](product-contract-proposal.md).

**Checkout/logística: investigación abierta por corrección del usuario.** C4/G2 no se cierran con ítems y total: deben contrastar con el agente del chatbot las reglas existentes de clientes/direcciones, entrega propia, Skydropx/Envíos Perros y restricciones territoriales/de contacto. Postergar chatbot es posibilidad, no decisión aprobada; D25 aprueba pago web completo por adelantado para ambas modalidades; D29 aprueba reserva al iniciar pago; pasarela, ciclo técnico pedido/pago/reserva y guía siguen sin contrato acordado. Informe del chatbot recibido: ver [evidencia y recorrido provisional](checkout-logistics-discovery.md). Aclaración posterior del chatbot recuperó documentación/memoria de entrega propia y Envíos Perros; la búsqueda inicial por símbolos era insuficiente. No demuestra implementación/activación actuales; blacklist comercial sigue sin fuente localizada. Backend corroboró archivo histórico y memoria posterior: fuentes reconciliadas; D23 aprueba cuatro categorías territoriales para web, no cobertura concreta ni restantes reglas históricas; no prueba de configuración desplegada. D24 aprueba apoyo de paquetería sobre precio final, no la base anterior a promociones del bot; límites de paquete y vigencia observados siguen sin aprobación web. Backend canceló búsqueda logística duplicada. No cambiar identidad/autorización ni copiar tarifas sin evidencia. El diseño visual independiente puede continuar, pero no representar ese recorrido como aprobado.

D23 exige FREE (propio gratis), SURCHARGE (propio con importe confirmado), CARRIER_ONLY (paquetería) y UNKNOWN (consultar equipo y guardar clasificación). En C4, comprobar que desconocido no produce gratuidad/rechazo automático y que recargo pendiente no se presenta como importe confirmado. No confundir cobertura con bloqueo comercial. Los $50–70 históricos y condiciones históricas de pago no se aprueban por esta decisión.

D24: apoyo de paquetería de $120 por unidad con precio final D18 >$500, excluido envío, acumulable y limitado a cotización. En C4 verificar frontera exacta $500 (no califica), promoción a $480 (no califica), dos unidades elegibles con cotización $310 (cargo $70), cotización $200 (cargo $0, sin saldo). No aplicar automáticamente a reparto propio ni duplicar por paquete. No modifica bot/POS; contrato de impuestos/redondeo y paquetes pendiente.

D25 exige pago íntegro anticipado en web (mercancía y envío confirmado), sin excepciones automáticas de confianza ni saldo en puerta. Cuenta/mayoreo/acuerdo no conceden crédito. C4 debe distinguir pendiente/fallido/confirmado, no aceptar comprobante o retorno del navegador como prueba, y no despachar sin pago completo confirmado. Resolver UNKNOWN/SURCHARGE antes de cobrar total final; proveedor, estados/idempotencia, reservas, cancelaciones y reembolsos pendientes. No cambia bot/POS.

D26 agrega a C4 solicitud de cotización pendiente para zona desconocida, recargo pendiente o tarifa no disponible: guardar sin cobro, reserva ni promesa de envío; resolución interna y aviso al cliente para revisar total y decidir pago. Revalidar precios/stock/vigencia antes de pagar; no congelar valores ni obligar handoff al chatbot. Verificar cada causa y que resolución/aviso no cobren por sí solos. D35 define correo verificado y seguimiento web como canales iniciales. D37 define vigencia visible y actualización; plazos concretos y cancelación de solicitud requieren contrato; D36 define cierre ante entrega imposible confirmada por revisión.

D27: C4 permite explorar/armar carrito sin cuenta; solicitar cotización/pagar exige identificación con correo verificado, con registro breve que conserva ítems. Verificar cambio de contexto/precios sin pérdida del carrito ni exposición privada; direcciones guardadas/condiciones particulares requieren vínculo D22. Mecanismo de sesión y reconciliación de carritos pendiente, no permiso de crédito.

D28 agrega a C4 restricciones comerciales de teléfono/domicilio: coincidencia confirmada con restricción vigente impide cotización/pago; dudosa pasa a revisión sin cobro/rechazo automático. Gestión autorizada con motivo/alcance/actor y mensajes neutrales/contacto, sin notas internas. Probar que apellido/dirección similar/intento fallido no crean bloqueo automático y que CARRIER_ONLY no es blacklist. Revisión de restricciones no se confunde con cotización D26. Definir matching y estados antes de implementar; no blacklist existente acreditada ni datos cargados.

D29: C4 revalida y reserva temporalmente solo al iniciar pago, nunca al armar carrito/pedir cotización. Disponibilidad insuficiente se informa antes de cobro; pago confirmado asigna reserva una vez. Fallo/cancelación/vencimiento confirmados liberan una vez; cierre de pestaña o error de red no bastan. D34 fija objetivo de 15 minutos para tarjeta sujeto a validación; mecanismo de conciliación pendiente; D31 define la salida comercial para pagos tardíos. Antes de liberar checkout, T1/C4 requieren contrato con autoridad de stock y pruebas concurrentes/duplicados; no presumir que O1 o backend actuales ya lo satisfacen ni crear saldo paralelo.

D31: pago tardío intenta asegurar pedido completo al total aceptado sin desplazar reservas ajenas; si no puede cumplirse, resolución/reembolso, sin sustituciones ni cargos extra automáticos. Cancelación del cliente automática antes de preparación, después revisión. Probar carrera cancelación/preparación, no reactivar cancelado por evento tardío, y no duplicar asignación/liberación/reembolso. Mostrar devolución pendiente hasta resultado del proveedor. D32 devuelve íntegramente lo cobrado, incluido envío, al medio original, sin descontar comisión, en cancelación anterior a preparación o pago tardío no cumplible; HoundFe absorbe comisión no reintegrada. No generalizar a otros casos ni inventar fecha de acreditación.

D33 define «Iniciar preparación» como acción de personal autorizado al comenzar a reunir mercancía, registrando quién y cuándo. Pago/lectura del pedido no disparan el estado ni el corte de cancelación. C4 debe verificar esos casos y la carrera cancelar/iniciar; no agregar roles fijos o una reversión automática por inferencia.

D34: 15 minutos desde iniciar pago, sin reinicio por recarga, solo tras asegurar total y disponibilidad durante la ventana. Renovar cotización insuficiente antes del cobro con aceptación. Verificar cierre efectivo, carreras/fallos y recuperación de cobro incierto; para Stripe requiere cierre explícito por mínimo temporizado de 30 minutos. No declarar soporte ni cambiar duración silenciosamente si la prueba falta/falla.

D35: avisos de cotización lista, pago confirmado, pedido enviado e incidencias/novedades de reembolso por correo verificado; estado actualizado en cuenta web. Sin correos por cambios menores ni notas internas; WhatsApp es ampliación posterior, no handoff obligatorio. Verificar destinatario autorizado, contenido y correspondencia con estado real; repetir una operación no debe producir avisos duplicados por el mismo hecho. Proveedor/envíos reales no autorizados aquí.

D36: revisión que confirma entrega imposible cierra solicitud con «No podemos ofrecer entrega en esta dirección», correo verificado y estado en cuenta, sin cobrar/reservar. Otra dirección inicia nueva cotización revalidada; no promete retiro ni fuerza WhatsApp. Verificar que UNKNOWN/CARRIER_ONLY no disparen este cierre automáticamente ni creen bloqueo comercial, y que el aviso no produzca efectos de dinero/stock.

D37: cotización resuelta muestra total y fecha/hora de vencimiento sustentados; vencida conserva solicitud/carrito y ofrece «Actualizar cotización». Revalidar precio/stock/envío y pedir aceptación de cambios; si no puede renovarse automáticamente, revisión sin cobro/reserva. Verificar que renovar no extienda apartado ni cobre, y que iniciar pago requiera total sostenible toda la ventana D34.

## 3. Puertas duras pendientes: bloquear solo su alcance

Una puerta se cierra con decisión o evidencia registrada y criterios verificables; el silencio no la cierra. P0 sigue parcialmente abierto.

| ID | Decisión / evidencia requerida | Bloquea | Puede continuar en paralelo |
| --- | --- | --- | --- |
| G0 | Alcance de implementación explícitamente autorizado y límites de acciones. | Toda escritura de implementación no autorizada. | Planificación documental solicitada; no usarla como permiso de ejecución. |
| G1 | D11/D12/D13/D14/D17 aprobadas. Detallar familias, vocabularios amplios, bindings sin herencia, representación/autorización del ámbito empresarial D17, categorías y aplicabilidad de mínimos por subtipo; verificar contrato técnico de borrador/publicación. | Contratos nuevos de información/facetas y administración correspondiente; D13 y los mínimos por familia D14 no se reabren como decisión comercial. | Descubrimiento UX, reglas operativas independientes. |
| G2 | D18 aprueba menor precio elegible sin acumulación automática; D19 resuelve cero/ausente y respaldo autorizado; D20 aprueba catálogo abierto y condiciones particulares identificadas/autorizadas; D21 registro abierto con vínculo comercial verificado; D22 correo verificado e invitación a contacto previamente validado (revisión autorizada si falta/está desactualizado). Pendientes elegibilidad, cantidades/unidades, impuestos/redondeo, empate/procedencia, mecanismo de alta/identificación/vínculo comercial/recuperación/revocación, vigencia, entrega, orden/filtros de fichas consultables y alcance de otros canales. | Precio comercial, handoff autenticado y funciones de campaña dependientes. | Contenido/UX no dependiente; compras e inventario internos. |
| G3 | Fuente de verdad stock; aperturas, compatibilidad y cierre de bypass; verificar ownership padre/lote. | Extensión de lotes y efectos de inventario hasta probar aislamiento/integridad. | Catálogo sin efectos y planificación de proveedores. |
| G4 | Corte temporal/zona, fechas desconocidas, desempates/reparto FEFO, retornos; resolución de incidencias/sobreentregas. | Contratos afectados de venta/recepción/liberación/devolución; alertas temporales. | Diseño de revisión separada; proveedores y costeo propuesto. |
| G5 | Evento de reconocimiento por compra, conciliación, plazos, correcciones, anticipos/créditos y cancelaciones. | CxP y aplicaciones financieras dependientes. | Intención de compra; recepción solo con contrato que no invente deuda. |
| G6 | Validar valuación, referencia de margen, flete, impuestos, descuentos y costos posteriores (§5). | Valuación persistida e impacto de margen que use esa referencia. | Política de no reprecificar y planeación de entradas físicas. |
| G7 | Saldos iniciales/procedencia, fondos insuficientes, combinaciones fuente/método, terceros y reversión. | Pagos/gastos/movimientos de fuentes afectados. | Catálogo, proveedores y contratos físicos independientes. |
| G8 | Tránsito, parciales/diferencias, alcances entre ubicaciones; ventanas, canales, destinatarios y baja rotación. | Traslados y automatizaciones/avisos afectados. | Núcleo de compra/recepción; catálogo sin esas funciones. |
| G9 | D38 aprueba pantallas/prioridades y D39 dirección visual general; prompt público para v0 preparado. Falta revisar composiciones y estados de la propuesta resultante. | Integración visual definitiva y liberación; prompt y propuesta base solicitados no autorizan implementar negocio. | Contratos funcionales y frente operativo independiente. |

Granularidad técnica de permisos corresponde a los agentes contra el sistema existente; no reabrir preguntas de «qué puesto puede» como puerta comercial.
Las alertas por familia requieren resolver G1 para esa configuración, no aprobar todo el catálogo para explorar alertas.
Fuera de alcance por defecto: fracciones, conversión caja/pieza, contabilidad general, integración bancaria y acciones automáticas de compra/reposición.

Propuesta funcional del primer frente operativo: [proveedores e integridad de inventario](first-operational-contract.md). O3/O1 se diseñan en paralelo; O2/O4 dependen de sus bases aceptadas. El documento ya está redactado y revisado como planificación, no cierra G0/G3–G7 ni declara implementadas las unidades.

## 4. Unidades revisables y dependencias

**Todas pendientes; ninguna tarea, contrato o validación se declara completada.** IDs locales, no commits ni endpoints.
FE = agente frontend; BE = agente backend principal. Cada fila exige revisión propia, documentación y futuras pruebas de su contrato.
Dependencia de una unidad significa resultado aceptado, no mera existencia de un documento. G0 aplica a toda ejecución futura.

| ID | Resultado observable | FE: responsabilidad | BE: responsabilidad | Dependencias | Ejemplo de aceptación futura | Aprobaciones / evidencia pendiente |
| --- | --- | --- | --- | --- | --- | --- |
| T0 | Alcance por carril y registro de puertas retomable. | Casos/pantallas y límites. | Confirmar viabilidad por peer. | Fuentes rectoras | Cada pendiente tiene unidad afectada y siguiente paso. | G0 por alcance; no cierre global de P0. |
| T1 | Contratos compartidos por unidad. | Estados/errores e intentos. | Autoridad, permisos y límites transaccionales. | T0 | Borrador no mueve stock/dinero; error no deja efectos parciales. | Puertas específicas y checklist §7. |
| C1 | Modelo comercial representativo y diccionarios amplios validados. | Ejemplos producto/variante/empaque y búsqueda usable de opciones. | Viabilidad aditiva y aislamiento del diccionario. | T0 | 100/500 ml no implica lote por variante ya disponible. | G1; híbrido aceptado, detalle y cobertura D12 por validar. |
| C2 | Brief v0 posterior y revisión de seis superficies/estados. | Incluir borrador guardado/sin guardar, publicado/no publicado, preview/diff, publicar/descartar/conflicto. | Revisar límites de datos y privacidad demostrables. | C1, T1 | Móvil, vacío/error/permiso y datos realistas; sin capacidades ficticias. | G9; no se genera brief aquí. |
| C3 | Catálogo/facetas y administración con D13 completo. | Guardar/retomar, preview/diff privado, publicar/descartar y conflicto. | Persistencia privada, CAS/transacción, medios y consulta solo de publicado. | C1, T1, C2; subunidades debajo | Borrador sobre publicado sobrevive recarga; fallo conserva ambos; facetas correlacionadas. | G1; integración, privacidad y rendimiento por verificar. |
| C4 | Precio privado y recorrido comercial verificables. | Sesión, «Desde», carrito/handoff. | Elegibilidad/resolución autoritativa por canal. | T1, C2 | Anónimo no recibe acuerdos; cambio de cantidad revalida precio/stock. | G2; O2 solo para presentaciones que lo requieran. |
| O1 | Historial/ajustes y apertura íntegros. | Motivo, anterior/nuevo, conflicto. | Journal/autoridad, aislamiento, idempotencia y compatibilidad. | T1 | Ajuste obsoleto no pisa una venta; sin bypass de cantidad/lotes. | G3 y contrato de reversión aplicable. |
| O2 | D8: lotes por variante y traza de salida/retorno. | Selector FEFO y lote realmente entregado. | Asignación, conciliación, bloqueo de vencidos. | O1, T1 | Cancelación enlaza lote original; vencido no cobra ni sale. | G4; ownership demostrado en O1. |
| O3 | Proveedores y órdenes separadas de efectos. | Condiciones y pedido/pendiente visibles. | Persistencia autorizada y estados sin efectos implícitos. | T1 | Confirmar pedido no recibe, paga ni reconoce deuda automáticamente. | Condiciones/documentos de este alcance. |
| O4 | Recepción parcial y mercancía en revisión. | Aceptado/revisión/pendiente separados. | Entrada única aceptada, origen y conciliación documental. | O1, O2, O3 | 10 pedidas, 6 aceptadas → +6; dañadas aparte, retry sin duplicado. | G4; G5 si reconoce deuda; G6 si incorpora valuación. |
| O5 | Costo trazable y margen sin cambiar precios. | Referencia/fecha y comparación visible. | Método validado y costo de entrada separado de precio. | O4 | Mismo precio de venta después de una recepción más cara. | G6; esta fila no elige el método. |
| O6 | CxP, anticipos y crédito proveedor conciliados. | Obligación, pagado/crédito y pendiente separados. | Reconocimiento/aplicación sin doble deuda ni salida. | O3, T1 | Anticipo aplicado reduce saldo sin retirar dinero otra vez. | G5; G7 para salida real de anticipo. |
| O7 | Pagos/fuentes y gastos sin stock. | Fuente y resultado recuperable. | Integrar autoridad de caja/cuentas, atomicidad y reversión. | O6, T1 | Pago parcial afecta una fuente una vez; servicio no crea stock. | G7/G5; permisos granulares disponibles. |
| O8 | Traslado interno trazable por ubicación. | Despacho/tránsito/recepción y diferencias. | Conservación lote/origen/destino y límites. | O2, O4 | No crea venta/CxP; parcial conserva saldo en tránsito. | G8 y correcciones aplicables. |
| O9 | Alertas y sugerencias explicables. | Vista sucursal/lote/cantidad y motivos. | Ventanas/deduplicación y datos de demanda/plazos. | O2, O4; O8 para sugerir traslados | Repetir evaluación no duplica aviso; no compra automáticamente. | G4/G8; G1 para configuración por familia. |
| R1 | Liberación de cada alcance con evidencia cruzada. | Recorridos y regresión FE. | Integración/aislamiento y regresión BE. | Unidades incluidas, no todo el programa | Stock/dinero/precios coinciden y denegaciones no filtran datos. | §8 y autorización de entrega correspondiente. |

### Desglose obligatorio de C3: D13 antes de liberar catálogo

Subunidades revisables, no APIs ni commits; todas requieren G0, C1/T1 y estados de C2 aceptados. No liberar una edición publicada «válida solamente» dejando persistencia del borrador para después.

| Subunidad | Resultado / dependencia | Aceptación futura |
| --- | --- | --- |
| C3.1 | Referencias/asignaciones y borrador privado persistente con revisión; base de C3.2/C3.3. | Un borrador por producto/tenant, recarga recuperable, faltantes permitidos; tipos/unidades/códigos/referencias ajenas inválidos no mutan revisión. Binding simple/variante explícito sin herencia. |
| C3.2 | Preview/diff autenticados, publicación/descarte con CAS y medios; depende C3.1. | Éxito reemplaza publicado y consume borrador; fallo conserva ambos. Descarte obsoleto no borra borrador nuevo; no filtración ni eliminación de imágenes compartidas/publicadas. |
| C3.3 | Consulta/facetas/caché solo desde versión descriptiva publicada; depende C3.1/C3.2 para liberar. | Respeta elegibilidad operativa vigente; OR dentro/AND entre facetas, conteos excluyen solo su propia selección, variante correlacionada y productos únicos antes de paginar. |

C3 conserva seis superficies del [mapa funcional](product-contract-proposal.md#pantallas-del-primer-corte-especificación-funcional-propuesta): familias; diccionario; alta/edición; presentaciones; preview/comparación/publicación; listado público. Integrar guardado/retoma/descarte en ellas, sin inventar pantallas CMS adicionales.

**Contrato técnico propuesto por backend** (`1e6135c1-f360-4a95-a4e6-dc5d882be2a3`): `Published {revision, document}` y `Draft {revision, basePublishedRevision, document}`. Comandos conceptuales crear/retomar, `save(expectedDraftRevision)`, preview/compare, `publish(expectedDraftRevision, expectedPublishedRevision)` y `discard(expectedDraftRevision)`; no rutas ni esquema ya aprobado.

- Documento: `commercialTitle`, descripción, `mediaRefs` ordenadas, `familyCode`, bindings/valores producto/vendible. Título comercial no es `Product.name` ni cambia POS/recibos; copia inicial explícita opcional sin sincronización. Verificar integración con contratos actuales.
- Excluir nombre operativo, SKU/código de barras, existencia/estado de variantes, stock/lotes/caducidad, precios/promociones/impuestos, unidad de venta, visibilidad/publicación operativa, acceso y receta. Publicar descripción no enciende visibilidad ni restaura operación.
- Publicar revalida permisos/revisiones, definiciones, todas las variantes actualmente ofrecidas/referenciadas y medios/pertenencia/elegibilidad dentro de la transacción; impedir carrera validar–eliminar–publicar. Referencia archivada/eliminada tras guardar queda diagnosticada en borrador y bloquea publicación sin borrarlo; reasignar explícitamente simple↔variantes, nunca resucitar variantes.
- Preview/diff autenticados `no-store`; assets del tenant, medios exclusivos de borrador privados sin URL estable/CDN público. Caché/índice públicos solo de publicado con revisión e invalidación y reglas operativas vivas. Retener media mientras borrador/publicado la refiera; sin limpieza inline al cambiar/descartar, huérfanos aparte. Mecanismos concretos de almacenamiento, transacción y caché requieren evidencia, no una API especulativa.

C3/C4 no esperan O6–O9. O3 no espera la dirección visual del catálogo; usa solo su contrato y convenciones administrativas acordadas.
O4 referencia O2 para el alcance con lotes; un primer alcance sin lotes solo procede si se acuerda explícitamente y no oculta D8.
Ninguna campaña/Buen Fin exige terminar finanzas: habilitar únicamente las funciones comerciales con puertas resueltas.

## 5. Propuesta acotada de costos para validar, no decisión adoptada

**Ilustración operativa, no asesoría fiscal ni reglas contables aprobadas.** Una presentación, misma ubicación/unidad; sin impuestos, descuentos, devoluciones ni redondeos intermedios.
Se reciben y aceptan A: 10 unidades a $100, después B: 10 a $140; luego salen 12 unidades, sin movimientos entre recepciones.
Mercancía total: $2.400. Flete documentado total: $200 ($100 por recepción); desembolso/obligación se concilia aparte, no se presume pagado.

| Alternativa de flete | Valuación comparada | Costo disponible antes de salir | Costo asignado a 12 salidas | Inventario final: 8 unidades |
| --- | --- | --- | --- | --- |
| Separado como gasto operativo ilustrativo | Promedio ponderado: $120/u | $2.400 | $1.440 | $960 |
| Separado como gasto operativo ilustrativo | FIFO: 10×$100 + 2×$140 | $2.400 | $1.280 | $1.120 |
| Incorporado por unidad recibida: +$10/u | Promedio ponderado: $130/u | $2.600 | $1.560 | $1.040 |
| Incorporado por unidad recibida: +$10/u | FIFO: 10×$110 + 2×$150 | $2.600 | $1.400 | $1.200 |

En cada fila, costo de salidas + inventario final = costo disponible. En las dos primeras, los $200 de flete quedan separados; no se omiten ni se suman de nuevo al stock.
Promedio ponderado reparte valor; FIFO consume capas de costo por orden de entrada. FEFO elige mercancía física por vencimiento y no decide esas capas.
Por ejemplo, B podría vencer antes que A: FEFO propondría B primero; la valoración seguiría el método expresamente validado, con traza física real independiente.
El ejemplo no resuelve mezcla de pesos/volúmenes: repartir flete por valor o peso es otra política pendiente, no intercambiable silenciosamente con reparto por unidades.

**Recomendación mínima para discutir:** promedio ponderado móvil por identidad vendible/ubicación y flete conocido atribuible por unidades aceptadas, solo donde las unidades sean comparables.
Conservar costo documental por recepción y trazas de lote separadas; no agregar selección de múltiples métodos por operación como alcance inicial.
Negocio debe validar método, alcance de agrupación, flete conocido/tardío, impuestos recuperables/no recuperables, descuentos, redondeos, retornos y referencia de margen (G6).
Si requiere FIFO o distinto reparto, ajustar el contrato antes de persistir valuaciones; no migrar ni recalcular historia por inferencia.
No prometer ahorro, margen objetivo ni precio sugerido: ningún costo nuevo modifica automáticamente precios públicos, listas, escalas o acuerdos.

## 6. Primeros cortes de planificación y ejecución futura

**Entregables documentales paralelos preparados y revisados:** [brief funcional de catálogo](catalog-design-brief.md) y [primer contrato operativo](first-operational-contract.md). D38 confirma prioridad de catálogo/ficha/publicación y diseño O3/O1 en paralelo. No son UI ni funciones implementadas: G0 y puertas específicas siguen vigentes. D39 aprueba la dirección visual general y solicita el [prompt público para v0](v0-public-catalog-prompt.md); preparado para copiar, sin solicitud externa ejecutada ni aprobación del diseño resultante.

1. **Planificación A — T0:** seleccionar ejemplos de ambos carriles y registrar puertas/alcance. Todavía sin código ni operaciones.
2. **Planificación B — T1 + C1 / O1–O3:** validar modelo propuesto con negocio y contratos con peer backend; resolver solo puertas del primer corte.
3. **Planificación C — C2:** conservar el brief v0 como entregable posterior; acordar pantallas y dirección visual antes de generarlo.
4. **Ejecución inicial, únicamente tras G0:** carril catálogo C3.1→C3.2→C3.3 con D13 requerido, según C1/C2/T1 aceptados; operación O1 y O3 por contratos independientes, sin esperar finanzas.
5. **Siguiente corte operativo:** O2/O4 con G3/G4 resueltas; luego O5–O7 según G5–G7. Nunca adelantar pagos para desbloquear diseño visual.
6. **Ampliaciones:** O8/O9 y mejoras comerciales según evidencia; liberar cada alcance mediante R1, sin declarar terminado todo el programa.

### Siguiente corte de contrato C4: pago y stock compartido

[Propuesta de pagos/reservas](payment-contract-proposal.md) integra evidencia backend `90960d78-9c30-4c2c-8d4a-e762028e4b92`: checkout bot crea crédito y descuenta stock inmediatamente; PSP y reservas temporales no demostrados. No usar ese comando tal cual para D25/D29.

Antes de implementación, declarar y acordar superficies de inventario compartido que POS/bot deberán respetar para evitar sobreventa/doble descuento/restitución, sin cambiar sus políticas comerciales. D30 acota medios a tarjetas y D31 resuelve pago tardío/corte de cancelación. Proveedor, validación de ventana D34, condiciones comerciales del proveedor y plazos de reembolso siguen pendientes; D32 cierra importe y absorción de comisión en sus dos casos; locks, eventos verificables, recuperación y límites transaccionales se resuelven técnicamente. No depende de terminar todo finanzas, pero sí de autoridad de disponibilidad común y pruebas de todos los escritores afectados.

D30 acota el lanzamiento web a tarjetas. SPEI/OXXO no forman parte de ese corte; MSI no se habilita por inferencia. Link EVO es candidato para posterior evaluación en chatbot, no tarea de integración autorizada. C4 conserva controles de pagos pendientes y reservas aunque el medio inicial sea tarjeta.

Investigación de pasarelas: [comparación documental México](payment-provider-comparison.md). No hay pasarela contratada; Link EVO no seleccionado. Stripe Checkout es primer candidato técnico condicionado a elegibilidad/comercial/pruebas; MP alternativa, EVO requiere precisar producto. No fijar tiempo de reserva solo desde el vencimiento de sesión: coordinarlo con cotización y medio de pago. Tarifas MP/EVO no verificadas; la comparación no autoriza cuentas, contratación ni implementación.

## 7. Checklist de handoff de contrato FE ↔ BE

- [ ] Unidad, alcance autorizado, exclusiones y puertas cerradas con referencia a decisión/evidencia.
- [ ] Casos representativos y negativos; identidad producto/variante, ubicación/tenant, unidad vendible e importes precisos.
- [ ] Estados/transiciones, aceptación versus revisión, actor autorizado y efectos/no efectos de cada comando.
- [ ] Autoridad única para stock, caja y CxP; atomicidad, concurrencia, idempotencia actor/hash y recuperación del resultado.
- [ ] Permisos granulares en editor actual; alcances y aislamiento de referencias, sin roles fijos ni bypass por permiso. En D13, editar/guardar y publicar separados, combinables en roles sin segundo aprobador obligatorio.
- [ ] C3/D13: un borrador persistente y una descripción publicada; shapes/revisiones, faltantes versus captura malformada, CAS de guardar/publicar/descartar y recuperación sin pérdida. Publicar revalida referencias/medios/definiciones vigentes en transacción, sin restauración operativa.
- [ ] C3/D13: preview/diff privados `no-store`, medios tenant-local privados de borrador, caché pública solo de publicado y retención de imágenes referidas; adopción de productos actuales sin borrados ni nueva API de almacenamiento inferida.
- [ ] Errores recuperables, conflicto, principal cambiado y éxito con fallo posterior de lectura; contrato acordado, no API inventada aquí.
- [ ] Aperturas, compatibilidad de consumidores/endpoints actuales, retiro de bypass y corrección enlazada sin borrar historia.
- [ ] Peer BE devuelve evidencia acotada de viabilidad y comandos futuros de validación; FE acuerda consumidores y pruebas antes de implementar.

## 8. Aceptación y liberación por alcance

Esta hoja es pasiva: los siguientes son criterios para **pruebas futuras**, no pruebas ejecutadas ni capacidades certificadas.
Primero pruebas enfocadas de contrato/unidad; integración cruzada después. Las suites y builds aplicables forman parte de la implementación autorizada y no requieren permiso por cada paso; accesos externos o efectos destructivos conservan su autorización específica.

| Área | Evidencia exigida antes de liberar la función |
| --- | --- |
| D13: persistencia y publicación | Recargar retiene borrador incompleto válido; captura malformada no cambia revisión. Éxito publica atómicamente y consume borrador; fallo conserva ambos sin despublicar. CAS evita pérdidas al guardar/publicar/descartar, incluido descarte obsoleto. |
| D13: referencias y operación | Referencia invalidada luego de guardar impide publicar sin borrar borrador/publicado; carrera con archivo/eliminación protegida. No resucitar variantes ni alterar nombre/SKU/stock/precio/receta/visibilidad; publicar descripción no enciende visibilidad. |
| D13: privacidad y medios | Acceso cruzado a borrador/media denegado; preview/diff autenticados `no-store`, sin URL/CDN público de media no publicada ni caché/índice público de borrador. Caché publicada con revisión e invalidación; cambiar/descartar no borra media compartida/publicada. |
| Facetas descriptivas | Solo publicado y elegibilidad viva; una misma variante satisface predicados vendibles. OR dentro/AND entre facetas; conteos propios excluyen solo selección de esa faceta, no privacidad/contexto; materiales una faceta con grupos. |
| Inventario/idempotencia | Retry y concurrencia: una entrada/ajuste, sin sobre-recepción ni saldo perdido; mismo intento con payload incompatible se rechaza sin efectos. |
| Dinero/CxP | Pago/anticipo/crédito/reembolso no duplica salida ni aplicación; rechazo deja saldos intactos; segunda reversión no altera balances. |
| Lotes y revisión | Variante/lote/ubicación concilian físico y vendible; incidencia queda separada; vencido no se vende; salida/retorno conservan origen real. |
| Aislamiento/RBAC | Probar referencias cruzadas tenant/padre/lote y ubicación; triage ownership verificado antes de extender; permiso de compra no concede pago. |
| D19: precio ausente/cero | Candidato cero/ausente se excluye; otro precio válido autorizado permite compra según D18. Sin ninguno: «Consultar precio», ficha visible si cumple demás condiciones, alta de esa presentación al carrito denegada por UI y servidor. Variante hermana válida no bloqueada, sin precio cero ficticio ni mutaciones de datos por resolver precio. |
| D22: verificación del vínculo | Correo nuevo verificado no revela acuerdos ajenos. Invitación de cliente existente usa contacto registrado previamente validado; si falta/está desactualizado, revisión autorizada antes de vincular. Nombre/teléfono/número de cliente no bastan. Proveedor, vigencia y controles técnicos pendientes; no se ejecutan invitaciones aquí. |
| D21: registro y vínculo | Registro voluntario concede condiciones públicas, no beneficios privados ni permisos de personal. Cliente existente requiere identidad/vínculo verificados; nombre/teléfono no bastan. Solicitud de mayoreo no asigna condiciones sin acción autorizada. No fusionar clientes automáticamente; implementación de verificación pendiente. |
| D20: acceso comercial | Visitante explora sin registro y recibe solo condiciones públicas elegibles; cliente identificado recibe únicamente condiciones asignadas/autorizadas según D18/D19. Autodeclararse mayorista no cambia asignaciones; cuenta de cliente no otorga permisos del POS/administración. Contrastar aislamiento y revocación antes de habilitar acceso privado. |
| Precio privado | API, UI y caché no filtran listas/acuerdos a anónimo u otro cliente; revocación/cambio de sesión limpia contexto; costo no reprecifica. |
| D18: elección de precio | Para el mismo vendible/contexto, lista 100, escala aplicable 90, acuerdo 85 y promoción 80: cobrar 80 si promoción elegible, 85 si no. No acumular descuentos ni usar precios de otro cliente; revalidar cantidad y contexto vigentes. Ejemplo futuro, no test ejecutado ni cambio aprobado a POS/bot. |
| Compatibilidad | Peer BE y FE comparan venta cobrada/cancelación, stock, pagos/caja, variantes y lotes actuales; POS/catálogo/bot según consumidores afectados. |
| Recuperación/UX | Éxito seguido de fallo de refresco conserva resultado aplicado; relectura no repite escritura; cambio de principal no reutiliza intento anterior. |
| Alertas | Umbral/fecha/configuración acordados; repetición sin duplicado y casos frontera; recomendación no ejecuta compra/traslado. |

Las diferencias actuales de precios entre POS/catálogo/bot son baseline a documentar, no permiso para cambiarlas ni exigir paridad ficticia.
Registrar comandos exactos acordados con BE, entorno seguro, resultados y límites; una inspección estática o mocks FE no acreditan atomicidad/aislamiento backend.
Si falla validación requerida, no liberar ese alcance; separar fallos preexistentes sin ocultarlos ni corregirlos fuera de autorización.

## 9. Retomar, pausar y entregar evidencia

- Mantener por unidad: estado real, contrato/decisiones, autorización, archivos afectados, validaciones observadas, bloqueo y próximo paso; sin commits ficticios.
- Tras autorizar alcance y cerrar sus puertas, avanzar por sus unidades sin consentimiento por paso ni preguntas arbitrarias sobre nombres de roles.
- Pausar solo lo afectado ante nueva decisión de negocio/alcance, autorización específica faltante o prueba/evidencia requerida ausente; continuar el carril independiente seguro.
- Un bloqueo técnico o validación fallida exige registrar evidencia y no liberar; no habilita inventar política ni saltar aislamiento/invariantes.
- No inferir permiso para pushes, borrados, migraciones destructivas, despliegues ni acceso a repositorios externos; backend se coordina por su agente principal.
- Al entregar: resumir resultado verificable, pendientes y siguiente unidad. Este plan no declara P0 cerrado ni preparación integral final para implementar.
