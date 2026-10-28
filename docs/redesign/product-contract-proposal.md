# Propuesta de contrato para productos especializados

Estado: diseño propuesto, no API existente ni autorización de implementación.
Fuente: agente backend principal, mensaje `3160bcc3-e8b0-44cd-85b9-6c22f71568a5`, refinado por `a9562ea1-bb43-4e04-a382-c4c2ad95a78d`, `f0b0bb90-aa54-409a-8cf3-3b7b65cfe79b` y D13 en `1e6135c1-f360-4a95-a4e6-dc5d882be2a3`. Contratos propuestos, no APIs; evidencia heredada de inspecciones, sin nuevas lecturas de código, tests ni cambios de implementación aquí.
Leer junto a [estrategia D11/D12/D13](catalog-product-strategy.md) y [hoja de ruta](implementation-roadmap.md). D13 aprueba un borrador privado persistente y una versión descriptiva publicada por producto; reemplaza la recomendación mínima anterior. El vocabulario concreto se prepara por separado.

## Aprobado frente a propuesto

- Aprobado: núcleo operativo estable + atributos tipados por familia + variantes vendibles; opciones iniciales amplias; D13: un único borrador privado activo, persistente entre sesiones, y una versión descriptiva publicada por producto.
- Aprobado: permisos granulares existentes distinguen editar y publicar; el usuario los combina en roles configurables, sin segundo aprobador obligatorio ni puestos fijos.
- Aprobado (D17): diccionario y plantillas comunes de esta empresa, mantenidos con permisos efectivos; productos/asignaciones conservan aislamiento por tenant. No comparte automáticamente productos, existencias, precios ni clientes.
- Propuesto: representación del ámbito empresarial, revisiones y validación especializada de publicación; la autorización runtime sigue pendiente de evidencia.
- Aprobado (D14): mínimos de publicación para las siete familias de [vocabularios, sección 7](product-vocabularies.md), según pertinencia y evidencia; sugeridos opcionales. Faltantes permiten guardar borrador pero bloquean publicación.
- No aprobado: esquema físico, rutas, migración ni detalles técnicos de republicación/adopción de productos actuales. Resta especificar bindings y condiciones por subtipo, no reabrir D13 ni los mínimos por familia D14.
- No hay que preguntar otra vez qué puesto gobierna referencias: lo determina la asignación de permisos. Los agentes deben definir alcance de esos permisos y verificar vínculo empresa–tenant.

### Transición de catálogo (D15)

No se exige mantener visible el catálogo actual durante la preparación ni operar dos catálogos públicos en paralelo. Propuesta de adopción: preparar contenido descriptivo, revisar faltantes y publicar únicamente fichas que cumplan D14 y controles D13; conservar productos y operación sin inferir datos. La ausencia de usuarios no autoriza borrados, apagado inmediato ni publicación masiva automática. Selección de datos, migración y habilitación siguen sujetas a alcance técnico y autorización de implementación/entrega.

## Primer corte y exclusiones

Preparar referencias, asignar familia y valores tipados a producto/variante, guardar/retomar borradores privados, previsualizar/comparar, publicar atómicamente o descartar, y conectar facetas públicas. D13 es requisito del primer corte, no ampliación opcional. Separar referencias/asignaciones, ciclo de borrador/publicación y consulta/facetas; no tratar todo como un único cambio.

No incluye compras/CxP, costeo, lotes por variante, motor de reglas, nueva plataforma de roles, segundo aprobador obligatorio, múltiples ramas, historial ilimitado de revisiones ni generación automática de variantes. Preservar `option/value`, SKU, stock, precios y flags operativos actuales. Seleccionar una categoría no asigna una familia implícitamente.

## Ownership empresarial aprobado (D17), mecanismo técnico pendiente

Diccionario y plantillas compartidos dentro de la misma empresa para evitar diferencias semánticas entre sucursales. Productos, variantes, asignaciones y preferencias de presentación mantienen su aislamiento por tenant.

Compartir referencias no concede acceso a productos ajenos. Requiere identidad empresa–tenant verificable y permisos específicos; no inferir ese vínculo desde nombres de sucursales. El refinamiento posterior descarta una allowlist improvisada como solución al vínculo faltante. Transporte, almacenamiento e índices los resuelven los agentes con evidencia.

### Evidencia acotada de ownership y agrupación

Fuente: agente backend principal, mensaje `bb06be94-7b84-4d3e-9c87-d1e035df626c`. Inspección estática acotada, sin DB/API/tests ni HEAD verificado nuevamente; rutas relativas al backend, no leídas directamente por frontend.

- `src/tenants/domain/tenant.entity.ts:1–10` y `prisma/schema.prisma:390–530`: no se encontró vínculo empresa/sucursal verificable en Tenant.
- `prisma/schema.prisma:350–410,570–660`: Product tiene tenant obligatorio; Category/Brand globales no prueban autorización empresarial para referencias compartidas.
- `src/auth/infrastructure/strategies/jwt.strategy.ts:19–33,46–54`: contexto usuario/tenant, sin empresa ni conjunto de sucursales autorizado; JWT solo no demuestra pertenencia vigente.
- `prisma/schema.prisma:1330–1410`: permisos sujeto/acción, roles y TenantMembership; rol global no equivale a autorización empresarial. Evaluador runtime de permisos no verificado en este alcance.
- `prisma/schema.prisma:720–810`: variantes y precios separados. El peer cita además `product.entity.ts:86–148,381–399,423–450` y `create-product.dto.ts:39–77` sin ruta completa: campos operativos comunes, límites de option/name/value y restricción vigente de lotes con variantes. Resolver esas rutas antes de usarlas como referencias ejecutables.

**Contrato propuesto, no esquema aprobado:** resolver en servidor `tenantId → {stableDictionaryOwnerId, ownershipRevision}` desde relación explícita verificable. Autorizar actor, acción y dueño del recurso mediante permisos granulares existentes y pertenencia vigente, incluida revocación. No habilitar mutaciones de referencias compartidas entre tenants mientras falte esa resolución. El identificador expresa ámbito, no impone una tabla Company. No inferir acceso por nombres, roles globales o categorías globales.

No se encontró veto a agrupar 100/500 ml, materiales, animales o etapas diferentes; tampoco se verificaron exhaustivamente servicios de agrupación. No convertir ausencia de atributos tipados en prohibición comercial. Comprobar aparte compatibilidad de unidad, receta, impuestos y demás campos operativos comunes: los atributos descriptivos no habilitan diferencias operativas ni soporte de lotes ausente.

## Objetos conceptuales propuestos, no rutas

| Objeto | Contenido mínimo propuesto |
| --- | --- |
| ReferenceRelease | Identidad, revisión, estado y familias; primera entrega con vocabulario amplio D12. |
| AttributeDefinition | Código estable, etiqueta, descripción, tipo, opciones, restricciones, dimensión/unidad y estado; binding de familia define dueño. |
| FamilyTemplate | Código, revisión, etiqueta y bindings con `attributeCode` y `ownerScope` (`product` o `sellable`), requerido para publicar y uso como faceta pública. |
| ProductSpecialization | Producto, familia y valores con binding explícito; cada versión descriptiva distingue valores de producto y vendibles. Verificar definiciones vigentes sin exigir pinning persistente por producto. |
| VariantValues | Referencia a producto simple o variante real, valores descriptivos y revisión; validar pertenencia al producto/tenant y estado vigente, sin copiar identidad operativa. |
| DescriptiveDocument | `commercialTitle`, `description`, `mediaRefs` ordenadas, `familyCode` y bindings/valores `product` o `sellable`. Solo contenido descriptivo. |
| Draft | `{revision, basePublishedRevision, document}`; máximo uno privado activo por producto, persistente. Admite faltantes, no datos malformados. |
| Published | `{revision, document}`; única versión descriptiva publicada, ausente antes de primera publicación. Independiente del borrador y del estado operativo vivo. |
| ValidationResult | Revisiones evaluadas, faltantes y problemas con código, ruta de campo y mensaje; validez de captura no equivale a aptitud para publicar. |

Son shapes conceptuales propuestos por backend, no tablas, DTOs ni endpoints aprobados. `commercialTitle` no es `Product.name` ni cambia POS/recibos: solo una copia inicial explícita opcional desde el nombre operativo, nunca sincronización. Queda verificar su integración exacta con contratos/consumidores actuales, sin renombrarlos por inferencia.

Tipos candidatos: texto, booleano, número, selección única y múltiple. Selecciones guardan códigos, no etiquetas. Ejemplo: contenido neto 500 ml solo si la definición acepta volumen; no implica dosis ni conversión de inventario.

## Alcance de valores: binding explícito, sin herencia

Por familia, cada atributo tiene un único dueño lógico: `product` para descripción común o `sellable` para la identidad vendible. Si no hay variantes, valores sellable residen en el producto simple; si las hay, exclusivamente en las variantes reales. Reutilizar definición/código/tipo/unidad sin crear variantes ficticias ni heredar valores implícitos.

Al habilitar variantes, exigir asignación explícita de valores sellable a las variantes reales; permitir preview/selección manual, no copiar automáticamente. Valores anteriores del producto conservan trazabilidad pero dejan de ser efectivos y no son fallback. Al volver a producto simple, exigir sus valores explícitos, no elegir arbitrariamente una variante. Validar transición/publicación atómicamente; conservar contratos operativos y restricciones de lotes. Esta operación descriptiva no copia ni reparte stock, precios o lotes.

Para facetas, atributos product se evalúan en el producto; todos los sellable deben coincidir en el producto simple o en una misma variante elegible. Grupos de materiales base/rígidos pertenecen a una sola definición multiselección con mapping explícito de códigos, no dos atributos/facetas.

## Reglas de edición y evolución propuestas

- Producto nuevo o ya publicado puede guardar un borrador privado incompleto y retomarlo en otra sesión. Rechazar tipos/unidades incompatibles, opciones desconocidas y referencias ajenas sin escritura parcial; la última versión publicada permanece intacta.
- Para publicar, cada variante ofrecida debe cumplir sus propios requeridos; un valor del producto no los satisface por accidente. Su ausencia no impide guardar un borrador estructuralmente válido.
- Cambio de familia requiere preview de valores conservados/incompatibles y confirmación sin pérdida silenciosa.
- Revisiones esperadas protegen borrador y publicado frente a otros editores: guardar/publicar/descartar con revisión obsoleta del recurso afectado devuelve conflicto, sin sobrescritura ni escritura parcial. Publicar comprueba también la base publicada esperada. Preview, comparación y validación fallida no mutan; entradas locales no guardadas siguen disponibles para resolver el conflicto.
- Backend valida pertenencia y permisos en cada operación; los errores no revelan existencia de referencias de otros tenants.
- Códigos no se reciclan. Archivar conserva historia, impide nuevas asignaciones y no borra valores usados. Referencias invalidadas bloquean publicar sin borrar el borrador. D16 conserva valores válidos ya publicados y sus filtros, sujetos a elegibilidad vigente; mostrar advertencia administrativa y reemplazar/quitar la opción antes de republicar, cumpliendo D14. Datos incorrectos o peligrosos requieren corrección o retiro explícito; archivar no basta.
- Primer corte propuesto: rechazar cambios incompatibles de tipo/dimensión/reglas requeridas cuando invaliden datos existentes; una futura migración debe ser explícita. Al guardar, validar estructura y referencias contra definiciones vigentes sin exigir completitud; al publicar, revalidar también todos los requeridos atómicamente. No implementar pinning ni subsistema de migración por inferencia. Semillas por código/procedencia no sobrescriben personalizaciones.
- Alias no ambiguos dentro de su vocabulario; unidad canónica y dimensión explícitas. No inferir indicaciones terapéuticas ni alterar reglas de receta desde atributos.

### D13: borrador persistente y publicación descriptiva

Decisión de negocio aprobada: una versión descriptiva publicada y un único borrador privado activo por producto. La recomendación anterior de guardar solo ediciones válidas de publicados queda sustituida. El siguiente ciclo es una propuesta técnica para cumplir D13, no una API existente. CAS significa comparar la revisión esperada y escribir solo si coincide, de forma indivisible.

| Acción / estado | Resultado y límite |
| --- | --- |
| Iniciar o retomar (`create/resume`) | Recuperar el único borrador autorizado, incluso entre sesiones; si no existe, preparar la edición descriptiva desde lo publicado o desde el alta sin publicar. No crear ramas por editor. |
| Editar sin guardar | Diferenciar entradas locales de la revisión persistida. Salir con cambios pendientes requiere aviso; no prometer su recuperación en otra sesión. |
| Guardar (`save(expectedDraftRevision)`) | Persistir contenido incompleto pero estructuralmente válido con CAS; mostrar guardado/pendiente/error. Captura inválida no muta contenido ni revisión. No cambiar lo publicado ni elegibilidad operativa. |
| Previsualizar/comparar (`preview`, `compare`) | Vista autenticada privada y diferencias contra lo publicado, o su ausencia en un alta; `no-store`. Indicar si refleja entradas sin guardar; no persistir ni publicar por previsualizar. |
| Publicar (`publish(expectedDraftRevision, expectedPublishedRevision)`) | Validar y sustituir solo descripción publicada con CAS; reemplazar `Published` y consumir `Draft` en la misma transacción. La siguiente edición abre el único activo desde la nueva base. |
| Fallo de publicación | Conservar íntegros tanto versión publicada como borrador persistido para corregir y reintentar; mantener entradas locales si existen. No despublicar ni borrar silenciosamente. |
| Descartar (`discard(expectedDraftRevision)`) | Confirmar alcance y usar CAS: una revisión obsoleta no elimina un borrador más nuevo ni lo publicado. Abandonar solo el borrador; advertir también sobre entradas locales pendientes. |
| Conflicto | Explicar cambios de otro editor o de la base; releer/comparar y resolver explícitamente sin sobrescribir, fusionar automáticamente ni publicar parcialmente. |

**Frontera descriptiva.** Incluye título comercial, descripción, imágenes y atributos tipados de producto/presentaciones según binding. Excluye nombre operativo, SKU/código de barras, existencia/estado de variantes, stock, lotes/caducidad, precios/promociones/impuestos, unidad de venta, visibilidad/publicación operativa, acceso y receta. Nada de ello se captura ni restaura al publicar o descartar. Publicar descripción tampoco enciende la visibilidad: una descripción publicada no garantiza oferta pública elegible.

**Publicación autoritativa.** Revalidar permisos, revisiones de borrador/publicado, definiciones vigentes y todas las variantes ofrecidas/referenciadas actualmente, su pertenencia al producto/tenant, elegibilidad y medios. Proteger esas comprobaciones y el reemplazo en una transacción para impedir la carrera validar–eliminar–publicar; no confiar en validación previa del navegador. Si una referencia se archiva/elimina después de guardar, mantenerla diagnosticada en el borrador sin borrarlo; publicar falla conservando ambas versiones hasta corrección. Transición simple↔variantes exige reasignación explícita: nunca resucitar variantes ni restaurar operación anterior. D16 conserva opciones archivadas válidas en la versión ya publicada y sus filtros, sin permitir nuevas asignaciones ni republicación sin corregirlas. Esto no conserva elegibilidad de variantes o medios archivados ni evita restricciones operativas.

**Privacidad y medios.** Preview/compare autenticados y `no-store`; borradores y valores internos no entran en respuestas públicas, cachés compartidas ni índices públicos. Medios exclusivos del borrador son privados, sin URL pública estable ni CDN público. Referencias de assets pertenecen al tenant; rechazar cruces de tenant. Retener recursos mientras los refiera borrador o publicado: cambiar imágenes/descartar no ejecuta limpieza inline ni elimina imágenes compartidas o publicadas. Limpieza de huérfanos es un trabajo separado, no API de almacenamiento inventada aquí. Caché pública solo de contenido publicado, con revisión e invalidación y puertas operativas evaluadas en vivo.

Editar/guardar y publicar usan permisos granulares separados del sistema existente; el usuario puede combinarlos en un rol. No se exige segundo aprobador, rol fijo, múltiples borradores simultáneos ni historial ilimitado. Adopción de productos actuales, persistencia física y mecanismos de concurrencia/transacción requieren evidencia backend; datos de prueba no autorizan borrados.

### Frontera con resolución comercial (D18/D19)

D18 aprueba para el nuevo catálogo elegir el menor precio válido para cliente/cantidad entre lista aplicable, escala, acuerdo vigente y promoción elegible, sin acumulación automática ni acceso a precios de otros clientes. Un acuerdo no impide una promoción mejor que sí corresponda. La resolución autoritativa es un contrato operativo separado (C4/G2): no guardar ni restaurar el precio elegido desde Draft/Published. Elegibilidad, comparación de impuestos/unidades/redondeo y demás detalles de G2 siguen pendientes; no alterar POS/bot por inferencia ni introducir un motor de precios en este corte descriptivo.

D19 excluye precio ausente o cero de candidatos de compra: aplicar D18 a los restantes precios válidos y autorizados, incluido público si corresponde. Sin candidato, mostrar «Consultar precio» y denegar agregar la presentación al carrito, preservando visibilidad si cumple las demás condiciones. No bloquear variantes hermanas con precio válido ni inferir gratuidad. La restricción requiere validación autoritativa futura, no solo deshabilitar un botón. No altera datos almacenados ni POS/bot.

Distinguir visibilidad de ficha consultable de elegibilidad de compra: falta de precio no oculta por sí sola una ficha permitida, pero no concede acceso a productos o listas ajenos. Orden/filtros por precio y precio representativo de variantes requieren especificación para estas fichas; nunca representar ausencia como cero ni incluirla en el mínimo «Desde».

### Acceso, registro y verificación comercial aprobados (D20–D22)

Explorar catálogo y consultar precios/promociones públicos elegibles no requiere registro. Acceso identificado solo habilita consulta de condiciones particulares efectivamente asignadas al cliente y autorizadas en servidor; D18/D19 operan dentro de ese conjunto. Declararse mayorista o iniciar sesión no asigna beneficios. El personal con permisos efectivos mantiene esas asignaciones; cliente no adquiere permisos administrativos/POS.

D21 permite registro voluntario abierto con condiciones públicas iniciales. Acceso a condiciones de un cliente comercial existente exige identidad verificada y vínculo autorizado, no coincidencia de nombre/teléfono. Interesados nuevos en mayoreo pueden solicitar condiciones; personal autorizado las asigna. No fusionar clientes ni asignar beneficios automáticamente. El flujo no exige cuenta para explorar/armar carrito; D27 exige identificación con correo verificado al solicitar cotización o pagar, con registro breve que conserva carrito. Datos privados mantienen exigencia de vínculo D22.

D22 concreta el flujo: cuenta nueva verifica correo y parte de condiciones públicas. Para cliente comercial existente, invitación al contacto registrado y previamente validado por la empresa; contacto ausente/desactualizado requiere revisión de personal autorizado antes de vincular. Un correo verificado cualquiera, nombre, teléfono o número de cliente no prueban titularidad de ese vínculo. No crea una segunda aprobación universal. Proveedor, enlace/código y vigencia quedan por especificar; no hay envío de invitaciones reales autorizado.

Contrato técnico pendiente: verificar identidad y vínculo comercial, pertenencia vigente y alcance de cada consulta; separar contexto público/privado en respuestas, índices y cachés. No confiar en IDs de cliente/lista enviados por navegador como autoridad. Recuperación y revocación deben definirse antes de habilitar acceso privado. D27 aprueba el punto de identificación al cotizar/pagar, no el proveedor ni mecanismo técnico de autenticación. Conservar carrito y revalidar precios/contexto al identificar; sin vincular clientes automáticamente.

## Facetas y listado público

- Mantener filtros actuales de elegibilidad por tenant, publicación y contexto de precio autorizado. Consultar solo la versión descriptiva publicada; no exponer borradores, previews ni atributos internos, tampoco en cachés/índices públicos.
- Predicados de producto se evalúan sobre producto. Todos los predicados de variante deben coincidir en la misma variante elegible, incluido el contexto de precio.
- Filtrar antes de contar, ordenar y paginar. Contar productos distintos, no multiplicar por variantes.
- Semántica recomendada refinada: OR entre valores seleccionados de una misma faceta, AND entre facetas diferentes. Todos los predicados de variante siguen correlacionados sobre una sola variante elegible.
- Para contar opciones de una faceta F, aplicar los demás filtros y omitir solo las selecciones actuales de F; contar productos distintos por valor candidato. Resultado y total aplican todos los filtros, incluidas las selecciones de F.
- Para un candidato de faceta de variante, ese candidato y los demás predicados de variante deben coincidir en la misma variante. Tanto conteos como resultados conservan categoría/texto/familia/tenant/publicación/precio exacto y privacidad. Medir costo de consulta; nunca relajar esos filtros para optimizar.
- Orden por precio debe ser global, no por página. Precio representativo de un producto con variantes requiere contrato explícito.
- Familia delimita atributos aplicables; cobertura amplia administrativa no obliga a publicar opciones sin resultados elegibles.

## Aceptación propuesta para contratos futuros

1. Un usuario con permisos ve opciones iniciales amplias sin cargarlas manualmente.
2. Producto nuevo o publicado guarda y retoma un único borrador privado incompleto entre sesiones; publicar exige mínimos acordados de producto y de cada presentación ofrecida. Campos malformados se rechazan sin escritura parcial; faltantes de publicación no impiden guardar captura válida.
3. Asignar familia/atributos no crea variantes ni cambia `option/value`, SKU, stock o precios.
4. Referencia a variante de otro tenant se rechaza sin filtración ni mutación, aunque pertenezca a otra sucursal de la misma empresa.
5. Guardar, publicar o descartar con revisión obsoleta produce conflicto y no sobrescribe a otros editores; preview/diff y errores no mutan. Mostrar qué está guardado frente a entradas locales pendientes.
6. D16: archivar una opción conserva historia, valores válidos ya publicados y sus filtros para productos elegibles; muestra advertencia administrativa. Nueva asignación falla; republicar exige reemplazar/quitar la opción respetando D14, sin pérdida del borrador/publicado ante rechazo. Actualizar vocabulario no destruye personalizaciones. Información incorrecta/peligrosa exige corrección o retiro explícito, no solo archivo.
7. Unidad incompatible falla sin escritura; contenido de paquete no cambia inventario.
8. Filtros distribuidos entre variantes hermanas no producen coincidencia; una variante que cumple todo devuelve un producto, con conteos previos a paginación.
9. Seleccionar dos valores de una faceta permite cualquiera de ellos, pero exige las demás facetas; conteos de alternativas omiten solo su propia selección, nunca los filtros de privacidad o elegibilidad.
10. Un producto simple acepta contenido sellable sin crear variante. Al cambiar a variantes, falta de asignaciones explícitas impide publicar atómicamente; el borrador puede conservar faltantes válidos. No se heredan atributos ni se alteran stock/precios desde el contrato descriptivo.
11. Publicación exitosa sustituye solo contenido descriptivo de forma atómica. Un fallo conserva la versión publicada y el borrador para corrección, sin despublicar ni borrar. Descartar confirmado conserva producto y publicación.
12. Revalidar en transacción definiciones, medios y variantes ofrecidas/referenciadas actuales: referencia invalidada después de guardar queda diagnosticada y publicar falla conservando ambas versiones. Ninguna variante archivada/eliminada o ajena reaparece; no hay carrera validar–eliminar–publicar ni restauración operativa.
13. Usuario con edición sin publicación guarda/retoma pero no publica; combinar permisos permite ambas acciones sin otro aprobador. Acceso cruzado a borrador/media se deniega; preview/compare autenticados son `no-store`. Sin contenido no publicado en respuestas/cachés/índices públicos ni URL estable/CDN público de medios exclusivos del borrador.
14. Retener media referida por borrador/publicado; cambiar imágenes o descartar no elimina recursos compartidos/publicados ni hace limpieza inline. Caché pública usa solo publicado con revisión e invalidación y elegibilidad viva.
15. Recargar recupera el borrador guardado; guardar datos malformados no cambia su revisión. CAS de guardar/publicar/descartar impide pérdida de revisiones; descarte obsoleto no elimina borrador nuevo. Publicación exitosa consume borrador atómicamente.
16. Publicar descripción no modifica `Product.name`, POS/recibos, SKU/código de barras, existencia/estado de variantes, stock/lotes/caducidad, precio/promoción/impuesto, unidad, receta ni visibilidad/acceso. Copia inicial opcional de título es explícita y sin sincronización; publicar no enciende visibilidad.

## Pantallas del primer corte: especificación funcional propuesta

No define rutas ni diseño visual final; reutilizar los patrones administrativos actuales. La propuesta pública detallada se incorpora al brief de v0 después de validar el alcance.

| Superficie | Resultado que debe ofrecer | Estados y límites |
| --- | --- | --- |
| Administración de familias | Consultar plantillas y definir campos pertinentes, orden y requeridos para publicar. | Permiso efectivo; plantilla en uso; cambio incompatible rechazado con explicación. No mezcla categoría con familia. |
| Diccionario de atributos/opciones | Buscar y agrupar el vocabulario inicial, revisar tipos/unidades, agregar, renombrar o archivar opciones. | Código/alias duplicado, sin permiso, archivado histórico, conflicto de actualización. No obliga a cargar manualmente cientos de opciones. |
| Alta/edición de producto | Elegir familia, editar título comercial/descripción/imágenes y atributos; guardar/retomar único borrador. | Publicado/no publicado independiente de borrador guardado/cambios sin guardar; faltantes, errores, aviso al salir y conflicto. Descartar con confirmación no elimina producto ni publicación. |
| Presentaciones/variantes | Editar atributos descriptivos de cada identidad vendible dentro del mismo borrador. | Binding product/sellable explícito; simple o variante real, sin variantes ficticias/herencia. Membresía cambiada o variante archivada/eliminada requiere corrección, no restauración operativa. |
| Vista previa, comparación y publicación | Ficha/facetas privadas, diff contra publicado y faltantes por producto/presentación; publicar o descartar con permiso. | Preview de guardado/sin guardar identificado; sin publicado para comparar en alta. Publicación atómica, fallo conserva ambas versiones, conflicto recuperable; sin filtración pública ni pérdida de medios publicados. |
| Listado público | Búsqueda, filtros pertinentes, chips removibles, conteos y orden global desde descripción publicada. | Sin resultados, carga/error, faceta activa en cero removible; filtros correlacionados por variante y operación vigente. Sin borrador/preview en respuesta, caché o índice ni precios privados al anónimo. |

Controles reutilizables: selección buscable y agrupada, multiselección accesible, número con unidad compatible y estados desconocido/no aplicable explícitos. Una lista extensa debe permitir alcanzar todas las coincidencias, no limitarse a las primeras sugerencias.

## Contraste del vocabulario y pendientes acotados

[Vocabulario propuesto](product-vocabularies.md): 112 opciones animales, 72 etapas/fases y 330 opciones de atributos; 514 códigos únicos en 67 filas, comprobados por script. El conteo no prueba taxonomía, compatibilidad de productos ni aceptación del vocabulario final.

- Los grupos animales y especies no son equivalentes; no expandir asociaciones médicas/comerciales por pertenencia a grupo. Nombres comunes/alias regionales requieren revisión.
- La matriz inicial del vocabulario resuelve las marcas P→V como propuesta explícita: atributos potencialmente variables en sellable, contenido común de ficha en product. Validar aplicabilidad por subtipo, sin herencia ni variantes ficticias. Cambiar un binding con datos existentes requiere revisión de compatibilidad, nunca reinterpretación automática.
- Agrupaciones de opciones como materiales base/rígidos deben poder pertenecer a una sola definición lógica multiselección; prefijo de opción no implica una faceta o definición distinta.
- Los mínimos de publicación por familia están aprobados por D14; resta precisar su aplicabilidad por subtipo. No exigir destinatario animal a un equipo que no lo declara ni inventar datos para pasar validación. Los campos sugeridos siguen opcionales.
- Backend y frontend acuerdan shapes finales, permisos/errores, ownership y casos antes de ejecutar. El alcance sigue siendo documental; no hay APIs, semillas ni pantallas implementadas.
