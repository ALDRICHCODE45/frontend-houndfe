# Prompt para v0 — catálogo público HoundFe

Actúa como diseñador senior de producto, UX/UI y accesibilidad especializado en comercio electrónico. Crea una propuesta base visual de alta calidad para **HoundFe**, una tienda mexicana de productos para mascotas y animales que atiende por igual a compradores minoristas y mayoristas.

## 1. Entregable y límites obligatorios

Quiero un **prototipo visual navegable**, no una aplicación de negocio implementada. Usa datos ficticios y estado local exclusivamente para demostrar navegación, selección de presentación, cantidades, filtros, formularios y estados. Marca el entorno como «Demostración · Datos ficticios» de manera discreta pero persistente.

No conectes bases de datos, APIs, autenticación, correo, WhatsApp, bancos, pasarelas, inventario, analítica ni servicios reales. No solicites credenciales, datos reales de clientes o números de tarjeta. No construyas servidores ni lógica comercial de producción. Los importes, estados y resultados del prototipo son escenarios preparados, no verificación real.

El producto existente utiliza Vue 3, Vite, TypeScript, Nuxt UI y Tailwind CSS. Esta entrega es referencia de diseño para ese producto. Si tu entorno necesita React/Next.js para renderizar el prototipo, úsalo solo como soporte visual: no implica migrar la aplicación. Separa componentes, tokens y fixtures para facilitar la adaptación posterior.

**No diseñes un POS, un dashboard administrativo ni un ERP.** Esta propuesta cubre la experiencia pública del comprador. La administración de productos, proveedores e inventario es otro frente.

Prioridad de ejecución: primero catálogo y detalle excelentes; después carrito y recorrido de compra/cuenta con la misma calidad visual. No entregues únicamente una landing ni un collage de componentes. No envíes mensajes, generes guías, cobres, reserves mercancía ni afirmes que esas funciones están implementadas.

## 2. Dirección visual

Una tienda especializada, cercana, confiable y profesional: moderna sin ser fría, familiar sin verse infantil. Debe servir tanto a una persona que compra un comedero como a un negocio que compra varias presentaciones.

Prioriza productos, búsqueda, información y claridad de precios. Evita estética de software corporativo, hero de pantalla completa, grandes gradientes, glassmorphism, fondos oscuros dominantes, exceso de banners, mascotas caricaturescas por todas partes y plantillas genéricas de tres tarjetas.

Puedes proponer composición y detalles propios dentro de estos límites. No copies una tienda conocida ni inventes un rediseño del logotipo. Si no recibes el logo, usa un wordmark tipográfico «HoundFe» y decláralo provisional.

## 3. Paleta y tokens

Usa esta base, tomada de colores existentes del producto y adaptada a una experiencia pública clara. No la presentes como un manual corporativo certificado.

| Token | Color | Uso |
| --- | --- | --- |
| Fondo general | `#F5F6F8` | Fondo de página, sin grandes bloques oscuros. |
| Superficie | `#FFFFFF` | Tarjetas, formularios y paneles. |
| Superficie suave | `#E7EEF7` | Agrupaciones o información secundaria. |
| Títulos | `#173968` | Jerarquía principal y marca tipográfica. |
| Texto | `#24313D` | Lectura principal. |
| Texto secundario | `#576574` | Descripciones y ayudas legibles. |
| Acción principal | `#2442F6` | CTA, enlaces y selección; texto blanco. |
| Hover principal | `#1D35C4` | Variación de interacción, no otro color de marca. |
| Selección suave | `#EDF0FF` | Fondo seleccionado con texto azul. |
| Acento dorado | `#F6BB13` | Detalles puntuales, no todos los botones. |
| Dorado suave / texto | `#FFF5D6` / `#443218` | Mensajes cálidos legibles; nunca texto blanco sobre dorado. |
| Borde decorativo | `#DCE2E8` | Separadores no esenciales. |
| Borde de control | `#7B8999` | Ajuste de contraste para campos sobre blanco y fondo general; comprobar contexto final. |
| Éxito | `#236044` sobre `#EAF5EF` | Estado positivo, siempre con texto/icono. |
| Advertencia | `#805511` sobre `#FFF5D6` | Atención o revisión, sin alarmismo. |
| Error | `#B42318` sobre `#FEF3F2` | Error accionable, no único indicador de estado. |

El azul es la acción principal consistente; el dorado es acento contenido. Los colores semánticos no deben confundirse con descuentos. No agregues cian, morado o degradados como acentos competidores. Usa tokens, no colores distintos por pantalla. Tema claro prioritario; no añadas selector oscuro sin necesidad.

Tipografía: **Manrope**, con fallback `ui-sans-serif, system-ui, sans-serif`. Texto base 16 px e interlineado aproximado 1.5; títulos de página 28–40 px según pantalla; títulos de producto 16–20 px; ayudas 14 px. Precios con cifras tabulares cuando sea útil. No usar mayúsculas en párrafos ni texto diminuto para condiciones importantes.

Espaciado consistente de 4/8/12/16/24/32/48 px; tarjetas con radio 12 px, controles 8 px y chips tipo píldora solo donde sean adecuados. Sombras muy discretas: bordes y espacio antes que elevación por todas partes. Iconos de una sola familia y peso, sin emojis como iconos de interfaz.

## 4. Layout responsive y navegación

Diseña mobile-first. Verifica composiciones a 360, 390, 768, 1024 y 1440 px, y reflujo accesible a 320 CSS px. Contenedor máximo aproximado 1360 px; márgenes laterales 16 px móvil, 24 px tablet y 32 px escritorio.

Header: wordmark, búsqueda protagonista, acceso a cuenta y carrito con cantidad. En móvil, búsqueda en segunda fila si mejora el espacio. Menú de categorías compacto, accesible por teclado y toque. No sidebar de administración ni navegación permanente que quite espacio al catálogo.

Grid adaptable: una o dos columnas en móvil según legibilidad real, tres en tablet y hasta cuatro con filtros laterales en escritorio. No fuerces dos columnas si rompe títulos, precios o botones. Usa fotografías consistentes, fondo limpio y relación de aspecto estable; para envases/objetos, evita recortar información con un cover agresivo.

En móvil, filtros en panel con selección, aplicar y limpiar visibles. Conserva contexto al volver del detalle: búsqueda, filtros y posición. Header o acciones fijas no deben tapar contenido, mensajes, teclado virtual ni foco. Respeta zonas seguras del dispositivo.

Footer sobrio con ayuda y lugares para políticas reales. No inventes domicilios, teléfonos, certificaciones, textos legales definitivos ni enlaces que aparenten estar operativos.

## 5. Arquitectura de pantallas

Diseña estas vistas conectadas, con navegación local de demostración:

1. Catálogo/listado público, con búsqueda y filtros.
2. Detalle de producto y selección de presentación.
3. Carrito.
4. Identificación, registro/verificación y dirección.
5. Envío, cotización y resumen antes de pagar.
6. Paso visual de pago y resultados.
7. Mi cuenta: cotizaciones, pedidos y su detalle/seguimiento.

No inventes favoritos, reseñas, estrellas, puntos, suscripciones, compras recurrentes, comparador, recuperación de carrito por marketing ni campañas nuevas. No agregues «Compra ahora» que salte validaciones. El acceso mayorista comparte la misma tienda: no diseñes un sitio distinto.

## 6. Catálogo: encontrar antes que decorar

Entrada con título breve, búsqueda visible, categorías y productos útiles arriba del primer pliegue. Si usas un bloque editorial, que sea compacto y no empuje el inventario debajo de una gran imagen.

Familias de producto: alimentos; premios/carnazas; juguetes; higiene; accesorios; hábitats/equipo; cuidado/veterinaria. Categoría de navegación y familia de atributos no son necesariamente lo mismo. La tienda no vende solo para perros/gatos: contempla aves, peces, reptiles y pequeños mamíferos cuando haya productos con información respaldada.

Filtros pertinentes: destinatario declarado, tipo, marca, contenido/presentación, tamaño, material o etapa cuando exista información válida. No mostrar todos los filtros para todas las familias ni listas gigantes vacías. Una bomba de acuario no necesita una especie inventada. Evita compatibilidades médicas o recomendaciones sanitarias deducidas por la UI.

Selecciones múltiples del mismo atributo se combinan como alternativas; atributos distintos se combinan como requisitos. No mezcles atributos de presentaciones hermanas: si existe azul/1 m y roja/2 m, filtrar azul + 2 m no debe mostrar coincidencia falsa. Conteos por productos, no por número de variantes; fixtures coherentes con los filtros. Selecciones con cero resultados siguen visibles para poder quitarlas.

Incluye chips removibles, limpiar filtros, número de resultados y orden. El orden debe ser coherente sobre el conjunto ficticio, no solo dentro de una página. No inventes ventas históricas o ranking «Más vendidos». Para el demo puedes usar nombre A–Z; decisiones definitivas de precio representativo/orden sin precio quedan para el producto real.

Tarjeta: fotografía, nombre legible, marca si está disponible, presentación o aviso de varias opciones, precio contextual y acción clara. Un producto con varias presentaciones muestra «Elegir presentación»; solo agregar directamente si la identidad y el precio están claros. No botones anidados dentro de un enlace de tarjeta.

## 7. Detalle de producto y precios

Galería con miniaturas y ampliación accesible, información comercial publicada, atributos pertinentes, presentación, cantidad y acción principal. El usuario debe distinguir claramente «cantidad de unidades» de «contenido de cada unidad»; un paquete de tres no implica automáticamente tres unidades del inventario.

Muestra especificaciones como talla, capacidad, contenido, medidas o material según producto. Campos desconocidos no equivalen a falso o «no aplica». Información sanitaria, advertencias y requisitos de receta nunca se inventan; representa un producto afectado como no habilitado para compra hasta resolver sus condiciones, sin simular aprobación médica.

Reglas de precios que la UI debe representar, no implementar como motor comercial:

- Precio válido más bajo para ese cliente y cantidad entre lista, escala por cantidad, acuerdo y promoción elegible. No apilar descuentos automáticamente.
- Un acuerdo no impide acceder a una promoción mejor si ese cliente cumple sus condiciones.
- Visitante ve condiciones públicas. Cliente identificado y vinculado ve solo sus condiciones autorizadas; no los acuerdos ajenos.
- Registrarse o declararse mayorista no concede descuentos. Puede solicitar condiciones, sin asignación automática.
- Precio ausente o cero no significa gratis. Si no hay otro precio autorizado válido, mostrar exactamente **«Consultar precio»** y no permitir agregar esa presentación. La ficha puede seguir visible y otras presentaciones seguir comprables.
- No usar cero como mínimo de «Desde». Si el demo usa «Desde», solo a partir de presentaciones elegibles con precio válido y aclarando condiciones; no diseñar una regla definitiva que aún no esté resuelta.
- Precio tachado, porcentaje y badge promocional solo si el fixture contiene una oferta válida comparable; no inventar urgencia, stock escaso ni contadores promocionales.

Importes en MXN, formato mexicano; en el resumen escribir la moneda explícitamente. No inventar desglose fiscal, factura automática ni cálculo de impuestos pendiente. Los precios de demostración no son precios reales.

## 8. Carrito y cuenta del comprador

Carrito editable con imagen, producto/presentación, cantidad, precio unitario, subtotal y retirar. Resumen claro; envío aún desconocido aparece **«Por confirmar»**, nunca como $0 ni como total final cobrable. Cambios de cantidad pueden cambiar precio elegible. Si cambió precio o stock, explicar y pedir revisión, no sustituir silenciosamente.

Explorar y armar carrito no requiere cuenta ni aparta mercancía. Cotizar o pagar requiere correo verificado, con registro breve que conserva el carrito. Mostrar estados: iniciar sesión, registro, verificación pendiente, correo verificado y vínculo comercial pendiente/autorizado. Solo prototipo; no enviar correos ni autenticar realmente.

Cliente comercial existente: acceso a condiciones/direcciones privadas tras vínculo verificado, mediante invitación al contacto previamente validado. Nombre, teléfono o número de cliente no bastan. Si el contacto no está actualizado, revisión del equipo. No fusiones automáticas ni permisos administrativos por registrarse.

Dirección: destinatario, calle, número exterior (permitir S/N cuando corresponda), interior opcional, colonia, CP, estado, municipio/ciudad y ayudas claras. No inventar validación real de cobertura o autocompletado conectado. Representar elegir dirección propia autorizada y capturar una nueva; no exponer registros de otro cliente. Guardar una dirección no debe parecer una vinculación comercial automática.

En formularios usa labels visibles, autocomplete/inputmode adecuados, errores junto al campo y resumen de errores. Permite pegar credenciales/códigos; no pruebes memoria con acertijos ni añadas CAPTCHA ficticio. Si el mecanismo de verificación no está decidido, muestra un estado genérico, no impongas OTP o enlace como contrato definitivo.

## 9. Envío y cotización

Cuatro situaciones comerciales:

- Reparto propio gratuito, solo cuando esté confirmado.
- Reparto propio con recargo confirmado por el equipo; no tarifa fija inventada.
- Paquetería fuera del reparto propio; no significa cliente bloqueado ni cobertura garantizada.
- Zona desconocida: revisión del equipo, sin gratuidad o rechazo automático.

Si faltan cobertura, recargo o tarifa, permitir **«Solicitar cotización»** sin cobrar, apartar stock ni prometer envío. El equipo resuelve; el cliente recibe aviso y vuelve a revisar el total, sin obligación de WhatsApp.

Cotización resuelta: importe, modalidad, total y fecha/hora de vencimiento sustentada en datos del escenario. No inventar un plazo universal. Vencida: conservar solicitud/carrito y ofrecer exactamente **«Actualizar cotización»**. Revalidar precio, disponibilidad y envío; si cambia algo, nueva aceptación. Si no puede renovarse automáticamente, revisión humana sin cobro/reserva.

Si la revisión confirma que no se puede entregar, mostrar **«No podemos ofrecer entrega en esta dirección»**, cierre de solicitud y opción de otra dirección/nueva cotización. No ofrecer retiro en sucursal ni obligar a ir al chatbot. No aplicar este cierre por el solo hecho de estar en zona desconocida.

Restricción comercial confirmada: impedir cotizar/pagar con mensaje neutral y contacto. Coincidencia dudosa: revisión antes de continuar, sin cobro ni acusaciones. No mostrar motivos internos, «lista negra», puntajes de fraude o datos ajenos. Esto es distinto de cobertura.

No hay cobertura real, proveedor logístico definitivo, horarios ni empaquetado general demostrados. No inventes «entrega mañana», cobertura nacional, bultos calculados automáticamente ni SLA. Una estimación de transporte no incluye necesariamente preparación; identifica ambas cosas cuando existan datos, sin sumar días arbitrariamente.

## 10. Apoyo de paquetería: mostrar el desglose correcto

Apoyo de **$120 MXN por cada unidad cuyo precio final después de descuentos sea estrictamente mayor a $500 MXN**, sin incluir envío. Sumar apoyos y limitar el aplicado al costo de paquetería. No saldo a favor y no aplicación automática a recargo de reparto propio.

Escenario: dos unidades a $600 cada una, envío cotizado $310. Mercancía $1,200; apoyo aplicado $240; envío a pagar $70; total $1,270 MXN. Mostrar claramente costo del envío, apoyo y cargo final, sin descontar $240 dos veces.

Si el envío cuesta $200 con el mismo potencial de apoyo, el cliente paga $0 de envío; no recibe los $40 restantes. Una unidad a $500 exactos o $480 no califica. No anunciar simplemente «envío gratis desde $500» porque sería falso.

## 11. Pago: simulación visual, nunca cobro

Lanzamiento web solo con tarjeta. Mercancía y envío confirmado se pagan íntegramente por adelantado. No efectivo, SPEI, OXXO, saldo en puerta, crédito mayorista implícito ni meses sin intereses por inferencia.

Pasarela sin seleccionar. Diseña una transición neutral hacia checkout alojado del proveedor, no un formulario HoundFe que capture datos de tarjeta. Usa una ilustración no editable o pantalla de estado y acción de simulación. No logotipos que impliquen contratación de Stripe/EVO/Mercado Pago ni certificaciones inventadas.

Antes de pagar se revisan identidad, condiciones, precio, disponibilidad y envío. Solo entonces comienza el apartado temporal; insuficiencia se informa antes de cobro. El objetivo aprobado es **15 minutos desde iniciar el pago**, condicionado a poder cumplirlo con seguridad. El total debe poder mantenerse durante toda esa ventana. Mostrar tiempo restante sin reiniciarlo al recargar; no iniciar contador al entrar al carrito.

Para el prototipo, usa reloj simulado controlable en el panel de escenarios; no un temporizador que obligue al revisor a apresurarse ni almacenamiento real. En producción el reloj será del servidor, no del navegador. No prometas extensión automática del apartado.

Estados separados: autenticación bancaria adicional requerida, procesando, resultado desconocido/pendiente, pago confirmado, fallo confirmado, apartado vencido, pago confirmado con pedido aún en recuperación. No usar un único check verde que confunda dinero recibido con mercancía preparada/despachada.

Una red fallida o volver del proveedor no prueba el pago. En resultado desconocido, mostrar **«Estamos verificando tu pago»**, consulta del mismo intento y advertencia de no repetirlo; no «Pagar otra vez». Un fallo confirmado permite nuevo intento con revalidación. Vencimiento y confirmación pueden coincidir: los fixtures deben respetar estos estados, no ejecutar un cobro simulado como consecuencia de esperar.

## 12. Pedido, cancelación y reembolso

Cuenta con lista/detalle de cotizaciones y pedidos; cantidades, presentación, desglose pagado, dirección ficticia autorizada y seguimiento. Separar estado del pago, preparación/entrega y reembolso. No mostrar un avance irreversible inventado por el reloj o por abrir el pedido.

Personal autorizado inicia preparación explícitamente al comenzar a reunir mercancía; recibir pago o abrir pedido no cuenta. En la UI pública se muestra el estado, no un botón administrativo para iniciarlo.

- Antes de preparación: cliente puede cancelar automáticamente. Confirmación clara, sin patrones de retención engañosos.
- Después de preparación: solicitar revisión del equipo; no prometer aceptación o reembolso automático.
- Pago tardío tras vencer apartado: intentar asegurar pedido completo al total aceptado sin quitar reservas ajenas; si no se puede cumplir, resolución y reembolso. Sin sustituciones ni cobros extra automáticos; un pedido cancelado no se reactiva por un evento tardío.
- En cancelación antes de preparación y pedido tardío no cumplible: reembolso de todo lo efectivamente cobrado, incluido envío, al medio original, sin descuento de comisión. HoundFe absorbe comisión no reintegrada. No convertirlo en saldo a favor ni devolver apoyo que nunca se cobró.
- Reembolso solicitado/pendiente/fallido/confirmado visibles; solicitar no significa dinero ya acreditado. Sin fecha bancaria inventada ni política general de devoluciones posteriores.

Avisos iniciales por correo verificado y seguimiento web: cotización lista, pago confirmado, pedido enviado e incidencias/novedades del reembolso. Sin emails por cada cambio menor ni notas internas. Representa el aviso, no lo envíes. WhatsApp es una ampliación futura, no requisito de este recorrido.

## 13. Fixtures y escenarios que deben poder revisarse

Crea 10–12 productos ficticios, variados y coherentes: comederos de acero 350/700 ml, correa azul/1 m y roja/2 m, juguete para ave con destinatario declarado, accesorio de acuario con capacidad/dimensiones, higiene ambiental sin especie inventada y alimento con destinatario/formato/contenido declarados. No inventes marcas reales, testimonios, certificaciones, recetas o claims médicos. Fotos de demostración coherentes o placeholders de calidad si faltan activos.

Incluye fixtures para:

1. Visitante que encuentra producto y arma carrito sin cuenta.
2. Cliente vinculado con escala/acuerdo: lista $100, escala $90, acuerdo $85, promoción elegible $80 → $80; sin elegibilidad → $85. Son candidatos de demostración, no descuentos acumulados ni precios de otros clientes expuestos.
3. Presentación sin precio con «Consultar precio» y otra comprable.
4. Producto agotado, búsqueda vacía y filtro sin coincidencias.
5. Correo pendiente y vínculo comercial pendiente, sin pérdida de carrito.
6. Envío confirmado, recargo pendiente, revisión de cobertura y entrega imposible confirmada.
7. Cotización vencida, actualización con nuevo total y aceptación pendiente.
8. Resumen del apoyo: $1,200 + $70 = $1,270 MXN.
9. Pago en verificación, fallo confirmado, apartado vencido y cobro confirmado con pedido en recuperación.
10. Pedido pagado antes de preparación, cancelación solicitada después de preparación y reembolso pendiente/fallido/confirmado.

Permite abrir estos estados mediante un **selector de escenarios de demostración**, separado de la navegación del cliente y claramente identificado. No lo disfraces de permisos reales ni persistas datos sensibles. Una acción visual debe mostrar un cambio comprensible o una explicación de su límite, no botones aparentemente operativos que no hagan nada.

## 14. Accesibilidad: objetivo WCAG 2.2 AA, no certificación ficticia

- HTML semántico, landmarks, enlace para saltar al contenido, títulos jerárquicos y nombres de página claros.
- Texto normal con contraste mínimo 4.5:1; texto grande 3:1; controles, foco e información gráfica esencial 3:1 contra colores adyacentes. Verifica también hover, selección, errores y estados sobre fotos. Borde decorativo claro no sirve como único límite de un campo.
- Todo operable por teclado, orden lógico y foco visible que no quede tapado por barras fijas. En modal/panel: foco inicial pertinente, contención solo mientras corresponda, cierre con Escape y retorno al disparador.
- Objetivos táctiles preferentemente de 44×44 px o mayores y separación suficiente; no botones minúsculos para cantidad/cierre. No depender de hover ni de arrastrar; ofrecer controles alternativos.
- Labels persistentes, instrucciones y errores asociados al campo; no solo placeholders. No solo color para selección/error; icono más texto. Controles de presentación con nombre y estado seleccionado; swatches de color con etiqueta.
- Permitir zoom, reflujo, textos largos y aumento de espaciado sin perder acciones. Sin scroll horizontal de página; adaptar tablas/resúmenes a móvil.
- Imágenes con texto alternativo útil; decorativas vacías. Botones de icono con nombre accesible. Evitar lectura duplicada de precio y etiquetas.
- Mensajes de carrito/guardado con anuncios discretos, sin mover foco innecesariamente. El contador de pago no se anuncia cada segundo; explicar el límite y cambios relevantes sin saturar lector de pantalla.
- Respeta `prefers-reduced-motion`: nada de autoplay, parallax obligatorio, scroll secuestrado o animaciones continuas. Feedback breve de 120–200 ms cuando aporte comprensión; contenido siempre accesible sin animación.
- La política de tiempo del checkout requiere revisión específica de accesibilidad durante implementación. No afirmar conformidad solo por mostrar un contador ni extender reservas automáticamente para aparentarla; el prototipo permite pausar/explorar escenarios sin presión.
- No declares «WCAG certificado» ni pruebas superadas que no hayas ejecutado. Informa qué revisaste y qué sigue pendiente.

## 15. Calidad visual, contenido y rendimiento percibido

Español de México natural y consistente, orientado a tareas: «Agregar al carrito», «Elegir presentación», «Revisar total», «Solicitar cotización». Sin anglicismos innecesarios ni textos de relleno. Información importante visible; condiciones complejas en divulgación progresiva sin esconder costos.

Estados de carga con skeletons que reserven dimensiones, sin cambios bruscos de layout. Errores contextuales y recuperables; alertas importantes persistentes, no solo toasts fugaces. Estado vacío con siguiente acción específica, no ilustración decorativa sin salida.

Imágenes dimensionadas, lazy loading fuera de la primera vista y primera imagen relevante sin retraso innecesario. Evita videos, librerías de animación pesadas o efectos que entorpezcan buscar y comprar. No inventes puntuaciones de rendimiento; este es un objetivo de diseño, no una medición ya obtenida.

No falsos testimonios, estrellas, «quedan 2», sellos de seguridad, descuentos, cobertura, fechas de entrega o cifras de clientes. No popup de registro al entrar, newsletter obligatoria ni WhatsApp flotante por defecto. Mantén claro qué es comprable, qué requiere información y qué está en revisión.

## 16. Qué debes entregar

1. Una propuesta visual coherente, no varias estéticas inconexas: catálogo y ficha especialmente cuidados, resto del recorrido conectado.
2. Vista escritorio y móvil con navegación demostrable y escenarios accesibles, usando exclusivamente fixtures.
3. Tokens/componentes reutilizables: header, búsqueda, filtros, tarjeta, selector de presentación, cantidad, resumen de importes, formulario, mensajes de estado, cronología y confirmación de cancelación.
4. Un pequeño inventario de pantallas/estados y explicación breve de las decisiones visuales, fuera de la UI del cliente.
5. Checklist de lo comprobado en el prototipo y lo pendiente para implementación: autenticación, precios autoritativos, inventario, cobertura, cotizaciones, pasarela, correo y pruebas reales.

Empieza construyendo la propuesta, no devolviendo solo un plan. Si la herramienta limita la cantidad de pantallas por entrega, completa primero catálogo y detalle y declara explícitamente cuáles faltan; no llames completo a un recorrido incompleto ni elimines reglas para hacerlo caber. Conserva este documento como contexto para las siguientes pantallas.
