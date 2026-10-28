# Plan de abastecimiento, inventario y finanzas de HoundFe

Para la junta: [resumen central de decisiones y capacidades de negocio](business-meeting-brief.md), sin detalle técnico y con pendientes visibles.

Documento vivo para retomar descubrimiento y preparar trabajo revisable. Estado: **planificación; no listo para ejecución**.
No autoriza implementación, migraciones, borrados, movimientos de dinero/stock ni despliegues. No contiene calendario ni esquema aprobado.
Contexto rector: [Catálogo y modelo de producto](catalog-product-strategy.md), especialmente D8, D9 y la solicitud textual en «Registro de decisiones».

Primer alcance concretado para revisión: [contrato operativo O3/O1 → O2/O4](first-operational-contract.md). Campos, efectos y escenarios futuros; no capacidad implementada ni autorización de ejecución.

## Ruta rápida y estado de las decisiones

1. Resolver las preguntas de negocio de P0 con ejemplos y responsables.
2. Aprobar contratos y criterios por unidad; después solicitar autorización explícita de implementación.
3. Avanzar por dependencias reales, conservando un carril paralelo de catálogo/Buen Fin.

| Marca | Significado en este plan |
| --- | --- |
| Confirmado | Dirección elegida por el usuario; no equivale a diseño técnico aprobado. |
| Propuesta | Recomendación para validar; estados, efectos y fases aún no comprometidos. |
| Pendiente | Respuesta de negocio o verificación necesaria antes de cerrar el contrato afectado. |

- **Confirmado — D8:** ampliar soporte de lotes/caducidades por variante cuando corresponda; no exigirlo a todos los productos.
- **Confirmado — D9:** plan detallado y retomable para proveedores, entradas, pagos/origen del dinero, gastos, caducidad, rotación y reposición.
- **Confirmado:** ejecución desatendida es un objetivo posterior, no permiso actual para cambiar inventario o dinero.
- **Confirmado — N1:** CEDIS y sucursales pertenecen a la misma empresa y trasladan mercancía internamente. Los traslados no son compras/ventas entre empresas. Esto no elimina permisos ni aislamiento técnico por ubicación/tenant.
- **Pendiente:** reglas operativas, reconocimiento de obligaciones, permisos, costos y diseño de datos.

## Evidencia disponible y límites

Inspección estática acotada del frontend y reporte del agente del backend principal; sin tests, DB ni llamadas API.
No se repite aquí la investigación ni se accede al repositorio backend. «No identificado» no significa ausencia universal.

| Evidencia | Implicación para el plan |
| --- | --- |
| No se identificaron proveedores, órdenes de compra, recepciones documentadas, CxP, pagos a proveedores, journal ni traspasos formales. | Capacidades propuestas; los pedidos existentes son ventas a clientes. |
| Edición directa de cantidad de producto/variante y CRUD de lotes. | Son entradas aparentes, no compras ni recepciones auditadas. |
| Lotes actuales excluyen variantes; cantidades enteras. | D8 exige ampliar contratos; no prometer fracciones o conversión de empaques. |
| Sin asignación FEFO ni vínculo venta→lote/restauración verificados. | Diseñar trazabilidad antes de afirmar control integral de caducidades. |
| Conciliación lote↔cantidad del padre no demostrada. | Acordar fuente de verdad y detectar diferencias antes de extender. |
| Alertas de mínimo excluyen productos con lotes; se rearman estrictamente por encima del mínimo. | No asumir cobertura por lote ni cambiar la condición silenciosamente. |
| No se identificaron scanner de caducidad ni avisos de baja rotación. | Son trabajo nuevo, condicionado a políticas y datos fiables. |
| Costos NET/GROSS y por variante existentes. | No equivalen a historial de costo recibido ni valuación de inventario. |

La venta cobrada valida y descuenta producto/variante y persiste pago transaccionalmente; la cancelación restaura stock.
Un importe de reembolso no prueba por sí solo una salida de caja. Respuestas humanas RESTOCK/EXPIRATION no mueven stock.
La recepción en `/pos/caja/recepciones` es custodia de efectivo, no recepción de mercancía.
Los datos bancarios de `PaymentDetail` son referencias para transferencias de clientes, no cuentas financieras ni ledger.

**Riesgo previo a extender lotes:** el agente backend detectó `updateLot/removeLot` con `{id,productId}` sin consulta previa de pertenencia del padre al tenant.
Es un posible hueco de ownership por inspección, no un exploit reproducido. Requiere triage de aislamiento; no hay corrección autorizada.

## Límites de módulos propuestos

| Módulo | Responsabilidad | No debe sustituir |
| --- | --- | --- |
| Abastecimiento | Proveedores, condiciones, plazos, órdenes y seguimiento de entregas. | Ventas de clientes, stock o libro de caja. |
| Inventario | Recepciones confirmadas, existencias, lotes/variantes, ajustes y trazas. | La obligación al proveedor o su pago. |
| Finanzas operativas | Cuentas por pagar (CxP), anticipos si se aprueban, pagos, fuentes de fondos y gastos sin stock. | Contabilidad general completa ni integración bancaria. |
| Catálogo/precios | Identidad vendible, presentación e información comercial. | Costeo de recepciones o movimientos financieros. |

Separar **compromiso de compra**, **recepción física**, **obligación al proveedor**, **pago** y **gasto sin stock**.
Una compra puede estar pendiente de entrega o de pago: no colapsar sus estados en «comprado».
Reconocer la obligación por factura, recepción o conciliación entre ambas sigue **pendiente**; no elegir un disparador implícito.
Método de pago (efectivo/transferencia) ≠ fuente de fondos (caja/cuenta autorizada).
Mover efectivo entre custodios no es un gasto. Una recepción de mercancía no es ingreso de caja.

**Reposición por sucursal**, propuesta: detectar necesidad local y recomendar compra o traslado considerando disponibilidad, demanda y plazo.
No significa comprar automáticamente. N1 confirma traslados internos de una misma empresa; quedan por definir autorización, despacho, tránsito y recepción.

## Matriz propuesta de estados y efectos

Nombres conceptuales para revisar, no enums, tablas ni endpoints aprobados. Cada efecto requiere un comando explícito autorizado.

| Operación / transición propuesta | Stock | Dinero / obligación | Control necesario |
| --- | --- | --- | --- |
| Documento → borrador / edición | Ninguno | Ninguno | Guardar intención nunca implica contabilizar. |
| Orden → confirmada / parcialmente atendida | Ninguno por la orden | Compromiso; no pago ni CxP automática | Separar cantidades pedidas, recibidas y pendientes. |
| Recepción → confirmada, parcial o final | Una entrada por cantidades aceptadas | Reconocimiento de CxP pendiente de política | Servidor aplica stock y traza una sola vez. |
| Factura / documento de proveedor → reconocido | Ninguno adicional | Obligación según regla aún pendiente | Conciliar con recepciones sin duplicar deuda. |
| Pago → aplicado, parcial o total | Ninguno | Una salida enlazada y aplicación a CxP | Fuente, saldo, permisos y vínculo verificables. |
| Anticipo → registrado / aplicado a compra | Ninguno | Registro: una salida; aplicación: consume saldo del anticipo sin nueva salida | Soporte aprobado; reglas de cancelación/reembolso pendientes. |
| Gasto sin stock → registrado / pagado | Ninguno | Obligación o salida según contrato pendiente | No simular recepción para registrar servicios. |
| Traslado → despachado / recibido | Efectos por ubicación según política pendiente | No inferir gasto ni CxP | Confirmar propietario legal y tránsito primero. |
| Devolución a proveedor → confirmada | Salida por unidades aceptadas | Crédito, compensación o devolución pendientes | Vincular recepción/lote y límite retornable. |
| Ajuste / merma → confirmado | Delta auditado | Tratamiento de costo pendiente | Motivo, autorización y lote cuando aplique. |
| Documento sin efectos → cancelado | Ninguno | Ninguno | Diferenciarlo de reversar uno ya aplicado. |
| Documento aplicado → corregido / reversado | Compensación explícita cuando proceda | Compensación enlazada cuando proceda | No borrar historia ni revertir dos veces. |

**Propuesta de integridad:** una recepción confirmada produce un único efecto de stock propiedad del servidor.
No implementar «confirmar recepción + PATCH de cantidad + crear lote» desde frontend como tres escrituras independientes.
Un pago al proveedor produce un único efecto de caja/cuenta enlazado; no liquidar CxP y retirar efectivo otra vez por separado.
Correcciones deben respetar consumo posterior, períodos y permisos por definir; no prometer reversión si ya no es válida.

## Trazabilidad e integridad propuestas

- Identidad vendible estable: producto o variante, ubicación y lote cuando la política lo requiera.
- Recepción: origen documental, proveedor, cantidades aceptadas/rechazadas, costo informado, lote/caducidad y responsable.
- Venta: enlazar unidades salientes con lotes; FEFO aprobado como prioridad: proponer primero el lote válido que venza antes y registrar el realmente entregado. No equivale a implementación existente ni a selección ciega del lote físico.
- Caducidad: bloqueo de venta aprobado para lotes vencidos; conservar existencia física e historial. Zona/fecha de corte y permisos de corrección siguen pendientes; no hay excepción de venta autorizada.
- Traslado: conservar lote/caducidad y traza origen→tránsito→destino; pérdidas, diferencias y recepción parcial necesitan reglas.
- Retorno de cliente/cancelación: enlazar venta y lote original; validar condición, destino y aptitud para volver a disponible.
- Retorno a proveedor: enlazar recepción y lote original; separar salida física de crédito o reembolso financiero.
- Conciliación: definir cómo se deriva stock agregado de lotes/variantes y cómo se detectan diferencias sin reparación silenciosa.
- Edición directa actual: sustitución por ajustes auditados aprobada; definir transición, aperturas, permisos y compatibilidad. No dejar endpoints de cantidad/lotes como bypass permanente del historial.
- Aperturas y datos anteriores: proponer reconciliación y procedencia explícita, sin inventar compras históricas ni autorizar borrados.

## Responsabilidades frontend y backend propuestas

| Capa | Responsabilidad / límite |
| --- | --- |
| Frontend | Formularios, cantidades pendientes, fuente de fondos visible, confirmación y estados de carga/error/permiso. |
| Frontend | Mantener clave del mismo intento al reintentar; impedir doble envío accidental sin prometer atomicidad desde UI. |
| Frontend | No reutilizar intento con otro actor/sesión; distinguir escritura exitosa de fallo posterior al refrescar. |
| Backend | Validar permisos efectivos con el sistema existente, tenant, sujeto, ubicación, estado, cantidades y fondos; calcular efectos autoritativos, sin depender del nombre del rol. |
| Backend | Idempotencia con actor y hash de solicitud; rechazar reutilización incompatible; controlar concurrencia y atomicidad. |
| Backend | Registrar documento, efecto, vínculo, actor y reversión; integrar caja/stock existentes, no duplicar lógica autoritativa. |
| Contrato compartido | Errores accionables, resultados recuperables, unidades/importes y estados explícitos; sin esquema físico aprobado. |

Los movimientos manuales actuales de caja ya usan `Idempotency-Key`, replay por actor/hash, permisos, dueño/sesión y delta atómico.
`CashMovementPayload` solo expone `amountCents` y `reason`: no demuestra vínculos de proveedor, CxP o fuente financiera suficiente.
Aprovechar el patrón de `useCashSessionCommands.ts:84–158` para intento estable, principal obsoleto y fallo de refresco tras éxito.
Extender el sistema existente con permisos granulares de abastecimiento/finanzas disponibles en el editor de roles. El usuario crea los roles y asigna permisos; no heredar autorización desde un `Product update` genérico ni introducir roles fijos o un sistema paralelo.
Modelos nuevos deberán incorporarse a la allowlist de tenant y tener cobertura de aislamiento; no basta ocultar botones.

## Fases propuestas y unidades revisables

No son fechas ni autorización de ejecución. Cada unidad futura debe incluir contrato, pruebas enfocadas y documentación, con revisión independiente.
El cierre de cada dependencia se verifica antes de iniciar efectos de la siguiente; no exigir terminar todo el ERP.

| Fase / unidad | Entregable propuesto | Dependencia / puerta de salida |
| --- | --- | --- |
| P0-A — negocio | Respuestas de propiedad legal, documentos, parciales, fondos y correcciones; roles configurables existentes confirmados. | Ejemplos aprobados; pendientes visibles, sin efectos. |
| P0-B — contratos | Matriz validada, errores, permisos e invariantes; triage de ownership de lotes. | Alcance ejecutable aprobado antes de código; avanzar luego por unidades dentro de esa autorización. |
| P1-A — integridad | Fuente de verdad de stock, apertura/ajustes, historial e idempotencia. | Resolver bypass de edición y aislamiento; plan de compatibilidad. |
| P1-B — D8 | Lotes por variante y trazas de entrada/salida/retorno con conciliación. | Identidad vendible y políticas de lote; recepción formal llega en P2. |
| P2-A — abastecimiento | Proveedores, condiciones/plazos y órdenes sin efectos implícitos. | Contratos P0; probar compromiso separado de stock y pago. |
| P2-B — recepción | Entregas parciales, rechazos, lotes y efecto único de entrada. | P1 y orden/origen acordado; conciliación documental explícita. |
| P3-A — CxP | Reconocimiento, vencimientos, saldo pendiente y anticipos si se aprueban. | Regla factura/recepción y devoluciones resuelta. |
| P3-B — tesorería/gastos | Fuentes, pagos parciales, gasto sin stock y reversión enlazada. | CxP, permisos granulares integrados y autoridad de caja/cuentas acordados. |
| P4-A — traslados | Despacho, tránsito, recepción y diferencias por ubicación. | N1 resuelta: internos; P1/P2 y permisos entre ubicaciones pendientes. |
| P4-B — alertas/reposición | Caducidad, baja rotación y sugerencias por sucursal/proveedor. | Datos/trazas fiables, ventanas, demanda y plazos aprobados. |

**Carril paralelo catálogo/Buen Fin:** continuar descubrimiento, contenido, UX y contratos comerciales de la estrategia sin esperar P3/P4.
Solo bloquear la función que dependa realmente de stock/precios/lotes aún no soportados; no mostrar capacidades futuras como existentes.
Las presentaciones que necesiten lotes por variante dependen de P1-B; una campaña no depende de construir todo abastecimiento/finanzas.
Precedencias de promociones/listas y disponibilidad pública conservan su propia validación; no modificar POS por inferencia.

## Criterios de aceptación observables propuestos

Se convertirán en pruebas al autorizar cada unidad; esta documentación no ejecuta operaciones ni acredita comportamiento nuevo.

- [ ] Borrador y confirmación de orden dejan stock, caja y CxP sin cambios salvo el compromiso aprobado.
- [ ] Dos recepciones parciales muestran pedido/aceptado/pendiente correcto; exceso o rechazo sigue la política explícita.
- [ ] Reintentar la misma recepción devuelve el resultado previo: una traza y un delta, sin duplicar lote ni cantidad.
- [ ] Conflictos concurrentes no sobre-reciben ni sobrescriben stock; comandos rechazados dejan balances y contadores de negocio intactos.
- [ ] Lotes por variante conservan caducidad y saldo; venta/cancelación/retorno se concilian con su origen según política aprobada.
- [ ] Pago parcial reduce el saldo debido correcto y una única fuente; retry no duplica retiro ni aplicación a CxP.
- [ ] Medio de pago sin fuente autorizada, fondos insuficientes o sesión inválida se rechazan sin efectos parciales.
- [ ] Gasto sin stock no crea inventario; traslado de custodia de efectivo no aparece como gasto.
- [ ] Reversión conserva original, motivo y actor; una segunda reversión o una inválida no altera saldos.
- [ ] Actor sin permiso, cambio de principal y referencias cruzadas entre tenants/ubicaciones no autorizadas se rechazan sin filtraciones.
- [ ] Allowlist/aislamiento cubren modelos nuevos y referencias padre/lote; el riesgo estático existente queda verificado antes de extender.
- [ ] Éxito seguido de fallo al refrescar se muestra como aplicado con recuperación de lectura, no invita a repetir la escritura.
- [ ] Alertas cumplen ventanas/condiciones aprobadas, sin duplicados; rearmado en igualdad y con lotes tiene casos explícitos.
- [ ] Reposición explica demanda, disponibilidad, plazo y origen de datos; no genera compra/traslado automático.

## Decisiones y preguntas de negocio — puerta P0

| ID | Pregunta que debe responder el negocio | Contrato que bloquea |
| --- | --- | --- |
| N1 — resuelta | Misma empresa, con traslados internos entre CEDIS y sucursales. | No crear compraventa ni CxP entre sucursales por el traslado; falta diseñar tránsito, recepción y permisos. |
| N2 — parcial | Confirmado: contado/crédito con abonos y momento/importe exigible variable según proveedor. No fijar un único disparador global de deuda. Propuesta: condiciones predeterminadas por proveedor y acuerdo explícito en cada compra (sección siguiente). Pendientes conciliación, excepciones y validación del mecanismo. | Separar pedido, recepción, documento de cobro y pago; impedir doble reconocimiento de deuda. |
| N3 — parcial | Confirmados abonos, entregas parciales y anticipos antes de recibir. Cada recepción aumenta stock solo por lo recibido y aceptado; el anticipo registra dinero entregado y se aplica luego a la compra sin duplicar salida. Aprobadas dos salidas para cancelaciones/devoluciones de compras pagadas: reembolso efectivo o saldo a favor con el proveedor. Aprobado: mercancía dañada, vencida o distinta se separa y registra para revisión, sin disponibilidad de venta automática. Pendientes: sobreentregas y resolución física/documental de incidencias, devoluciones y cancelaciones. | No confundir pago parcial con recepción parcial ni con anticipo. |
| N4 — parcial | Confirmado: pueden existir varias fuentes; el usuario desconoce cuáles concretamente. Aprobado: fuentes configurables con tipos operativos controlados (sección siguiente). Aprobado: autorización mediante permisos granulares y roles configurados por el usuario, reutilizando el sistema actual. Controles de saldo y detalle de permisos/alcances todavía pendientes; no asumir doble aprobación ni límites por rol. | Tesorería, segregación de funciones y fuentes autorizadas; no inventar cuentas ni saldos. |
| N5 — parcial | Aprobado: un cambio de costo no modifica automáticamente precios de venta; mostrar impacto en margen y requerir cambio explícito de persona autorizada. El usuario pide proponer un modelo de costos y validarlo con el negocio antes de elegirlo. Pendientes: flete, impuestos, descuentos, costo de referencia y método de valuación. | Proteger precios públicos/comerciales y acuerdos; no inferir método de costeo. |
| N6 — parcial | Aprobado: bloquear venta de lotes vencidos, conservarlos para devolución/merma con historial. Aprobado FEFO como prioridad entre lotes válidos, con registro del realmente entregado. Pendientes: desempates, fecha/zona de corte, políticas por producto, excepciones a la prioridad y retornos. No se autorizó excepción de venta de vencidos. | D8, disponibilidad vendible y trazabilidad por lote. |
| N7 — parcial | Aprobados avisos de caducidad iniciales a 60, 30 y 7 días, configurables por familia; vista de lotes con sucursal/cantidad afectada y sin repetición del mismo aviso. Pendientes: canales/destinatarios, fechas de corte, rearmado y definición de baja rotación. | Alertas y recomendaciones verificables; no asumir ventas históricas ni avisos implementados. |
| N8 — parcial | Aprobado: sustituir edición directa de existencias por ajustes auditados con motivo, responsable, cantidad anterior y nueva; entradas de compras por recepción. Pendientes: saldos iniciales, transición de contratos y permisos específicos. | Integridad y auditoría sin cambios de stock inexplicables; no autoriza borrar datos. |

Fuera de alcance por defecto: conversión automática caja/pieza, cantidades fraccionarias, contabilidad general completa e integración bancaria.
Cualquier ampliación requiere decisión explícita; tener costos o datos bancarios actuales no aprueba esas capacidades.

## Decisiones de alcance: carriles paralelos y mercancía observada

- Prioridad elegida: catálogo y operación interna en paralelo, mediante entregas separadas y dependencias explícitas. No promete finalización simultánea ni habilita implementación antes de cerrar el alcance correspondiente.
- Costos: preparar ejemplos comparables y una recomendación para validar con el negocio; no adoptar promedio/FIFO ni reparto de flete por inferencia. FEFO para salida física no decide el método de valuación.
- Recepción con incidencia: separar y revisar mercancía dañada, vencida o distinta de la pedida. Registrar su presencia, cantidades, motivo y origen sin incorporarla automáticamente a stock vendible. Una existencia en revisión es distinta de una recepción aceptada/disponible.
- La revisión no habilita vender lotes vencidos. Resolución, devolución/baja y liberación de mercancía no vencida requieren acciones con permisos e historial; política exacta pendiente. El efecto sobre deuda al proveedor se concilia por separado.

## Decisión aprobada: permisos granulares con roles configurables

Reutilizar el modelo de autorización existente. El usuario crea y configura sus roles; todas las operaciones nuevas deben exponer permisos granulares asignables desde el editor actual. No codificar «dueño», «administrador» o «encargado» como condición de autorización ni introducir jerarquías o roles obligatorios.

Matriz funcional propuesta para derivar los identificadores técnicos con backend, sin aprobar nuevos flujos por el mero nombre del permiso:

| Área | Operaciones a separar en permisos |
| --- | --- |
| Proveedores | Consultar, crear, editar, archivar y gestionar condiciones comerciales. |
| Compras | Consultar, crear/editar borrador, confirmar y cancelar. |
| Recepciones | Consultar, registrar, confirmar y corregir/reversar cuando el estado lo permita. |
| Cuentas por pagar | Consultar obligaciones/saldos y registrar/corregir documentos según el contrato aprobado. |
| Pagos/anticipos | Consultar, registrar/aplicar, revertir y gestionar reembolsos/créditos cuando corresponda. |
| Cuentas y fondos | Consultar, crear/editar, archivar y operar movimientos explícitos. |
| Gastos | Consultar, registrar/editar borrador, confirmar/pagar y revertir. |
| Inventario | Consultar, registrar/confirmar ajustes, consultar auditoría y operar lotes. |
| Traslados | Consultar, solicitar/preparar, despachar, recibir y corregir diferencias. |
| Configuración | Gestionar alertas y condiciones; reutilizar permisos de precios cuando su alcance sea equivalente. |

La separación exacta se valida contra los verbos/sujetos existentes; no duplicar permisos equivalentes ni inventar endpoints a partir de esta tabla. Registrar una compra no concede por sí mismo recepción o pago; el usuario puede combinar esos permisos en un mismo rol.

Los permisos no eluden invariantes: aislamiento por ubicación/tenant, dueño/sesión de caja existentes, estado del documento, idempotencia, trazabilidad ni bloqueo de lotes vencidos. No introducir permisos para saltar reglas aprobadas. Verificar tanto interfaz como API; ocultar un botón no es autorización.

No se incorporan por inferencia límites monetarios, doble aprobación ni separación obligatoria de personas. Esta decisión resuelve cómo se asigna autoridad; no convierte autorizar una operación en un paso adicional de aprobación humana. El diseño técnico del catálogo de permisos y su cobertura se delega a los agentes, no a nombres de puestos definidos por el usuario.

## Decisión aprobada: alertas de caducidad configurables

Usar 60, 30 y 7 días antes del vencimiento como configuración inicial, ajustable por familia de producto. Mostrar una vista de lotes próximos a vencer con sucursal y cantidad afectada. Evitar repetir el mismo aviso; alcanzar un umbral distinto es un evento diferente, no una repetición del anterior.

El mecanismo de deduplicación, destinatarios, canales, fecha/zona horaria de evaluación, cambios de configuración y lotes que ingresan ya dentro de una ventana necesitan contrato detallado. No generar varias alertas retrospectivas por inferencia. Las alertas informan; no trasladan, venden ni dan de baja mercancía automáticamente.

Criterios de aceptación propuestos: umbrales por familia prevalecen sobre valores iniciales según configuración explícita; vista y aviso conservan lote/ubicación/cantidad correctos; repetir una evaluación sin cambios no reenvía el mismo aviso. Casos de frontera temporal se fijarán con la política de fecha aprobada.

## Decisión aprobada: ajustes auditados en lugar de edición directa

Reemplazar la edición directa de existencias por ajustes explícitos. Registrar motivo, responsable, fecha, ubicación, producto/variante y lote cuando corresponda, cantidad anterior, nueva y diferencia. Las entradas por compra se registran mediante recepción; diferencias de conteo, daños o pérdidas mediante ajuste con su motivo.

Mantener el historial y distinguir corrección de una operación de negocio real; no simular compras para justificar conteos ni contabilizar una recepción por segunda vez como ajuste. El detalle técnico de permisos y reversión queda pendiente. Cambiar inventario exige validación autoritativa; no basta sustituir un campo de la interfaz mientras APIs antiguas permiten cambios sin traza.

Criterios propuestos: el ajuste confirmado registra un único efecto y su evidencia; motivo vacío o actor no autorizado no alteran stock; un ajuste calculado sobre cantidades obsoletas no sobrescribe movimientos posteriores sin resolver el conflicto. La preparación de aperturas/migración requiere contrato propio, sin inventar compras históricas ni borrar datos.

## Decisión aprobada: precios de venta independientes del cambio de costo

Registrar cambios de costo de compra y mostrar su impacto en margen sin modificar automáticamente precios públicos, listas comerciales, escalas ni acuerdos particulares. Un cambio de precio de venta requiere una acción explícita de persona autorizada, con alcance visible y trazabilidad; no implica un segundo aprobador obligatorio, aún no definido.

La interfaz debe identificar qué costo usa para comparar y su fecha/origen. Registrar una compra más cara no define por sí mismo costo promedio, FIFO ni último costo como valuación del stock. Esas políticas, tratamiento de impuestos/flete/descuentos y alertas específicas siguen pendientes.

Criterio de aceptación: registrar una compra con costo distinto mantiene intactos los precios de venta y acuerdos; la consulta muestra la comparación de margen usando la referencia aprobada. Solo un comando autorizado de cambio de precio altera esos valores. No recalcular ventas históricas.

## Decisión aprobada: bloquear venta de lotes vencidos

Un lote vencido no se puede vender. Conservar registro, cantidades físicas y trazabilidad para gestionar devolución al proveedor o baja por merma autorizada; vencer no borra el lote ni descuenta existencias físicas automáticamente.

Distinguir stock físico de stock vendible. La validación autoritativa debe impedir confirmar una venta con unidades vencidas, no depender únicamente del selector visual. No permitir que otro canal eluda el bloqueo. Una venta rechazada no debe generar cobros ni movimientos parciales de stock.

FEFO queda aprobado como prioridad de elección entre lotes válidos. Quedan por acordar el corte exacto de vencimiento (fecha/zona horaria), manejo de fecha desconocida, desempates, excepciones a la prioridad y retornos. No se aprobó permitir ventas vencidas por rol, advertencia o confirmación manual.

## Decisión aprobada: prioridad FEFO

Al preparar una venta con lotes, proponer primero el lote válido con vencimiento más cercano (First Expired, First Out). Registrar siempre el lote efectivamente entregado, no atribuirlo automáticamente a la sugerencia si el operador retira otro.

Ejemplo: para la misma presentación y ubicación, con cantidades disponibles en lotes válidos que vencen en diciembre y marzo siguiente, priorizar diciembre. No mezclar variantes o sucursales para satisfacer la selección ni incluir lotes vencidos. No reservar ni descontar por mostrar una sugerencia; el momento del movimiento seguirá el contrato transaccional autorizado.

Desempates, cantidades repartidas entre lotes, fechas desconocidas y permisos/motivos para cambiar la sugerencia requieren detalle de contrato. Aprobar FEFO no autoriza vender vencidos ni inventar trazabilidad física.

## Reconocimiento de deuda: variabilidad confirmada y mecanismo propuesto

El usuario confirma que cambia según proveedor. Puede exigirse el total documentado antes de completar la entrega o únicamente lo recibido. No imponer una regla única ni equiparar automáticamente pedido, factura y recepción.

Propuesta de implementación funcional, no política fiscal ni esquema aprobado:

- Proveedor con condiciones predeterminadas: base para registrar la deuda (documento de cobro aceptado o recepción aceptada), modalidad/plazo de pago y referencia del acuerdo. Plazos concretos aún no definidos.
- Cada compra conserva las condiciones acordadas. Cambiar la configuración del proveedor no recalcula documentos históricos; una excepción requiere permiso y trazabilidad por definir.
- Pedido, mercancía recibida, importe reconocido, pagos/anticipos aplicados y saldo pendiente se muestran separados.
- Si la deuda se registra por recepción, la factura posterior se concilia con esa deuda y no crea otra. Si se registra por documento de cobro, la recepción posterior no vuelve a generar la obligación.
- Propuesta: confirmar explícitamente el documento/evento que reconoce deuda; no crear deuda por guardar un borrador ni por cambiar una lista desplegable.
- Ejemplo: pedido $10.000 y recibido $6.000; si se acepta cobro total, obligación $10.000 y mercancía restante por recibir; si se acuerda cobro por entrega, obligación $6.000 y pedido restante pendiente. Aplicar pagos aparte; no llamar deuda vencida al importe aún no reconocido.
- Conciliación de diferencias, fechas de vencimiento, cambios de condiciones y responsabilidad de aprobación siguen pendientes. No implementar interpretación contable/fiscal por inferencia.

## Decisión aprobada: anticipos a proveedores

Se permite entregar dinero al proveedor antes de recibir mercancía. Registrar proveedor, importe, fuente, fecha y vínculo con la compra cuando esté definido. El anticipo confirmado produce una sola salida de dinero y ningún incremento de inventario; su aplicación posterior a la compra consume el anticipo disponible, no produce otra salida.

Ejemplo conceptual: anticipo de $2.000 para una compra de $10.000; el anticipo no cambia stock. Al reconocer la obligación de $10.000 según la política todavía pendiente y aplicar esos $2.000, quedan $8.000 por liquidar. La recepción física se registra separadamente. Reintentar la misma operación no duplica el anticipo ni su aplicación. Se admiten reembolso efectivo y saldo a favor con el proveedor según la sección siguiente; autorización, saldos no aplicados, cancelaciones y reasignaciones todavía requieren reglas detalladas.

## Decisión aprobada: reembolso o saldo a favor del proveedor

Ante cancelación o devolución de una compra ya pagada, soportar ambas modalidades:

- Reembolso: mantener pendiente hasta confirmar que el dinero realmente se recibió; registrar importe, destino y vínculo documental. La promesa del proveedor no incrementa caja/cuenta.
- Saldo a favor con el proveedor: registrar crédito disponible para una compra posterior; no representa dinero disponible en caja o banco. Su aplicación consume ese crédito, sin nueva salida de dinero.

Separar el retorno físico de mercancía de la resolución financiera. Conservar el vínculo con compra, pago/anticipo y devolución/cancelación; impedir que el mismo importe se reintegre y se aplique como crédito por duplicado. Roles, evidencias, importes parciales y tratamiento de compras aún no pagadas siguen pendientes.

## Decisión aprobada: recepciones parciales

Una orden puede recibirse mediante varias entregas. Mantener cantidades pedidas, recibidas y pendientes por línea; cada recepción confirmada aporta solo sus cantidades aceptadas al inventario, una única vez. No registrar como existencia lo que sigue pendiente ni generar pagos implícitos al recibir.

Ejemplo de aceptación acordado: pedido de 10 cajas, recepción de 6 → recibidas 6, pendientes 4, incremento de stock 6; recepción posterior de 4 → recibidas 10, pendientes 0, incremento adicional 4. Los reintentos no duplican entradas. El ejemplo asume cajas como unidad vendible ya definida, no autoriza conversión caja/pieza.

## Decisión aprobada: fuentes de fondos configurables

El usuario aprobó este modelo conceptual; no autoriza todavía implementación ni resuelve los controles de saldo. La autoridad se asigna mediante permisos granulares en los roles configurables existentes, sin un flujo adicional de aprobación implícito.

No requiere conocer hoy los nombres de todas las cuentas. Configurar instancias con nombre, tipo operativo, responsable, alcance por ubicación y estado activo; no permitir que un texto libre determine efectos financieros.

| Tipo acordado | Tratamiento |
| --- | --- |
| Caja operativa | Vincular caja/sesión existente; usar su autoridad de saldo y comando, sin duplicar ledger. |
| Cuenta bancaria de la empresa | Registrar movimientos internos e importes; no implica integración bancaria ni saldo real sincronizado. |
| Fondo de efectivo / caja chica | Saldo y movimientos propios registrados; aperturas/reposiciones con origen documentado. |
| Pago de un tercero por cuenta de la empresa | Registrar quién pagó sin descontar una cuenta empresarial ficticia. Si es reembolsable, crear obligación distinta; si es aporte, documentarlo. Clasificación pendiente de política aprobada. |

- Nombres e instancias configurables por personal autorizado; los tipos con efectos operativos no son etiquetas arbitrarias.
- Fuente (de dónde sale) separada de método (efectivo/transferencia/etc.); validar combinaciones admitidas.
- Cada pago o abono identifica una fuente. Si una compra se paga con varias, registrar pagos separados vinculados a la misma deuda; no exigir un motor de pago dividido en una sola operación.
- Saldo inicial y movimientos deben tener procedencia; no inventar balances ni presentar saldo registrado como saldo bancario real.
- Cuentas bancarias de referencia de cobro existentes no se convierten automáticamente en cuentas financieras.
- Permisos granulares reutilizan roles configurables existentes. Detalle técnico de alcances, evidencia y política sobre saldo insuficiente siguen pendientes. No se aprueban límites monetarios ni doble aprobación por inferencia; preservar las restricciones de caja existentes.
- Archivar fuentes con historial, no borrarlas ni alterar retrospectivamente su tipo operativo. Correcciones con trazabilidad.
- Mantener el alcance en tesorería operativa; no agregar contabilidad general ni conexión a bancos por inferencia.

## Registro de respuestas comerciales

- Cuestionario de cierre inicial: prioridad → «Ambos en paralelo»; costos → «Proponer modelo y validarlo con el negocio»; mercancía dañada/vencida/distinta → «Separar y revisar antes de poner a la venta». No son aprobación de valuación ni de implementación.

- N4, corrección del usuario: «ese tipo de cosas deberian definirse solo con permisos hermano, como esta hecho todo el sistema, el usuario decide cuando crear roles y que permisos asignarle a esos roles, donde deben estar disponibles todos los permisos granulares para hacer operaciones sobre lo que mencionas, me sigues?» Adoptar el modelo existente; retirar como decisión de negocio pendiente la elección de puestos fijos autorizados.

- N7: ante avisos iniciales a 60, 30 y 7 días, configurables por familia, vista de lotes próximos a vencer con sucursal/cantidad y prevención de avisos repetidos, el usuario respondió «si hermano.» Configuración inicial aprobada.

- N8: ante reemplazar edición directa por ajustes con motivo, responsable, cantidad anterior y nueva, y registrar compras por recepción, el usuario respondió «si hermano, estoy de acuerdo.» Dirección aprobada; saldos iniciales y permisos concretos pendientes.

- N5: ante mantener precios de venta hasta un cambio aprobado, mostrando nuevo costo e impacto en margen sin modificar precios públicos/comerciales automáticamente, el usuario respondió «si hermano, de acuerdo». Regla aprobada; valuación de inventario y roles específicos pendientes.

- N6, FEFO: ante priorizar el lote válido que venza primero al preparar la venta, registrando el realmente entregado, el usuario respondió «si hermano.» Prioridad aprobada; no es autorización de implementación ni de excepciones al bloqueo de vencidos.

- N6: ante bloquear venta de lotes vencidos y conservarlos para devolución al proveedor o baja por merma sin borrar historial, el usuario respondió «si hermano.» Bloqueo aprobado; detalles de fecha y asignación pendientes.

- N2: ante si se debe al recibir mercancía o al aceptar factura/nota de cobro —con ejemplo pedido $10.000, recibido $6.000—, el usuario respondió «si hermano, cambia segun el proovedor.» Se confirma variabilidad, no un disparador global ni automatización concreta.

- N2/N3: ante «¿a los proveedores les pagan todo al momento, les compran a crédito para pagar después —incluso en abonos—, o manejan ambas formas?», el usuario respondió «ambas formas».
- Esa respuesta confirma contado y crédito con abonos; por sí sola no define anticipos, entregas parciales, plazos específicos, intereses ni momento de reconocimiento de deuda.
- N3, aprobación posterior: ante recibir 10 cajas en entregas de 6 y 4, registrar cada entrega y aumentar inventario solo con lo recibido, el usuario respondió «si hermano, hay que soportarlo.» Quedan aprobadas las recepciones parciales.
- N3, anticipos: ante soportar anticipos antes de recibir, registrar el dinero sin aumentar inventario y aplicarlo después a la compra, el usuario respondió «si hermano, estoy de acuerdo». Soporte de anticipos aprobado.
- N3, resolución financiera: ante incluir reembolso realmente recibido o saldo a favor con el proveedor para cancelación/devolución de compras pagadas, el usuario respondió «si hermano, ambas.» Se aprueban las dos modalidades, no las reglas pendientes de recepción/devolución física.
- N4, usuario: «puede salir de varias fuentes hermano.. sinceramente no tengo la informacion especifica de donde sale.. no se si vale la pena que lo hagamos de alguna forma tan robusto que se pueda de alguna forma asociar a lo que el usuario quiera.. o que propones?» Respuesta posterior a la propuesta de fuentes configurables con tipos controlados: «Si hermano, estoy de acuerdo». Modelo conceptual aprobado; detalles operativos señalados como pendientes se conservan abiertos.

## Checklist para retomar sin reconstruir contexto

- [ ] Leer estrategia D8/D9 y este plan; conservar separado confirmado/propuesto/pendiente.
- [ ] Registrar respuestas N1–N8 con ejemplos, responsable y decisión; no convertir silencio en aprobación.
- [ ] Acordar un alcance de implementación y sus límites; ejecutar sus unidades autorizadas sin pedir permiso en cada transición. Detenerse ante decisiones comerciales abiertas, cambios de alcance o acciones que requieran consentimiento específico.
- [ ] Revisar triage de ownership, autoridad de stock/caja y compatibilidad de edición directa con el agente backend principal.
- [ ] Acordar contrato y criterios observables; después implementar y validar de forma enfocada, con revisión independiente.
- [ ] Actualizar aquí estado, evidencia y siguiente unidad; preservar el carril catálogo/Buen Fin y lo no autorizado.

## Referencias y procedencia

- [Estrategia de catálogo, decisiones y solicitud original](catalog-product-strategy.md): autoridad de alcance, no permiso de implementación.
- Evidencia frontend aportada: `ProductDetailView.vue:1039` edita cantidad de variante; `:1085/:1108` crea/elimina lotes.
- Contrato aportado: `src/features/POS/cash-register/interfaces/cash.types.ts:262`, `CashMovementPayload`.
- Patrón frontend aportado: `useCashSessionCommands.ts:84–158`; se cita evidencia previa, no una nueva verificación.
- Reporte backend `5033cc11-d6da-496e-b9c7-750462e6a794`: mapa operativo y riesgo en `products.service.ts:1679–1718`.
- Reporte previo `c6fc3f05-879e-41bd-88a2-9af73be7bed4`: variantes/lotes, cantidades y modelo de producto.
- Los reportes son mensajes de coordinación, no archivos locales ni validaciones runtime; no prueban explotación ni corrección.
