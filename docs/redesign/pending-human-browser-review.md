# Catálogo — revisión humana pendiente

Estado: pendiente de revisión visual del usuario. Las pruebas técnicas y la inspección MCP del agente no equivalen a aprobación humana. No publicar ni desplegar por este registro.

## Cuando puedas abrir el navegador

Preview existente: http://localhost:4173/catalogo/centro

| ID | Qué revisar | Recorrido | Evidencia técnica / estado humano |
| --- | --- | --- | --- |
| V1 | Composición general frente a v0: logo, hero, tarjetas y detalle | Mirar listado y abrir una ficha en móvil y escritorio | Comparación del agente realizada; aprobación humana pendiente |
| V2 | Nuevo bloque compacto de búsqueda y categorías | A390px revisar etiqueta, Buscar, Limpiar búsqueda y categorías; repetir a320px | Primera fila a390 pasó de y722 a y616; controles44px y sin overflow; gusto/legibilidad pendientes |
| V3 | Búsqueda combinada y limpieza | Buscar croqueta, elegir Alimento para perro, limpiar categoría y búsqueda; volver con historial | MCP verificó18→11→18→52 en DEV; experiencia humana pendiente |
| V4 | Paginación y contexto | Navegar las tres páginas, cambiar lista de precios y revisar recuperación de URL fuera de rango | PUBLICO20/20/12 y recuperación verificados; experiencia humana pendiente |
| V5 | Ficha y variantes | Abrir Pechera acolchada Julius-K9 IDC, revisar sus tres tallas, cerrar con Escape | Datos reales DEV y retorno de foco verificados; composición humana pendiente |

Capturas del último pulido: `artifacts/catalog-controls-polish/{320,390,768,1440}.png`. Imágenes grises de productos son placeholders sintéticos DEV; no representan el catálogo fotográfico final.

## POS — mensajes de variantes (2026-10-27)

- V6 — Pendiente de revisión humana: al desactivar variantes, `PRODUCT_HAS_VARIANTS` explica que deben eliminarse primero y conserva las ediciones. Al cancelar una venta, `RESTOCK_TARGET_HAS_VARIANTS` informa que la cancelación no se realizó y la venta no cambió; no recomienda reintentar ni ofrece reasignación inexistente.
- Contrato corregido por BE: HTTP 422, código en `error`, no en `code`; detalles en raíz. Cambios locales, sin modificar normalizadores compartidos ni reglas del bot.
- Agente verificó mediante Playwright MCP los formularios reales con respuestas y sesión sintéticas aisladas: 390px/claro y 1440px/oscuro, lectura de capturas, envío por teclado, modal conservado y ediciones pendientes conservadas. No fueron operaciones sobre datos reales ni prueba de integración desplegada. Capturas: `artifacts/pos-variant-errors-sale-390.png`, `artifacts/pos-variant-errors-sale-1440-dark.png`, `artifacts/pos-variant-errors-product-390.png`, `artifacts/pos-variant-errors-product-1440-dark.png`.
- Hallazgo visual pendiente: la cabecera existente de edición de producto recorta «Guardar cambios» a 390px. El nuevo toast se ve completo; esto **no** acredita conformidad visual de toda la pantalla. No se modificó esa cabecera en este corte.
- Verificación: 67/67 pruebas en seis archivos del árbol actual, Vue-aware `vue-tsc --noEmit -p tsconfig.vitest.json`, ESLint de tests/composable y diff-check aprobados. La primera corrida ampliada incluyó accidentalmente otros worktrees (36 fallos); se corrigió el alcance con `--exclude '.worktrees/**'`, sin eliminar pruebas. Diagnóstico genérico de imports `.vue` no equivalente al chequeo Vue-aware. Formato global del SFC existente no normalizado; no build global ejecutado.
- Evaluación nativa no disponible por selección no declarada de históricos sin seguimiento; no hubo revisión ni aprobación nativa. Adaptación y tests guardados en `28a002d` por autorización humana transmitida por BE; cuatro archivos, 234 adiciones y una eliminación. Este documento y los demás pendientes quedan fuera de ese commit. Sin push ni despliegue.

## Editor editorial — lectura independiente (2026-10-27)

- V7 — Revisión humana pendiente: `/pos/products/:id/editorial`, cabecera adaptable, borrador/publicado separados y detalle expandible por teclado. Por ahora es **solo consulta**, no guardado ni publicación.
- MCP del agente: permiso exacto editorial de lectura sin Product CRUD permitió la ruta; `manage:all`, update-only y read:Product solos devolvieron `/403` sin solicitudes editoriales. Sesión y respuestas sintéticas, no validación de API3000 ni asignación real de permisos.
- Estados observados: vacío, solo publicado, borrador ilegible conservando publicado, histórico de 201 emojis y descripción de 20,001 caracteres íntegros; 403/500 con mensajes seguros y sin contenido anterior visible. Solo GET editoriales; sin medios ni escrituras.
- Capturas inspeccionadas: `artifacts/editorial-access-390-light.png` y `artifacts/editorial-access-1440-dark.png`. Botón móvil de 44px, foco visible y apertura por Enter; sin overflow del editor a 390px ni con zoom CSS 200%. Fuentes/iconos remotos bloqueados: evidencia con fallback local, no fidelidad tipográfica de recursos externos. La tarjeta de sucursal del shell conserva su contraste previo; no se afirma conformidad de todo el shell.
- 68/68 pruebas enfocadas/regresión observadas por el padre. Verificación independiente incompleta: cinco fallos del router por no copiar un asset del shell (63/68), no atribuidos al candidato. Comparación baseline/candidato: ambos exit0 y doce navegaciones iguales, pero no se capturaron las trazas detalladas; comparación automática no acreditada. Con autorización humana, el verificador corrigió solo su entorno: router34/34 y doce trazas semánticas capturadas e idénticas, ambos exit0; hashes actuales intactos. Verificación técnica independiente PASS acotada, no aprobación visual humana ni prueba de backend desplegado. Tipos de tests siguen inconclusos; no aprobación nativa. Vista previa propia4174 detenida, sesión sintética limpiada y navegador liberado a Peopleflow.

## Editor editorial — formulario (2026-10-28)

- V8 — Pendiente de revisión humana; cierre técnico verificado con respuestas aisladas: formulario con cinco tipos de atributos, selección explícita de presentación, cambio de familia confirmado, guardar sin publicar, consulta conservando/descartando y retransmisión del mismo intento.
- MCP aislado: cinco tipos, cancelación/confirmación de familia, guardar con Enter, 400 seguro con ediciones conservadas, 409 sin reenvío automático, retransmisión tras 500 con bytes y clave idénticos, y consulta de solo lectura sin controles de escritura observados. Título de201 emojis no generó PUT. No llamadas operativas ni medios; solo fixtures sintéticos.
- Capturas inspeccionadas: `artifacts/editorial-form-390-light.png`, `artifacts/editorial-form-1440-dark.png`, `artifacts/editorial-form-fields-390-light.png`. Acciones44px, ancho/scroll343/343 a390px, zoom CSS200%156/156, foco visible2px por teclado. Fuentes/iconos externos bloqueados; no acredita fidelidad de recursos remotos ni de todo el shell.
- Bloqueo encontrado en navegador: inicializar → consultar conservando deja el buffer nulo, sin formulario ni acción para cargarlo. Evidencia: `artifacts/editorial-form-initialize-blocker-390.png`. Usuario autorizó la corrección acotada: ahora «Consultar y cargar borrador» realiza un GET explícito cuando no existe buffer. Revisión dirigida MCP aprobada para vacío/Publicado sin recarga, y documento ilegible conservado en solo lectura; las ediciones existentes siguen intactas al consultar conservando. Capturas inspeccionadas: `artifacts/editorial-initialize-fixed-empty.png` y `artifacts/editorial-initialize-fixed-published.png`. 208/208 pruebas conjuntas y tipos Vue-aware de aplicación finales aprobados. La aceptación visual humana sigue pendiente; tipos del proyecto de tests previamente inconclusos y revisión nativa no disponible.
- Historial inválido (L16): verificado contra la API real de dev (main backend `3f02f6f`). Guardar conservando una presentación borrada responde 400 sin cambios y la UI lo bloquea antes de enviar; el borrador corregido guarda con 200. Se retiró el aviso de limitación; ahora el editor pide quitar o corregir los atributos no disponibles. Los valores numéricos huérfanos muestran su unidad. Capturas: `artifacts/editorial-l16-*.png`. Este editor no permite quitar medios y no normaliza documentos ilegibles.
- Pendiente aparte (sin corregir): la pantalla de inicio de sesión dice «Ingresá tus credenciales» (voseo), no español neutro de México.

## Criterio para próximos cambios de UI

- V1–V5 siguen pendientes de revisión humana; la continuidad del desarrollo no equivale a aceptación visual.
- Cada cambio de UI debe comprobarse mediante Playwright MCP, tanto funcional como visualmente, siguiendo el design system y las reglas de UI existentes. Revisar composición, tipografía, espaciado, estados, foco/teclado y responsive; conservar evidencia y corregir defectos antes de entregar.
- No reemplazar esta comprobación por tests unitarios, compilación o snapshots de accesibilidad sin inspección visual. Si el navegador no está disponible, declarar la comprobación pendiente, no presentar el cambio como validado.
- Coordinación Playwright MCP del 2026-10-27: el perfil es compartido con Peopleflow y no tiene aislamiento por sesión. Tras el conflicto inicial, su agente confirmó «liberado» y cerró su propio navegador. Acuerdo: pedir turno por intercom, esperar liberación explícita, usar solo la sesión propia, cerrar mediante `browser_close` y avisar «liberado» al terminar. No cerrar sesiones ajenas ni borrar locks. Houndfe todavía no tomó el navegador; esta confirmación no constituye evidencia visual nueva.

## Límites y pendientes técnicos

- Pulido visual y regresiones guardados en el commit local `5d62b16`. Formato, suite catálogo/layouts, build y MCP pasaron; diagnóstico CSS limpio. Runner aislado e inventario histórico en `239f5b1`: configuración18/18, detalle21/21, wiring5/5 y tipos pasan; verificación independiente PASS y review nativa `review-b5eae9b4ccb7c64c` aprobada/consumida. Advisory informativo `R3-001` en configuración:8 conservado como seguimiento no bloqueante. Sin push, PR ni merge.
- Review nativa del pulido y regresiones completada: `review-23cd95a9975baadc`,282 líneas/3 archivos, legibilidad y confiabilidad aprobadas; acknowledgement exacto consumido. El bloqueo inicial por archivos históricos sin seguimiento se resolvió seleccionando únicamente este documento como archivo nuevo intencional. Búsqueda y paginación anteriores también tienen reviews consumidas. Esto no sustituye la aprobación visual humana.
- Regresión automatizada ampliada en `e2e/responsive/catalog-controls.test.mjs`: 23/23 casos pasaron, sin fallos ni omitidos. Conserva15 previos de selectores/sucursales y agrega8 de búsqueda/categorías a320/390/768/1440. Verifica geometría relativa, controles44px, foco por Tab, búsqueda sin peticiones al escribir, filtros, limpieza e historial. Usa respuestas aisladas en Chromium, no datos reales ni servidor nuevo. Formato y diff-check pasaron. Es caracterización de comportamiento existente, sin RED artificial.
- Persisten warnings conocidos del build. Safari y revisión humana no ejecutados; no declarar paridad completa de navegadores.
- Conservar preview4173 y API3000, documentos históricos y capturas. Sin push, PR, merge, despliegue ni cambios de datos por esta continuidad.
- No abrir carrito, checkout, pagos, cambios de permisos ni contratos nuevos por inferencia. La hoja de ruta comercial contiene puertas todavía abiertas.

## Registro

2026-10-25 — Usuario: «Bien hermano, pero ahora no estoy disponible para ver el resultado en el navegador, por favor tu y el frontend continuen trabajando y coordinandose para no parar de trabajar, y no pierdas de vista las anotaciones de lo que tienes pendiente para mi por verificar por favor en el navegadoe. adelante con los siguientes pasos».

Se conserva la revisión humana pendiente mientras continúa la preparación y verificación técnica de alcances definidos. Ninguna casilla se cerrará sin respuesta explícita del usuario.

2026-10-27 — Usuario: «Bien hermano, pero ustedes sigan trabajando, avancen en mas features pero guarda lo que tengo pendiente de revisar en el navegador, cuando tenga tiempo lo revisare, pero no quiero que ustedes paren de trabajar, y algo que es muy importante es que por favor pruebes en el navegador (con el mcp de playwhrit) todo lo que hagas en la ui, sigue el system design del sistema, las reglas de ui, y no solo valides funcionalidad, tambien valida que lo que hagas tenga buen diseño, esto es muy importante hermano, lo que no quiero es llegar a revisar el resultado y tner que haver 1000 correcciones de diseño, me sigues??».
