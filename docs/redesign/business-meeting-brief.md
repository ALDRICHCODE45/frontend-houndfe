# HoundFe — decisiones de negocio para la junta

**Documento central para conversar con los clientes.** Actualizado con las decisiones hasta D39.
**Estado: alcance acordado y capacidades previstas, no demostración de funciones disponibles.** No hay fecha de lanzamiento comprometida ni pasarela contratada. La disponibilidad real deberá verificarse antes de anunciarla.

## 1. Mensaje principal para presentar

> Estamos definiendo una experiencia profesional para comprar productos para mascotas y animales, tanto al menudeo como al mayoreo. El catálogo ayudará a encontrar la presentación adecuada y mostrará el mejor precio que corresponda a cada cliente. La web comenzará con pago completo con tarjeta, envío confirmado y reglas claras de cancelación. En paralelo, se planifica mejorar compras, proveedores e inventario para controlar lo recibido, lo disponible, lo que se debe y lo que se paga.

**Cómo leer este resumen:** «Acordado» significa que la regla de negocio ya fue aceptada para el diseño. «Propuesto» necesita validación. «Pendiente» no debe presentarse como promesa. Ninguna de esas etiquetas significa que la función ya esté implementada.

### Qué haremos primero — prioridad acordada D38

1. **Ahora, dos frentes en paralelo:** preparar diseño de catálogo/administración y concretar el primer alcance de proveedores, órdenes y control de inventario. Son entregables de planificación, no funciones construidas.
2. **Primeras piezas comerciales:** catálogo, detalle y edición con borradores/publicación, aplicando reglas de precios públicos y particulares. Compra y cuenta están en el alcance general, no se construye todo a la vez.
3. **Primeras piezas operativas:** proveedores/órdenes e historial/ajustes; después lotes por presentación y recepciones parciales con sus reglas resueltas. Una orden no recibe mercancía ni paga al proveedor.
4. **Compra web:** identificación, cotización, tarjeta y apartados cuando existencias compartidas y pasarela estén validadas. No espera terminar todo finanzas.
5. **Completar por dependencias:** pagos/saldos de proveedores, anticipos, gastos y fuentes; traslados y sugerencias de reposición. Sus reglas aprobadas se mantienen aunque no todo entre en el primer corte.

Los datos logísticos se reúnen en paralelo para la junta. Dirección visual general aprobada D39; falta revisar la propuesta concreta y autorizar implementación; no hay fecha comprometida. No se agregan favoritos, reseñas, puntos, suscripciones o nuevas funciones promocionales.

## 2. Catálogo y administración — acordado

- Atender minoristas y mayoristas con la misma importancia; no diseñar un catálogo genérico ajeno al negocio animal.
- Organizar la información por familias de productos y sus características, con muchas opciones iniciales y búsqueda, sin partir de listas vacías.
- Distinguir las presentaciones que realmente se venden: por ejemplo, tamaños o volúmenes distintos. No crear presentaciones ficticias ni afirmar que un producto sirve para una especie o condición sin respaldo.
- Permitir guardar una ficha incompleta como borrador privado, retomarla, previsualizar cambios, compararla con lo publicado y publicarla cuando cumpla los requisitos de su familia.
- Mantener una sola versión publicada y un borrador activo por producto. Descartar el borrador no altera lo publicado; editar la descripción no congela precios, existencias o caducidades.
- Separar permisos para editar y publicar, dentro de los roles configurables del sistema; no imponer puestos fijos ni un segundo aprobador obligatorio.
- Compartir familias, características y requisitos de publicación entre CEDIS y sucursales de la empresa. Eso no comparte automáticamente precios, clientes o existencias.
- Retirar una opción de uso futuro no borra información válida ya publicada. Para republicar una ficha afectada debe reemplazarse o retirarse esa opción. Información incorrecta o peligrosa exige corrección o retiro explícito.
- No se exige mantener dos catálogos públicos funcionando durante la transición. Esto no autoriza borrar información ni apagar el actual sin acordar la ejecución.

**Pantallas propuestas, todavía por validar visualmente:** familias, características/opciones, edición del producto, presentaciones, revisión/publicación y catálogo público con filtros. El diseño visual se prepara después de cerrar su alcance; no es una entrega ya realizada.

## 3. Precios, cuentas y mayoreo — acordado

| Situación | Regla de negocio |
| --- | --- |
| Cliente encuentra varios precios aplicables | Usar el menor precio válido para ese cliente y cantidad entre lista, escala por cantidad, acuerdo particular y promoción elegible. No sumar descuentos automáticamente. |
| Un acuerdo resulta más caro que una promoción válida | Aplicar la promoción si ese cliente cumple sus condiciones; tener acuerdo no obliga a pagar más. |
| Falta precio o figura cero | Buscar otro precio válido autorizado. Si no existe, mostrar «Consultar precio» y no permitir comprar esa presentación; la ficha puede seguir visible si cumple las demás condiciones. |
| Visita sin cuenta | Puede explorar precios públicos y armar carrito. |
| Solicitud de cotización o pago | Requiere identificación con correo verificado, conservando el carrito durante el registro. |
| Cliente quiere condiciones particulares | Debe tener una cuenta comercial vinculada y autorizada. Declararse mayorista no concede descuento. |
| Cliente comercial ya existente | Vinculación mediante invitación a un contacto previamente validado; si falta o está desactualizado, revisión del equipo autorizado. Saber el nombre o teléfono no da acceso. |

**Ejemplo:** lista $100, escala aplicable $90, acuerdo $85 y promoción $80: corresponde $80 si cumple la promoción; de lo contrario, $85. No se mezclan los descuentos ni se muestran acuerdos de otros clientes.

## 4. Entrega y cotización — acordado

Hay cuatro situaciones: reparto propio gratuito; reparto propio con recargo confirmado por el equipo; paquetería fuera de cobertura propia; y zona todavía desconocida que necesita consulta. Falta concretar el mapa de cobertura: no anunciar zonas ni tarifas que aún no están confirmadas.

- Si falta cobertura, recargo o tarifa, guardar una solicitud de cotización sin cobrar, reservar mercancía ni prometer envío.
- El equipo resuelve y avisa; el cliente revisa el total actualizado y decide si paga, sin obligación de continuar en el chatbot.
- Antes del pago se revisan nuevamente precios, disponibilidad y vigencia del envío. Una cotización solicitada no congela esos valores.
- Una restricción comercial vigente y confirmada de teléfono/domicilio impide cotizar o pagar en ese caso. Una coincidencia dudosa se revisa, sin cobro ni rechazo automático por parecido. El cliente recibe un mensaje neutral y una vía de contacto.
- Estar fuera de cobertura propia no significa estar bloqueado comercialmente.

### Vigencia y actualización — acordado D37

- Mostrar total y fecha/hora de vencimiento en la cotización resuelta. La vigencia depende de cuánto podamos sostener la tarifa de envío; no hay un plazo único aprobado.
- Antes de pagar, revisar precios, disponibilidad y envío. Si cambian, mostrar el resumen actualizado y pedir aceptación.
- Conservar la solicitud vencida y ofrecer «Actualizar cotización», sin hacer reconstruir el carrito ni garantizar precios anteriores.
- Si no puede actualizarse automáticamente, volver a revisión del equipo, sin cobrar ni apartar mercancía.
- Iniciar los 15 minutos de apartado solo cuando podamos mantener el total durante toda esa ventana. Actualizar una cotización no cobra ni aparta por sí mismo.

### Cuando no podemos ofrecer entrega — acordado D36

Tras revisar y confirmar que no es posible entregar, cerrar la solicitud con «No podemos ofrecer entrega en esta dirección», avisar por correo y mostrarlo en la cuenta. No cobrar ni apartar mercancía. El cliente puede indicar otra dirección y pedir nueva cotización, revisando precios y disponibilidad.

No equivale a bloquear al cliente ni a rechazar automáticamente una zona desconocida o fuera del reparto propio. No se promete retiro en sucursal ni se exige continuar por WhatsApp.

### Apoyo para paquetería

**$120 MXN por cada unidad cuyo precio final después de descuentos sea mayor a $500 MXN**, sin incluir envío. Los apoyos se acumulan hasta el costo de la paquetería; no generan dinero a favor ni se aplican automáticamente al recargo de reparto propio.

- Dos unidades que califican: apoyo de $240. Envío de $310: cliente paga $70.
- Precio final exactamente $500 o $480: esa unidad no califica.
- Apoyo de $240 y envío de $200: cliente paga $0 por envío, sin recibir los $40 sobrantes.

## 5. Pago y disponibilidad — acordado

- **Lanzamiento web solo con tarjeta**, con mercancía y envío confirmado completamente pagados antes de la entrega. No hay saldo en puerta ni crédito por ser cliente mayorista o conocido.
- Transferencias y efectivo en OXXO quedan fuera del lanzamiento web. Aceptar tarjeta no incluye automáticamente meses sin intereses.
- El carrito y la solicitud de cotización no apartan mercancía. El apartado temporal comienza al iniciar el pago, después de revisar disponibilidad y total; si no alcanza la mercancía, no iniciar el cobro.
- Un pago confirmado asegura el pedido conforme a su disponibilidad; si el apartado ya venció, aplica la regla de pago tardío de la sección siguiente.
- Cerrar la página o perder conexión no significa que el cobro haya fallado. Primero se verifica el mismo pago; no se pide pagar nuevamente a ciegas.
- Pago fallido confirmado: liberar el apartado que corresponda y permitir otro intento tras revisar total y disponibilidad.
- **Apartado de 15 minutos desde que inicia el pago (D34)**, sujeto a comprobar que la pasarela permita cumplirlo de forma segura. Antes de iniciar, confirmar mercancía y total de envío por toda la ventana; si hace falta, actualizar la cotización y pedir aceptación del total.
- Mostrar tiempo restante sin reiniciarlo al recargar. Al vencer, cerrar el intento y liberar coordinadamente; para intentar otra vez, revisar total y disponibilidad. Si hay duda sobre el cobro, verificar primero. Pago confirmado tarde sigue las reglas de recuperación o reembolso acordadas.

**Proveedor pendiente:** Stripe Checkout es el primer candidato recomendado, no elegido. Mercado Pago sigue como alternativa; Link EVO se considera para una evaluación posterior del chatbot, no como integración contratada. Antes de elegir se deben confirmar condiciones comerciales y elegibilidad del catálogo. Las reglas web no cambian automáticamente las del mostrador o chatbot.

## 6. Preparación, cancelaciones y reembolsos — acordado D31–D33

**Inicio de preparación:** personal autorizado marca «Iniciar preparación» cuando comienza realmente a reunir la mercancía. Se registra quién y cuándo. Recibir el pago o abrir el pedido no activa este estado ni elimina la posibilidad de cancelación automática.

| Caso | Qué se acordó |
| --- | --- |
| Cliente cancela antes de iniciar preparación | Permitir cancelación automática. Si hubo cobro, devolver íntegramente lo cobrado. |
| Cliente solicita cancelar después de iniciar preparación | Revisión del equipo; no prometer aceptación ni devolución íntegra automática. |
| Pago confirmado después de vencer el apartado | Intentar asegurar de nuevo el pedido completo al total aceptado, sin quitar apartados a otros clientes. |
| Ese pedido tardío ya no puede cumplirse | Resolver y reembolsar íntegramente lo cobrado; sin sustituir productos ni cobrar diferencias automáticamente. |
| Reembolso solicitado | Mostrarlo pendiente hasta confirmar su resultado; solicitarlo no significa que el dinero ya esté acreditado. |

**Para los dos casos con reembolso íntegro acordado:** incluir mercancía y envío efectivamente cobrados; devolver al medio de pago original; no convertirlo en saldo a favor ni descontarle al cliente la comisión de la pasarela. **HoundFe absorbe la comisión que el proveedor no reintegre.** No devolver apoyos de envío no cobrados ni importes mayores a los pagados.

**Ejemplo ilustrativo:** si el cliente pagó $1,000 de mercancía y $70 de envío, corresponde devolver $1,070 en esos casos, no una cifra reducida por comisión. Si no hubo cobro, no hay dinero que devolver.

No hay fecha de acreditación bancaria prometida. Estas reglas no sustituyen una política completa de cambios, garantías o devoluciones de productos ya preparados/entregados, ni una revisión de las obligaciones legales aplicables.

### Avisos y seguimiento — acordado D35

- Correo verificado para avisar cotización lista, pago confirmado, pedido enviado e incidencias o novedades del reembolso.
- Seguimiento dentro de la cuenta web para consultar el estado actualizado; el correo acompaña ese seguimiento, no lo reemplaza.
- No enviar correos por cada cambio menor ni incluir notas internas del equipo.
- WhatsApp queda para una ampliación posterior; no se obliga al cliente web a continuar en el chatbot.
- La aprobación define los canales futuros: no hay envíos reales realizados ni plazo de recepción del correo prometido.

## 7. Compras, inventario y proveedores — dirección acordada

Este carril avanza en paralelo al catálogo. Son capacidades previstas; no anunciar un módulo operativo terminado.

| Área | Capacidad o regla acordada |
| --- | --- |
| CEDIS y sucursales | Son una empresa; mover mercancía entre ellas es traslado interno, no compraventa entre empresas. |
| Compras a proveedores | Soportar contado y crédito, incluidos abonos; recibir mercancía, reconocer deuda y pagar son hechos distintos. |
| Entregas parciales | Registrar lo realmente aceptado y lo pendiente. Pedir 10 cajas y recibir 6 suma 6 al inventario; las otras 4 siguen pendientes. |
| Mercancía dañada, vencida o distinta | Separar y revisar antes de ponerla a la venta. |
| Anticipos | Registrar dinero entregado antes de recibir mercancía; aplicarlo después sin volver a retirar dinero. El anticipo no aumenta existencias. |
| Resolución con proveedor | Distinguir devolución de dinero realmente recibida de saldo a favor para futuras compras. Un crédito del proveedor no es dinero en caja. |
| Origen del dinero | Fuentes configurables —caja, cuenta empresarial, fondo o pago de tercero— separadas del método de pago. No inventar saldos ni prometer conexión bancaria. |
| Cambios de costo | Registrar costo y mostrar impacto en margen, sin cambiar automáticamente precios de venta o acuerdos. La referencia de costo aún debe acordarse. |
| Lotes y caducidades | Ampliar el soporte por presentación cuando corresponda. No vender lotes vencidos; conservar cantidades físicas e historial para su tratamiento. |
| Rotación física | Priorizar el lote válido que venza primero y registrar el que realmente se entrega. |
| Alertas de caducidad | Ventanas iniciales de 60, 30 y 7 días, configurables por familia, con sucursal/cantidad y sin avisos repetidos por el mismo caso. |
| Ajustes de existencias | Sustituir cambios directos sin explicación por ajustes con motivo, responsable y cantidades anterior/nueva. Las compras entran por recepción. |
| Permisos | El usuario configura roles y permisos de cada operación; no se imponen puestos, montos máximos o doble aprobación no acordados. |

**Confirmado:** cuándo se reconoce deuda puede variar por proveedor. **Propuesto:** guardar condiciones del proveedor y conservar lo acordado en cada compra; falta cerrar cómo se resuelven diferencias y cambios. No imponer una sola regla a todos.

**Propuesto, no automático:** sugerir compra o traslado para reponer una sucursal. No se aprobó que la aplicación compre sola ni que calcule necesidades sin datos suficientes.

## 8. Pendientes para resolver, sin detener lo independiente

| Tema | Qué falta decidir o confirmar |
| --- | --- |
| Lanzamiento y alcance visual | Pantallas/prioridades D38 y dirección general D39 aprobadas. Prompt preparado para que v0 proponga la base pública; falta revisar el diseño resultante. Sin fecha comprometida ni interfaz entregada. |
| Pasarela de tarjetas | Proveedor definitivo, catálogo aceptado, tarifas, abonos a la empresa y condiciones de devolución. |
| Apartado y envío | Validar que puedan cumplirse los 15 minutos D34 y mantener el total de envío durante esa ventana; D35 define correo verificado y seguimiento web. No anunciar el objetivo como función disponible. |
| Operación de entregas | Cobertura real y tarifas/paquetes. Canales de aviso definidos en D35; cierre por entrega imposible y nueva cotización definidos en D36. |
| Devoluciones posteriores | Reglas de cambios/devoluciones después de preparación o entrega, sin ampliar D32 por suposición. El inicio de preparación ya está definido en D33. |
| Costos y margen | Cómo valorar existencias y distribuir flete, impuestos y descuentos; no elegirlo por defecto. |
| Proveedores y fondos | Condiciones por compra, diferencias, saldos iniciales, fondos insuficientes y correcciones. |
| Traslados y caducidades | Mercancía en tránsito, diferencias y parciales; fecha exacta de vencimiento, fechas faltantes y retornos. |
| Reposición y avisos | Datos para sugerencias, responsables, canales y frecuencia de avisos. |

**Pendientes para el siguiente bloque:** cobertura real, tarifas y paquetes, proveedor de pago y validación de los 15 minutos D34. D37 resuelve cómo informar y renovar vigencia; los plazos concretos deben respaldarse con la tarifa ofrecida. D36 resuelve entrega imposible. No cambiar la duración del apartado por valores predeterminados del proveedor.

### Datos concretos para llevar a la junta

**Resultado de la revisión disponible:** conocemos las reglas, pero no contamos con una lista de cobertura ni fichas de paquetes verificadas y listas para usar. Esto no significa que el negocio no las tenga. No necesitamos volver a decidir las categorías; necesitamos sus datos concretos.

| Dato a obtener | Qué pedir al negocio o proveedor |
| --- | --- |
| 1. Cobertura vigente | Listado de códigos postales, zonas y excepciones, o mapa vigente que pueda traducirse a esa lista; fecha/versión y persona que lo valide. |
| 2. Pendiente de Envíos Perros | Qué condición falta cumplir exactamente, quién la resolverá y cómo se sabrá que quedó cumplida. No se conoce todavía si es un trámite, acuerdo u otra cuestión; no pedir contraseñas. |
| 3. Punto de despacho y medidas | Ficha autorizada del origen (CP, estado, municipio y colonia); peso en gramos y largo/ancho/alto en cm por presentación y por paquete realmente armado, con embalaje y combinaciones admitidas. No basta sumar medidas de productos. |
| 4. Preparación y calendario | Tiempo habitual de preparación, hora de corte, días de operación y cómo se explicarán los días estimados de la paquetería. La estimación del transportista no demuestra el tiempo total desde la compra. |
| 5. Pedidos de varios paquetes | Si el negocio los prepara, cómo decide la división y qué límites acepta cada servicio. No está demostrada una división automática para cualquier pedido. |

Para cada respuesta, anotar fuente, fecha y responsable de validarla. No incluir credenciales ni datos privados de clientes en este resumen. Los campos identificados no equivalen a datos ya cargados ni a servicios activos.

**Qué puede avanzar mientras se reúnen:** diseño y revisión de pantallas, catálogo, reglas comerciales acordadas y planificación de compras/inventario. No prometer cobertura, cotización automática para cualquier carrito, varios paquetes o fechas de entrega sin los datos y comprobaciones correspondientes.

**Primer entregable de catálogo preparado:** [brief funcional de diseño](catalog-design-brief.md). Define catálogo, ficha y administración con borradores/publicación como primer corte; compra y seguimiento se diseñan con sus estados y dependencias. D39 aprueba una tienda especializada, cercana y profesional, de fondos claros, productos protagonistas y precios legibles. Está preparado el [prompt completo para v0](v0-public-catalog-prompt.md): propuesta pública con datos ficticios, sin implementar el negocio. Falta revisar la composición resultante; no se ha generado interfaz.

**Primer entregable operativo preparado:** [alcance de proveedores e inventario](first-operational-contract.md). Define cómo organizar proveedores y órdenes sin mover dinero o mercancía por guardar un pedido, y cómo preparar historial/ajustes antes de conectar recepciones. Es una propuesta documentada para revisión, no un módulo disponible.

## 9. Guion breve y mantenimiento

1. Presentar el objetivo y aclarar que es alcance planificado, no una demostración de funciones terminadas.
2. Recorrer compra pública/mayorista, envío y pago con los ejemplos anteriores.
3. Explicar cancelación/reembolso, incluida la comisión que absorbe HoundFe.
4. Mostrar el carril paralelo de proveedores e inventario y separar lo acordado de lo pendiente.
5. Registrar ajustes acordados en la junta; no convertir una idea nueva en compromiso de entrega sin revisar su alcance.

Este archivo es el **resumen central de negocio**: actualizarlo cuando cambie una decisión. Las fuentes de detalle conservan acuerdos y ejemplos completos; ante discrepancias, resolver con la decisión explícita del usuario, no con una interpretación silenciosa.

- [Decisiones de catálogo, clientes y checkout](catalog-product-strategy.md).
- [Compras, inventario y finanzas operativas](procurement-inventory-plan.md).
- [Políticas de pago y reservas](payment-contract-proposal.md).
- [Comparación de pasarelas, aún sin selección](payment-provider-comparison.md).
- [Hoja de ruta y pendientes](implementation-roadmap.md).
