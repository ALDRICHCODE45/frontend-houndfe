# Pago web: límites de pedido, intento y reserva

**Estado: propuesta documental; no contrato final ni autorización de implementación.**
Consolidar D25–D37 sin confundir cotización, cobro, inventario y despacho. No define API, esquema, pasarela ni política contable.
Evidencia actual: informe backend `90960d78-9c30-4c2c-8d4a-e762028e4b92`, estático y acotado; no acredita despliegue, PSP activo ni reserva temporal existente. Ver §1.1.

## 1. Fuentes y autoridad

- [Estrategia y decisiones D13–D37](catalog-product-strategy.md): fuente comercial aprobada; las propuestas e historia no tienen esa autoridad.
- [Descubrimiento de checkout/logística](checkout-logistics-discovery.md): evidencia estática reportada, antecedentes del bot y recorrido provisional; no prueba de operación web.
- [Hoja de ruta](implementation-roadmap.md): T1/C4, G0/G2/G3 y liberación por alcance; este documento no cierra esas puertas.
- D13 mantiene precios, stock y restricciones fuera del borrador descriptivo. D18/D19 rigen precios válidos; D20–D22, privacidad; D23/D24, cobertura y apoyo logístico.

**Precedencia:** D25/D29 aprueban prepago y reserva al iniciar pago; reemplazan la indefinición histórica, no autorizan implementación. Los antecedentes de saldo en puerta del bot no aplican a web. No se cambian políticas comerciales de bot/POS; una reserva correcta puede necesitar cambios técnicos en sus escritores de inventario compartido, cuyo alcance debe acordarse explícitamente antes de implementar.

### 1.1. Evidencia backend y brechas comprobadas

Informe `90960d78-9c30-4c2c-8d4a-e762028e4b92`: código inspeccionado por explorador; agente principal contrastó `src/sales/sales.service.ts:3779–3864`. Sin DB/API/red/proveedores/tests/mutaciones. Rutas de este apartado pertenecen al backend y frontend no las leyó directamente.

| Superficie | Evidencia reportada | Consecuencia para web |
| --- | --- | --- |
| PSP | Búsqueda acotada EVO/webhook/callback/Stripe/Conekta/Openpay/Mercado no localizó adapter, webhook o firma; `package.json:26–58` sin SDK reconocible no excluye HTTP custom. Fixture Mercado Pago no es integración. | No elegir proveedor ni afirmar cobro online existente. |
| Confirmación bot | `src/sales/sales.service.ts:3779–3864`: paidCents=0, deuda total, CREDIT/ONLINE, entrega PENDING y descuento inmediato de stock. | No invocar este comando tal cual al iniciar pago web: incumple D25/D29. |
| Cobro POS | `src/sales/sales.service.ts:2827–3248`: lock de draft, revalidación, capacidad promocional, stock, pagos y eventos transaccionales. `:372–413` canonicaliza método/monto. | Reutilización a evaluar; registrar tender/método no prueba captura PSP. |
| Checkout del bot | `src/chatbot-api/presentation/checkout.controller.ts:114–150`: service-auth, scopes customers:write/sales:create y clave idempotente. | No exponer credencial de servicio al navegador. |
| Idempotencia/contexto | `application/checkout.service.ts:51–108,147–202,331–365`: hash de cliente/dirección/versión/ítems/expectedTotal/envío, tenant+operación+clave; conflicto por payload y estado in-flight. `:211–311` serializa teléfono entre esos writers, lock de cliente/dirección; no cubre todos los writers. Ruta parcial reportada. | succeeded/not_observed son estados de operación, NO pago. Contratos pueden inspirar web, no sustituyen auth cliente. |
| Stock | `prisma-product.repository.ts:285–421`: transacción ambiente y decremento condicional producto/variante; `:495–568` restaura. Ruta parcial reportada. Lotes: agregado sin FEFO en ese método; sincronización global no verificada. | No se estableció reserva temporal de mercancía; respetar fuente de disponibilidad compartida y modalidad de stock. |
| Cancelación/reembolso | `src/sales/sales.service.ts:3251–3393` cancela/restaura stock y crea obligaciones de reembolso; `:1622–1784` registra liquidación. | refundedCents/registro local no prueban devolución externa PSP. |
| Comprobante | `receipt-review.service.ts:87–139,171–195` confirma vía revisión STAFF/addPayment/outbox; `:142–168` rechaza sin pago. Ruta parcial reportada. | No es verificación bancaria automática ni callback PSP; consumidores/dedup no verificados. |

Resolver rutas parciales antes de usarlas como referencia ejecutable. No se inspeccionaron exhaustivamente PSP, todos los escritores de stock, sincronización de lotes, autenticación cliente ni consumidores de callbacks.

**Alcance técnico compartido pendiente de acuerdo:** restar al reservar y volver a restar al confirmar duplica descuento; ignorar reservas en POS/bot permite sobreventa; cancelar venta y liberar reserva sin coordinación duplica restitución. Diseñar una sola invariante de disponibilidad/asignación/liberación para todos los escritores afectados. No es cambiar precios/crédito de esos canales, pero sí requiere declarar y acordar esas superficies antes de implementar. No prometer aislamiento de una reserva solo web sobre stock compartido.

## 2. Reglas aprobadas que el contrato debe preservar

| Fuente | Regla aprobada | Límite |
| --- | --- | --- |
| D25 | Prepago íntegro de mercancía y envío confirmado, tanto reparto propio como paquetería. | Sin saldo en puerta ni crédito por cuenta verificada, mayoreo o acuerdo. Comprobante/retorno web no acreditan pago. |
| D26 | Zona desconocida, recargo pendiente o tarifa no disponible permiten solicitar cotización; equipo resuelve y cliente revisa total actualizado. | Solicitud/resolución/aviso no cobran, reservan, congelan valores ni prometen envío; no obligan a seguir en el bot. |
| D27/D22 | Cotizar o pagar exige correo verificado; registro breve conserva carrito. Datos/condiciones privados requieren además vínculo comercial autorizado. | Correo verificado no concede cuenta comercial ajena; explorar y armar carrito sigue abierto. |
| D28 | Restricción vigente con coincidencia confirmada bloquea cotización/pago; dudosa exige revisión antes de continuar. | Sin cobro ni rechazo automático por parecido; cobertura no es bloqueo. Gestión autorizada y trazable; mensaje neutral sin notas internas. |
| D29 | Revalidar y reservar temporalmente stock disponible de forma atómica solo al iniciar pago; insuficiencia se informa antes de cobro. | Carrito/cotización no reservan; no comprometer dos veces la última unidad. D34: objetivo de 15 minutos para tarjeta, sujeto a cierre seguro verificado. |
| D29 | Pago confirmado convierte reserva en asignación una vez; fallo/cancelación/vencimiento confirmados liberan una vez según estado autoritativo. | Cerrar pestaña/error de red no liberan. Pago tardío exige reconciliación sin prometer stock automáticamente. |

## 3. Estados ortogonales propuestos, no enumeraciones finales

Separar dimensiones evita que «pedido confirmado» signifique indistintamente aceptar resumen, cobrar o despachar.
Los nombres siguientes son conceptuales, no campos, tablas, endpoints ni nuevos módulos aprobados.

| Dimensión | Estados conceptuales propuestos | Lo que no demuestra |
| --- | --- | --- |
| Cotización | Pendiente de resolución, disponible con revisión/vigencia, no disponible o vencida. | Resolverla no cobra, reserva ni congela precio/stock. |
| Intención de checkout/pedido | En elaboración del resumen, requiere revisión/aceptación, aceptada para iniciar pago, pendiente de completar pedido. | Aceptar resumen o crear intención no acredita pago ni asignación. |
| Intento de pago | Preparado, en curso, resultado desconocido/pendiente, confirmado, fallo o cancelación confirmados. | Pendiente/desconocido no es fallido; vencer una ventana no prueba impago. |
| Reserva | No creada, activa, asignada, liberada por causa confirmada o en reconciliación. | Su vencimiento no revoca un cobro ni concede stock a un pago tardío. |
| Cumplimiento/entrega | No habilitado, pendiente de preparación, preparación iniciada D33, preparado o despachado, según contrato futuro. | Pago confirmado es necesario, no autorización automática de despacho sin pedido/asignación y controles vigentes. |
| Reembolso | Solicitado, pendiente, confirmado o fallido; nombres conceptuales, no estados finales de implementación. | D31/D32 delimitan los casos aprobados y el importe íntegro; solicitar devolución no demuestra acreditación ni aprueba cualquier otro caso. |

Puede existir pago confirmado con pedido/asignación aún pendientes de recuperación. Mostrar ambas realidades, sin negar el cobro ni prometer entrega.
La autoridad sobre disponible/reservado/asignado y su relación con venta/descuento físico o contable debe verificarse con backend; no se crea un segundo saldo de stock ni de dinero.

## 4. Evaluación y aceptación previas al pago — propuesta técnica

**D37 aprobado:** cotización resuelta muestra total y fecha/hora de vencimiento respaldados por vigencia de tarifa, no un TTL comercial inventado. Conservar solicitud vencida y carrito con «Actualizar cotización»; renovar revalida precio, disponibilidad y envío, sin cobrar/reservar ni extender un intento de pago anterior. Si hay cambios, obtener aceptación del resumen actualizado; si no puede renovarse automáticamente, volver a revisión del equipo. Mantener D34: total sostenible durante toda la ventana de 15 minutos antes de iniciar pago.

1. Servidor revalida identidad verificada, vínculo/permisos vigentes, restricciones, dirección, cobertura, precio elegible, envío y disponibilidad.
2. Servidor evalúa importe y moneda, ítems/vendibles/cantidades, cliente y ámbito operativo autorizado, dirección y revisiones de dirección/cotización/checkout; vincula esa evaluación al intento y a la aceptación del cliente.
3. Incluir envío confirmado y apoyo D24 sobre precio final D18, sin duplicarlo ni convertir remanente en saldo; impuestos/redondeo comparables requieren contrato.
4. Todo cambio previo al pago que altere la evaluación invalida la aceptación afectada: mostrar nueva revisión/total y obtener aceptación antes de iniciar cobro; nunca cobrar silenciosamente el nuevo importe.
5. Solo al iniciar pago, efectuar reserva atómica condicionada a disponibilidad vigente. Una lectura anterior de stock no garantiza unidades; si falla, no iniciar cobro.
6. Si cambia sesión, cliente o autorización, no reutilizar el intento privado anterior ni su evaluación; revalidar contexto sin revelar datos ajenos.

El navegador expresa intención, no fija importe/moneda ni autoridad de stock. El contrato futuro debe precisar cómo conserva la aceptación sin congelar la operación D13/D26.

## 5. Confirmación, concurrencia y recuperación — propuesta técnica

- Confirmar mediante evento de proveedor con firma verificada en servidor y validación de procedencia, intento, ámbito, importe y moneda esperados; un redirect, comprobante o estado enviado por frontend no basta.
- Proponer idempotencia para comandos y eventos, ligada a actor/ámbito y contenido: misma clave con contenido incompatible se rechaza sin efectos; repetición válida recupera resultado existente.
- Transiciones condicionales y tolerantes a eventos duplicados/desordenados: confirmación repetida no duplica venta/asignación; liberación repetida no aumenta disponible dos veces; evento antiguo no degrada pago confirmado.
- Reserva y PSP externo no comparten una transacción universal. Proponer intención de pasos duradera y recuperable, con transiciones condicionadas; mecanismo concreto pendiente de evidencia, sin imponer patrón de implementación.
- Si crear un intento PSP pierde su respuesta, recuperar y reconciliar **ese mismo intento** antes de permitir otro cobro; no asumir que falló por timeout ni crear otro a ciegas.
- Resultado PSP pendiente/desconocido conserva incertidumbre y exige consulta/reconciliación autoritativa futura; navegador no ordena nuevo cobro ni liberación por desconexión.
- Separar vencimiento de reserva de resultado de pago. Liberar solo por transición autoritativa compatible; el vencimiento local no prueba que PSP no haya cobrado.
- Carrera vencimiento/confirmación: una transición coherente de reserva, sin doble asignación/liberación; pago confirmado sin reserva utilizable pasa a reconciliación, no a despacho ni promesa automática de stock.
- Pago confirmado con fallo posterior al completar pedido/asignación queda recuperablemente pendiente: retomar el efecto faltante sin nuevo cobro ni ocultar el pago existente.
- Doble cobro confirmado requiere reconciliar hechos reales; no inventar un balance compensatorio, crédito, reembolso ni nueva reserva como solución aprobada.

### D34: ventana de apartado condicionada a validación

Objetivo aprobado: 15 minutos desde inicio del pago; conservar un vencimiento autoritativo sin reiniciarlo al recargar. Asegurar mercancía y total de envío por toda la ventana antes de empezar; renovar cotización insuficiente y obtener aceptación del total actualizado antes del cobro. No extender reservas al consultar estado.

Cerrar el intento para nuevos pagos y liberar de forma coordinada al vencer según estado autoritativo, sin tratar un contador o timeout como prueba de impago. Recuperar cobro desconocido antes de permitir otro; confirmación tardía sigue D31/D32. Stripe tiene mínimo de 30 minutos para vencimiento programado: 15 exige cierre explícito y prueba de carreras/fallos, no bloquear solo la pantalla. Un cierre fallido no acredita cierre efectivo. Si el objetivo no es seguro, presentar evidencia y alternativa al usuario, sin fallback comercial silencioso.

### D31: salida comercial aprobada para pago tardío y cancelación

Pago confirmado tras vencer reserva: intentar asegurar nuevamente el pedido completo al total aceptado, sin desplazar reservas de otros. Si no hay stock o no se puede cumplir ese total, resolución y reembolso; sin sustituciones ni cobros adicionales automáticos. Revalidar restricciones/autorización vigentes; no resucitar un pedido cancelado por un evento tardío.

Cancelación solicitada por cliente: automática antes de iniciar preparación; después revisión del equipo. D33 define inicio mediante «Iniciar preparación» por personal autorizado al reunir realmente la mercancía, con actor y fecha/hora; ni pago ni lectura del pedido lo activan. Serializar esa decisión con el inicio de preparación para que ambos no ganen la misma carrera. Cancelar pedido, liberar/asignar inventario y solicitar/confirmar reembolso son transiciones distintas, cada una idempotente. Reembolso pendiente hasta resultado autoritativo del proveedor; no dar por devuelto un pago por registrar la obligación local.

D32 aprueba devolver todo lo efectivamente cobrado, incluido el envío, al medio original y sin descuento de comisión, en cancelación antes de preparación o pago tardío cuyo pedido no pueda cumplirse. HoundFe absorbe comisiones no reintegradas; no sustituir devolución por saldo a favor. No fija fecha de acreditación bancaria ni generaliza a devoluciones después de preparación u otros incidentes. D31/D32 no eligen proveedor. Un pago desconocido no habilita nuevo cobro; un pago fallido confirmado permite nuevo intento tras revalidar. Las devoluciones aquí descritas son diseño, no acciones ejecutadas.

## 6. Privacidad y consultas de estado — propuesta técnica

- En **cada** consulta/recuperación de cotización, intención, intento, reserva o pedido, servidor comprueba sesión, pertenencia del cliente y ámbito autorizado vigentes; conocer un identificador no autoriza acceso.
- Cambio/revocación de sesión no conserva acceso privado por caché, URL o intento anterior. Un aviso para retomar no concede vínculo comercial ni revela direcciones/acuerdos ajenos.
- No usar credenciales de servicio del bot ni secretos de PSP en navegador. Mensajes de restricción neutrales; sin motivos internos ni datos de otro cliente.

## 7. Aceptación futura acotada — casos no ejecutados

| Caso | Resultado exigido para validar el contrato futuro |
| --- | --- |
| Ventana D34 | 15 minutos desde inicio de pago; recarga no extiende. Cotización insuficiente se renueva antes del cobro con aceptación; cierre fallido no se declara exitoso. Vencimiento/confirmación no duplican efectos ni permiten recobro ciego. |
| Cotización vencida D37 | Solicitud y carrito se conservan; actualizar revalida sin cobro/reserva y exige aceptación si cambia. Sin renovación automática posible, revisión humana. Fecha/hora de vencimiento visible y respaldada; no iniciar pago si total no cubre ventana D34. |
| Dos compradores por última unidad | Solo uno obtiene reserva utilizable; el otro no inicia cobro por esa unidad. |
| Stock insuficiente al iniciar pago | Informar antes del cobro; no iniciar cobro ni prometer unidades inexistentes. |
| Misma clave idempotente, payload distinto | Rechazo sin nuevo cobro, reserva ni otros efectos. |
| Evento confirmado duplicado/desordenado | Una venta/asignación; evento anterior no revierte confirmación; liberación repetida no duplica disponible. |
| Vencimiento frente a confirmación y pago tardío | Resolver carrera sin doble efecto; D31 recupera pedido completo al total aceptado si puede asegurarse sin afectar reservas ajenas; en caso contrario resolución/reembolso, sin sustitución o cargo extra automático. |
| Cancelación frente a inicio de preparación | Cancelación automática solo si gana antes de preparación; después revisión. No doble restitución ni reembolso duplicado; evento tardío no reactiva pedido cancelado. |
| Inicio de preparación D33 | Pago o lectura no cambian preparación ni corte de cancelación. Acción autorizada registra responsable/momento una vez; intento sin permiso o sobre pedido cancelado no inicia preparación. |
| Reembolso solicitado, pendiente o fallido | Mostrar estado real; solicitud o asiento local no equivalen a devolución confirmada. Recuperar seguimiento sin duplicar devolución. |
| Reembolso D32 | En los dos casos aprobados, devolver mercancía y envío efectivamente cobrados al medio original, sin descontar comisión ni crear saldo a favor. No duplicar ni superar lo cobrado; no generalizar a otros casos. |
| PSP desconocido o respuesta de creación perdida | Recuperar mismo intento; no cobrar otra vez ni liberar por navegador/timeout. |
| UNKNOWN, recargo pendiente o cotización ausente | Solicitud sin cobro/reserva; resolución exige revisión del total, no cobra por sí sola. |
| Cambio de sesión/cliente o consulta ajena | No reutilizar intento privado ni filtrar estado, dirección o condiciones ajenas. |
| Evento con importe o moneda divergentes | No aceptar como pago válido del checkout; reconciliar discrepancia sin efectos ficticios. |
| Pago confirmado y fallo al completar pedido/asignación | Estado pendiente recuperable visible; no nuevo cobro ni promesa de entrega sin resolver asignación. |
| Revisión previa cambia precio/dirección/cotización | Nueva evaluación y aceptación del total antes del pago; no cobrar el importe cambiado silenciosamente. |
| Carrito/cotización, pestaña cerrada y liberación repetida | Primeros no reservan; cerrar no libera; causa autoritativa confirmada libera una vez. |

## 8. Pendientes reales y siguiente paso

**Situación comercial confirmada:** el usuario no tiene pasarela contratada; Link EVO es candidato, no elección. La [comparación de proveedores para México](payment-provider-comparison.md) recomienda condicionalmente Stripe Checkout como primer candidato técnico, Mercado Pago como alternativa y EVO sujeto a producto/contrato exactos. No se crea cuenta ni se autoriza implementación por investigar.

**Alcance inicial D30:** web solo tarjetas; Link EVO candidato a evaluación posterior del chatbot, sin integración ni proveedor seleccionados. No habilitar SPEI/OXXO ni MSI por inferencia; tarjetas aún pueden quedar pendientes o requerir autenticación adicional.

**Decisiones de negocio:** proveedor/pasarela y condiciones de tarjeta; validación de la ventana de 15 minutos D34; mecanismo y plazos de seguimiento/acreditación del reembolso. D32 ya define importe íntegro y comisión a cargo de HoundFe en sus dos casos; condiciones económicas del proveedor aún por confirmar. D31 ya resuelve recuperación de pagos tardíos y corte de cancelación; no reabrir esas reglas. No se proponen duraciones ni SLA arbitrarios. Coordinar reserva con vencimiento real del checkout y vigencia restante de cotización; el mínimo temporizado de Stripe Checkout (30 minutos) no decide automáticamente cuánto reservar.
**Comprobaciones técnicas:** informe backend recibido en §1.1; faltan diseño y pruebas de integración con autoridad de stock compartida, eventos PSP, idempotencia, concurrencia y recuperación. Declarar superficies de POS/bot que deban respetar reservas y acordar ese alcance antes de implementación, sin reabrir sus políticas comerciales.
La dependencia es un inventario autoritativo capaz de sostener D29 y sus garantías, no terminar todo el despliegue de finanzas O6–O9. No asumir que O1/backend actuales ya lo cumplen.
Siguiente corte propuesto: confirmar proveedor y condiciones de tarjetas D30, validar ventana D34 y operación de reembolso bajo D31/D32, definir autoridad compartida de reserva y adaptar contrato web separado del checkout bot a crédito. Después convertir los casos de §7 en pruebas autorizadas; no implementar ni reabrir D25–D29 en este trabajo documental.

**Límites de esta entrega:** documentación pasiva; casos de aceptación sin ejecutar. Sin código, esquema, migraciones, pruebas de aplicación, DB/API/red/proveedores, credenciales, movimientos de stock/dinero ni commits.
