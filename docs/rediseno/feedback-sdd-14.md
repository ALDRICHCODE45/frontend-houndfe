# Feedback visual SDD-14 — sales-screen-redesign

> Documento para consumo del próximo modelo.
> Estado: 6 commits aplicados a `main` (9818dbd, d0f0bcc, f42f18c, e7ea062, 58a1897, 3ccab5c).
> Tests 810/810 green. Type-check y build pasan.
> Capturas analizadas: Image 1 (pantalla completa), Image 2 (zoom carrito derecho).

## Veredicto del usuario

> "no me gusta NADA el resultado... el item de producto me gusta bastante mas. pero de ahi en fuera nada."

**Lo que sobrevive:** el nuevo `SaleItemRow` horizontal (commit `e7ea062`).
**Lo que hay que rehacer:** prácticamente todo lo demás.

---

## 🚨 Veredicto general

El rediseño fracasó visualmente. Los cambios estructurales (75/25 split, SaleItemRow horizontal) son conceptualmente correctos pero la ejecución visual quedó rota. Hay 3 problemas críticos que bloquean el uso, 3 mayores que degradan funcionalidad, y 2 menores cosméticos.

---

## Problemas detallados

### 🔴 CRÍTICO 1: Dark category panel vacío y gigante

**Síntoma:** Debajo de los chips de categorías hay un bloque oscuro rectangular ENORME, completamente vacío, que cruza TODO el ancho del panel de productos. Se ve como un bug CSS, no como un panel intencional.

**Causa probable:** Commit `f42f18c` (14a.3). Se envolvieron los chips en un wrapper con clases de panel oscuro (`bg-elevated`, `bg-coco-neutral-900` o similar). Pero el wrapper no tiene contenido real — solo contiene los 3 chips que ya estaban, y el padding/alto del wrapper crea la barra vacía.

**Archivo:** `src/features/POS/sales/components/ProductSearchPanel.vue`, sección de category chips (~líneas 86-128)

**Fix sugerido:** Rollback de este cambio. Los chips NO necesitan un panel oscuro dedicado. Volver al diseño anterior donde los chips están sueltos debajo del search. Si se quiere un panel, que sea un fondo sutil (`bg-muted/20` o similar) aplicado SOLO a los chips, no un contenedor high-contrast vacío.

---

### 🔴 CRÍTICO 2: Cards de producto GIGANTESCAS

**Síntoma:** La card de Pedigree ocupa casi toda la altura del viewport. Imagen enorme (la bolsa naranja del producto), etiquetas chicas debajo. Solo se ven 3 cards visibles: 1 con imagen real + 2 placeholders. Las 3 cards ocupan casi todo el panel.

**Causa probable:** Commit `d0f0bcc` (14a.2). Grid de 3 columnas con cards que no limitan la altura de imagen. En una card de ~350-400px de ancho, una imagen `object-contain` o `w-full` escala a tamaño completo, y la card crece para acomodarla. Sin `max-h-*` ni `aspect-*` en la imagen.

**Archivos:**
- `src/features/POS/sales/components/ProductSearchResultItem.vue`
- `src/features/POS/sales/components/ProductCardGrid.vue`

**Fix sugerido:**
1. Limitar altura de imagen: `h-32` o `aspect-[4/3]` con `object-cover`
2. Cambiar grid de 3 cols a 4 o 5 cols para que las cards no sean tan anchas
3. Cada card debería medir ~200-250px de alto máximo

---

### 🔴 CRÍTICO 3: Franja blanca al borde derecho del carrito

**Síntoma (Image 2):** El panel del carrito está contenido en un wrapper que NO llena el 25% del grid. Hay una franja blanca/ancha entre el borde derecho del cart y el borde derecho de la pantalla. El cart está centrado o tiene padding interno excesivo.

**Causa probable:** Commit `9818dbd` (14a.1) cambió las clases de grid en `SalesView.vue` pero el wrapper interno del cart (`UDashboardPanel` o equivalente) tiene `mx-auto`, `max-w-*`, o padding que no se ajustó al nuevo ancho.

**Archivo:** `src/features/POS/sales/views/SalesView.vue` — grid wrapper del cart panel

**Fix sugerido:**
1. El wrapper del grid cell debe tener `w-full` sin `max-w-*`
2. El panel interno debe tener padding horizontal reducido (el cart es más angosto ahora)
3. Verificar que las clases de Tailwind no estén agregando margen lateral

---

### 🟡 MAYOR 1: Select "PUBLICO" apretado contra el borde

**Síntoma:** En el cart header, el UInputMenu "PUBLICO" queda sin margen derecho, pegado al borde del panel. Con el cart al 25% (~340px en laptop), los elementos (UTabs + label "Lista: PUBLICO" + UInputMenu) no caben con márgenes decentes.

**Archivos:**
- `src/features/POS/sales/components/ActiveSalePanel.vue`
- `src/features/POS/sales/components/PriceListSelector.vue`

**Fix sugerido:**
1. Ocultar el label "Lista:" cuando el cart está muy angosto (dejar solo el selector)
2. O apilar label encima del selector en vez de lado a lado
3. O mover el selector a una segunda fila en el header

---

### 🟡 MAYOR 2: Stock badge inconsistente

**Síntoma:** Card 2 muestra `#10` (gris neutro), card 3 muestra `#0` (con tinte rojo/anaranjado), card 1 (Pedigree con variantes) no muestra ninguno. Inconsistencia visual entre cards del mismo grid.

**Causa probable:** El badge usa `useStock` como condicional, y para productos con variantes (`hasVariants: true`) el campo `stock` puede ser null o tener estructura diferente. También puede haber una lógica de color diferente según `quantity < minQuantity`.

**Archivo:** `src/features/POS/sales/components/ProductSearchResultItem.vue`

**Fix sugerido:**
1. Unificar formato visual: mismo tamaño, misma posición (top-right), mismo color de fondo
2. Variante de color: `quantity === 0` → rojo, `quantity <= minQuantity` → naranja, default → gris
3. Si el producto tiene variantes, mostrar `variantStockTotal` en vez de `stock.quantity`

---

### 🟡 MAYOR 3: Cards placeholder feas

**Síntoma:** Las 2 cards sin imagen real muestran un fondo lavanda pálido + un ícono de cubo/caja centrado. Se ve roto, como un placeholder de desarrollo sin pulir.

**Archivo:** `src/features/POS/sales/components/ProductSearchResultItem.vue`

**Fix sugerido:**
1. Usar un placeholder con el mismo aspect-ratio que una card con imagen
2. Fondo neutro (`bg-muted` o `bg-neutral-100 dark:bg-neutral-800`) en vez del lavanda
3. Ícono de producto (`i-lucide-package` o similar) centrado, más chico

---

### 🟢 MENOR 1: "SIN MARCA" se ve forzado

**Síntoma:** Productos sin marca muestran "SIN MARCA" como label, ocupando una línea completa. Visualmente molesto.

**Archivo:** `src/features/POS/sales/components/ProductSearchResultItem.vue`

**Fix sugerido:** Si `brand === null` o `brand.name` está vacío, directamente no renderizar la línea de brand.

---

### 🟢 MENOR 2: Chips de categorías con estilo raro

**Síntoma:** Chips no-activos se ven grises/oscuros con números "3" y "2". Se ven disabled o quebrados, no como chips clickeables.

**Archivo:** `src/features/POS/sales/components/ProductSearchPanel.vue`

**Fix sugerido:** Revisar clases de los chips en estado no-activo. Necesitan `bg-elevated` (fondo claro) + `border` visible + hover effect.

---

## Resumen de issues

| # | Severidad | Problema | Commit culpable |
|---|---|---|---|
| 1 | 🔴 CRÍTICO | Dark panel vacío gigante | `f42f18c` (14a.3) |
| 2 | 🔴 CRÍTICO | Cards gigantes, solo 3 visibles | `d0f0bcc` (14a.2) |
| 3 | 🔴 CRÍTICO | Franja blanca a la derecha del cart | `9818dbd` (14a.1) |
| 4 | 🟡 MAYOR | Select PUBLICO apretado | `3ccab5c` (14b.3) |
| 5 | 🟡 MAYOR | Stock badge inconsistente | `d0f0bcc` (14a.2) |
| 6 | 🟡 MAYOR | Placeholder de card feo | `d0f0bcc` (14a.2) |
| 7 | 🟢 MENOR | "SIN MARCA" molesto | `d0f0bcc` (14a.2) |
| 8 | 🟢 MENOR | Chips de categoría con estilo roto | `f42f18c` (14a.3) |

---

## Lo que SÍ funciona (NO TOCAR)

- ✅ `SaleItemRow` horizontal card — commit `e7ea062`
- ✅ Items/units count "0 Artic · 0 Unidad" — commit `3ccab5c`
- ✅ "TOTAL A COBRAR" prominente — commit `3ccab5c`
- ✅ Botón "Cobrar" amarillo + F8 — commit `3ccab5c`
- ✅ `PromocionesFlatList` — commit `58a1897` (no se ve en las capturas porque el cart está vacío, pero pasa tests)

---

## Plan de acción sugerido

### Fase 1: Rollback de lo roto (3 cambios)

| Acción | Archivos | Qué hace |
|---|---|---|
| Rollback `f42f18c` | `ProductSearchPanel.vue` | Quitar dark panel wrapper vacío |
| Revertir grid 3-col | `ProductCardGrid.vue` | Volver a 4 o 5 columnas |
| Limitar altura de cards | `ProductSearchResultItem.vue` | `h-32` + `object-cover` en imagen |

### Fase 2: Arreglar el cart (2 cambios)

| Acción | Archivos | Qué hace |
|---|---|---|
| Fix franja blanca | `SalesView.vue` | `w-full` en wrapper del cart, quitar `max-w-*` |
| Compactar header | `ActiveSalePanel.vue`, `PriceListSelector.vue` | Apilar label + selector, o quitar label |

### Fase 3: Pulido (3 cambios)

| Acción | Archivos | Qué hace |
|---|---|---|
| Unificar stock badge | `ProductSearchResultItem.vue` | Mismo formato + color según nivel |
| Mejorar placeholder | `ProductSearchResultItem.vue` | Fondo neutro + ícono proporcionado |
| Quitar "SIN MARCA" | `ProductSearchResultItem.vue` | No renderizar si no hay brand |

---

## Archivos clave (toda la acción está en estos 6)

```
src/features/POS/sales/views/SalesView.vue
src/features/POS/sales/components/ProductSearchPanel.vue
src/features/POS/sales/components/ProductSearchResultItem.vue
src/features/POS/sales/components/ProductCardGrid.vue
src/features/POS/sales/components/ActiveSalePanel.vue
src/features/POS/sales/components/PriceListSelector.vue
```

---

## Contexto adicional para el próximo modelo

- Proyecto: Vue 3.5 + Nuxt UI 4 + Tailwind CSS 4 + TanStack Query
- Test runner: `pnpm test:unit --run` (810 tests, todos pasan)
- Type-check: `pnpm type-check` (vue-tsc)
- Build: `pnpm build`
- Commits en main, solo dev, sin PRs — se puede hacer `git reset` sin miedo
- El usuario está probando en laptop (~1366px de ancho)
- `SaleItemBadges.vue` NO se toca (compartido con vista de ventas confirmadas)
