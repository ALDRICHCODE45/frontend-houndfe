# Catálogo y modelo de producto de HoundFe

Para la junta: [resumen central de decisiones y capacidades de negocio](business-meeting-brief.md), sin detalle técnico y con pendientes visibles.

Documento vivo de decisiones y propuestas. Estado: descubrimiento y validación; no es autorización de implementación, migración ni borrado de datos.
La experiencia pública y la administración deben compartir información comercial consistente. El brief de v0 se prepara después de validar el alcance funcional.
Plan operativo complementario: [Abastecimiento, inventario y finanzas](procurement-inventory-plan.md), con fases P0–P4, criterios de aceptación y decisiones comerciales; N1 resuelta, N2–N8 pendientes.

## Decisiones confirmadas por el usuario

| ID | Decisión |
| --- | --- |
| D1 | Rediseñar profundamente el catálogo: moderno, familiar y profesional; no limitarse a adaptar la apariencia actual. |
| D2 | Atender minoristas y mayoristas con la misma importancia. |
| D3 | Listas compartidas, acuerdos particulares y escalas por cantidad como modelo comercial; D18 aprueba menor precio elegible sin acumulación automática para el nuevo catálogo. Condiciones detalladas y alcance de otros canales pendientes. |
| D4 | El negocio vende productos para mascotas y animales; no es un POS genérico. |
| D5 | Se pueden proponer cambios de sistema y datos. El usuario declara que HoundFe aún contiene datos de prueba y no tiene usuarios reales; esto no autoriza borrados. No extender esa declaración al legacy. |
| D6 | Investigar backend mediante su agente del repositorio principal; no leer directamente repositorios externos ni involucrar el worktree de importación sin coordinación. |
| D7 | Mantener las decisiones importantes en un archivo Markdown, además de memoria. |
| D8 | Ampliar el sistema para soportar lotes/caducidades por variante cuando corresponda; el usuario confirma que algunas presentaciones lo necesitan. No es capacidad existente. |
| D9 | Preparar un plan detallado y retomable que incluya proveedores, compras/entradas, pagos y origen del dinero, gastos, caducidades, rotación y reposición. La ejecución desatendida es un objetivo posterior al cierre de reglas y alcance, no una orden de modificar dinero/inventario ahora. |
| D10 | CEDIS y sucursales pertenecen a la misma empresa y trasladan mercancía internamente; no modelar esos movimientos como compraventas entre empresas. |
| D11 | Modelo híbrido aprobado: núcleo operativo estable, atributos tipados configurables por familia y variantes para identidades vendibles. Detalle físico de tablas y contratos pendiente. |
| D12 | Los selectores y vocabularios configurables deben incluir muchas opciones iniciales: cobertura amplia, no limitarse a ejemplos del inventario actual ni trasladar toda la carga inicial al cliente. |
| D13 | Una versión descriptiva publicada y un borrador privado activo por producto, persistente entre sesiones. Retomar, previsualizar, comparar, publicar atómicamente o descartar borrador; permisos existentes separados para editar/publicar y conflictos de concurrencia. No congelar ni restaurar precios, stock, caducidad, visibilidad o restricciones operativas. |

### D39: dirección visual aprobada y prompt público para v0

El usuario aprobó la dirección visual con «Si hermano, perfecto» y pidió un prompt completo para que v0 proponga la base del catálogo: «v0 no implementara funcionalidad, pero es importante que se describa para poder hacer una ui que cumpla con lo requerido cuando la implementemos, me sigues?»

Dirección aceptada: tienda especializada, cercana y profesional, fondos claros, productos protagonistas y precios/presentaciones legibles, sin aspecto de POS ni ruido publicitario. Se entrega [prompt autónomo para v0](v0-public-catalog-prompt.md) centrado en catálogo público y recorrido del comprador; administración interna permanece en su frente independiente. Incluye paleta basada en colores existentes, propuesta de tokens ajustados por contraste, estados de negocio, ejemplos ficticios, móvil y accesibilidad. Valores concretos de composición/tokens son guía para la propuesta, no diseño final ya aprobado.

v0 debe producir prototipo visual con fixtures, no integrar negocio ni servicios reales. El usuario copiará el prompt; esta entrega no envía solicitudes externas, crea cuentas, genera la UI en este repositorio ni autoriza migrar Vue, implementar checkout, publicar o desplegar. La propuesta visual resultante aún requiere revisión.

### D38: pantallas iniciales y dos frentes paralelos

El usuario aprobó el alcance de pantallas y preguntó «Si hermano, pero quiero saber el orden de prioridades hermano, que haremos primero?? segun yo, habiamos dicho que se puede paralelizar no?»; tras el orden recomendado confirmó «Bien hermano, si, esta bien, continuemos con tus pasos recomendados por favor.»

Pantallas iniciales: catálogo, detalle, carrito, identificación/dirección, envío/resumen, pago/resultado y cuenta; administración de catálogo y operación web (cotizaciones, preparación, cancelaciones e incidencias). No incorporar favoritos, reseñas, puntos, suscripciones ni funciones promocionales nuevas por inferencia.

Prioridad inmediata: brief funcional de diseño del catálogo y primer contrato operativo en paralelo. Catálogo/detalle/administración con borradores y publicación primero, con precios públicos/particulares según reglas acordadas. Operación: proveedores/órdenes e historial/ajustes; luego lotes y recepciones parciales según contratos. Checkout requiere disponibilidad compartida y pasarela validada, no terminar todo finanzas. Finanzas completas, traslados y reposición siguen por dependencias, conservando sus reglas aprobadas.

Los datos logísticos se reúnen para la junta sin detener planificación independiente. Alcance de pantallas no equivale a dirección visual aprobada: se prepara brief funcional y propuesta visual, sin envío a v0 ni generación de aplicación. Esta decisión autoriza planificación, no implementación ni operaciones reales.

### D37: vigencia visible y actualización de cotizaciones

El usuario respondió «Si hermano.» a mostrar total y fecha/hora de vencimiento en la cotización resuelta, según cuánto pueda sostenerse la tarifa de envío, sin plazo único inventado. Antes de pagar, revisar precio, disponibilidad y envío; cualquier cambio exige mostrar el resumen actualizado y obtener aceptación.

Conservar la solicitud vencida y permitir «Actualizar cotización» sin reconstruir el carrito. Conservar contenido no congela precios ni garantiza stock. Si no puede actualizarse automáticamente, devolver a revisión del equipo sin cobrar ni reservar. Iniciar el apartado de 15 minutos D34 solo si puede mantenerse el total durante toda la ventana; actualizar cotización no inicia pago ni renueva automáticamente un apartado existente.

No fija tarifas, cobertura o plazo concreto del proveedor; no autoriza implementación ni mensajes/cobros reales. La vigencia de cotización y el apartado al pagar son conceptos distintos. La validación de cierre seguro de la pasarela D34 sigue pendiente.

### D36: cotización revisada sin entrega disponible

El usuario respondió «si hermano.» a cerrar la solicitud como «No podemos ofrecer entrega en esta dirección» cuando la revisión confirma que la entrega es imposible. Avisar por correo verificado y mostrar el resultado en la cuenta web, sin cobrar ni reservar mercancía.

El cliente puede indicar otra dirección y solicitar nueva cotización, revisando precios y disponibilidad. No se promete retiro en sucursal ni se obliga a continuar por WhatsApp. No confundir zona desconocida pendiente de revisión o fuera de reparto propio con entrega imposible: podría existir paquetería. El cierre no crea una restricción comercial del cliente ni una prohibición permanente sobre esa dirección. No autoriza implementación ni mensajes reales.

### D35: correo y seguimiento web para el lanzamiento

El usuario respondió «Si hermano, estoy de acuerdo» a avisar por correo verificado cuando la cotización esté lista, se confirme el pago, se envíe el pedido y haya incidencias o novedades del reembolso. El cliente consulta el estado actualizado dentro de su cuenta web. No enviar correo por cada cambio menor ni incluir notas internas.

WhatsApp queda como ampliación posterior, sin obligar al cliente web a usar el chatbot. Estos canales no sustituyen la verificación del pago ni conceden acceso a datos privados por conocer un enlace. No se elige proveedor de correo, plazo de entrega ni se autorizan envíos reales; tampoco se aprueban campañas comerciales por esta decisión.

### D34: objetivo de apartado de 15 minutos para tarjeta

El usuario respondió «Si hermano, estoy deacuerdo, a lo que sigue» a un apartado de 15 minutos desde el inicio del pago, sujeto a validar cierre seguro con la pasarela. Antes de iniciarlo, confirmar que pueden mantenerse mercancía y total de envío durante toda esa ventana; si la cotización no alcanza, actualizarla y obtener aceptación del total antes de cobrar. Mostrar tiempo restante sin reiniciarlo por recarga.

Al vencer sin pago confirmado, cerrar el intento para nuevos pagos y liberar coordinadamente según estado autoritativo; un nuevo intento revalida total y disponibilidad. Si el resultado del cobro es desconocido, verificar antes de pedir otro pago. Pago confirmado tardío conserva D31/D32. No confundir vencimiento con prueba de impago.

Es objetivo comercial condicionado, no garantía ya implementada. Stripe Checkout programa vencimiento desde 30 minutos: para 15 se requiere cierre explícito y pruebas, no solo contador visual. Si no puede cumplirse con seguridad, volver con evidencia y alternativas; no cambiar silenciosamente a 30 minutos ni habilitar una reserva insegura. No se elige proveedor ni se autorizan cobros/stock reales.

### D33: inicio explícito de preparación

El usuario respondió «Si hermano, adelante por favor.» a que personal autorizado marque «Iniciar preparación» cuando realmente comienza a reunir la mercancía. Registrar quién lo inició y cuándo. Recibir el pago o abrir el pedido no inicia preparación ni corta la cancelación automática D31.

La decisión precisa el momento operativo, no autoriza implementación, nuevos roles fijos ni operaciones reales. Conservar D31/D32 y resolver técnicamente la carrera entre cancelar e iniciar preparación sin permitir ambos resultados incompatibles. No inferir una vuelta automática al estado anterior ni una política nueva de cancelación posterior.

### D32: reembolso íntegro en los dos casos acordados

El usuario respondió «Si hermano, estoy de acuerdo.» a devolver todo lo efectivamente cobrado, incluido el envío, al medio de pago original y sin descontar comisión de pasarela, cuando el cliente cancela antes de preparación o cuando un pago tardío corresponde a un pedido que no puede cumplirse según D31. HoundFe absorbe cualquier comisión que el proveedor no reintegre; no convertir la devolución en saldo a favor.

El reembolso mantiene seguimiento hasta resultado del proveedor; no prometer fecha de acreditación bancaria sin condiciones confirmadas. Después de iniciar preparación sigue revisión del equipo: D32 no es política general de devoluciones ni reembolso íntegro automático para cualquier incidente. No autoriza operaciones reales.

El usuario también pidió reunir decisiones, capacidades y reglas para informar a sus clientes en la próxima junta, sin tecnicismos. El [resumen de negocio para la junta](business-meeting-brief.md) es la entrada central de esa conversación y distingue acordado, propuesto y pendiente; no acredita funciones implementadas.

### D31: pagos tardíos y corte de cancelación web

El usuario respondió «Bien, si hermano.» a dos reglas: ante pago confirmado después de vencer la reserva, intentar asegurar nuevamente el pedido completo al total aceptado, sin desplazar reservas ajenas; si falta stock o no puede cumplirse ese total, pasar a resolución y reembolso, sin sustituciones ni cobros adicionales automáticos. Una solicitud de cancelación del cliente se permite automáticamente antes de iniciar preparación; después requiere revisión del equipo.

Reembolso solicitado permanece pendiente hasta confirmar resultado del proveedor; cancelar pedido no demuestra devolución ejecutada. Mantener recuperación del mismo intento ante resultado desconocido y revalidación antes de reintentar un pago fallido confirmado. No reactivar un pedido cancelado ante un evento tardío: reconciliar dinero y estado vigente.

D32 resuelve devolución íntegra sin descontar comisión en sus dos casos. No se fijan plazos de acreditación ni pasarela. Coordinar inicio de preparación/cancelación y asignación/liberación con autoridad única, evitando dobles efectos. Es aprobación del comportamiento futuro, no autorización para devolver dinero, reservar stock o implementar.

### D30: dirección inicial de medios de pago por canal

El usuario indicó: «yo creo que al principio, en la web estaria bien solo pago con tarjeta hermano. digo yo. despues, en el chatbot es donde tendria sentido link evo.» El plan inicial web se acota a tarjetas; transferencias/SPEI y efectivo/OXXO quedan fuera de ese lanzamiento, no prohibidos para futuras ampliaciones. No inferir meses sin intereses ni redes/tipos de tarjeta concretos habilitados sin contrato del proveedor.

Link EVO queda como candidato para una evaluación posterior del chatbot, no selección ni integración autorizada. Stripe Checkout sigue siendo primer candidato técnico web condicionado a elegibilidad/comercial/pruebas, no decisión definitiva. Tarjeta no garantiza confirmación inmediata: estados pendientes, autenticación adicional, reintentos y pagos tardíos siguen sujetos a D25/D29. Esta dirección no autoriza contratación, cuentas, cobros ni cambios de bot/POS.

### D29: reserva temporal al iniciar el pago

El usuario respondió «Si hermano, estoy de acuerdo.» a reservar temporalmente stock solo al iniciar pago web, después de revalidar identidad, condiciones, precio, envío y disponibilidad. Carrito y solicitud de cotización no reservan. Si no hay unidades suficientes, informar antes de iniciar cobro; dos intentos no pueden comprometer la misma última unidad.

Pago confirmado convierte la reserva en asignación del pedido una sola vez. Fallo, cancelación o vencimiento confirmados liberan según estado autoritativo, no por cerrar pestaña ni por un error de red. D34 fija objetivo de 15 minutos para tarjeta, condicionado a cierre seguro con la pasarela. Pago confirmado después del vencimiento necesita reconciliación separada, sin prometer stock automáticamente.

Decisión de negocio, no implementación ni cambio de inventario autorizado. Integración con venta, momento del descuento físico/contable, autoridad de reserva, eventos duplicados/desordenados, recuperación y pagos tardíos requieren contrato backend. No añadir una segunda fuente de stock ni aplicar automáticamente al bot/POS.

### D28: restricciones comerciales y coincidencias dudosas

El usuario respondió «si hermano.» a bloquear solicitud de cotización o pago cuando exista restricción vigente de teléfono/domicilio con coincidencia confirmada, para ese caso. Coincidencia dudosa pasa a revisión del equipo antes de continuar, sin cobro ni rechazo automático por parecido. Gestión por personal autorizado, con motivo, alcance y actor al agregar/retirar la restricción; mensaje neutral al cliente y posibilidad de contacto, sin notas internas ni acusaciones.

No generar bloqueos automáticos por intento fallido, apellido o dirección parecida. Separar restricción comercial de cobertura: CARRIER_ONLY no es cliente bloqueado. D28 define conducta futura, no acredita blacklist existente ni autoriza cargar restricciones reales. Normalización, criterios de coincidencia confirmada/dudosa, estados de revisión, alcance y permisos concretos requieren contrato; no inventar roles, score de fraude o doble aprobación obligatoria.

### D27: identificación al solicitar cotización o pagar

El usuario respondió «si hermano» al recorrido híbrido: explorar y armar carrito sin cuenta; solicitar cotización o pagar requiere identificación con correo verificado, con registro breve que conserva el carrito. Consultar direcciones guardadas o precios particulares exige además vínculo comercial autorizado D22; verificar un correo no vincula automáticamente una cuenta comercial existente.

No concede crédito ni excepciones a D25. La implementación de sesión/verificación y conservación/reconciliación del carrito requiere contrato técnico; no inferir fusiones automáticas de clientes ni mantener precios anónimos sin revalidación al cambiar contexto. No se autoriza implementar autenticación ni enviar correos reales.

### D26: cotización pendiente cuando el envío requiere revisión

El usuario respondió «si hermano, estoy de acuerdo.» al recorrido: zona/tarifa confirmadas permiten revisar total y pagar; zona desconocida, recargo pendiente o cotización no disponible permiten guardar solicitud de cotización, sin cobrar ni prometer envío. El equipo resuelve cobertura y costo dentro del sistema; el cliente recibe aviso, vuelve a revisar el total actualizado y decide si paga. No obligar a continuar en el chatbot.

Antes de pagar se revalidan precios, disponibilidad y vigencia del envío. La solicitud no congela valores ni reserva stock por sí sola. D25 sigue exigiendo pago completo previo; una cotización resuelta no equivale a pago confirmado ni habilita despacho. D35 resuelve correo verificado y seguimiento web como canales iniciales. D36 define cierre y nueva solicitud cuando la revisión confirma entrega imposible. D37 define vigencia visible y actualización sin reconstruir carrito. Permisos concretos, reglas de cancelación de solicitud y plazos sustentados por la tarifa requieren contrato; no se autoriza implementación, mensajes reales ni cobros.

### D25: pago completo por adelantado en el canal web

El usuario corrigió la propuesta de cobrar saldo en puerta: «mejor que todo este pagado desde el principio mediante la web hermano»; explicó que «pagar lo que sobra en la entrega» es solo para ciertas personas/clientes de confianza, no para el público general del catálogo.

Para pedidos web, exigir pago completo por adelantado de mercancía y envío confirmado, tanto reparto propio como paquetería. No trasladar excepciones de confianza, saldo en puerta ni crédito implícito al canal web. Cuenta verificada, lista mayorista o acuerdo de precios no conceden una excepción de pago. No hace falta clasificar confianza para este flujo.

D25 reemplaza la recomendación provisional basada en el antecedente de reparto propio, no modifica reglas existentes de bot/POS. Sin cobertura/cotización o recargo confirmado no hay total definitivo que cobrar: resolver UNKNOWN/SURCHARGE antes del pago. Pago pendiente, comprobante o retorno del navegador no prueban pago confirmado. Pasarela, estados de intento/pedido, verificación autoritativa, reservas, expiración, cancelación y reembolso requieren diseño; esta decisión no autoriza implementación ni cobros reales.

### D24: apoyo de paquetería calculado sobre precio final

El usuario respondió «si hermano» a conservar apoyo de $120 MXN por cada unidad comprada cuyo precio unitario final después de descuentos sea estrictamente mayor a $500 MXN, sin incluir envío. Acumular apoyos hasta el costo de la cotización de paquetería: no generar saldo a favor ni aplicar automáticamente al recargo de reparto propio.

Ejemplos aprobados: dos unidades que califican aportan $240; cotización $310 → cliente paga $70. Una unidad con precio final $480 o exactamente $500 no califica, aunque antes costara $600. Si la cotización es menor al apoyo, el cargo al cliente es cero, sin devolución del remanente.

D24 se aplica al precio final resuelto según D18, no a una base anterior a promociones como la observada en el bot. No autoriza cambiar bot/POS ni datos existentes. Impuestos/redondeo comparables, reparto entre paquetes y efectos de cambios/cancelaciones requieren contrato; tarifas, vigencias y límites del proveedor siguen pendientes.

### D23: cuatro categorías territoriales para checkout web

El usuario respondió «si hermano, esta perfecto» a conservar el modelo de cuatro categorías: FREE, reparto propio gratuito; SURCHARGE, reparto propio con importe confirmado por una persona; CARRIER_ONLY, paquetería fuera de cobertura propia; UNKNOWN, consultar al equipo y guardar clasificación para próximas consultas. No inventar cobertura ni automatizar el recargo variable.

Aprobado el modelo para diseño web, no un catálogo concreto de CP/zonas ni una tarifa fija de $50–70. Ese importe sigue siendo antecedente. Tampoco confirma por extensión crédito de envío, condiciones de pago históricas, proveedor adicional ni implementación. Reglas de bloqueo comercial son distintas de cobertura; UNKNOWN no equivale a envío gratuito o rechazo definitivo.

### D22: correo verificado e invitación a contacto validado

El usuario respondió «si hermano, estoy de acuerdo.» al flujo recomendado: cuenta nueva con correo verificado y condiciones públicas; cliente comercial existente mediante invitación al contacto registrado previamente validado por la empresa. Si falta ese contacto o está desactualizado, personal autorizado revisa antes de vincular. No basta escribir nombre, teléfono o número de cliente. Verificar cualquier correo acredita acceso a ese correo, no derecho sobre una cuenta comercial ajena.

La revisión del contacto es para resolver el vínculo, no una segunda aprobación obligatoria para todos los registros. Conserva D20/D21: sin fusiones automáticas, beneficios ni permisos administrativos implícitos. Proveedor, enlace frente a código, vigencia de invitación, recuperación/revocación y controles técnicos siguen por especificar. No autoriza implementar autenticación, cambiar credenciales ni enviar invitaciones reales.

### D21: registro abierto y vinculación comercial verificada

El usuario respondió «Si hermano» a permitir registro voluntario abierto, inicialmente con condiciones públicas. Clientes existentes acceden a sus condiciones particulares solo tras verificar identidad y vincular la cuenta comercial; escribir nombre/teléfono no basta. Nuevos interesados en mayoreo pueden solicitar condiciones, asignadas por personal con permisos efectivos. No fusionar clientes ni conceder descuentos automáticamente; explorar sigue sin requerir cuenta.

Aprobación del flujo comercial, no de implementación: D22 define correo verificado e invitación a contacto validado, con revisión autorizada si falta/está desactualizado; proveedor y mecanismos de recuperación, revocación, prevención de duplicados y resolución de vínculos requieren contrato técnico. No añade permisos administrativos ni aprobación doble obligatoria. D27 resuelve identificación con correo verificado al solicitar cotización o pagar; implementación del mecanismo pendiente.

### D20: catálogo abierto y condiciones particulares identificadas

El usuario respondió «si hermano.» a mantener exploración, precios y promociones públicos elegibles sin registro, con acceso identificado y autorizado para consultar las listas/acuerdos asignados al cliente. D18/D19 se aplican dentro del contexto autorizado; iniciar sesión no concede por sí solo una lista privada ni revela acuerdos ajenos. Personal con permisos efectivos asigna condiciones comerciales: declararse mayorista no concede beneficios automáticamente. El acceso de cliente no otorga permisos administrativos ni del POS.

Ejemplo ilustrativo: visitante ve precio público $100; cliente identificado con acuerdo aplicable $85 ve el precio resultante de su contexto y de D18, sin acceso a acuerdos de otros clientes. No exige registro para explorar; D27 exige identificación con correo verificado al solicitar cotización o pagar.

D21 resuelve registro voluntario abierto y vinculación verificada. Pendientes técnicos/funcionales: mecanismo de alta e identificación, vínculo con cliente comercial, recuperación, revocación y comportamiento de sesión/caché. No se elige proveedor de autenticación ni se autoriza implementación, modificación de usuarios existentes o cambios de permisos actuales.

### D19: precio ausente o cero, sin compra gratuita implícita

El usuario respondió «si hermano. adelante.» a excluir precios ausentes o $0 de los candidatos de compra del nuevo catálogo. Si existe otro precio válido, elegible y autorizado para ese cliente/cantidad, incluido el público cuando corresponda, aplicar D18 entre esos candidatos. Si no existe ninguno, mostrar exactamente «Consultar precio» y no permitir agregar esa presentación al carrito; conservar la ficha visible solo si cumple las demás condiciones. Otras presentaciones con precio válido no se bloquean por ese motivo.

No mostrar $0 como precio de venta, inventar gratuidad, revelar precios privados ajenos ni convertir ausencia en un número para calcular el mínimo. No reescribir valores almacenados ni modificar POS/bot. Son reglas aprobadas para diseño, no implementación ejecutada.

### D18: menor precio elegible, sin acumulación automática

El usuario respondió «si hermano, estoy de acuerdo» a cobrar el menor precio válido para ese cliente y esa cantidad entre lista aplicable, escala por cantidad, acuerdo particular vigente y promoción elegible. El acuerdo no bloquea una oferta mejor cuando corresponda; no acumular descuentos automáticamente ni consultar precios privados de otros clientes.

Ejemplo ilustrativo aprobado: lista $100, escala aplicable $90, acuerdo $85 y promoción $80 → $80 si el cliente cumple las condiciones de la promoción; $85 si no las cumple. Son precios comparables del mismo vendible/cantidad/contexto, no suma de descuentos. No habilita promociones indiscriminadamente a mayoristas ni inventa condiciones de elegibilidad.

Alcance: diseño del nuevo catálogo, sin modificación implícita de POS/bot ni autorización de implementación. D20 aprueba el modelo de acceso; quedan por especificar su mecanismo de identificación/autorización, elegibilidad y vigencias, cantidades/unidades, impuestos/redondeo comparables, empate/procedencia y entrega; D19 resuelve ausencia/cero, sin cerrar toda G2. Los precios siguen operativos y fuera del borrador descriptivo.

### D17: diccionario común de empresa aprobado

El usuario respondió «si hermano, estoy de acuerdo» a compartir familias, atributos, opciones y mínimos/plantillas de publicación entre CEDIS y sucursales de la misma empresa. Mantenimiento por actores con permisos efectivos; sin roles fijos. Compartir referencias no comparte automáticamente productos, existencias, precios ni clientes y conserva aislamiento operativo y D13/D16. La decisión comercial queda cerrada; vínculo empresa–tenant verificable, autorización y esquema siguen pendientes de implementación expresamente autorizada.

### D16: opciones archivadas y contenido publicado

El usuario respondió «si hermano.» a conservar los valores válidos ya publicados y sus filtros al archivar una opción del diccionario. Archivar impide nuevas asignaciones y muestra advertencia administrativa; no borra historia ni cambia silenciosamente fichas publicadas. Antes de republicar una ficha afectada se reemplaza o quita la opción, respetando los mínimos D14. Información incorrecta o peligrosa requiere corrección o retiro explícito, no solo archivo. La conservación pública depende de elegibilidad operativa vigente; no se extiende a variantes/medios archivados ni evade privacidad. Decisión de diseño, sin implementación autorizada.

### D15: transición sin continuidad pública obligatoria

Ante la propuesta de mantener visible el catálogo actual mientras se preparan las fichas nuevas, el usuario respondió «mmm no necesariamente hermano, nadie lo ocupa, realmente no es necesario.» No se requiere disponibilidad pública continua del catálogo actual ni convivencia de ambos catálogos. Esta aclaración no autoriza apagarlo ahora, borrar productos/datos, alterar precios/inventario/historial ni implementar o desplegar. La adopción técnica de datos existentes sigue pendiente; el nuevo catálogo conserva los mínimos D14 y controles D13 antes de habilitarse.

### D14: mínimos de publicación por familia aprobados

El usuario respondió «s hermano, estoy de acuerdo.» a los mínimos de las siete familias de [vocabularios, sección 7](product-vocabularies.md). Quedan aprobados como regla de publicación, conservando sus condiciones de pertinencia: datos respaldados, sin compatibilidades inventadas; faltantes permiten guardar borrador pero impiden publicar. Los campos sugeridos siguen opcionales. No autoriza implementación ni aplicación retroactiva a productos existentes; bindings, condiciones por subtipo y adopción requieren especificación técnica.

### D13: alcance de publicación aprobado

El borrador comprende información comercial descriptiva (nombre comercial, descripción, imágenes y atributos de producto/presentaciones). Se conserva la última versión publicada válida mientras se trabaja en él. No implica múltiples ramas, segundo aprobador obligatorio ni snapshot de la operación. La pertenencia/cambios operativos de variantes siguen validándose con estado vigente al publicar.

Ante la recomendación de este modelo, el usuario respondió «si hermano, estoy de acuerdo.» Previamente pidió «no decidas por lo mas facil, vamos por algo profesional, es decir, la mejor opcion, aunque implique mas trabajo.» D13 reemplaza la recomendación anterior de no persistir ediciones incompletas de productos publicados; esquema, API e implementación siguen pendientes.

## Evidencia actual y límites

- Capturas del nuevo catálogo: búsqueda/categorías/orden/carrito sin recorrido comercial; ficha modal con escasa información; precio mínimo sin etiqueta «Desde».
- Capturas legacy: alimentos secos/húmedos para perro/gato, carnazas por tamaño y peso, juguetes con catnip en paquetes y medicamentos de 100/500 ml. La página muestra 3970 productos; no es un conteo verificado por API.
- Otras especies están incluidas en la intención general del negocio, pero no se confirmó su taxonomía concreta.
- Legacy mezcla nombres de listas por segmento, comisión y paquete. Precios cero y stock negativo aparecen en capturas; su significado no está validado y no debe trasladarse automáticamente.
- Contratos frontend: listas compartidas, lista asignada al cliente, escalas por producto/variante, promociones, lotes/caducidades, unidad y requisito de receta ya están representados.
- El backend principal confirmó búsqueda/categoría/paginación públicas; orden por precio limitado a la página y alias de relevancia/valoración que usan novedad.
- Existe validación pública de carrito, sin paridad de escalas/promociones ni comprobación completa de cantidad solicitada contra stock.
- POS, catálogo y bot tienen diferencias de resolución de precios. No modificar comportamiento del POS por inferencia.
- No se identificaron login comercial, acuerdos persistentes cliente-producto ni handoff autenticado de carrito en lo inspeccionado. Exportación de catálogo no verificada.
- Evidencia técnica por inspección estática de código/tests y reporte del agente backend; no se ejecutaron pruebas ni llamadas de integración.
- Evaluación backend adicional: categorías actualmente planas/globales; productos por tenant con una categoría opcional. No se identificaron familias, definiciones reutilizables ni valores tipados.
- Limitación operativa confirmada por inspección: activar variantes desactiva lotes/caducidades (`normalizeStockConfiguration`); no existe soporte demostrado para lotes por variante. Las cantidades actuales son enteras.
- Mapa ampliado backend: no se identificaron proveedores, compras, recepción documentada, cuentas por pagar ni journal de inventario en la búsqueda acotada. Edición de cantidades y CRUD de lotes no equivalen a recepción de mercancía.
- No se identificó asignación de lote a venta ni restauración enlazada al lote original. Alertas de cruce de mínimo existen, pero excluyen productos con lotes; no se identificaron scanner de caducidad ni avisos de baja rotación.
- Riesgo preexistente pendiente de verificación: el backend reporta actualización/eliminación de lotes mediante `{id,productId}` sin consulta previa de pertenencia del producto al tenant. Hallazgo estático, no exploit reproducido; revisar aislamiento antes de extender esas operaciones. No se autorizó ni realizó una corrección.

## Modelo híbrido de información de producto aprobado

El usuario aprueba el modelo conceptual (D11). Las recomendaciones técnicas y configuraciones específicas señaladas como propuestas siguen pendientes; no se autoriza implementación ni esquema físico por inferencia.

### 1. Núcleo comercial y operativo estable

Identidad, SKU, código de barras, marca, precios, impuestos, inventario, unidad de venta, variantes, publicación, lotes/caducidad y reglas de receta mantienen contratos propios. No convertirlos en campos libres que puedan eludir reglas del negocio.

### 2. Diccionario de atributos tipados y reutilizables

Cada definición tendría identificador estable, nombre visible, tipo de dato, opciones o unidad permitida cuando corresponda, alcance producto/variante y uso público/interno. Tipos iniciales candidatos: selección única/múltiple, número con unidad, booleano y texto.

- Valores controlados para facetas: evitar «Perro», «perros» y «canino» como opciones independientes.
- Desconocido, no aplicable y falso no son equivalentes.
- Marcar explícitamente si participa en filtros, ficha o comparación; no todo atributo debe ser un filtro.
- Permitir crear definiciones a personal autorizado, no generar claves diferentes desde cada producto.
- No cambiar destructivamente el tipo de un atributo con valores existentes; diseñar retiro y sustitución.
- Backend recomienda valores tipados relacionales e índices para atributos filtrables, por validación y rangos numéricos. Es una propuesta: diseño físico y rendimiento todavía no aprobados ni medidos; no se justifica un buscador externo sin evidencia.
- D17 aprueba diccionario central compartido dentro de la empresa; verificar representación del vínculo empresa–tenant y autorización efectiva. Las categorías globales actuales no prueban ese vínculo.
- Aplicar filtros antes de paginar y calcular conteos sobre el mismo conjunto elegible. Si se combinan atributos de variantes, deben coincidir en la misma variante, no en variantes hermanas distintas.

### 2.1. Cobertura inicial amplia de opciones (D12)

Entregar diccionarios iniciales abundantes y curados para animal/especie y los atributos de selección pertinentes; no entregar listas mínimas con solo perro/gato o dejar todo vacío porque es configurable. La cobertura no se restringe a los productos de las capturas. La lista final y su evidencia se prepararán como entregable propio antes de implementar semillas.

Recomendaciones de diseño para cumplir el requisito sin perder calidad:

- Vocabulario comercial amplio por grupos de animales, distinguiendo grupo, especie y raza; no mezclar niveles como valores equivalentes ni afirmar una taxonomía científica completa.
- Etiquetas canónicas e identificadores estables; alias de búsqueda para nombres comunes/sinónimos sin duplicar valores. Revisar homónimos y términos regionales.
- Selectores con búsqueda, agrupación y selección múltiple cuando la semántica del atributo lo permita. Mantener acceso a todas las opciones pertinentes, sin esconderlas tras una lista corta fija.
- Opciones por familia/tipo de atributo: no mostrar materiales en especie ni extrapolar etapas de vida idénticas a todos los animales.
- Personal con permisos puede ampliar, renombrar o retirar opciones con trazabilidad; retirar no borra valores históricos. Nuevas entregas de vocabulario no deben sobrescribir personalizaciones.
- Separar inventario del diccionario y filtro público: disponer de muchas opciones administrativas no exige llenar el catálogo público de filtros sin resultados.
- No fabricar marcas, prestaciones sanitarias, compatibilidad por especie ni indicaciones terapéuticas para aumentar el número de opciones. La asociación de un producto con animales requiere información válida del producto.

Criterios de aceptación propuestos: revisión de cobertura por grupos y familias, alias sin facetas duplicadas, búsqueda navegable con teclado, selección múltiple correcta y prueba de extensión por permisos. No fijar un número arbitrario como sustituto de cobertura útil.

### 3. Plantillas por familia de producto

Una familia define los atributos sugeridos y los necesarios para publicar. La categoría de navegación es una organización comercial distinta; no necesita ser idéntica a la plantilla.

Propuesta inicial del backend: una familia por producto, sin herencia de plantillas; especie como atributo reutilizable, no duplicar familias para perro y gato. Un árbol de categorías sería una capacidad separada, con profundidad acotada, prevención de ciclos y reglas explícitas para buscar en descendientes.

| Familia candidata | Atributos de ejemplo |
| --- | --- |
| Alimentos | Especies, etapa de vida, seco/húmedo, contenido neto, ingredientes y análisis declarado por fabricante. |
| Premios/carnazas | Especies, tipo, tamaño, contenido/peso, material o composición. |
| Juguetes | Especies, tamaño, material, tipo, características como catnip. |
| Accesorios | Medidas, talla, material, color, compatibilidad cuando aplique. |
| Salud y cuidado | Especies indicadas, presentación, composición/concentración y advertencias verificadas, según producto. |

No inferir idoneidad terapéutica ni recomendar tratamientos desde atributos o IA. Requisitos regulatorios y de receta requieren validación propia.

### 4. Productos, variantes y empaques separados

- Producto: identidad común y características compartidas.
- Variante vendible: combinación que necesita SKU, precio, stock o código de barras propios. Las presentaciones de 100 ml frente a 500 ml podrían modelarse así, pero si requieren lotes/caducidades primero debe resolverse la incompatibilidad actual; no presentar lotes por variante como capacidad existente.
- Atributo descriptivo: describe o filtra; no crea automáticamente variantes ni combinaciones cartesianas.
- Unidad y empaque: contenido y forma de venta; distinguir una pieza, un paquete de tres y tres piezas.
- Conversión caja/pieza o venta fraccionada necesita reglas explícitas de inventario/precio; no resolverla con una etiqueta libre.
- El precio por kg/litro solo se calcula cuando contenido, unidad y precio son comparables.

## Experiencia administrativa propuesta

1. Elegir familia al crear un producto y mostrar únicamente los campos pertinentes.
2. Separar secciones: información comercial, atributos, presentaciones, precios, inventario y publicación.
3. Guardar borradores incompletos; exigir mínimos acordados antes de publicar, sin bloquear innecesariamente altas internas.
4. Ofrecer vista previa de ficha pública y explicación de campos faltantes.
5. Permitir edición masiva y mapeo de importaciones con validación previa; no inferir atributos desde nombres sin revisión.
6. Mostrar historial y responsables de cambios relevantes; proteger datos internos de la publicación.

## Oportunidades para validar, no alcance comprometido

| Oportunidad | Valor | Dependencia o límite |
| --- | --- | --- |
| Calidad de catálogo | Detectar fotos, presentaciones y datos necesarios faltantes | Criterios por familia; no bloquear por cualquier campo opcional. |
| Pedido rápido y listas recurrentes | Agilizar compras comerciales y reposición | Precio/contexto autorizado, cantidades y disponibilidad actuales. |
| Gestión de empaques y contenido | Evitar confusión pieza/caja/kg | Reglas de conversión y stock; no solo diseño. |
| Alertas de caducidad y rotación | Reducir pérdidas y mejorar operación | Aprovechar lotes existentes; verificar alcance actual antes de ampliar. |
| Relaciones de productos | Complementos y alternativas pertinentes | Curación explícita; no sustituciones médicas automáticas. |
| Documentación del fabricante | Fichas técnicas, composición, instrucciones y advertencias | Procedencia, actualización y permisos de publicación. |
| Reposición por sucursal/proveedor | Apoyar compras y disponibilidad | Validar demanda, plazos y herramientas existentes. |
| Campañas Buen Fin | Ofertas claras y medibles | Elegibilidad, vigencias y reglas de precios reales. |
| Catálogo descargable | Venta asistida y consulta offline | Snapshot fechado; precios privados pueden reenviarse. |

## Checkout: descubrimiento requerido antes de cerrar el flujo

El usuario corrigió la propuesta simplificada de pedido: además de ítems/total, requiere considerar alta y reconocimiento de clientes, direcciones guardadas/nuevas, acceso con o sin sesión, entrega propia, Skydropx/Envíos Perros y restricciones por direcciones/zonas o teléfonos. La sugerencia de postergar el chatbot fue tentativa, no aprobación de excluirlo. En ese momento esas modalidades estaban abiertas; D25/D26/D29 posteriores aprueban prepago web, cotización pendiente y reserva al iniciar pago. Implementación de pago/reserva y generación de guía siguen pendientes. Ver [contrato de pagos y reservas](payment-contract-proposal.md), con evidencia backend: el checkout actual del bot crea crédito y descuenta stock, no cumple esas reglas web.

Fuente indicada explícitamente por el usuario: «el chatbot tiene las reglas hermano, estoy seguro. preguntale a el.» Consultar directamente a su agente, no reconstruir las reglas desde backend ni inventar tarifas. Tras sesión corrupta y reenvío solicitado por el usuario, el agente de reemplazo entregó el informe `4a5e7db3-008f-4d85-b4ff-2237d1029ec9`. Evidencia y recorrido provisional en [descubrimiento de checkout/logística](checkout-logistics-discovery.md). Backend principal confirmó cancelación de investigación logística duplicada (mensaje `e0887d00-c286-412a-b057-d83969bd3e96`); no produjo informe nuevo.

Evidencia solicitada: secuencia real cliente/dirección/cobertura/restricciones/cotización/confirmación; configuración frente a reglas fijas; cotizar frente a comprar guía/cobrar/reservar; contratos backend usados frente a lógica exclusiva del bot. No trasladar identidad del canal conversacional a sesión web por inferencia ni mostrar direcciones guardadas por conocer teléfono/correo. Separar restricciones territoriales de restricciones de contacto, sin copiar datos personales a documentación.

Investigación de solo lectura por el agente chatbot, sin llamadas a proveedores, DB, credenciales, envíos ni modificaciones. La aclaración del chatbot `80f084c8-804f-4934-a159-c029d884c6e9` corrigió la búsqueda inicial insuficiente: sí existen documentos/antecedentes de entrega propia y Envíos Perros, aunque no prueban motor territorial ni integración EP actuales. Blacklist comercial sigue sin fuente localizada. Backend corroboró archivo y memoria históricos (`2b82c97f-cbbf-4bb2-a4a3-4f861a3040af`); fuentes reconciliadas; D23 confirma las cuatro categorías para web, pero faltan cobertura concreta, demás parámetros logísticos y efectos del pedido antes de cerrar checkout, sin pedir al usuario ubicar archivos ya identificados ni copiar tarifas hardcoded. D27 resuelve el requisito de identificación al cotizar/pagar; mecanismo técnico y reutilización exacta de identidad del chatbot siguen pendientes.

## Reglas comerciales todavía abiertas

- D19 resuelve ausencia/cero y respaldo autorizado: «Consultar precio» sin compra si no hay candidato válido. Precisar representación/orden/filtros de fichas consultables sin asignarles precio numérico ficticio.
- D18 resuelve elección del menor precio elegible sin acumulación automática en el nuevo catálogo. Detallar elegibilidad, cantidades/unidades, vigencias, impuestos/redondeo, empate/procedencia y alcance por otros canales.
- Vigencia de cotización y cambios durante carrito/handoff.
- D20 aprueba catálogo abierto y condiciones particulares para cliente identificado/autorizado. D21 aprueba registro abierto y vínculo verificado; D22 define correo verificado e invitación a contacto validado. Precisar implementación de verificación/vínculo, recuperación, revocación y sesión sin permisos de personal.
- Conversión de empaques, mínimos y cantidades fraccionarias.
- Lotes por variante: dirección aprobada (D8); faltan reglas de recepción, asignación/salida, devoluciones, caducidad y trazabilidad. No exigir lotes a productos que no los necesitan.
- Propiedad central o por tenant de atributos, opciones y familias.
- Entrega/retiro, cobertura, costos, plazos y políticas reales.
- Familias y atributos obligatorios; administración de opciones y unidades.

## Secuencia de trabajo propuesta

1. Detallar el modelo híbrido aprobado D11/D12, vocabulario inicial y límites operativos con evidencia del agente backend.
2. Acordar familias iniciales y ejemplos representativos; definir alcance de lanzamiento frente a mejoras posteriores.
3. Resolver decisiones comerciales y contratos compartidos con backend/chatbot, sin asumir paridad actual.
4. Preparar brief de v0: pantallas, estados, datos realistas, versión móvil y dirección visual aprobada.
5. Solo después de autorización de implementación: cambios acotados con pruebas y documentación. No hay autorización para borrar datos, publicar o desplegar.

## Referencias

- [Vocabularios iniciales amplios](product-vocabularies.md): 514 códigos de opciones propuestos; cobertura revisada, no semillas ni taxonomía definitiva.
- [Contrato de productos especializados](product-contract-proposal.md): recomendación frontend/backend, pantallas y aceptación del primer corte; no API implementada.

- `src/features/POS/products/interfaces/product.types.ts`: Product, ProductDetail, ProductVariant, ProductLot y precios escalonados.
- `src/features/system/catalog-settings/interfaces/catalog-settings.types.ts`: publicación y listas públicas, distintas de asignaciones privadas.
- Reporte del agente backend principal, mensaje `06193df3-6c2e-4374-b489-6e0cfd942025`: contratos y diferencias de precios observadas.
- Evaluación backend, mensaje `c6fc3f05-879e-41bd-88a2-9af73be7bed4`: viabilidad aditiva del híbrido, categorías/variantes actuales, límites de lotes, cantidades y filtros. Inspección, no pruebas ejecutadas.
- Mapa backend, mensaje `5033cc11-d6da-496e-b9c7-750462e6a794`: abastecimiento, costos, caja, falta de trazabilidad por lote y posible brecha de ownership. Investigación estática cerrada, sin escrituras ni tests ejecutados.
- Capturas proporcionadas por el usuario el 22 de octubre de 2026, series 16:59–17:03 y 19:23–19:26. No se copian imágenes al repositorio.

## Registro de decisiones

- D11/D12, usuario: «si hermano, completamente. algo extra que tambien olvide decirte es que en campos select como animal o especie o incluso las etiquetas "cambiantes" de las que hablamos, deben ser muy bastas hermano, deben contener muchas muchas opciones, mas vale que sobre alguna a que falten muchas, me sigues?» Modelo conceptual aceptado y cobertura inicial amplia requerida.

- Usuario (D10/N1): «asi es, cedis y otras sucursales pertenecen a la misma empresa y si, se trasladan mercancia internamente. la ultima pregunta no la entendi.»

- Usuario: «para ambos hermano, con la misma importancia.» — D2.
- Usuario: «lo que vende el negocio es todo tipo de productos para mascotas y animales» — D4.
- Usuario: «las decisionces importantes no solo las guardes en memoria, tambien en un .md, por favor.» — D7.
- Modelo híbrido de atributos configurables: aceptado en D11. Backend considera viable una capa aditiva; el esquema y la implementación siguen sin aprobarse.
- Evidencia incorporada: variantes y lotes son incompatibles actualmente. Usuario elige ampliar trazabilidad por variante (D8), sin aprobación todavía del diseño técnico o migraciones.
- Solicitud ampliada de planificación (D9), transcripción del último mensaje del usuario:

> en algunos casos si hermano. todo lo que mencionas me gusta mucho, desde el hecho de alertas de caducidad, identificacion de productos con poca rotacion, apoyo a reposicion por sucursal (esto no se muy bien que significa) y lo de la informaciond e proovedores y tiempos de abastecimiento si creo que valdria la pena plantearlo bien hermano, porque posiblemente requeriria su propio modulo aparte o tal vez su propia tabla, no lo se, el tema es que ahora podemos saber cuando salen los productos, pero no cuando entran a la empresa, no se puede, no hay una seccion para eso, proovedores, como se les paga, de donde se les paga, que productos se les ha comprado, y muchas mas cosas que se podrian agregar alli, me explico? comparas, gastos, todo eso es algo que mis clientes si quieren hermano, es algo que se valoraria mucho. sin embargo hay que tener un plan bien detallado de que hacer, como hacerlo, etc.. porque tengo otros proyectos, y quiero dejarte a ti con el plan bien fresco para que lo implementes mientras atiendo otras cosas. me sigues? y por el tema de la limitacion importante que encontraron, creo que yo me inclino por ampliar el sistema para manejar lotes por variantes, es mejor tenerlo a no tenerlo y que me busquen para que lo agregue en algunos yers. me sigues hermano?
