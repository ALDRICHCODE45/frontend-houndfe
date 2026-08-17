# Products Specification

Domain: `products` — type-aware product create/edit: SERVICE field-visibility matrix, type-filtered units (8/6), dynamic `location` label, `serviceDetail`, type-aware payloads, SERVICE variants, transition warnings, slideover SERVICE-hiding.

## Purpose

Make SERVICE a first-class type per the backend handoff: both form surfaces share one matrix and payload rules, hiding what the backend rejects and omitting what it forces.

## Requirements

### REQ-1: Field-visibility matrix

For SERVICE the form SHALL hide sku, barcode, brandId, purchaseCost, useStock, useLotsAndExpirations, quantity, minQuantity, lots, and the inventory card; for PRODUCT it SHALL hide serviceDetail, and hide useLotsAndExpirations when useStock is false.

#### Scenario: fields follow type

- GIVEN type = SERVICE
- THEN sku, barcode, brandId, purchaseCost, stock/lots/quantity fields, and inventory card are hidden
- AND serviceDetail renders
- GIVEN type = PRODUCT
- THEN serviceDetail is hidden
- AND inventory fields render per useStock

### REQ-2: Unit options by type

The unit selector SHALL offer exactly 8 PRODUCT values or exactly 6 SERVICE values via `unitOptionsFor(type)`.

#### Scenario: options follow type

- GIVEN type = SERVICE
- THEN only HORA, SESION, DIA, CONSULTA, CURSO, PAQUETE are selectable
- GIVEN type = PRODUCT
- THEN only UNIDAD, CAJA, BOLSA, METRO, CENTIMETRO, KILOGRAMO, GRAMO, LITRO are selectable

### REQ-3: Location label by type

`location` SHALL label "Zona de servicio" for SERVICE and "Ubicación en almacén" for PRODUCT via `locationLabelFor(type)`.

#### Scenario: label follows type

- GIVEN type = SERVICE
- THEN the label is "Zona de servicio"
- GIVEN type = PRODUCT
- THEN the label is "Ubicación en almacén"

### REQ-4: serviceDetail editing

For SERVICE, the serviceDetail card SHALL expose capacity (integer >= 1; empty = null) and notes (max 500 chars); capacity is informational. Invalid capacity or notes over 500 chars SHALL block submit.

#### Scenario: serviceDetail validates

- GIVEN capacity 3 and notes of 120 chars
- WHEN the user saves
- THEN the payload includes serviceDetail { capacity: 3, notes }
- GIVEN capacity 0 or notes over 500 chars
- WHEN the user submits
- THEN submit blocks with a capacity or notes error

### REQ-5: Type-aware payloads

For SERVICE, create/update payloads SHALL omit sku, barcode, brandId, and lots; force stock/lots false, quantity 0, minQuantity 0, purchaseCost zeroed; and include serviceDetail only when populated.

#### Scenario: SERVICE omits forbidden fields

- GIVEN a SERVICE form with sku, barcode, brandId, and lots set
- WHEN toCreatePayload runs
- THEN it omits them and forces stock/lots false, quantity 0, minQuantity 0, purchaseCost zeroed

#### Scenario: serviceDetail only when populated

- GIVEN empty capacity and notes
- THEN the payload omits serviceDetail
- GIVEN capacity 5
- THEN the payload includes serviceDetail.capacity = 5

### REQ-6: SERVICE variants

The type watcher SHALL NOT force hasVariants=false or clear SERVICE variants; all three variant forms SHALL hide sku, barcode, quantity, minQuantity for SERVICE and omit them from payloads.

#### Scenario: SERVICE keeps variants

- GIVEN a SERVICE product
- WHEN the user enables hasVariants and adds variants
- THEN hasVariants stays true and variants are not cleared

#### Scenario: variant form and payload

- GIVEN a SERVICE variant form with sku and quantity entered
- THEN sku, barcode, quantity, and minQuantity are hidden
- AND the built variant payload omits them

### REQ-7: Type-change transitions

In edit mode, PRODUCT→SERVICE with stock or lots SHALL confirm inventory loss; SERVICE→PRODUCT SHALL toast that stock and costs must be re-added. Backend 400 `PRODUCT_TYPE_CHANGE_BLOCKED` SHALL surface via the error mapper.

#### Scenario: SERVICE→PRODUCT warns

- GIVEN editing a SERVICE
- WHEN the user switches to PRODUCT
- THEN a toast warns to re-add stock and costs after saving

#### Scenario: PRODUCT→SERVICE warns and blocks

- GIVEN editing a PRODUCT with stock or lots
- WHEN the user switches to SERVICE and saves
- THEN a confirmation warns inventory will be lost
- AND a 400 PRODUCT_TYPE_CHANGE_BLOCKED surfaces via the error mapper

### REQ-8: Slideover SERVICE-hiding (D1)

The slideover SHALL NOT add type or unit selectors. Editing an existing SERVICE SHALL hide sku, barcode, stock, min-stock, and purchase-cost inputs; create stays PRODUCT-only. Slideover payloads SHALL follow REQ-5.

#### Scenario: editing SERVICE hides fields

- GIVEN the slideover editing a SERVICE
- THEN sku, barcode, stock, and min-stock inputs are hidden

#### Scenario: payload omits forbidden fields

- GIVEN the slideover editing a SERVICE
- WHEN the user saves
- THEN the payload omits sku, barcode, and stock fields
