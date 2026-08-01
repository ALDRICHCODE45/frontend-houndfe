# Feedback visual SDD-14 — Ronda 2

> Análisis para el próximo modelo que SÍ razone mejor.
> Contexto: el usuario volvió a probar después del commit `1d43849` y reportó nuevos issues. Sigue sin estar conforme con la UI en pantallas medias (tablets/laptops).
> Cambios previos (ronda 1) ya mergeados: commit `1d43849` — fix dark panel + grid 4 cols + aspect-[4/3] + cart wrapper sin borde derecho.

## ⚠️ DISCLAIMER IMPORTANTE

**El modelo que escribió este análisis NO es multimodal.** No pudo ver las imágenes que el usuario describió. Todo el análisis se basa en la descripción textual del usuario + lectura del código actual. El próximo modelo que lea este doc y SÍ pueda ver las imágenes debería:

1. Leer este doc primero
2. Contrastar con las imágenes reales
3. Confirmar/ampliar/rechazar cada punto según lo que VEA

Si el próximo modelo es multimodal, que ABRA las imágenes y valide antes de aplicar cualquier fix.

---

## Issues reportados por el usuario (texto)

### 🔴 Issue A: "Card del carrito cortada al final, no cierra"

> "la card del carrito (si, la que ahora ocupa el 25 porciento) esta como 'cortada' al final, no cierra, no se ven las esquinas superior derecha e inferior derecha de la card"

**Interpretación:** La card panel del carrito no muestra sus esquinas derechas (superior e inferior). O sea, visualmente está como "recortada" en el borde derecho.

**Causa probable (basada en código):** En el commit `1d43849` cambié el wrapper del cart en `SalesView.vue` línea 727-728:

```html
<div class="hidden lg:block lg:w-[25%] shrink-0 pl-3 lg:pl-4 pr-0 pt-1.5 lg:pt-2 pb-3 lg:pb-4">
  <div class="h-full w-full rounded-l-2xl border border-default/50 overflow-hidden border-r-0">
```

Probé hacer dos cosas mal a la vez:
1. `pr-0` → quité el padding derecho del wrapper exterior
2. `rounded-l-2xl border-r-0` → solo bordes redondeados a la izquierda, sin borde derecho

**Problemas que esto causa:**
- El cart panel queda FLUSH contra el borde derecho del viewport (sin margen)
- Al hacer flush, si hay CUALQUIER pixel de overflow horizontal (por un scrollbar, por un pixel sub-pixel, por un cambio de zoom), el cart panel queda CLIPPED — sus esquinas derechas no se ven
- `rounded-l-2xl` significa esquinas REDONDEADAS solo a la izquierda, lo cual es visualmente raro en una card que va de borde a borde

**Lo correcto sería:** mantener las esquinas derechas visibles (no hacer flush), con un pequeño margen interno. O si el cart va edge-to-edge, que las esquinas derechas sean CUADRADAS (no `rounded-l-2xl` sino `rounded-none` en el right, o un patrón donde la card respete el viewport pero mantenga su forma).

**Fix sugerido (validar con la imagen):**
- Opción 1: Volver al `pr-3 lg:pr-4` (margen derecho) y `rounded-2xl` completo. Aceptar un pequeño "white strip" entre el cart y el borde de la pantalla, que era el issue de la ronda 1 que el usuario también rechazó. Esta opción NO resuelve ambos problemas, hay que elegir.
- Opción 2: Hacer que el cart sea edge-to-edge PERO que el panel interior (no el wrapper) sea el que tenga el border/rounded. Así los bordes visuales del cart están adentro, no en el wrapper.
- Opción 3: Cambiar el breakpoint para que el cart ocupe 25% en `xl:` en vez de `lg:`, dejando más espacio en `lg:` (tablets).

---

### 🔴 Issue B: "Cuadro grande a la derecha al hacer zoom out"

> "cuando hago mucho zoom out, aparece un cuadro grande a la derecha de la pantalla... ese cuadro aparece de repente en la ui pero desaparece despues"

**Interpretación:** Al hacer zoom out (reducir el zoom del navegador), aparece un cuadro grande (probablemente claro) a la derecha de la pantalla, que luego desaparece. Sugiere algo del tipo slideover/modal/floating element que aparece condicionalmente según el viewport.

**Causa probable (basada en código):** En `SalesView.vue` hay:
- Línea 107: `const isMobileViewport = useBreakpoints(breakpointsTailwind).smaller('lg')` — toggles mobile vs desktop
- Un FAB (Floating Action Button) cuando está en mobile para abrir el cart drawer
- Un USlideover para el cart en mobile

Cuando el zoom del navegador cambia, el `viewport width` efectivo cambia. Al hacer zoom out, el viewport se hace más chico en CSS pixels → puede cruzar el breakpoint `lg:` (1024px) → el cart "salta" de desktop split (25%) a mobile slideover.

Si el USlideover o el FAB se renderiza brevemente durante la transición, aparece ese "cuadro grande" que después desaparece cuando el layout se estabiliza.

**Archivos sospechosos:**
- `src/features/POS/sales/views/SalesView.vue` (FAB + slideover logic)
- Cualquier `UDrawer` o `USlideover` usado para el cart en mobile

**Fix sugerido:**
- Agregar `v-show` o `v-if` con transiciones más limpias
- O usar `useBreakpoints` con un threshold más estable (e.g. `smallerOrEqual('md')` en vez de `smaller('lg')`)
- O eliminar el FAB en absoluto y solo mostrar el cart cuando NO esté en mobile (que es lo que el usuario quiere — no quiere mobile)

---

### 🟡 Issue C: "UI no se ve bien en pantallas medias"

> "en un punto medio (tables, laptops, etc.. ) pantallas que no sean un monitor ultrawide, la ui (de la venta) no se ve del todo bien"

**Interpretación:** Entre mobile (que el usuario dice que está OK) y ultrawide (probablemente >1920px), hay un rango de pantallas donde la UI no funciona bien. Típicamente 1024px a 1600px — tablets en landscape y laptops estándar.

**Causa probable:** El breakpoint `lg:` (1024px) activa el split 75/25. En una pantalla de 1024px, eso son 256px para el cart — muy angosto. En 1280px, 320px. En 1366px, 341px. Solo arriba de 1600px el cart empieza a sentirse cómodo.

**Problemas concretos en ese rango:**
- Cart header: tabs + selector no caben juntos sin compactar (issue que el usuario ya señaló antes)
- Cart items: la card horizontal con thumbnail + nombre + specs + qty + multi-line pricing es muy ancha para el cart angosto
- Footer del cart: "Cliente:", totales, "Cobrar" — todo se comprime

**Opciones de fix (la decisión es de diseño, no técnica):**

| Opción | Cambio | Pros | Contras |
|---|---|---|---|
| 1 | Cambiar `lg:` → `xl:` para el split. En `lg` (1024-1280px) full-width cart debajo del catálogo | Más espacio para el cart en laptops chicas | Rompe el "POS horizontal" que muchos esperan en laptops |
| 2 | Split diferente en `lg:` vs `xl:` — 80/20 en `lg`, 75/25 en `xl` | Cart más ancho en laptops chicas | Aún angosto, no resuelve de fondo |
| 3 | Hacer el split responsive con `vw`-based widths (`w-[calc(100vw-Xpx)]`) | Cart siempre tiene mínimo X píxeles | Complejidad, puede romper en zoom |
| 4 | **Recomendada**: Usar `lg:` solo para desktop POS, `xl:` para "POS expandido". En `lg:` el cart pasa a un side drawer pero visible siempre, NO oculto | Mantiene responsive sin compromiso | Más trabajo de UI |

---

### 🟡 Issue D: "Hay un cuadro a la derecha de la pantalla" (posible interpretación alternativa)

Si el "cuadro grande" del Issue B es persistente y NO solo en zoom out, podría ser:

- El USlideover del cart en mobile que se renderiza fuera de viewport pero visible
- Algún `UDrawer` o modal que queda "pegado" en el DOM
- El FAB del cart mobile que tiene un tamaño desproporcionado

El próximo modelo debería confirmar esto abriendo la imagen 2.

---

## Contexto de código actual

### Cambios mergeados en `1d43849`:
```diff
// SalesView.vue (cart wrapper)
- <div class="hidden lg:block lg:w-[25%] shrink-0 px-3 lg:px-4 pt-1.5 lg:pt-2 pb-3 lg:pb-4">
-   <div class="h-full w-full rounded-2xl border border-default/50 overflow-hidden">
+ <div class="hidden lg:block lg:w-[25%] shrink-0 pl-3 lg:pl-4 pr-0 pt-1.5 lg:pt-2 pb-3 lg:pb-4">
+   <div class="h-full w-full rounded-l-2xl border border-default/50 overflow-hidden border-r-0">
```

### Estructura actual del cart:
```
SalesView (h-full flex flex-col bg-default)
├── SalesTabsStrip (sticky top)
└── flex-1 flex flex-col lg:flex-row w-full
    ├── ProductSearchPanel (lg:w-[75%])
    └── ActiveSalePanel (lg:w-[25%], pr-0, border-r-0)
        ├── cart-header (UTabs + PriceListSelector + spacer)
        ├── cart-body (SaleItemRow × N o empty state)
        └── cart-footer
            ├── customer slot
            ├── PromocionesFlatList (v-if applicablePromotions.length)
            └── SaleTotalsFooter (items count, subtotal, total, Cobrar)
```

### Breakpoints usados:
- `lg:` = 1024px (donde el cart split aparece)
- El cart drawer/FAB se activa cuando `< lg`

### Archivos clave para los próximos fixes:
1. `src/features/POS/sales/views/SalesView.vue` — wrapper del cart, FAB logic, slideover
2. `src/features/POS/sales/components/ActiveSalePanel.vue` — header compaction, footer
3. `src/features/POS/sales/components/PriceListSelector.vue` — label + dropdown
4. `src/features/POS/sales/components/SaleItemRow.vue` — card horizontal (el usuario lo aprueba)
5. `src/features/POS/sales/components/SaleTotalsFooter.vue` — totals breakdown

---

## Recomendación al próximo modelo

**Si podés ver las imágenes:**

1. **Primero validá cada issue** — ¿el cart realmente está cortado? ¿el "cuadro grande" es el slideover o algo más? No asumas, MIRÁ.
2. **Para Issue A (cart cortado)**: Considerá volver al `pr-3 lg:pr-4` + `rounded-2xl` completo. El usuario prefiere un pequeño gap a tener el cart clipped.
3. **Para Issue B (cuadro al hacer zoom)**: Esto es un bug de responsive. Probablemente relacionado con el cart mobile slideover. Usá DevTools para reproducir.
4. **Para Issue C (pantallas medias)**: Esta es una decisión de diseño. Si el usuario quiere que el cart sea cómodo en laptops, hay que cambiar los breakpoints. Sugerí opciones al usuario.
5. **NO toques**:
   - `SaleItemRow.vue` (el usuario lo aprueba)
   - `SaleTotalsFooter.vue` (la sección de totales funciona bien)
   - `PromocionesFlatList.vue` (no se ve en las capturas pero pasa tests)
   - La lógica de negocio de la venta (no es problema de UI)

**Si NO podés ver las imágenes** (heredaste este doc sin acceso):
- Pedile al usuario que confirme visualmente cada fix antes de aplicarlo
- No asumas la causa raíz — el modelo anterior también asumió y se equivocó

---

## Resumen ejecutivo

| Issue | Severidad | Status |
|---|---|---|
| A — Cart cortado, esquinas derechas no se ven | 🔴 CRÍTICO | Fix anterior empeoró el problema |
| B — Cuadro aparece al zoom out | 🔴 CRÍTICO | Probablemente related al responsive toggle |
| C — UI no funciona en pantallas medias | 🟡 MAYOR | Decisión de diseño: qué hacer con `lg` breakpoint |
| D — Cuadro persistente a la derecha (alternativa) | 🟡 MAYOR | A confirmar con imagen |

**El usuario está frustrado porque lleva 3 rondas y la UI sigue sin funcionar bien en su pantalla.** El próximo modelo debe ser HUMILDE: empezar por entender, no por aplicar fixes.

---

## Archivo de feedback previo (ronda 1)

Ver `docs/rediseno/feedback-sdd-14.md` para el historial completo de issues previos. Algunos fueron resueltos en `1d43849`, otros persisten.

---

## Estado del repo

- Branch: `main`
- Último commit: `1d43849` (fix ronda 1)
- Tests: 810/810 ✅
- Type-check: ✅
- Build: ✅
- Working tree: clean

El próximo modelo puede empezar a trabajar inmediatamente — no hay cambios sin commitear.
