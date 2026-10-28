# Primer contrato operativo: proveedores e integridad de inventario

**Estado: propuesta funcional para revisar; no lista para ejecutar ni capacidad implementada.**
Primero diseñar O3 (proveedores/órdenes) y O1 (historial/ajustes/apertura) en paralelo al brief de catálogo.
Después, O2 (lotes por variante) y O4 (recepciones parciales), solo con sus dependencias aceptadas.
La aprobación actual permite estos documentos, no código, esquemas, migraciones ni movimientos de stock/dinero.

## 1. Autoridad y lectura rápida

- [Plan operativo](procurement-inventory-plan.md): N1–N8, decisiones aprobadas y límites de evidencia.
- [Hoja de ruta](implementation-roadmap.md): T1, O1–O7 y puertas G0/G3–G7; una dependencia exige resultado aceptado.
- [Estrategia](catalog-product-strategy.md): D8/D9/D10/D17; compartir empresa no fusiona inventarios ni permisos.

Las respuestas específicas posteriores del plan precisan sus resúmenes iniciales: hay aprobaciones parciales, no cierre de P0.
La evidencia backend citada en esas fuentes es inspección estática reportada, no comprobación nueva ni prueba runtime.
Aquí no se audita código, accede a otros repositorios, corrige ownership ni presupone autoridad de stock o locks existentes.
Los nombres de campos/estados siguientes son conceptos propuestos, no tablas, contratos API ni identificadores de permisos.

## 2. Primera entrega, en palabras de negocio

La primera entrega propuesta permitiría organizar a quién se compra y qué se pide, sin confundir un pedido con mercancía recibida o dinero pagado.
En paralelo se prepararía una historia explicable de las existencias y sus correcciones, antes de conectar entradas nuevas.
Todavía no incluiría pagos, bancos, contabilidad completa, traslados ni reposición automática; tampoco prometería recibir mercancía hasta cerrar sus reglas.
Hoy se entrega únicamente el contrato para discutirlo, no esas funciones ni una fecha de disponibilidad.

## 3. Orden y dependencias por unidad

| Unidad | Propuesta acotada | Dependencia para habilitar efectos futuros |
| --- | --- | --- |
| O3 — primero, paralelo a O1 | Proveedores, condiciones y órdenes; intención de compra separada. | T1 aceptado, condiciones/documentos del alcance y permisos; no exige O1 ni finanzas terminadas. |
| O1 — primero, paralelo a O3 | Historial, ajustes auditados y propuesta de apertura. | T1; G3 resuelta y reversión aplicable acordada; apertura sin política aceptada no se confirma. |
| O2 — después de O1 | Lotes por variante cuando corresponda, conciliación y salida/retorno real. | O1/T1 aceptados, ownership demostrado y G4 aplicable cerrada. No reducir D8 por conveniencia. |
| O4 — después de las bases | Recepción parcial, cantidades aceptadas y mercancía en revisión. | O1/O3 aceptados y O2 para lotes; G4; G5 si reconoce deuda y G6 si incorpora valuación. |

G0 (autorización expresa de implementación) rige todas las unidades; ningún documento por sí mismo la satisface.
O3/O1 pueden diseñarse simultáneamente sin esperar todo el ERP ni el diseño visual del catálogo.
O4 no es independiente de toda decisión contable: debe acordar qué registra, qué no reconoce y cómo se conciliará después.
Un recorte de O4 sin lotes requeriría acuerdo explícito; no elimina lotes por variante del programa ni oculta presentaciones dependientes.
O5–O7 detallarán costos, CxP y tesorería; no son requisito global para diseñar O3/O1 ni permiso para inventar deuda en O4.

## 4. Actores, permisos y superficies propuestas

Un actor es una persona con permisos efectivos del sistema granular existente y alcance válido de tenant/ubicación.
El usuario configura roles y combina permisos en el editor actual; no se fijan puestos ni segunda aprobación obligatoria.

| Superficie futura | Acciones que se deben distinguir al acordar permisos |
| --- | --- |
| Proveedores y órdenes (O3) | Consultar, crear/editar, archivar proveedor, gestionar condiciones; editar borrador, confirmar/cancelar orden. |
| Historia y ajustes (O1) | Consultar auditoría; registrar/confirmar ajuste y corregir/reversar cuando proceda; apertura por contrato propio. |
| Lotes (O2) | Consultar/operar lotes y registrar asignación/salida/retorno según contrato, sin permiso para vender vencidos. |
| Recepciones (O4) | Consultar, registrar, confirmar y corregir/reversar; resolución de incidencias según política pendiente. |

Registrar compra no concede recibir ni pagar; un permiso genérico de editar producto no sustituye estas autorizaciones.
Propuesta de UX: mostrar pendientes, historial y motivo del bloqueo; una consulta autorizada puede ser de solo lectura si hay datos fiables y contrato de lectura aceptado.
Si falta integridad o contrato de mutación, no habilitar confirmar por tener una pantalla; sin datos verificables, mostrar estado bloqueado, no saldos inventados.
Toda superficie sigue siendo futura: ocultar botones no demuestra aislamiento ni autorización del servidor.

## 5. Datos conceptuales mínimos para discutir

| Unidad / concepto | Información necesaria propuesta, sin esquema físico |
| --- | --- |
| Común | Referencia estable, actor/fecha, tenant/ubicación, estado, origen documental e intento recuperable. |
| O3 — proveedor | Identificación comercial, estado activo/archivado, condiciones/plazos acordados y referencias pertinentes. |
| O3 — orden | Proveedor; producto o variante, unidad vendible, cantidad pedida y costo informado; condiciones conservadas por compra. |
| O1 — ajuste | Identidad vendible, ubicación/lote aplicable, motivo, anterior/nueva/diferencia, responsable y vínculo de corrección. |
| O1 — apertura | Saldo propuesto, fecha de corte y procedencia/evidencia; diferencias a conciliar y responsable, sin compra histórica ficticia. |
| O2 — lote | Identidad producto/variante, ubicación, referencia de lote, caducidad, cantidades físicas/vendibles y trazas de origen/salida/retorno. |
| O4 — recepción | Orden/origen, entrega, cantidades aceptadas/en revisión/rechazadas y pendientes por línea; lote/caducidad aplicables e incidencia. |

Costo informado no equivale a costo valuado; pedido, recibido, obligación reconocida, anticipos/pagos y pendiente se distinguen.
Las condiciones predeterminadas del proveedor y su conservación por compra son mecanismo propuesto: cambiar un proveedor no debe recalcular historia.
Usar unidades vendibles definidas; no inferir fracciones ni conversión caja/pieza. D17 comparte diccionario, no stock/precios/clientes.
D10 mantiene traslados internos de la misma empresa fuera de este corte; no crear compraventa ni CxP entre sucursales.

## 6. Matriz conceptual de estados y efectos

Cada efecto futuro necesita acción autorizada y validación del servidor; no se propone secuencia de escrituras independientes desde UI.

| Acción / estado propuesto | Inventario | Dinero / deuda y otros límites |
| --- | --- | --- |
| O3: guardar proveedor, condiciones u orden borrador | Sin efecto. | Sin pago ni obligación; condiciones no son reconocimiento. |
| O3: confirmar orden / cancelar orden sin efectos | Sin cambio de existencias ni apartado; solo compromiso de compra o su cancelación. | Sin pago ni CxP automática; preservar historia. |
| O1: preparar ajuste o apertura | Sin efecto. | Sin compra, pago ni deuda ficticios. |
| O1: confirmar ajuste | Un delta auditado; no sobrescribir movimientos posteriores. | Costo/reversión según contrato aplicable; nunca reprecificar venta. |
| O1: confirmar apertura, si se acepta su contrato | Saldo de origen conciliado, sin sumar de nuevo stock previo. | No inventar proveedor, pago ni compra histórica. |
| O2: sugerir FEFO / registrar lote entregado | Sugerencia no reserva/descuenta; salida solo por operación autorizada. | FEFO físico no elige método de valuación. |
| O4: capturar entrega / separar incidencia | Captura sin entrada aceptada; presencia en revisión distinta de disponible. | Sin pago; presencia física no resuelve deuda. |
| O4: confirmar recepción parcial/final | Una entrada solo por cantidades aceptadas; actualizar pendiente sin duplicar. | No pagar; reconocer deuda únicamente si G5 y el contrato lo permiten. |
| Operación rechazada o intento incompatible | Sin cambios en cantidades ni contadores de negocio. | Sin cambios en saldos, documentos aplicados o precios. |
| Operación aplicada → corrección/reversión válida | Compensación enlazada, nunca borrado ni segunda reversión. | Respetar consumo posterior y contrato financiero; no prometer reversión siempre. |

Ejemplo aprobado: 10 cajas pedidas, 6 recibidas y aceptadas → recibidas 6, pendientes 4, entrada +6.
Luego aceptar 4 → recibidas 10, pendientes 0, entrada adicional +4; reintentar cualquiera no suma otra entrada.
Caja es aquí la unidad vendible ya definida; el ejemplo no autoriza conversión a piezas.
Mercancía dañada, vencida o distinta se separa con cantidad/motivo/origen para revisión antes de estar disponible.
No descontar automáticamente la revisión del pendiente aceptable: resolución física/documental y sobreentregas dependen de G4.
Vencido nunca se libera para venta; conservar físico e historial para devolución/merma autorizada, no baja automática.

## 7. Límites que no deben perderse al recortar

- **Recibir ≠ pagar ≠ reconocer deuda.** Contado/crédito con abonos y exigibilidad variable por proveedor están confirmados; no hay disparador global aprobado.
- Si se reconoce por recepción, el documento posterior concilia sin duplicar; si se reconoce por documento, recibir no vuelve a generar deuda. Mecanismo concreto: G5.
- Anticipos aprobados: una salida antes de recibir, sin stock; aplicación consume saldo sin otra salida. Fuente/importe/fecha/proveedor y vínculo cuando esté definido.
- Cancelación/devolución pagada admite reembolso o saldo a favor del proveedor. Promesa de reembolso no aumenta caja; solo dinero recibido confirmado lo hace.
- Crédito proveedor no es dinero en banco/caja; aplicarlo consume crédito sin nueva salida. Conservar vínculos e impedir reintegrar y aplicar el mismo importe dos veces.
- Estos comportamientos aprobados delimitan compatibilidad futura; no obligan a implementar toda tesorería en O3/O1. Fuentes, pagos/crédito y reglas detalladas van después.
- Un costo nuevo no modifica precios públicos, listas, escalas ni acuerdos. Referencia de margen, impuestos/flete/descuentos y valuación requieren G6; FEFO no decide FIFO/promedio.
- FEFO prioriza el lote válido que vence antes; registrar siempre el realmente entregado. No mezclar variantes/ubicaciones ni inventar trazabilidad desde la sugerencia.
- Bloqueo de venta de vencidos aprobado sin excepción por rol. Corte/zona, fecha desconocida, desempates, reparto entre lotes y retornos siguen pendientes.
- Edición directa debe sustituirse por ajustes auditados; cerrar bypass antiguos exige compatibilidad aceptada, no solo retirar un campo de pantalla.

## 8. Puertas abiertas: bloquear la acción afectada, no todo el programa

| Puerta | Pendiente concreto y alcance bloqueado |
| --- | --- |
| G3 | Autoridad de stock, apertura/procedencia, compatibilidad y cierre de bypass; verificar pertenencia padre/lote. Bloquea efectos O1 y extensión O2/O4 dependiente. |
| G4 | Corte/zona, fecha desconocida, desempates/reparto FEFO, retornos, incidencias y sobreentregas. Bloquea operaciones temporales, liberaciones y recepciones afectadas. |
| G5 | Evento de reconocimiento por compra, conciliación, plazos, correcciones, anticipos/créditos y cancelaciones. Bloquea CxP/aplicaciones y recepción que los necesite. |
| G6 | Valuación, referencia de margen, flete, impuestos, descuentos y costos posteriores. Bloquea valuación persistida y comparaciones dependientes; no obliga a reprecificar. |
| G7 | Saldos iniciales/procedencia, insuficiencia, fuente/método, terceros y reversión. Bloquea pagos/gastos/movimientos afectados; no intención O3. |

El reporte estático previo de posible falta de ownership en actualización/eliminación de lotes exige triage/verificación antes de extender; aquí no se corrige ni se da por resuelto.
No asumir conciliación lote↔padre, exclusión concurrente ni autoridad de disponibilidad compartida ya demostradas; O1 no certifica por sí solo reservas de checkout.

## 9. Escenarios de aceptación futuros — no ejecutados

- [ ] O3: guardar/confirmar orden conserva stock, dinero y deuda; cambiar condiciones del proveedor no reescribe compras anteriores.
- [ ] O1: ajuste con motivo deja anterior/nuevo/delta y un efecto; motivo vacío o base obsoleta se rechaza sin pisar una venta posterior.
- [ ] O1: apertura conserva procedencia y concilia saldo previo sin duplicarlo, borrar historia ni inventar compras; depende de política aprobada.
- [ ] O2: variante/lote/ubicación concilian; FEFO sugiere el válido próximo, salida registra el real y retorno/cancelación conserva vínculo original.
- [ ] O2: vencido no se vende en ningún canal; rechazo no cobra ni descuenta parcialmente. Fronteras temporales se fijarán al cerrar G4.
- [ ] O4: caso 10/6/4 y segunda entrega concilian; dañadas/distintas/vencidas permanecen separadas, sin disponibilidad automática.
- [ ] O1/O4: retry del mismo intento devuelve resultado previo sin doble delta/lote/documento; payload incompatible y concurrencia no sobre-reciben ni pierden stock.
- [ ] Todas: falta de permiso o referencia cruzada tenant/padre/lote/ubicación deniega sin filtración ni efectos de negocio parciales; comprobar UI y servidor.
- [ ] Todas: cambio de actor/sesión no reutiliza intento; éxito con refresco fallido conserva resultado aplicado y recupera lectura sin repetir escritura.
- [ ] Corrección: conserva original/motivo/actor; segunda reversión o corrección inválida deja saldos y efectos intactos.
- [ ] Fronteras O4/O6/O7: recepción/documento no duplican deuda; anticipo/crédito aplicado no duplica salida y reembolso prometido no aumenta fondos.
- [ ] Costos: entrada más cara conserva precios/acuerdos; comparación de margen solo usa referencia aprobada, sin recalcular ventas históricas.

## 10. Siguiente paso de revisión

Validar primero límites y campos de O3/O1, con ejemplos de apertura y corrección; registrar decisiones G3–G7 por unidad, sin cerrar P0 globalmente.
Después acordar T1 con el agente backend principal por coordinación del orquestador, no mediante acceso cruzado desde este documento.
Pedir autorización de implementación por alcance solo cuando sus dependencias y validaciones futuras estén acordadas; este contrato no la solicita ni la sustituye.
