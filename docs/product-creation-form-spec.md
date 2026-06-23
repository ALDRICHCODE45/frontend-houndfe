# Product Creation Form — Design-Tool-Ready Specification

> **Document purpose**: Exhaustive field-by-field specification of the POS "create product" form so a designer who has never seen the code can rebuild it exactly. All UI labels are quoted **verbatim** in their original language (Spanish).
>
> **Sources**: Frontend (`frontend-houndfe`) components + composables, Backend (`houndfe-backend`) DTOs + domain entities + service validation.

---

## 1. Form Overview

### Purpose

Create a new product (or service) in the POS system. The form collects product metadata, classification, pricing, inventory configuration, tax settings, variants, lots, price lists, and images — all submitted atomically in a single API call (`POST /products`).

### Two Entry Points (same data model, different surface area)

| Entry Point                  | Component                                         | Surface                                                  | Fields Exposed                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quick Create** (slideover) | `ProductUpsertSlideover.vue`                      | Right-side `USlideover` panel                            | Subset: name, SKU, barcode, category, brand, price, stock, min stock, description, location, SAT key, plus 4 checkboxes. Excludes taxes, units, lots, variants, price lists, images. Links to full editor. |
| **Full Editor** (page)       | `ProductDetailView.vue` route `/pos/products/new` | Full-page scrollable form with multiple `UCard` sections | ALL fields, including variants, lots, price lists (inline local state), tax config, images (edit-mode only).                                                                                               |

This specification focuses on the **Full Editor** since it is the complete superset.

### Submit Flow

1. User fills the form across multiple card-sections.
2. On submit, `buildFullCreatePayload()` merges the main form state + pending variants + pending lots + pending price lists into a single `CreateProductPayload`.
3. `POST /products` creates the product + all sub-resources atomically inside a DB transaction.
4. After creation, if variants were included, variant prices configured locally are applied via `PUT /products/:id/variants/:vid/prices/:plid` calls (because the backend auto-creates variant prices at `0` cents during creation).
5. On success, the user is redirected to the product detail page (`/pos/products/:id`).

### Create vs Edit Differences

- In **create mode**: variants, lots, and price lists are managed as local pending arrays (client-side only until submit). Images cannot be uploaded until after creation.
- In **edit mode**: variants, lots, and price lists are managed via individual API mutations. Images can be uploaded via drag-and-drop. The `PriceListSection` component replaces the inline price list table.

---

## 2. Segment-by-Segment Breakdown (Display Order)

The full editor is structured as a vertical stack of `UCard` sections inside a `UForm` wrapped in a `<fieldset>`.

### Header Bar (sticky top)

- Back button (arrow-left icon) → navigates to `/pos/products`
- Title: `"Nuevo producto"` (create) or the product name (edit)
- Submit button: `"Crear producto"` / `"Guardar cambios"` — loading state while mutation pending

### Section 1: "Datos del producto"

Product identity, classification, toggles, and description.

### Section 2: "Precio de Compra"

Purchase cost mode (NET/GROSS) and cost amount input.

### Section 3: "Impuestos"

Tax toggle + IVA/IEPS selects (conditionally visible).

### Section 4: "Inventario"

Stock toggle, manual stock fields, lots toggle, variants toggle. Only visible when `type === 'PRODUCT'`.

### Section 5: "Variantes"

Variant table + add/edit/delete modal. Visible when `!useLotsAndExpirations`.

### Section 6: "Lotes"

Lot table + add modal. Visible when `useStock && useLotsAndExpirations && !hasVariants`.

### Section 7: "Listas de Precios" (create mode only)

Inline price list management with tier prices. In edit mode, replaced by `PriceListSection` component.

### Section 8: "Imágenes" (edit mode only)

Drag-and-drop image gallery with upload, set-main, delete. Not available during creation.

---

## 3. Field Catalog

### Section 1: "Datos del producto"

| #   | UI Label                         | Field Key                | Input Type                                                                                          | Required                    | Default                    | Placeholder / Help                                                                                                    | Validation (Frontend Zod)                                                                                                                            | Validation (Backend DTO + Domain)                                                                                       | Allowed Values / Source                                           |
| --- | -------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | `"Tipo de producto"`             | `type`                   | Radio group (card variant, horizontal)                                                              | Yes                         | `'PRODUCT'`                | Options: `"Producto"` (desc: `"Artículo físico con inventario"`) / `"Servicio"` (desc: `"Sin control de inventario"`) | `z.enum(['PRODUCT', 'SERVICE'])`                                                                                                                     | `@IsEnum(['PRODUCT', 'SERVICE'])` — optional, defaults to `'PRODUCT'`                                                   | Hardcoded: `PRODUCT`, `SERVICE`                                   |
| 2   | `"Nombre"`                       | `name`                   | Text input                                                                                          | **Yes** (marked `required`) | `''`                       | `"Ej: Jabón de mano"`                                                                                                 | `z.string().trim().min(2).max(100)` — error: `"El nombre es obligatorio"`, `"El nombre debe tener al menos 2 caracteres"`, `"Máximo 100 caracteres"` | `@IsString() @MaxLength(100)`. Domain: `ProductName.create()` — required, trimmed, max 100 chars, cannot be only digits | —                                                                 |
| 3   | `"Código de barras"`             | `barcode`                | Text input                                                                                          | No                          | `''`                       | `"Opcional"`                                                                                                          | `z.string().trim().max(100)`                                                                                                                         | `@IsString()` optional. Service: DB uniqueness check (global across products + variants)                                | —                                                                 |
| 4   | `"SKU"`                          | `sku`                    | Text input                                                                                          | No                          | `''`                       | `"Opcional"`                                                                                                          | `z.string().trim().max(100)`                                                                                                                         | `@IsString()` optional. Service: trimmed, uppercased, DB uniqueness check (global)                                      | —                                                                 |
| 5   | `"Vender en Punto de Venta"`     | `sellInPos`              | Toggle (`USwitch`)                                                                                  | No                          | `true`                     | desc: `"Este producto aparecerá en la pantalla del POS"`                                                              | `z.boolean()`                                                                                                                                        | `@IsBoolean()` optional, defaults `true`                                                                                | —                                                                 |
| 6   | `"Incluir en catálogo en línea"` | `includeInOnlineCatalog` | Toggle (`USwitch`)                                                                                  | No                          | `true`                     | desc: `"Visible en la tienda online"`                                                                                 | `z.boolean()`                                                                                                                                        | `@IsBoolean()` optional, defaults `true`                                                                                | —                                                                 |
| 7   | `"Requerir receta médica"`       | `requiresPrescription`   | Toggle (`USwitch`)                                                                                  | No                          | `false`                    | desc: `"Exigir receta médica para su venta"`                                                                          | `z.boolean()`                                                                                                                                        | `@IsBoolean()` optional, defaults `false`                                                                               | —                                                                 |
| 8   | `"Unidad"`                       | `unit`                   | Select (`USelect`)                                                                                  | No                          | `'UNIDAD'`                 | —                                                                                                                     | `z.string().trim()`                                                                                                                                  | `@IsEnum([...])` optional, defaults `'UNIDAD'`. Domain validates against `VALID_UNITS`                                  | See §3.1                                                          |
| 9   | `"Categoría"`                    | `categoryId`             | Custom select (`CategorySelect`) with search, inline create action                                  | No                          | `''` (empty = no category) | `"Seleccionar categoría"`                                                                                             | `z.string().trim()`                                                                                                                                  | `@IsString()` optional. Must be valid UUID referencing existing category                                                | API-loaded: `GET /categories` + inline `"Crear categoría"` action |
| 10  | `"Marca"`                        | `brandId`                | Custom select (`CategorySelect`) with search, inline create action                                  | No                          | `''` (empty = no brand)    | `"Seleccionar marca"`                                                                                                 | `z.string().trim()`                                                                                                                                  | `@IsString()` optional                                                                                                  | API-loaded: `GET /brands` + inline `"Crear marca"` action         |
| 11  | `"Ubicación"`                    | `location`               | Text input                                                                                          | No                          | `''`                       | `"Ej: Estante 3B"`                                                                                                    | `z.string().trim().max(120)`                                                                                                                         | `@IsString() @MaxLength(120)` optional                                                                                  | —                                                                 |
| 12  | `"Descripción"`                  | `description`            | Textarea (4 rows)                                                                                   | No                          | `''`                       | `"Agregar una descripción..."`                                                                                        | `z.string().trim().max(2000)`                                                                                                                        | `@IsString() @MaxLength(2000)` optional                                                                                 | —                                                                 |
| 13  | `"SAT Key"`                      | `satKey`                 | Text input (in slideover) / Not directly visible in full editor Section 1 but present in form state | No                          | `''`                       | `"Opcional"`                                                                                                          | `z.string().trim().max(100)`                                                                                                                         | `@IsString()` optional                                                                                                  | —                                                                 |

> **Note on SAT Key**: The `satKey` field is present in the slideover layout (paired with `"Ubicación"`) and in the form state/schema, but in the full `ProductDetailView` it does not have an explicit `UFormField` in Section 1 template. The field IS included in the form state and payload. This is an **ambiguity** (see §10).

#### §3.1 Unit Options (hardcoded)

| Label          | Value        |
| -------------- | ------------ |
| `"Unidad"`     | `UNIDAD`     |
| `"Caja"`       | `CAJA`       |
| `"Bolsa"`      | `BOLSA`      |
| `"Metro"`      | `METRO`      |
| `"Centímetro"` | `CENTIMETRO` |
| `"Kilogramo"`  | `KILOGRAMO`  |
| `"Gramo"`      | `GRAMO`      |
| `"Litro"`      | `LITRO`      |

Labels are displayed uppercased in the select: `unit.label.toUpperCase()`.

### Section 2: "Precio de Compra"

| #   | UI Label                               | Field Key          | Input Type                                                      | Required | Default  | Placeholder / Help                                                                | Validation                                                                                                        | Allowed Values                                                                                                       |
| --- | -------------------------------------- | ------------------ | --------------------------------------------------------------- | -------- | -------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 14  | (radio group, no explicit label)       | `purchaseCostMode` | Radio group (horizontal) with descriptions                      | No       | `'NET'`  | Options: `"Neto"` (desc: `"Sin impuestos"`) / `"Bruto"` (desc: `"Con impuestos"`) | `z.enum(['NET', 'GROSS'])`                                                                                        | Hardcoded: `NET`, `GROSS`                                                                                            |
| 15  | (no label — field name `purchaseCost`) | `purchaseCost`     | Currency input (text with `$` prefix and `"por Unidad"` suffix) | No       | `'0.00'` | `"0.00"`                                                                          | `z.string().trim().regex(/^\d+(?:[.,]\d{1,2})?$/).or(z.literal(''))` — error: `"Ingresá un valor decimal válido"` | Backend: `@IsNumber() @Min(0)` in `PurchaseCostDto.valueCents`. Domain: `PurchaseCost.create()` — cannot be negative |

**Computed behavior**: The backend's `PurchaseCost` value object derives net/gross from the other based on `mode + IVA multiplier + IEPS multiplier`. Formula: `grossCents = netCents × (1 + ivaMultiplier + iepsMultiplier)` or `netCents = grossCents / (1 + ivaMultiplier + iepsMultiplier)`.

### Section 3: "Impuestos"

| #   | UI Label             | Field Key            | Input Type         | Required | Default       | Placeholder / Help                           | Validation          | Allowed Values |
| --- | -------------------- | -------------------- | ------------------ | -------- | ------------- | -------------------------------------------- | ------------------- | -------------- |
| 16  | `"Cobrar impuestos"` | `chargeProductTaxes` | Toggle (`USwitch`) | No       | `true`        | desc: `"Aplicar IVA e IEPS a este producto"` | `z.boolean()`       | —              |
| 17  | `"IVA"`              | `ivaRate`            | Select (`USelect`) | No       | `'IVA_16'`    | —                                            | `z.string().trim()` | See §3.2       |
| 18  | `"IEPS"`             | `iepsRate`           | Select (`USelect`) | No       | `'NO_APLICA'` | —                                            | `z.string().trim()` | See §3.3       |

Fields 17–18 are **conditionally visible** — only shown when `chargeProductTaxes === true`.

#### §3.2 IVA Options (hardcoded)

| Label      | Value        | Backend Percentage                           |
| ---------- | ------------ | -------------------------------------------- |
| `"16%"`    | `IVA_16`     | 16%                                          |
| `"8%"`     | `IVA_8`      | 8%                                           |
| `"0%"`     | `IVA_0`      | 0% (taxable at 0%)                           |
| `"Exento"` | `IVA_EXENTO` | 0% (exempt — semantically different from 0%) |

#### §3.3 IEPS Options (hardcoded)

| Label         | Value       | Backend Percentage |
| ------------- | ----------- | ------------------ |
| `"No aplica"` | `NO_APLICA` | 0%                 |
| `"160%"`      | `IEPS_160`  | 160%               |
| `"53%"`       | `IEPS_53`   | 53%                |
| `"50%"`       | `IEPS_50`   | 50%                |
| `"30.4%"`     | `IEPS_30_4` | 30.4%              |
| `"30%"`       | `IEPS_30`   | 30%                |
| `"26.5%"`     | `IEPS_26_5` | 26.5%              |
| `"25%"`       | `IEPS_25`   | 25%                |
| `"9%"`        | `IEPS_9`    | 9%                 |
| `"8%"`        | `IEPS_8`    | 8%                 |
| `"7%"`        | `IEPS_7`    | 7%                 |
| `"6%"`        | `IEPS_6`    | 6%                 |
| `"3%"`        | `IEPS_3`    | 3%                 |
| `"0%"`        | `IEPS_0`    | 0%                 |

### Section 4: "Inventario"

Only visible when `formState.type === 'PRODUCT'` (`showInventoryCard` computed).

| #   | UI Label                              | Field Key               | Input Type                           | Required | Default | Placeholder / Help                                             | Validation                                                                                                       | Conditional Visibility                                         |
| --- | ------------------------------------- | ----------------------- | ------------------------------------ | -------- | ------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 19  | `"Controlar inventario"`              | `useStock`              | Toggle (`USwitch`)                   | No       | `true`  | desc: `"Activar seguimiento de existencias y cantidad mínima"` | `z.boolean()`                                                                                                    | Always visible within Inventario card                          |
| 20  | `"Existencias"`                       | `quantity`              | Number input (`UInputNumber`, min=0) | No       | `0`     | hint: `"Unidades"`                                             | `z.number().int().min(0)` — errors: `"Ingresá un número válido"`, `"Debe ser entero"`, `"No puede ser negativo"` | Only when `useStock && !useLotsAndExpirations && !hasVariants` |
| 21  | `"Existencias mínimas"`               | `minQuantity`           | Number input (`UInputNumber`, min=0) | No       | `0`     | hint: `"Unidades"`                                             | `z.number().int().min(0)`                                                                                        | Same as field 20. Also shown in Lots section.                  |
| 22  | `"Usar lotes y vencimientos"`         | `useLotsAndExpirations` | Toggle (`USwitch`)                   | No       | `false` | desc: `"Agrupar unidades por lote y fecha de expiración"`      | `z.boolean()`                                                                                                    | Only when `useStock && !hasVariants`                           |
| 23  | `"Tiene variantes"`                   | `hasVariants`           | Toggle (`USwitch`)                   | No       | `false` | desc: `"Talles, colores u otras opciones"`                     | `z.boolean()`                                                                                                    | Always visible within Inventario card                          |
| —   | `"El stock se gestiona por variante"` | (info message)          | Warning text                         | —        | —       | —                                                              | —                                                                                                                | Only when `hasVariants === true`                               |

### Section 5: "Variantes" (visible when `!useLotsAndExpirations`)

Not a single field but a repeatable structure. See §5 for full specification.

### Section 6: "Lotes" (visible when `useStock && useLotsAndExpirations && !hasVariants`)

Repeatable structure. See §5 for full specification.

### Section 7: "Listas de Precios" (create mode)

| #   | UI Label                                                                                            | Field Key                    | Input Type                            | Required | Default | Placeholder / Help | Validation                                          |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------- | -------- | ------- | ------------------ | --------------------------------------------------- |
| 24  | `"Precio de Venta"` (column header: `"Precio de Venta"` with subtext `"(Con Impuestos Incluidos)"`) | Per price list: `priceCents` | Currency input (text with `$` prefix) | No       | `0`     | `"0.00"`           | Decimal regex in UI. Backend: `@IsNumber() @Min(0)` |

Also includes:

- Per-row `"+"` button for tier prices
- `"Márgen"` and `"Ganancia"` computed columns (read-only)
- `"Quitar"` button (disabled for default PUBLICO list)
- `"Agregar Lista de Precios"` button to add more global price lists

### Section 8: "Imágenes" (edit mode only)

| #   | UI Label                                                                    | Input Type                            | Validation                                                                                                                      |
| --- | --------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 25  | Drag-and-drop zone: `"Arrastrá tus imágenes aquí o hacé click para elegir"` | File upload (drag-drop + file picker) | Client: MIME in `['image/jpeg', 'image/png', 'image/webp', 'image/gif']`, max 10 MB. Backend: `@IsUrl()` for URL-based creation |

### Quick-Create Slideover: "Precio de venta" field

| #   | UI Label            | Field Key | Input Type           | Required | Default          | Placeholder | Validation                                                                           |
| --- | ------------------- | --------- | -------------------- | -------- | ---------------- | ----------- | ------------------------------------------------------------------------------------ |
| —   | `"Precio de venta"` | `price`   | Text input (decimal) | No       | `''` or `'0.00'` | `"199.90"`  | `z.string().trim().regex(/^\d+(?:[.,]\d{1,2})?$/).or(z.literal('')).default('0.00')` |

This field maps to `priceCents` in the payload via `decimalInputToCents()`. In the full editor, the price is set per-price-list in Section 7 (the PUBLICO list's price is the equivalent).

---

## 4. Dependency & Conditional-Logic Map

This is the most critical section. Every conditional relationship is listed below.

### 4.1 Type-Driven Dependencies

| When               | Then                                                                                                                                                                                                         | Mechanism                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `type = 'SERVICE'` | `useStock` → forced `false`; `useLotsAndExpirations` → forced `false`; `hasVariants` → forced `false`; `quantity` → `0`; `minQuantity` → `0`. All pending variants, lots, price lists cleared (create mode). | `watch(() => formState.type)` in `ProductDetailView` |
| `type = 'SERVICE'` | **Inventario card hidden entirely**                                                                                                                                                                          | `showInventoryCard = formState.type === 'PRODUCT'`   |
| `type = 'PRODUCT'` | Inventario card visible, all inventory sub-fields available                                                                                                                                                  | Default behavior                                     |

### 4.2 Stock-Driven Dependencies

| When               | Then                                                                                                | Mechanism                                       |
| ------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `useStock = false` | `useLotsAndExpirations` → forced `false`; `quantity` → `0`; `minQuantity` → `0`                     | `watch(() => formState.useStock)`               |
| `useStock = false` | Existencias + Existencias mínimas fields **disabled** (in slideover) or **hidden** (in full editor) | `showManualStockFields` computed                |
| `useStock = false` | `"Usar lotes y vencimientos"` toggle **hidden**                                                     | `showLotsCheckbox` = `useStock && !hasVariants` |
| `useStock = true`  | Existencias + Existencias mínimas fields shown (if not lots, not variants)                          | `showManualStockFields`                         |

### 4.3 Variant-Driven Dependencies

| When                  | Then                                                                            | Mechanism                                                                                           |
| --------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `hasVariants = true`  | `useLotsAndExpirations` → forced `false`; `quantity` → `0`; `minQuantity` → `0` | `watch(() => formState.hasVariants)`                                                                |
| `hasVariants = true`  | Manual stock fields (Existencias, Existencias mínimas) **hidden**               | `showManualStockFields` = `useStock && !useLotsAndExpirations && !hasVariants`                      |
| `hasVariants = true`  | `"Usar lotes y vencimientos"` toggle **hidden**                                 | `showLotsCheckbox` = `useStock && !hasVariants`                                                     |
| `hasVariants = true`  | Warning message shown: `"El stock se gestiona por variante"`                    | `showStockByVariantMessage` = `hasVariants`                                                         |
| `hasVariants = true`  | Variants section becomes active (table + add button)                            | Section always visible when `!useLotsAndExpirations`, but table is populated only if variants exist |
| `hasVariants = true`  | Lotes section **hidden**                                                        | `showLotsSection` = `useStock && useLotsAndExpirations && !hasVariants`                             |
| `hasVariants = false` | Variants can still be listed but the table will say `"Sin variantes"`           | —                                                                                                   |

### 4.4 Lots-Driven Dependencies

| When                           | Then                                                                                                       | Mechanism                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `useLotsAndExpirations = true` | `quantity` → forced `0` (stock lives in individual lots)                                                   | `watch(() => formState.useLotsAndExpirations)`                                  |
| `useLotsAndExpirations = true` | Manual stock `"Existencias"` field **hidden**; but `"Existencias mínimas"` shown at bottom of Lots section | `showManualStockFields` = false, but Lots section has its own minQuantity field |
| `useLotsAndExpirations = true` | Lots section visible with add/delete table                                                                 | `showLotsSection` computed                                                      |
| `useLotsAndExpirations = true` | Variants section **hidden**                                                                                | `showVariantsSection` = `!useLotsAndExpirations`                                |

### 4.5 Tax-Driven Dependencies

| When                         | Then                                             | Mechanism                                                                 |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| `chargeProductTaxes = false` | IVA and IEPS select fields **hidden**            | `v-if="formState.chargeProductTaxes"`                                     |
| `chargeProductTaxes = false` | `ivaRate` and `iepsRate` **not sent** in payload | `toCreatePayload()`: only includes them when `chargeProductTaxes` is true |
| `chargeProductTaxes = true`  | IVA and IEPS selects shown                       | Conditional render                                                        |

### 4.6 Backend Pre-Validation Cross-Field Rules

| Rule                                                                              | Error                                                             |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `variants` array provided but `hasVariants = false`                               | `"Cannot provide variants when hasVariants is false"`             |
| `lots` array provided but `useLotsAndExpirations = false` OR `hasVariants = true` | `"Lots require useLotsAndExpirations=true and hasVariants=false"` |
| Duplicate SKU within same request (product + variants)                            | `"Duplicate SKU within the same request"`                         |
| Duplicate barcode within same request                                             | `"Duplicate barcode within the same request"`                     |
| SKU already exists in DB                                                          | `EntityAlreadyExistsError('SKU', ...)`                            |
| Barcode already exists in DB                                                      | `EntityAlreadyExistsError('Barcode', ...)`                        |
| Duplicate priceListId in `priceLists` array                                       | `"Duplicate priceListId within the same request"`                 |
| Referenced globalPriceList not found                                              | `"Global price list not found"`                                   |
| Variant missing name when option/value not both provided                          | `"name is required when option/value are not both provided"`      |
| Tier prices not strictly ascending                                                | `"Tier thresholds must be strictly ascending and unique"`         |
| Duplicate lot numbers in batch                                                    | `"Duplicate lot number within the same request"`                  |

### 4.7 Domain Normalization (`normalizeStockConfiguration`)

Called after entity creation and on every update:

| Condition                      | Effect                                                             |
| ------------------------------ | ------------------------------------------------------------------ |
| `useStock = false`             | `useLotsAndExpirations → false`, `quantity → 0`, `minQuantity → 0` |
| `hasVariants = true`           | `useLotsAndExpirations → false`, `quantity → 0`, `minQuantity → 0` |
| `useLotsAndExpirations = true` | `quantity → 0`                                                     |

### 4.8 Visual Section Visibility Summary Table

| Section                                  | Visible When                                           |
| ---------------------------------------- | ------------------------------------------------------ |
| "Datos del producto"                     | Always                                                 |
| "Precio de Compra"                       | Always                                                 |
| "Impuestos"                              | Always                                                 |
| IVA/IEPS selects                         | `chargeProductTaxes = true`                            |
| "Inventario"                             | `type = 'PRODUCT'`                                     |
| Manual stock fields                      | `useStock && !useLotsAndExpirations && !hasVariants`   |
| `"Usar lotes y vencimientos"` toggle     | `useStock && !hasVariants`                             |
| `"Tiene variantes"` toggle               | Always (within Inventario)                             |
| Stock-by-variant warning                 | `hasVariants = true`                                   |
| "Variantes" card                         | `!useLotsAndExpirations` (regardless of `hasVariants`) |
| "Lotes" card                             | `useStock && useLotsAndExpirations && !hasVariants`    |
| "Listas de Precios" (create mode inline) | `isCreateMode = true`                                  |
| "Precios de Venta" (edit mode component) | `isCreateMode = false`                                 |
| "Imágenes"                               | `isCreateMode = false`                                 |

---

## 5. Repeatable / Nested Structures

### 5.1 Variants

**Container**: `pendingVariants` array (create mode) / `variants` query (edit mode).

**Min count**: 0. **Max count**: Unlimited (no cap in code).

**Add behavior**: Opens `UModal` titled `"Agregar variante"`. Submit appends to `pendingVariants[]`.

**Remove behavior**: Confirmation modal → splice from array.

**Reorder behavior**: None — items display in insertion order.

#### Per-Variant Fields (Add/Edit Modal)

| UI Label                   | Key            | Input Type                  | Required         | Default | Validation                                          |
| -------------------------- | -------------- | --------------------------- | ---------------- | ------- | --------------------------------------------------- |
| `"Opción"`                 | `option`       | Select (`USelect`)          | Yes (min 1 char) | `''`    | `z.string().trim().min(1, 'Seleccioná una opción')` |
| `"Valor"`                  | `value`        | Text input                  | Yes (min 1 char) | `''`    | `z.string().trim().min(1).max(100)`                 |
| `"SKU"`                    | `sku`          | Text input                  | No               | `''`    | `z.string().trim().max(100)`                        |
| `"Código de barras"`       | `barcode`      | Text input                  | No               | `''`    | `z.string().trim().max(100)`                        |
| `"Existencias"`            | `quantity`     | Number input                | No               | `0`     | `z.number().int().min(0)`                           |
| `"Existencias mínimas"`    | `minQuantity`  | Number input                | No               | `0`     | `z.number().int().min(0)`                           |
| `"Costo de compra (neto)"` | `purchaseCost` | Currency input (`$` prefix) | No               | `''`    | Decimal regex. Empty = inherits from product        |

**Variant Option Choices** (hardcoded):

| Label        | Value      |
| ------------ | ---------- |
| `"Tamaño"`   | `Tamaño`   |
| `"Color"`    | `Color`    |
| `"Material"` | `Material` |
| `"Estilo"`   | `Estilo`   |

**Variant Name Resolution** (backend `resolveVariantName`): If both `option` and `value` are provided and non-empty, the variant's stored `name` = `value`. If only `name` (fallback) is provided, it uses that. Error if none available.

#### Variants Table Columns (create mode)

| Column                                              | Content                                            |
| --------------------------------------------------- | -------------------------------------------------- |
| `"Variante"`                                        | `"option: value"` format + SKU/barcode below       |
| `"Existencias"` (conditional: only when `useStock`) | Inline `UInputNumber`                              |
| `"Precio Público"`                                  | Inline currency input (maps to PUBLICO price list) |
| `"Acciones"`                                        | `"Más Datos"` / `"Editar"` / `"Eliminar"` buttons  |

#### Variant Detail Modal ("Más Datos")

Opened via `"Más Datos"` button. In create mode, this is the `isPendingVariantDetailModalOpen` modal. Contains:

1. **General card**: SKU, Barcode, Purchase Cost (same as add modal)
2. **Existencias card**: Quantity, Min Quantity
3. **Precios card**: Table of all pending price lists with per-variant prices, tier price button, margin/profit computed columns

### 5.2 Variant Prices (per variant, per price list)

**Shape**: `PendingVariantPrice[]` per variant — one entry per global price list.

**Auto-initialization**: When a variant is created, it gets a `variantPrices` entry for each existing `pendingPriceList` (all at `priceCents: 0`).

| Field           | Type                                            | Default                |
| --------------- | ----------------------------------------------- | ---------------------- |
| `priceListId`   | string (UUID)                                   | From global price list |
| `priceListName` | string                                          | From global price list |
| `priceCents`    | number                                          | `0`                    |
| `tierPrices`    | `{ minQuantity: number, priceCents: number }[]` | `[]`                   |

### 5.3 Price Lists (product-level)

**Container**: `pendingPriceLists` array (create mode).

**Auto-attach**: On page load in create mode, ALL global price lists are auto-attached. The user can add more via a picker or remove non-default ones.

**Min count**: 0 explicit, but all globals are auto-attached.

**Default price list**: The one with `isDefault: true` (named `"PUBLICO"`) — cannot be removed.

| Per-Item Field  | UI Label                                                     | Input Type                  | Notes                                                                                                 |
| --------------- | ------------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `priceListName` | `"Lista de Precios"` (column)                                | Read-only text              | From global price list name                                                                           |
| `priceCents`    | `"Precio de Venta"` (subtext: `"(Con Impuestos Incluidos)"`) | Currency input (`$` prefix) | Editable inline                                                                                       |
| Tier prices     | `"+"` button → opens tier modal                              | —                           | See §5.4                                                                                              |
| Margin          | `"Márgen"` (column)                                          | Computed read-only          | `((priceCents - purchaseCostCents) / purchaseCostCents) × 100` — shown as `%` with green/red coloring |
| Profit          | `"Ganancia"` (column)                                        | Computed read-only          | `$ (priceCents - purchaseCostCents) / 100` — shown as `$ X.XX por Unidad`                             |
| Remove          | `"Quitar"` (column)                                          | Button                      | Only for non-default lists                                                                            |

### 5.4 Tier Prices (per price list or per variant price)

**Container**: Array within each price list / variant price.

**Min count**: 0. **Max count**: Unlimited.

**Add**: `"+ Agregar"` / `"Agregar escala"` button.

**Remove**: Trash icon button per row. If last row removed, a new empty one is auto-added (in some modal variants).

| Per-Row Field | UI Label                                                     | Input Type                                         | Validation                                                  |
| ------------- | ------------------------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------- |
| `minQuantity` | (first row only: `"Cantidad mínima"`) / display: `"X o más"` | `UInputNumber`, min=0                              | Must be integer ≥ 0, strictly ascending, unique across rows |
| `priceCents`  | (first row only: `"Precio"`)                                 | Currency input (`$` prefix, `"por Unidad"` suffix) | Decimal regex                                               |

**Backend validation**: `validateTierPrices()` — thresholds must be integers ≥ 0, unique, strictly ascending. Non-integer or negative values rejected.

### 5.5 Lots

**Container**: `pendingLots` array (create mode) / `lots` query (edit mode).

**Min count**: 0. **Max count**: Unlimited.

**Add**: Modal titled `"Agregar lote"`.

**Remove**: Confirmation modal → delete.

**Edit**: In edit mode, clicking `"Editar"` shows a `"Próximamente"` toast — lot editing is not yet implemented.

| Per-Lot Field     | UI Label        | Input Type                    | Required | Default | Validation                                                                                                                  |
| ----------------- | --------------- | ----------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `lotNumber`       | `"Lote"`        | Text input                    | Yes      | `''`    | Zod: `z.string().trim().min(2).max(120)`. Backend: `@IsString() @MinLength(2) @MaxLength(120)`. Must be unique per product. |
| `quantity`        | `"Existencias"` | Number input (`UInputNumber`) | No       | `0`     | `z.number().int().min(0)`. Backend: `@IsNumber() @Min(0)`                                                                   |
| `manufactureDate` | `"Fabricación"` | Date input (`type="date"`)    | No       | `''`    | `z.string().trim().optional()`. Backend: `@IsDateString()` optional                                                         |
| `expirationDate`  | `"Caducidad"`   | Date input (`type="date"`)    | Yes      | `''`    | `z.string().trim().min(1, 'La fecha de vencimiento es obligatoria')`. Backend: `@IsDateString()` required                   |

### 5.6 Images (edit mode only)

**Container**: `images` query via `ProductImageGallery` component.

**Upload**: Drag-and-drop zone + file picker. Files uploaded via `POST /products/:id/images/upload` (multipart form data).

**Scope tabs**: When variants exist: `"Todas"` | `"Producto"` | per-variant name — filters images by `variantId`.

**Per-Image Actions**:

- Set as main (`"Marcar como principal"`) — unsets previous main in same scope
- Delete (`"Eliminar imagen"`) — with confirmation
- Preview (lightbox modal on click)

**Constraints**: Only one main image per product-level scope and per variant scope. Backend enforces via unique constraint.

---

## 6. Tax & Pricing Logic

### IVA Rates and Multipliers

| Value        | Percentage | Multiplier | Exempt?            |
| ------------ | ---------- | ---------- | ------------------ |
| `IVA_16`     | 16%        | 0.16       | No                 |
| `IVA_8`      | 8%         | 0.08       | No                 |
| `IVA_0`      | 0%         | 0.00       | No (taxable at 0%) |
| `IVA_EXENTO` | 0%         | 0.00       | Yes (exempt)       |

### IEPS Rates and Multipliers

| Value       | Percentage | Multiplier       |
| ----------- | ---------- | ---------------- |
| `NO_APLICA` | 0%         | 0.00             |
| `IEPS_160`  | 160%       | 1.60             |
| (others)    | (see §3.3) | percentage / 100 |

### Purchase Cost Derivation

```
totalTaxMultiplier = 1 + ivaMultiplier + iepsMultiplier

if mode = NET:
    netCents = round(inputValueCents)
    grossCents = round(netCents × totalTaxMultiplier)

if mode = GROSS:
    grossCents = round(inputValueCents)
    netCents = round(grossCents / totalTaxMultiplier)
```

Both `netCents` and `grossCents` are persisted.

### Margin Calculation (product price lists)

```
marginCents = salePriceCents − purchaseNetCostCents
marginPercent = round((marginCents / salePriceCents) × 100)   [if salePriceCents > 0]
```

For variants: `netCostCents = variant.purchaseNetCostCents ?? product.purchaseCost.netCents` (variant cost overrides product cost if set).

### Price Input Conversion

All prices are displayed as decimal strings (e.g., `"199.90"`) and stored as integer cents internally.

```
centsToDecimalInput(cents) = (max(cents, 0) / 100).toFixed(2)
decimalInputToCents(value) = round(parseFloat(value.replace(',', '.')) × 100)
```

Commas are accepted as decimal separators (normalized to dots).

---

## 7. Computed / Derived Fields

| Field                      | Location                               | Formula                                                                | Display                                                 |
| -------------------------- | -------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| Purchase cost (other mode) | Backend `PurchaseCost` value object    | See §6                                                                 | Not directly shown in form but returned in API response |
| Margin %                   | Price list table / variant price table | `round((priceCents - netCostCents) / priceCents × 100)`                | Green text if ≥ 0, red if negative                      |
| Profit amount              | Price list table / variant price table | `(priceCents - netCostCents) / 100` formatted as `"$ X.XX por Unidad"` | Same coloring                                           |
| Product status             | Product list (not in form)             | Derived from `useStock`, `quantity`, `variantStockTotal`               | `active` / `out_of_stock` / `inactive`                  |
| Variant name               | Backend `resolveVariantName`           | `option && value ? value : fallbackName`                               | Stored as `name` on variant                             |

In create mode, margin/profit in the pending price lists table use a simplified formula:

```
marginPercent = round(((priceCents - costCents) / costCents) × 100)
```

(Note: divides by cost, not price — slightly different from the backend's edit-mode formula which divides by price.)

---

## 8. External Data Sources

| Data                       | UI Component                        | Source Endpoint                 | Loaded Via                                              |
| -------------------------- | ----------------------------------- | ------------------------------- | ------------------------------------------------------- |
| Categories                 | `CategorySelect`                    | `GET /categories`               | `useQuery({ queryFn: productApi.getCategories })`       |
| Brands                     | `CategorySelect` (reused component) | `GET /brands`                   | `useQuery({ queryFn: productApi.getBrands })`           |
| Global Price Lists         | Inline table + select picker        | `GET /price-lists`              | `useQuery({ queryFn: productApi.getGlobalPriceLists })` |
| Variants (edit mode)       | Variants table                      | `GET /products/:id/variants`    | `useQuery({ queryFn: productApi.getVariants })`         |
| Lots (edit mode)           | Lots table                          | `GET /products/:id/lots`        | `useQuery({ queryFn: productApi.getLots })`             |
| Price Lists (edit mode)    | `PriceListSection`                  | `GET /products/:id/price-lists` | `useQuery({ queryFn: productApi.getPriceLists })`       |
| Images (edit mode)         | `ProductImageGallery`               | `GET /products/:id/images`      | `useQuery({ queryFn: productApi.getImages })`           |
| Product detail (edit mode) | Form pre-fill                       | `GET /products/:id`             | `useQuery({ queryFn: productApi.getById })`             |

**Inline create actions** (both open modals that POST and auto-select the created item):

- `"Crear categoría"` → `POST /categories` → assigns new `categoryId`
- `"Crear marca"` → `POST /brands` → assigns new `brandId`
- `"Nueva lista de precios"` → `POST /price-lists` (global) → added to all products

---

## 9. Submit Mapping (Form → Backend Create DTO)

The `toCreatePayload()` function in `useProductForm.ts` + `buildFullCreatePayload()` in `ProductDetailView.vue` produce:

```typescript
{
  // From toCreatePayload():
  name: string,                              // ← formState.name
  type: 'PRODUCT' | 'SERVICE',              // ← formState.type
  sku?: string,                              // ← formState.sku (omitted if empty)
  barcode?: string,                          // ← formState.barcode (omitted if empty)
  categoryId?: string,                       // ← formState.categoryId (omitted if empty)
  brandId?: string | null,                   // ← formState.brandId (null if empty)
  description?: string,                      // ← formState.description (omitted if empty)
  location?: string,                         // ← formState.location (omitted if empty)
  satKey?: string,                           // ← formState.satKey (omitted if empty)
  unit: string,                              // ← formState.unit
  useStock: boolean,                         // ← formState.useStock
  useLotsAndExpirations: boolean,            // ← useStock ? formState.useLotsAndExpirations : false
  hasVariants: boolean,                      // ← formState.hasVariants
  quantity: number,                          // ← useStock && !lots && !variants ? formState.quantity : 0
  minQuantity: number,                       // ← useStock && !variants ? formState.minQuantity : 0
  sellInPos: boolean,                        // ← formState.sellInPos
  includeInOnlineCatalog: boolean,           // ← formState.includeInOnlineCatalog
  requiresPrescription: boolean,             // ← formState.requiresPrescription
  chargeProductTaxes: boolean,               // ← formState.chargeProductTaxes
  ivaRate?: string,                          // ← only if chargeProductTaxes
  iepsRate?: string,                         // ← only if chargeProductTaxes
  purchaseCost?: { mode, valueCents },       // ← only if costCents > 0
  priceCents: number,                        // ← decimalInputToCents(formState.price)

  // From buildFullCreatePayload():
  variants?: CreateVariantInline[],          // ← from pendingVariants (if hasVariants && any)
  lots?: CreateLotInline[],                  // ← from pendingLots (if lots section active && any)
  priceLists?: CreatePriceListInline[],      // ← from pendingPriceLists (only non-zero overrides)
}
```

**Backend processing order** (inside transaction):

1. Create product row
2. Create default price lists for ALL global price lists (PUBLICO gets `priceCents` from payload, others get `0`)
3. Create inline variants + their variant prices (all at `0`)
4. Create inline lots
5. Apply inline price list overrides (update `priceCents` + create tier prices)
6. Create inline images (not used in create mode currently)

**Post-transaction**: Variant prices configured in the UI are applied via separate `PUT` calls after the main creation.

---

## 10. Open Questions / Ambiguities

1. **SAT Key field in full editor**: The `satKey` field exists in the form state, schema, and payload, but there is no visible `UFormField` for it in the `ProductDetailView.vue` template's Section 1 ("Datos del producto"). It IS present in the slideover. It is unclear whether this was intentionally removed from the full editor or accidentally omitted. **The field IS submitted** regardless — just no UI to set it in the full editor.

2. **Margin formula inconsistency**: In create mode, the pending price list margin is calculated as `(price - cost) / cost × 100` (margin over cost). In edit mode (`PriceListSection` and backend `enrichPriceListResponse`), it is `(price - cost) / price × 100` (margin over price). These give different percentages for the same numbers. This may confuse designers trying to replicate the exact behavior.

3. **Price field in full editor create mode**: The form state has a `price` field (mapped to `priceCents` in payload), but in the full editor there's no dedicated "Precio de venta" input field outside the price lists table. The PUBLICO price list row in the pending price lists table serves this purpose. However, the `priceCents` in the payload defaults to `decimalInputToCents(formState.price)` which starts at `'0.00'`. The PUBLICO price list row edits `pendingPriceLists[].priceCents`, which is sent separately as a price list override. Both mechanisms coexist — the `priceCents` on the product is the PUBLICO default, and the override can change it.

4. **Lot editing**: The edit button for existing lots shows `"Próximamente"` toast. Lot editing is explicitly not implemented yet.

5. **Variant option choices**: The option choices (`"Tamaño"`, `"Color"`, `"Material"`, `"Estilo"`) are hardcoded in the frontend. The backend does not validate against this list — it accepts any string for `option`. A designer should know these are frontend-only constraints that could be expanded.

6. **Image upload in create mode**: The `ProductImageGallery` component is only rendered when `!isCreateMode`. There is no way to upload images during product creation — only after the product exists. The `CreateImageInlineDto` exists in the backend but is not used by the frontend create flow.

7. **Max image count**: No explicit limit on number of images per product or variant in either frontend or backend code. The POS catalog query limits to 5 images per product in its include clause, but this is a display limit, not a creation limit.

---

## Summary Statistics

| Metric                          | Count                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Segments (card sections)**    | 8 (Datos del producto, Precio de Compra, Impuestos, Inventario, Variantes, Lotes, Listas de Precios, Imágenes)      |
| **Total unique fields**         | 25 top-level fields + 7 per-variant + 4 per-lot + 2 per-price-list + 2 per-tier-price = **40 distinct field types** |
| **Dependency rules documented** | 23 explicit conditional relationships                                                                               |
| **Repeatable structures**       | 5 (Variants, Variant Prices, Price Lists, Tier Prices, Lots)                                                        |
| **External data sources**       | 8 API endpoints                                                                                                     |
| **Open questions**              | 7                                                                                                                   |
