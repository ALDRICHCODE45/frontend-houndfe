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
