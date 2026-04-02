# Request: Endpoints CRUD para precios por variante (VariantPrice)

## Contexto

El sistema legacy permite asignar **precios independientes por variante y por lista de precios**. Actualmente el modelo `VariantPrice` existe en la base de datos (relación entre `Variant` y `PriceList`), pero **no hay endpoints dedicados** para CRUD desde frontend.

El frontend necesita:

- Asignar un precio específico a una variante para cada lista de precios existente del producto
- Mostrar margen y ganancia por variante (calculado contra el costo del producto)
- Gestionar precios por volumen (tier prices) a nivel de variante

## Modelo de datos existente

```prisma
model VariantPrice {
  id          String    @id @default(uuid())
  variantId   String
  priceListId String
  priceCents  Int       @default(0)

  variant     Variant   @relation(fields: [variantId], references: [id], onDelete: Cascade)
  priceList   PriceList @relation(fields: [priceListId], references: [id], onDelete: Cascade)

  @@unique([variantId, priceListId])
}
```

**Nota:** Si se necesitan tier prices por variante, agregar modelo `VariantTierPrice`:

```prisma
model VariantTierPrice {
  id             String       @id @default(uuid())
  variantPriceId String
  minQuantity    Int
  priceCents     Int

  variantPrice   VariantPrice @relation(fields: [variantPriceId], references: [id], onDelete: Cascade)

  @@unique([variantPriceId, minQuantity])
}
```

## Endpoints solicitados

Base: `/products/:productId/variants/:variantId/prices`

### 1. Listar precios de una variante

```
GET /products/:productId/variants/:variantId/prices
```

**Response 200:**

```json
[
  {
    "id": "uuid",
    "variantId": "uuid",
    "priceListId": "uuid",
    "priceListName": "PUBLICO",
    "priceCents": 19900,
    "priceDecimal": 199.0,
    "margin": {
      "amountCents": 7900,
      "amountDecimal": 79.0,
      "percent": 40
    },
    "tierPrices": [
      {
        "id": "uuid",
        "minQuantity": 10,
        "priceCents": 17900,
        "priceDecimal": 179.0,
        "margin": {
          "amountCents": 5900,
          "amountDecimal": 59.0,
          "percent": 33
        }
      }
    ]
  }
]
```

**Notas:**

- El `margin` se calcula contra `product.purchaseCost.netCents` (misma fórmula que `enrichPriceListResponse`)
- Incluir `priceListName` para que frontend no necesite un join adicional
- Ordenar por `priceListName` o por orden de creación de la PriceList

### 2. Crear/actualizar precio de variante para una lista

```
PUT /products/:productId/variants/:variantId/prices/:priceListId
```

**Usar PUT (upsert)** porque la relación `variantId + priceListId` es unique. Si ya existe, actualiza; si no, crea.

**Body (`UpsertVariantPriceDto`):**

```json
{
  "priceCents": 19900,
  "tierPrices": [
    { "minQuantity": 0, "priceCents": 19900 },
    { "minQuantity": 10, "priceCents": 17900 }
  ]
}
```

**Validaciones:**

- `priceCents`: `number`, `>= 0` (requerido)
- `tierPrices`: opcional, mismo formato y validaciones que `TierPriceDto` de PriceList:
  - `minQuantity`: `IsInt`, `>= 0`
  - `priceCents`: `number`, `>= 0`
  - Cantidades únicas y estrictamente ascendentes
- Si `tierPrices` viene, **reemplaza todos** los tier prices existentes (misma semántica que `UpdatePriceListDto`)

**Response 200:**

```json
{
  "id": "uuid",
  "variantId": "uuid",
  "priceListId": "uuid",
  "priceListName": "PUBLICO",
  "priceCents": 19900,
  "priceDecimal": 199.00,
  "margin": { ... },
  "tierPrices": [ ... ]
}
```

### 3. Eliminar precio de variante para una lista

```
DELETE /products/:productId/variants/:variantId/prices/:priceListId
```

**Response:** `204 No Content`

**Validaciones:**

- No permitir eliminar el precio de la lista `PUBLICO` (misma protección que a nivel producto): `DEFAULT_PRICE_LIST_PROTECTED`
- Verificar que la variante pertenece al producto: `VARIANT_PRODUCT_MISMATCH`

### 4. Bulk update: asignar precios a todas las listas de una variante

```
PUT /products/:productId/variants/:variantId/prices
```

**Body:**

```json
{
  "prices": [
    {
      "priceListId": "uuid-publico",
      "priceCents": 19900,
      "tierPrices": [...]
    },
    {
      "priceListId": "uuid-mayoreo",
      "priceCents": 15900,
      "tierPrices": [...]
    }
  ]
}
```

**Semántica:** Upsert de cada entrada. Las listas no incluidas NO se eliminan (es un merge, no un replace).

**Response 200:** Array de variant prices actualizados (mismo shape que GET).

## Validaciones de dominio

| Error                          | Código | Cuándo                                                |
| ------------------------------ | ------ | ----------------------------------------------------- |
| `VARIANT_PRODUCT_MISMATCH`     | 422    | `variantId` no pertenece al `productId`               |
| `ENTITY_NOT_FOUND`             | 404    | Producto, variante, o lista de precios inexistente    |
| `DEFAULT_PRICE_LIST_PROTECTED` | 422    | Intento de eliminar precio de lista PUBLICO           |
| `INVALID_TIER_SEQUENCE`        | 422    | Tier prices con cantidades repetidas o no ascendentes |
| `INVALID_ARGUMENT`             | 400    | `priceCents` negativo o inválido                      |

## Enriquecimiento del GET variants existente

Además de los endpoints nuevos, el `GET /products/:id/variants` actual debería incluir `variantPrices` en cada variante:

```json
{
  "id": "uuid",
  "name": "Mediano",
  "option": "Tamaño",
  "value": "Mediano",
  "sku": null,
  "barcode": null,
  "quantity": 0,
  "variantPrices": [
    {
      "priceListId": "uuid",
      "priceListName": "PUBLICO",
      "priceCents": 19900,
      "priceDecimal": 199.00,
      "margin": { ... },
      "tierPrices": [ ... ]
    }
  ]
}
```

Esto permite al frontend mostrar la tabla de variantes con todos sus precios sin llamadas adicionales.

## Impacto en endpoints existentes

| Endpoint                                   | Cambio                                                         |
| ------------------------------------------ | -------------------------------------------------------------- |
| `GET /products/:id/variants`               | Agregar `variantPrices[]` enriquecido con margin + tierPrices  |
| `POST /products/:id/variants`              | Sin cambio (al crear variante, los precios se asignan después) |
| `DELETE /products/:id/variants/:variantId` | Sin cambio (cascade elimina variant prices)                    |

## Fórmula de margen (referencia)

Misma fórmula que `enrichPriceListResponse`:

```
netCostCents = product.purchaseCost.netCents
margin.amountCents = salePriceCents - netCostCents
margin.amountDecimal = margin.amountCents / 100
margin.percent = salePriceCents > 0 ? Math.round((margin.amountCents / salePriceCents) * 100) : 0
```

Aplicar a cada `variantPrice.priceCents` y a cada `tierPrice.priceCents`.
