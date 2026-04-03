# Backend Request: Agregar `minQuantity` y `purchaseNetCostCents` al modelo Variant

> **Revisión 2** — Incorpora feedback del backend dev. Cambios vs v1: renaming `costCents` → `purchaseNetCostCents`, normalización obligatoria de `minQuantity`, cascade cuando `useStock` cambia.

## Contexto

El sistema legacy permite gestionar **por cada variante** individual:

- **Cantidad mínima** (`minQuantity`) — umbral de alerta de stock bajo
- **Costo de compra neto** (`purchaseNetCostCents`) — costo unitario neto específico de la variante, independiente del producto padre

Actualmente el backend solo maneja estos campos a nivel producto. Para replicar la UX del legacy, el frontend necesita estos campos por variante.

**No hay datos en producción** — el sistema no está en uso real, así que no se necesita migración de datos existentes.

---

## Cambio 1: `minQuantity` por Variante

### Prisma Schema

```prisma
model Variant {
  // ... campos existentes ...
  quantity    Int     @default(0)
  minQuantity Int     @default(0)    // <-- NUEVO
  // ...
}
```

### DTOs

**`CreateVariantDto`** — agregar:

```typescript
@IsOptional()
@IsNumber()
@Min(0)
minQuantity?: number;
```

**`UpdateVariantDto`** — ya hereda de `PartialType(CreateVariantDto)`, no necesita cambio manual.

### Service

- Persistir `minQuantity` en create y update.
- Incluir `minQuantity` en todas las respuestas que devuelven variantes.
- **Normalización OBLIGATORIA**: cuando `useStock = false` a nivel producto, normalizar `minQuantity = 0` en todas las variantes. Agregar a `normalizeStockConfiguration()`.

### Cascade: `useStock` cambia a `false`

Cuando `PATCH /products/:id` cambia `useStock` de `true` a `false`, ejecutar normalización cascada:

```typescript
// En normalizeStockConfiguration o en el update del producto:
if (!useStock) {
  // Normalizar variantes: minQuantity = 0
  await prisma.variant.updateMany({
    where: { productId },
    data: { minQuantity: 0 },
  })
}
```

### Response shape

```json
{
  "id": "uuid",
  "name": "Mediano",
  "option": "Tamaño",
  "value": "Mediano",
  "sku": null,
  "barcode": null,
  "quantity": 30,
  "minQuantity": 5,
  "variantPrices": [...]
}
```

---

## Cambio 2: `purchaseNetCostCents` por Variante (Costo de Compra Neto)

### Motivación

En el legacy, cada variante puede tener un costo de compra diferente. Ejemplo:

- Producto "Alimento para perro"
- Variante "Mediano" → costo neto $45
- Variante "Grande" → costo neto $55

Esto afecta directamente el **cálculo de margen** por variante.

### Naming

Se usa `purchaseNetCostCents` (no `costCents`) para ser **consistente con el producto padre** que tiene `purchaseNetCostCents` y `purchaseGrossCostCents`. Este campo es siempre el costo **neto** (antes de impuestos). Las variantes NO necesitan el VO `PurchaseCost` completo con modo NET/GROSS — es un override simple del costo neto.

### Prisma Schema

```prisma
model Variant {
  // ... campos existentes ...
  quantity              Int     @default(0)
  minQuantity           Int     @default(0)
  purchaseNetCostCents  Int?                   // <-- NUEVO (nullable = hereda costo del producto)
  // ...
}
```

**`null`** = la variante hereda el `purchaseNetCostCents` del producto padre (comportamiento actual, backwards compatible).
**valor numérico** = la variante tiene su propio costo neto.

### DTOs

**`CreateVariantDto`** — agregar:

```typescript
@IsOptional()
@IsNumber()
@Min(0)
purchaseNetCostCents?: number;
```

**`UpdateVariantDto`** — hereda automáticamente.

### Service

- Persistir `purchaseNetCostCents` en create y update.
- Incluir `purchaseNetCostCents` y `purchaseNetCostDecimal` (calculado: `purchaseNetCostCents / 100`) en respuestas.

### Cambio en fórmula de margen (IMPORTANTE)

En la función de enrichment de variant prices, actualizar la resolución del costo base:

```typescript
// ANTES:
const netCostCents = product.purchaseCost.netCents

// DESPUÉS (para variant prices):
const netCostCents = variant.purchaseNetCostCents ?? product.purchaseCost.netCents
```

**Regla**: Si la variante tiene `purchaseNetCostCents` definido (no null), usarlo. Si es null, fallback al costo del producto.

Esto aplica a:

- `enrichVariantPriceResponse(...)` — al calcular `margin` para cada `VariantPrice`
- `enrichVariantTierPriceResponse(...)` — al calcular `margin` para cada `VariantTierPrice`

**NO** afecta el cálculo de margen de `PriceList` a nivel producto — ese sigue usando `product.purchaseCost.netCents`.

### Response shape

```json
{
  "id": "uuid",
  "name": "Mediano",
  "option": "Tamaño",
  "value": "Mediano",
  "sku": null,
  "barcode": null,
  "quantity": 30,
  "minQuantity": 5,
  "purchaseNetCostCents": 4500,
  "purchaseNetCostDecimal": 45.0,
  "variantPrices": [
    {
      "priceListName": "PUBLICO",
      "priceCents": 9900,
      "priceDecimal": 99.0,
      "margin": {
        "amountCents": 5400,
        "amountDecimal": 54.0,
        "percent": 55
      }
    }
  ]
}
```

---

## Resumen de cambios

| Cambio                 | Modelo        | DTO           | Service                                                    | Margen                   | Esfuerzo |
| ---------------------- | ------------- | ------------- | ---------------------------------------------------------- | ------------------------ | -------- |
| `minQuantity`          | +1 campo Int  | +1 validación | persistir + response + normalización obligatoria + cascade | No afecta                | ~1.5h    |
| `purchaseNetCostCents` | +1 campo Int? | +1 validación | persistir + response + cambiar fórmula margen              | SÍ afecta variant prices | ~2.5h    |

**Total estimado**: ~4h incluyendo tests y docs.

### Migración Prisma

```bash
npx prisma migrate dev --name add-variant-minquantity-and-purchase-cost
```

### Documentación a actualizar

- `docs/technical.md`:
  - Sección 1 (Variant model): agregar `minQuantity` y `purchaseNetCostCents`
  - Sección 3 (DTOs): agregar campos a CreateVariantDto
  - Sección 7.2 (Fórmulas de pricing): documentar fallback `variant.purchaseNetCostCents ?? product.purchaseCost.netCents`
  - Sección 8 (Invariantes de inventario): documentar cascade `useStock → variant.minQuantity`

- `docs/frontend-quickstart.md`:
  - Payload de ejemplo de crear variante: incluir `minQuantity` y `purchaseNetCostCents`

---

## Test cases sugeridos

### minQuantity

1. Crear variante con `minQuantity: 5` → response incluye `minQuantity: 5`
2. Crear variante sin `minQuantity` → response incluye `minQuantity: 0`
3. Update variante con `minQuantity: 10` → response refleja cambio
4. Crear variante con `minQuantity: -1` → 400 validation error
5. Cambiar `useStock` del producto a `false` → TODAS las variantes tienen `minQuantity: 0`

### purchaseNetCostCents

1. Crear variante sin `purchaseNetCostCents` → response incluye `purchaseNetCostCents: null`, margen usa costo producto
2. Crear variante con `purchaseNetCostCents: 4500` → response incluye `purchaseNetCostCents: 4500, purchaseNetCostDecimal: 45.00`
3. Margen de variant price con `purchaseNetCostCents: 4500` y `priceCents: 9900` → `margin.amountCents: 5400`
4. Margen de variant price con `purchaseNetCostCents: null` y producto `purchaseNetCostCents: 3000` → `margin.amountCents: 6900`
5. Update variante con `purchaseNetCostCents: 0` → respuesta refleja costo 0 (cero es válido, distinto de null)
6. Update variante con `purchaseNetCostCents: null` → vuelve a heredar costo del producto
