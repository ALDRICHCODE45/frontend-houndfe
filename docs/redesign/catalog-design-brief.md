# Catálogo HoundFe — brief funcional para discutir el diseño

**Entrega documental autorizada; no interfaz implementada ni solicitud a v0.** D38 aprueba pantallas y D39 la dirección visual general; composiciones y diseño final aún requieren revisión. Este brief prepara la siguiente conversación visual, sin aprobar contratos técnicos, fechas de lanzamiento o nuevas reglas de negocio.

## 1. Ruta de lectura y autoridades

1. Revisar primero la entrega catálogo/ficha/publicación (§2–5), con igual atención a minoristas y mayoristas.
2. Recorrer estados comerciales y ejemplos (§6–8); los pendientes logísticos no impiden diseñar estados seguros.
3. Validar dirección visual y revisar la lista de traspaso (§9–10) antes de preparar una ejecución posterior en v0.

| Autoridad | Uso en este brief |
| --- | --- |
| [Estrategia y decisiones D1–D38](catalog-product-strategy.md) | Reglas comerciales aprobadas; no capacidades disponibles. |
| [Contrato de producto propuesto](product-contract-proposal.md) | D13 completo, límites descriptivos, permisos, facetas y privacidad. |
| [Vocabularios §7: mínimos D14](product-vocabularies.md#7-mínimos-de-publicación-aprobados-d14-aún-no-implementados) | Requeridos por familia según pertinencia, sin inventar datos. |
| [Resumen para la junta](business-meeting-brief.md) | Lenguaje de negocio y pendientes que no deben prometerse. |
| [Contrato de pago: estados propuestos](payment-contract-proposal.md#3-estados-ortogonales-propuestos-no-enumeraciones-finales) | Separar cotización, pago, reserva, preparación y reembolso. |

Las decisiones explícitas prevalecen sobre recomendaciones anteriores. Este archivo no sustituye las autoridades ni añade reglas comerciales.

## 2. Alcance aprobado y orden de diseño

| Entrega de diseño | Pantallas incluidas | Dependencias y límite |
| --- | --- | --- |
| **Primera: catálogo, ficha y publicación administrativa** | Catálogo público; detalle de producto; familias; diccionario; producto/presentaciones; borrador persistente, preview privado, comparación y publicación. | Especificar bindings, mínimos por subtipo, permisos/ámbito empresarial, medios y resolución comercial. No exige terminar compras, finanzas o todo el ERP primero. |
| **Posterior: compra y seguimiento** | Carrito; identificación/dirección; envío/resumen; pago/resultado; cuenta. | Identidad/vínculo, precios autoritativos, cobertura/tarifas/paquetes y pago/reserva seguros. Diseñar incertidumbre ahora; no habilitar cobro con datos pendientes. |
| **Operación web de ese recorrido** | Cotizaciones; pedidos; cancelaciones; incidencias de pago y reembolso. | Permisos efectivos, preparación explícita y estados autoritativos; no contabilidad ni plataforma financiera completa. |

Las dos últimas filas se detallan aquí funcionalmente, sin convertirlas en primera entrega visual. La planificación de abastecimiento puede avanzar en paralelo sin acoplar toda su ejecución al catálogo.
**Fuera de alcance:** favoritos, reseñas, fidelidad, suscripciones y promociones nuevas. Solo representar promociones existentes cuando resulten elegibles. Sin acciones reales, código, esquema, migración, proveedor contratado o cambio de bot/POS.

## 3. Matriz actor → objetivo → estado → acción

Los actores describen acceso efectivo, no puestos ni roles nuevos obligatorios.

| Actor / pantalla | Objetivo | Estado que debe distinguir | Acción o límite visible |
| --- | --- | --- | --- |
| Visitante / catálogo | Encontrar una presentación | Cargando, resultados, vacío, error | Buscar, filtrar y ordenar; retirar filtros o reintentar. Sin registro obligatorio. |
| Minorista / ficha | Elegir contenido y cantidad | Presentación elegida, disponible/no disponible, precio consultable | Ver información publicada; agregar solo si es comprable; «Consultar precio» sin agregar si falta candidato válido. |
| Cliente comercial vinculado / catálogo-ficha | Comprar con sus condiciones | Contexto autorizado vigente o acceso revocado | Ver precio resultante propio; nunca acuerdos ajenos ni beneficio por declararse mayorista. |
| Comprador / carrito | Revisar lo que desea comprar | Vacío, válido, precio/stock cambiado | Editar cantidades, retirar líneas y revisar cambios; el carrito no reserva. |
| Comprador / identificación-dirección | Continuar sin perder carrito | Correo pendiente/verificado; vínculo pendiente/autorizado | Registro breve al cotizar/pagar; direcciones privadas solo con vínculo autorizado. |
| Comprador / envío-resumen | Conocer total y opciones reales | Confirmado, revisión pendiente, vencido, entrega imposible | Pagar solo con total confirmado; solicitar/actualizar cotización o indicar otra dirección. |
| Comprador / pago-resultado | Saber qué ocurrió sin pagar dos veces | En curso, pendiente/desconocido, confirmado, fallo confirmado | Recuperar mismo intento si hay duda; nuevo intento solo tras fallo confirmado y revalidación. |
| Cliente / cuenta | Seguir su compra o solicitud | Cotización lista/vencida; pedido; cancelación; reembolso | Revisar total, actualizar cotización, consultar estado o solicitar cancelación según preparación. |
| Personal autorizado / familias-diccionario | Mantener referencias comunes | Vigente, archivado, incompatible, sin permiso | Buscar todas las opciones pertinentes; mantenerlas con controles D16/D17 y diagnóstico. |
| Editor / producto-presentaciones | Preparar contenido completo | Sin publicado/con publicado; guardado/cambios locales | Elegir familia y editar contenido descriptivo; guardar/retomar el único borrador, sin crear variantes ficticias. |
| Actor con permiso de publicar / revisión | Ver diferencias y faltantes | Preview privado, incompleto, listo, conflicto | Comparar; publicar con validación vigente o descartar confirmado. Editar no concede publicar. |
| Personal autorizado / cotizaciones | Resolver entrega y costo | Pendiente, resuelta, imposible, necesita nueva revisión | Confirmar datos reales y vigencia; no cobrar ni apartar por resolver. |
| Personal autorizado / pedidos | Preparar o atender cancelación | Pago confirmado; preparación no iniciada/iniciada | «Iniciar preparación» registra actor/momento; coordinar con cancelación, no activarla por abrir pedido. |
| Personal autorizado / incidencias | Seguir dinero y pedido por separado | Cobro desconocido/tardío; reembolso pendiente/fallido/confirmado | Consultar/reconciliar estado autorizado; sin ocultar cobro ni declarar devolución por solo solicitarla. |

## 4. Primera entrega: catálogo y detalle

- **Catálogo:** búsqueda, categoría distinta de familia, facetas pertinentes, selecciones removibles, conteo de productos y orden global; no simular orden global ordenando cada página.
- Solo contenido publicado y elegibilidad operativa vigente. Diccionario administrativo amplio no implica filtros públicos vacíos; selecciones activas que pasan a cero siguen removibles.
- Facetas propuestas: OR dentro del atributo y AND entre atributos; todos los atributos vendibles deben coincidir en una misma presentación elegible. Contar productos únicos antes de paginar, sin exponer otros contextos.
- **Ficha:** título comercial, imágenes, descripción, atributos pertinentes, selector explícito de presentación/contenido/unidad y cantidad. No equiparar paquete de tres con tres unidades de inventario.
- Precio y disponibilidad son dinámicos: mostrar estado actualizado, no garantía de reserva. D18 elige el menor precio válido y autorizado para cliente/cantidad; no acumula descuentos ni fuerza un acuerdo peor que una promoción elegible.
- D19: ausente/cero no es precio de compra. Sin otro candidato autorizado, mostrar exactamente **«Consultar precio»** y bloquear agregar esa presentación; las hermanas válidas siguen comprables si cumplen las demás reglas.
- No usar ausencia como cero ni incluirla en «Desde». Precio representativo, orden/filtro de fichas consultables y comparabilidad fiscal/unidades siguen por especificar; no decidirlos mediante un mockup.
- D20–D22: explorar precios públicos sin cuenta; registro nuevo parte de condiciones públicas. Acceso particular exige vínculo verificado mediante invitación al contacto validado; contacto desactualizado pasa a revisión autorizada, sin fusionar clientes automáticamente.

## 5. Primera entrega: administración y ciclo D13 completo

Separar información comercial, atributos/presentaciones y revisión/publicación de la operación viva. Familia no se asigna por elegir categoría. Diccionario/plantillas comunes de empresa no comparten productos, clientes, precios o existencias entre tenants.

| Paso | Comportamiento funcional exigido para el diseño |
| --- | --- |
| Crear/retomar | Un solo borrador privado activo por producto, persistente entre sesiones, y una sola versión descriptiva publicada; alta puede no tener publicado. |
| Editar/guardar | Título comercial, descripción, imágenes y atributos product/sellable. Mostrar guardado, pendiente y error; faltantes permiten guardar, captura malformada no. |
| Presentaciones | Atributos sellable en producto simple o variantes reales, sin herencia/fallback ni generación de combinaciones. Cambio simple↔variantes requiere asignación explícita; cambio de familia muestra incompatibilidades antes de confirmar. |
| Previsualizar/comparar | Autenticado y privado, `no-store`; indicar si muestra entradas sin guardar y comparar con publicado o su ausencia. No guarda ni publica por mirar. |
| Validar/publicar | Mostrar faltantes por producto/presentación. Revalidar permisos, revisiones, definiciones, medios y presentaciones vigentes; éxito atómico reemplaza descripción publicada y consume borrador. |
| Fallo/conflicto | Conservar publicado, borrador persistido y entradas locales; explicar referencia invalidada o edición concurrente. Releer/comparar y resolver sin sobrescritura, mezcla automática o publicación parcial. |
| Descartar/salir | Confirmar descarte con revisión vigente: elimina solo borrador, no producto/publicado. Avisar cambios locales al salir; no prometer recuperarlos en otra sesión sin guardado. |

**No pertenece al borrador:** nombre operativo/POS, SKU/código de barras, existencia/estado de variantes, precios/promociones/impuestos, stock/lotes/caducidad, unidad de venta, visibilidad/acceso o receta. Publicar/descartar no restaura esos datos ni enciende visibilidad. El título comercial no sincroniza el nombre operativo.
**Privacidad:** ni borrador, comparación, medios exclusivos o datos internos en respuestas, cachés o índices públicos; medios exclusivos sin URL pública estable/CDN público. No borrar imágenes referidas por publicado al cambiar/descartar. Acceso y pertenencia se verifican, no se deducen del navegador.
**D16:** opción archivada impide nuevas asignaciones; conserva valores válidos publicados y filtros sujetos a elegibilidad, con advertencia administrativa. Republicar exige corregir; no resucitar variantes/medios archivados ni usar archivo para ocultar información peligrosa.

### Mínimos D14 a representar, no ampliar

| Familia | Diagnóstico de publicación según pertinencia |
| --- | --- |
| Alimentos | Destinatario declarado, formato, contenido y unidad por presentación. |
| Premios/carnazas | Destinatario declarado, forma, contenido/piezas y unidad. |
| Juguetes | Tipo, destinatario declarado y dimensiones relevantes. |
| Higiene | Tipo; presentación/contenido si consumible; destinatario si se aplica al animal. |
| Accesorios | Tipo y medidas de ajuste/capacidad determinantes para elegir. |
| Hábitats/equipo | Tipo, medidas/capacidad pertinentes y especificaciones eléctricas si corresponden. |
| Cuidado/veterinaria | Tipo, presentación, contenido y documentación/advertencias requeridas según producto; resolver reglas legales/receta aplicables antes de habilitar publicación. |

Campos sugeridos no bloquean; desconocido, no aplicable y falso son distintos. No inventar especie para una bomba ni compatibilidad por clasificación animal. Bindings y aplicabilidad por subtipo requieren precisión contractual; no reabrir mínimos aprobados.

## 6. Compra posterior: estados seguros sin esperar datos logísticos

- **Identificación (D27/D28):** preservar carrito al verificar correo y revalidar contexto/precio. Restricción confirmada bloquea cotizar/pagar con mensaje neutral y contacto; coincidencia dudosa pasa a revisión sin cobro ni rechazo por parecido. No mostrar notas internas.
- **Entrega (D23/D26):** FREE = reparto propio gratuito; SURCHARGE = recargo confirmado por personal; CARRIER_ONLY = paquetería, no cliente bloqueado; UNKNOWN = revisión. Si falta cobertura, recargo o tarifa, ofrecer solicitud de cotización, no total definitivo ni promesa de envío.
- **Resumen (D24/D25):** prepago completo de mercancía y envío confirmado; sin crédito/saldo en puerta por mayoreo. Paquetería: apoyo de $120 MXN por unidad con precio final estrictamente mayor a $500, limitado al envío; sin saldo a favor ni aplicación automática al recargo propio.
- **Cotización (D36/D37):** mostrar total y vencimiento sustentados; vencida conserva contenido y ofrece «Actualizar cotización». Revisar precio/stock/envío y obtener aceptación de cambios; si no se actualiza automáticamente, volver a revisión sin cobro/reserva. Entrega imposible confirmada muestra «No podemos ofrecer entrega en esta dirección» y permite nueva dirección/solicitud, sin prometer retiro ni exigir WhatsApp.
- **Inicio de pago (D29/D30/D34):** solo tarjeta en lanzamiento, proveedor pendiente. Revalidar todo antes de reservar/iniciar cobro; insuficiencia se informa antes. Objetivo de apartado: 15 minutos, condicionado a cierre seguro y total sostenible toda la ventana; contador no reinicia al recargar ni prueba impago al vencer.
- **Resultado (D31/D32):** pendiente/desconocido recupera el mismo intento; retorno del navegador no confirma pago. Pago confirmado puede tener pedido/asignación aún en recuperación: mostrar ambos. Tardío intenta asegurar pedido completo al total aceptado sin desplazar reservas ajenas; si no puede, resolución y reembolso, sin sustituciones/cargos automáticos ni reactivar pedido cancelado.
- **Cuenta/operación (D31–D35):** cancelación automática antes de preparación; después, revisión sin política general inventada. Preparación inicia explícitamente por personal, no por pago. En los dos casos D32, reembolso íntegro de lo cobrado incluido envío, medio original y sin descontar comisión; pendiente hasta resultado, sin fecha bancaria prometida. Avisos por correo verificado y seguimiento web para cotización lista, pago confirmado, envío e incidencias/reembolso; sin mensajes reales en esta fase.

## 7. Ejemplos ficticios para conversar, no evidencia de aceptación

| Caso ilustrativo no médico | Qué debe poder explicarse en el diseño |
| --- | --- |
| Minorista busca «Comedero de acero, 700 ml» | Elige capacidad/presentación real, revisa precio público y arma carrito sin cuenta; iniciar sesión no reserva stock. |
| Mayorista autorizado compra 12 comederos | Candidatos comparables por unidad: lista $100, escala $90, acuerdo $85, promoción elegible $80 → $80; sin elegibilidad de promoción → $85, sin sumar descuentos. |
| Visitante se registra y dice ser mayorista | Conserva carrito y condiciones públicas; puede solicitar condiciones, no ver acuerdos privados sin asignación/vínculo autorizado. |
| «Correa de paseo» azul/1 m y roja/2 m | Azul + 2 m no coincide combinando hermanas. Si azul carece de precio válido: «Consultar precio», sin impedir comprar roja elegible. |
| Dos unidades a precio final $600, paquetería $310 | Apoyo $240; envío a pagar $70. A $500 exactos no califica; sin tarifa confirmada solo cotización pendiente, no cobro. |
| Editor guarda correa sin medida requerida | Retoma borrador privado incompleto; la publicación anterior sigue intacta. Completa dato respaldado antes de publicar, no altera precio/stock. |

## 8. Estados transversales a dibujar

| Estado | Respuesta esperada en las propuestas de pantalla |
| --- | --- |
| Vacío | Distinguir sin resultados, carrito vacío, sin cotizaciones y producto sin publicado; ofrecer siguiente acción pertinente sin inventar datos. |
| Carga | Identificar consulta/guardado/validación en curso y evitar acciones duplicadas; no mostrar precio anterior como recién confirmado. |
| Error | Explicar qué no se completó, conservar entradas/carrito y permitir recuperación segura; error de red no equivale a pago fallido. |
| Sin permiso / sesión vencida | No revelar recursos ajenos; distinguir acceso cliente/personal y recuperar acceso autorizado sin mantener datos privados en caché. |
| Sin guardar / conflicto | Aviso al salir, revisión guardada diferenciada y comparación recuperable; nunca sobrescritura silenciosa ni promesa de autosave. |
| Referencia/medio invalidado | Diagnóstico junto al campo/presentación; publicar bloqueado sin borrar borrador/publicado ni restaurar operación anterior. |

## 9. Dirección visual y requisitos de diseño propuestos

**Dirección general aprobada D39; detalle visual todavía por proponer:** una tienda especializada, cercana y profesional, con fondos claros, contraste alto, acento cromático contenido, fotografía de producto protagonista y jerarquía nítida para presentación, cantidad y precio. Catálogo y administración comparten lenguaje visual, con mayor densidad informativa en administración; evitar apariencia de POS genérico y ruido promocional. El [prompt para v0](v0-public-catalog-prompt.md) concreta la guía de paleta, tipografía y accesibilidad a partir del tema existente; no certifica activos disponibles ni diseño final.

**Propuestas para móvil/accesibilidad, no aprobaciones adicionales:** filtros en panel con selecciones/resumen conservados; ficha y carrito sin desplazamiento horizontal; acciones principales sin tapar contenido. Administración adaptable con secciones y comparación legibles, sin ocultar faltantes. Teclado completo, foco visible/restaurado, etiquetas y errores asociados, estados anunciables y contraste verificable; no depender solo de color/hover ni de animación. Revisar lector de pantalla y objetivos táctiles en diseño/implementación futuros, no declararlos probados aquí.

## 10. Traspaso y pendientes de validación

- [x] Dirección visual general aprobada D39 y prompt documental preparado para v0; no se ha generado ni aprobado una interfaz.
- [ ] Preparar después composiciones catálogo/ficha/publicación con los estados D13, D14, D18/D19 y privacidad; revisar minorista y mayorista con los ejemplos ficticios.
- [ ] Precisar bindings por subtipo, precio representativo/orden sin precio, permisos/ownership, medios y concurrencia con los contratos responsables; no inventar APIs o roles.
- [ ] Para checkout/cuenta: confirmar identidad/recuperación/revocación, cobertura, tarifas, vigencia, paquetes y proveedor/cierre seguro de 15 minutos; mantener pendientes visibles mientras tanto.
- [ ] Separar prueba visual futura, pruebas funcionales futuras y autorización de implementación. Esta entrega solo documenta: no hay UI, pruebas de aplicación, cobros, reservas, avisos o evidencia de aceptación ficticia.

**Siguiente paso:** usar el prompt público solicitado en v0 y revisar su propuesta; administración queda como entrega separada. Este brief no envía solicitudes externas ni autoriza implementación, publicación o despliegue.
