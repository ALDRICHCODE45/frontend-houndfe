# Rediseño de la pantalla de detalle de Cotización — Comparación visual

Documento generado para servir como **spec de implementación** para un modelo sin capacidad multimodal. Contrasta la pantalla actual (lo que construimos) contra la pantalla objetivo (la referencia visual). Toda la información que sigue fue extraída inspeccionando las imágenes de referencia a mano.

---

## 1. Vista de Referencia (Objetivo)

### 1.1 Encabezado y navegación

**Barra de navegación superior (fija, fuera del contenido):**
- Esquina superior izquierda: logo redondo pequeño (`s`) + un ícono de bloque/cubo amarillo seguido del wordmark **"Coco"** en amarillo.
- Esquina superior derecha: ícono de búsqueda, ícono de notificaciones (campana), toggle de tema (sol/luna).
- Esquina izquierda vertical: rail de íconos de navegación (módulos). Se ve ítems como "Cotizaciones" y otros.

**Botón "Volver arriba":**
- Texto: `← Volver a cotizaciones`
- Color: gris/azul opaco, sin fondo, va arriba a la izquierda del título.

**Título de la cotización:**
- Grande, en negrita: `Cotización`
- A su derecha, dos chips:
  - Primer chip: `#e0c5f0fb` — fondo gris muy claro, texto gris, estilo "id badge".
  - Segundo chip: `● BORRADOR` — fondo amarillo/mostaza, texto blanco, con un punto blanco. Es el **status badge**.
- Tipografía del título: sans-serif, peso fuerte (~700-800).

**Metadatos en una línea debajo del título:**
- `Creada 1 ago 2026, 10:53 p.m.   Expira 31 ago 2026, 6:00 p.m.   Vendedor   Sofía Alarcón`
- Texto gris pequeño (texto secundario/terciario). Cada par clave-valor separado por espacio.
- Se observa un ícono de usuario junto a "Sofía Alarcón".

**Acciones principales (esquina superior derecha de la zona de contenido):**
- `📄 Previsualizar PDF` — botón con contorno/outlined, secundario.
- `📃 Copiar` (o duplicar) — botón con contorno/outlined, secundario.
- `🚫 Cancelar` — botón con contorno rojo, texto y borde rojo (`text-red-600` y similar). Advertencia, no acción destructiva inmediata.

**Stepper de progreso (debajo del header, full-width):**
- Línea horizontal con nodos conectados. Estados visibles: `BORRADOR` (activo, amarillo), `ENVIADA`, `ACEPTADA`, `PEDIDO`.
- El nodo activo tiene un punto lleno y label en negro. Los nodos futuros son puntos blancos con label en gris.
- Línea gris que conecta los nodos. Cuando el nodo está activo, el segmento que lleva a él es amarillo.

### 1.2 Layout principal (3 columnas)

Layout principal dividido en **tres tarjetas/paneles** dentro de un sistema grid:

- **Columna izquierda (form):** ancho ~2/3, contiene los paneles de Cliente, Lista de precios, Vigencia, Productos y Promociones.
- **Columna derecha (resumen pegajoso):** ancho ~1/3, contiene Resumen de totales, acción principal de enviar, y notas para el cliente.

Las tarjetas tienen:
- Fondo blanco
- Border radius generoso (~12px)
- Border sutil gris
- Padding interno de ~20px (5 en Tailwind)
- Sombra muy ligera o sólo border

### 1.3 Panel "Cliente"

- Título superior: `CLIENTE` (uppercase, tracking-wide, gris, peso 600, ~12px).
- Avatar circular con iniciales `HP` sobre fondo rosa/rosa claro.
- Al lado: nombre `HomeLander Perez` en bold negro.
- Debajo: `✉ hole@gmail.com` con ícono de email.
- Debajo: `📞 +52 55 1834 2210` con ícono de teléfono.
- Botón outlined al pie: `🔍 Cambiar cliente` (centrado, full-width).

### 1.4 Panel "Lista de precios"

- Título: `LISTA DE PRECIOS`
- Select dropdown con etiqueta: `Mayoreo` y un ícono de etiqueta/tag a la izquierda.
- Debajo del select, copy de ayuda en gris pequeño: `Mayoreo · desde 2 unidades. Los precios unitarios se recalculan al cambiar de lista.`

### 1.5 Panel "Vigencia"

- Título: `VIGENCIA`
- Input tipo date con ícono de calendario: muestra `08 / 31 / 2026` (m-month / d-day / y-year en formato US).
- Debajo, fila de chips de atajo: `7 días`, `15 días`, `30 días`, `Sin expiración`.
- Chips inactivos: fondo blanco, border gris, texto gris.
- El chip activo (en la imagen parece ser `15 días`, fondo amarillo claro, texto amarillo oscuro) está highlighted.

### 1.6 Panel "Productos"

- Cabecera del panel:
  - Título: `Productos` (bold negro, ~16px).
  - Subtexto: `3 productos · 4 unidades` (gris, ~12px).
  - A la derecha: `+ Agregar producto` — botón con **fondo azul sólido** (CTA, primary).
- Tabla de productos con cabecera:
  - Columnas: `PRODUCTO`, `CANTIDAD`, `PRECIO`, `DESCUENTO`, `IMPORTE`.
  - Texto en uppercase, tracking-wide, gris, ~10px.
- Filas de productos:
  - Cada fila es un container con border radius, padding generoso.
  - Columna PRODUCTO:
    - Ícono de caja (placeholder de imagen) en un cuadrado gris claro.
    - Nombre del producto: `Ibuprofeno 400mg` (bold).
    - SKU + variante en gris: `IBU-400-GR · Grande`.
    - Badge de stock: `Stock 192` en gris cuando hay stock suficiente.
  - Columna CANTIDAD: stepper `− [ 2 ] +` con la cantidad en un input pequeño entre dos botones outline.
  - Columna PRECIO: ` $170.00`.
  - Columna DESCUENTO: `−$30.00` en azul cuando hay descuento.
  - Columna IMPORTE: `$340.00` en bold alineado a la derecha.
  - Al final de la fila hay un ícono de tres puntos verticales (overflow menu) para acciones de fila (eliminar, override, etc.).
- Filas con stock bajo muestran badge **amarillo/dorado** (`⚠ Stock 10`, `⚠ Stock 8`).

### 1.7 Panel "Promociones"

- Título: `🪄 Promociones` (ícono de varita + texto bold).
- Subtexto: `2 activas de 2 detectadas` (gris).
- Lista de promociones aplicadas:
  - Cada promo en su propia card/bloque con border-radius.
  - Borde izquierdo **amarillo/dorado** de 4px (acento vertical).
  - Layout:
    - Izquierda: nombre bold (`Promo SpiderMan`) + descripción gris (`Aplica sobre analgésicos · vigente al 30 sep`).
    - Derecha: badge `AUTOMÁTICA` (pill outline gris), monto `−$30.00` en azul, botón `× Vetar` (outlined).
- Al final del panel: input dropdown `Agregar promoción manual...` con su propio botón `Aplicar` outlined a la derecha.

### 1.8 Panel "Resumen" (columna derecha)

- Título: `RESUMEN` (uppercase, tracking-wide, gris, ~12px).
- Subtexto: `3 productos · 4 unidades · lista Mayoreo` (gris, ~12px).
- Filas de totales:
  - `Subtotal` — `$581.50` (gris, alineado a la derecha).
  - `Descuentos` — `−$120.00` (azul, alineado a la derecha).
  - `IVA 16%` — `$73.84` (gris, alineado a la derecha).
- Línea separadora.
- `TOTAL` — `$535.34` (grande, bold, ~32px, negro, alineado a la derecha).
- Botón principal: `📤 Enviar cotización` — **fondo azul sólido** (CTA), full-width, padding generoso.
- Botón secundario: `💾 Guardar borrador` — fondo gris claro, full-width, debajo del CTA.
- Texto de aviso al pie: `🛡️ Válida hasta el 31 de agosto de 2026.` (gris, con ícono de check).

### 1.9 Panel "Notas para el cliente" (debajo del resumen)

- Título: `NOTAS PARA EL CLIENTE` (uppercase, tracking-wide, gris).
- Textarea con placeholder: `Condiciones de entrega, referencias de pago...`
- Contador de caracteres en la esquina inferior derecha: `0 / 280`.

### 1.10 Identidad visual general

**Paleta de colores:**
- **Primary / CTA:** azul vibrante (aprox `#3B5BFF` o `#2557D6`).
- **Accent / amarillo:** mostaza/dorado (aprox `#E0A800` o `#F5A623`).
- **Background general:** gris muy claro / casi blanco (`#F9FAFB` o `#F3F4F6`).
- **Cards:** blanco puro.
- **Texto principal:** negro/gris muy oscuro (`#111827`).
- **Texto secundario:** gris medio (`#6B7280`).
- **Texto terciario:** gris claro (`#9CA3AF`).
- **Borders:** gris muy claro (`#E5E7EB`).
- **Descuentos (azul):** azul (`#3B5BFF` o `#2563EB`).
- **Stock saludable:** gris.
- **Stock bajo:** amarillo/dorado.
- **Sin stock:** rojo.
- **Cancelar / peligro:** rojo (`#DC2626` o `#EF4444`).

**Tipografía:**
- Sans-serif del sistema (Inter o similar).
- Pesos: 400 (regular), 500 (medium), 600 (semibold), 700 (bold).
- Mayúsculas + tracking-wide para labels de sección.
- Tamaños: 12px (labels), 14px (body), 16px (subtítulos), 18px (títulos), 24-32px (total).

**Espaciado:**
- Cards con `p-5` (20px) interno.
- Gaps entre secciones: `gap-4` (16px).
- Border-radius: `rounded-xl` (12px) para cards, `rounded-md` (8px) para inputs/botones.
- Sombra: muy sutil o solo border.

**Componentes visibles (estilo):**
- Botones primary: fondo azul, texto blanco, padding generoso.
- Botones outlined: border gris, fondo blanco, texto gris/oscuro.
- Inputs: border gris, rounded-md, fondo blanco.
- Chips de vigencia: pills outlined, el activo con fondo amarillo claro.
- Cards de productos: rows con border-radius, padding interno generoso.
- Cards de promociones: border-left amarillo de 4px.
- Status badges: pill con color de fondo según estado.

---

## 2. Vista Actual (lo que tenemos hoy)

### 2.1 Estructura general

La pantalla actual está en `src/features/POS/quotations/views/QuotationDetailView.vue` y más o menos sigue este orden vertical:

1. **Header:** botón "Volver" + título `Cotización #<folio>` + chip de status + botones de acciones (Previsualizar PDF, Enviar, Cancelar).
2. **Primera fila** — 3 cards separados: Cliente, Lista de precios, Expiración.
3. **Productos** — card con tabla de items.
4. **Promociones** — card con promos aplicadas, vetoed, y selector.
5. **Totales + Acciones** — al final, dentro de un card de resumen.
6. **Notas para el cliente** — debajo del resumen.

### 2.2 Lo que hay vs lo que falta

| Área | Actual | Objetivo |
|---|---|---|
| **Stepper de progreso** | ❌ No existe | ✅ Línea horizontal con BORRADOR → ENVIADA → ACEPTADA → PEDIDO |
| **Avatar del cliente** | ❌ No existe | ✅ Iniciales en círculo rosa |
| **Datos de contacto del cliente** | ⚠️ Solo email (sin teléfono) | ✅ Email + teléfono, íconos |
| **Botón "Cambiar cliente"** | ✅ Existe pero es texto | ✅ Botón outlined con ícono |
| **Info de lista de precios** | ⚠️ Solo el select | ✅ Texto de ayuda explicando la lista (`Mayoreo · desde 2 unidades...`) |
| **Vigencia** | ⚠️ Solo input de fecha | ✅ Date input + chips de atajo (7/15/30 días, sin expiración) |
| **Tabla de productos** | ⚠️ Layout básico, sin border-radius generoso, sin stock badge inline | ✅ Cards por fila, stock badge inline, acciones en menú overflow |
| **Badge de stock** | ✅ Existe (Stock 192, ⚠ Stock 10) pero con íconos diferentes | ✅ Mismo concepto pero con mejor contraste |
| **Promociones** | ⚠️ Aceptable pero con dropdown | ✅ Cards con border-left amarillo, layout mucho más visual |
| **Resumen (totales)** | ⚠️ Existe pero abajo del todo | ✅ Pegajoso en columna derecha, con IVA 16%, total grande |
| **Botón "Enviar cotización"** | ⚠️ Texto plano, sin ícono | ✅ CTA grande con ícono de envío |
| **Notas para el cliente** | ⚠️ Existe al pie | ✅ Mismo concepto, con contador 0/280 |
| **Layout 2 columnas** | ❌ Toda la pantalla en 1 columna | ✅ Grid 2/3 + 1/3, resumen sticky a la derecha |

### 2.3 Detalles específicos del estado actual

**Header:**
- Botón "Volver" + título `Cotización #e0c5f0fb` (24px) + un dot azul + chip "Borrador" en azul.
- Subtítulos inline: `Expira 31 ago 2026, 6:00 p.m.   Creada 1 ago 2026, 10:53 p.m.`
- Acciones: `Previsualizar PDF` (outlined), `Enviar` (filled azul), `Cancelar` (outlined rojo).

**Cards de la primera fila:**
- Cada card tiene un subtítulo uppercase: `CLIENTE`, `LISTA DE PRECIOS`, `EXPIRA`.
- **Cliente:** nombre + email. Sin avatar, sin teléfono.
- **Lista de precios:** tag `Lista: Mayoreo` + select.
- **Expiración:** input date + texto "31 de agosto de 2026" + botón outline `× Quitar expiración`.

**Productos:**
- Card con título `Productos` + "3 productos" + botón `+ Agregar producto` (filled azul).
- Renderiza `QuotationItemRow` por cada item:
  - Imagen placeholder (cuadrado gris con ícono de caja).
  - Nombre del producto.
  - SKU + variante en gris.
  - Stepper `− [QTY] +` (input chico).
  - Stock badge: `Stock: 192` o `⚠ Stock 10` (gris con ícono).
  - Precios/descuentos con formato `× $170.00 = $340.00` (`c/u` style).
  - Menú overflow (3 puntos verticales) para eliminar/override.

**Promociones:**
- Card con título `Promociones` (negrita).
- Sección "APLICADAS": lista de promos aplicadas con:
  - Título de la promo (bold).
  - `−$30.00` en azul.
  - Badge `AUTOMÁTICA` (pill outline).
  - Botón `× Vetar` (outlined).
- Sección "VETADAS": si existen, lista de promos con botón `Re-activar`.
- Sección "AGREGAR PROMOCIÓN": dropdown + botón "Aplicar" (outlined).

**Resumen (totales):**
- Card con título `RESUMEN` (uppercase gris).
- Texto: `3 productos · 4 unidades` (gris).
- Filas:
  - `Subtotal` — `$400.00` (gris, derecha).
  - `Descuento` en azul — `−$60.00` (azul, derecha).
  - `Total` — `$340.00` (grande, bold, derecha).

### 2.4 Issues de UX/UI que la referencia resuelve

- **Todo está en una columna muy larga.** El resumen al final del scroll obliga al cajero a bajar para ver los totales mientras arma la cotización.
- **No hay stepper visible.** El cajero no ve de un vistazo en qué estado está la cotización.
- **Las tarjetas de promociones no son visualmente diferenciadas.** El border-left amarillo las haría saltar a la vista.
- **El cliente no tiene avatar ni teléfono.** La referencia incluye avatar con iniciales, email y teléfono.
- **Botón "Enviar cotización" no es prominente.** En la referencia es el CTA principal, full-width, gigantic.
- **El input de fecha plana.** La referencia muestra chips de atajo para 7/15/30 días.
- **Status bar del header minimal.** En la referencia es un stepper visual conectado.

---

## 3. Identidad visual — Tokens a usar

### 3.1 Colores (extraídos de la referencia)

```
--coco-primary: #2557D6    /* Azul para CTAs, totales, badges primary */
--coco-primary-50: #EFF4FF /* Fondo muy claro del primary */
--coco-accent: #E0A800     /* Amarillo mostaza para status, highlights, border-left */
--coco-accent-50: #FEF8E7  /* Fondo amarillo claro para chips activos */
--coco-bg: #F9FAFB         /* Background general */
--coco-card: #FFFFFF       /* Fondo de cards */
--coco-border: #E5E7EB     /* Borders muy claros */
--coco-text: #111827       /* Texto principal */
--coco-text-secondary: #6B7280  /* Texto secundario (subtítulos) */
--coco-text-tertiary: #9CA3AF   /* Texto placeholder/ayuda */
--coco-success: #10B981    /* Verde para confirmaciones */
--coco-warning: #F59E0B    /* Amarillo para advertencia stock bajo */
--coco-danger: #DC2626     /* Rojo para Cancelar/sin stock */
--coco-info: #3B5BFF       /* Azul para descuentos */
```

### 3.2 Espaciado (Tailwind)

- `gap-4` (16px) entre tarjetas principales.
- `p-5` (20px) padding interno de cards.
- `rounded-xl` (12px) border-radius para cards.
- `rounded-md` (8px) para inputs/botones.
- `gap-2` (8px) entre elementos dentro de una card.

### 3.3 Tipografía

- Familia: Inter (o la sans-serif del sistema del proyecto).
- H1: 24px, 700.
- H2: 18px, 600.
- Body: 14px, 400.
- Label: 12px, 600, uppercase, tracking-wide.
- Total: 32px, 700.

### 3.4 Componentes de la referencia

- **Status badge:** pill chico, fondo amarillo, texto blanco en bold, con punto blanco.
- **ID badge:** pill chico, fondo gris muy claro, texto gris, monospace.
- **Action buttons (header):** `outlined` secundarios, `filled` primary.
- **Cancel button:** outlined rojo (`text-red-600 border-red-600`).
- **Stock badge:**
  - OK: `bg-default text-muted` con `▣ Stock 192`.
  - Low: `bg-yellow-500/10 text-yellow-600` con `⚠ Stock 10`.
- **Promotion card:** `border-left: 4px solid yellow`, padding-left 16px, título bold, descripción gris.
- **Discount value:** `text-blue-600` con `−$XX.XX`.
- **Total:** `text-3xl font-bold tabular-nums` en negro.

---

## 4. Plan de implementación sugerido

### 4.1 Cambios estructurales

1. **Layout 2 columnas:** toda la vista pasa a un grid `grid-cols-3` con `lg:grid-cols-3`. Columna izquierda con span de 2, columna derecha con span de 1 y `sticky top-4`.
2. **Mover resumen a la derecha:** el card de `RESUMEN` + `NOTAS` + botones de acción salen del flow vertical y van a la columna derecha.
3. **Stepper de progreso:** nuevo componente `QuotationProgressStepper` que muestra los 4 estados (`BORRADOR`, `ENVIADA`, `ACEPTADA`, `PEDIDO`) con la lógica de resaltado.
4. **Header refactor:** el header pasa de ser 1 línea horizontal con título y botones a 2 partes: arriba el stepper de progreso, abajo el header con título + acciones.

### 4.2 Refactor de componentes

5. **`QuotationItemRow`** — ya está razonable, pero ajustar a:
   - Stock badge con mejor contraste visual.
   - Más padding interno.
   - Layout exactamente como la referencia (icono box + nombre + sku/variant, stepper, descuento, importe con subtotal).
6. **`QuotationTotalsFooter`** — repensar como card de resumen:
   - Título `RESUMEN` + subtítulo contextual.
   - Subtotal, descuentos, IVA 16%, total.
   - Botón `Enviar cotización` grande + `Guardar borrador` outlined.
7. **Promociones** — cambiar el layout de tabla a cards:
   - Cada promo aplicada en una card con `border-left` amarillo.
   - Sección "Vetadas" mantenida abajo como cards más sutiles.
   - Selector de promociones al final.
8. **Vigencia** — agregar chips de atajo (7/15/30 días, Sin expiración).
9. **Cliente** — agregar avatar con iniciales, agregar teléfono, botón "Cambiar cliente" outlined.

### 4.3 Nuevos componentes

- `QuotationProgressStepper.vue` — stepper visual de 4 estados.
- `ClientAvatar.vue` — círculo con iniciales (o reutilizar uno existente).
- `ExpiryShortcutChips.vue` — chips de atajo para vigencia (o inline en el card de Expiración).
- `PromotionCard.vue` — card de promoción con border-left amarillo.

### 4.4 Consideraciones de implementación

- **Pureza de TypeScript:** seguir usando `computed` y refs, no estado fuera del setup.
- **Composition API + `<script setup>`:** mantener el patrón actual.
- **Nuxt UI v4:** todos los componentes interactivos deben seguir usando componentes de Nuxt UI (UButton, UInput, USelectMenu, etc.) para mantener consistencia.
- **Tests:** actualizar `QuotationDetailView.test.ts` con nuevos data-testids y selectores.
- **i18n:** todo el copy en español (neutral profesional).

### 4.5 Riesgos / preguntas abiertas

- **¿El avatar con iniciales funciona cuando el cliente no tiene firstName/lastName?** Hay que fallback elegante.
- **¿El textarea de notas tiene un endpoint en el backend?** Si no, queda como UI-only (no-op).
- **¿El stepper tiene una transición animada cuando el status cambia?** Considerar.
- **¿Los chips de vigencia llaman al backend o son shortcuts locales?** Asumir shortcuts: setean el `expiresAt` según el día seleccionado.

---

## 5. Mapeo de imágenes a estados

| Imagen | Estado |
|---|---|
| Imagen 1 (la **primera** que enviaste) | **REFERENCIA / OBJETIVO** — cómo debe verse la vista final. |
| Imágenes 2 y 3 (las **siguientes**) | **ACTUAL** — cómo se ve la vista hoy con datos (cliente, productos, promos). |

Ambas vistas actuales muestran la misma pantalla con scroll en distintas posiciones: la imagen 2 enfoca la parte de arriba (header + cliente + precios + expiración + productos), y la imagen 3 enfoca la parte de abajo (productos + promociones + resumen + notas).
