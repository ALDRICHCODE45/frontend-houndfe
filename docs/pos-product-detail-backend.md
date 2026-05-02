# POS Product Detail — Backend Requirement

## Context

The POS frontend needs a "Ver Detalles" action in the cart item dropdown that shows full product information in a modal. The `SaleItem` object only contains sale-specific fields (name, price, quantity, discount) but NOT product metadata like category, brand, stock, images, description, location, or variant details.

## Required Endpoint

```
GET /sales/pos-catalog/:productId
```

**Permission**: `sale:read` (or `product:read` — align with existing POS permissions)

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `productId` | UUID | The product ID from `SaleItem.productId` |

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `variantId` | UUID | No | If provided, include variant-specific stock/price. If omitted, return product-level data. |

### Response (200)

```json
{
  "id": "prod-uuid",
  "name": "Alimento para perro",
  "description": "Alimento premium para perros adultos de razas grandes",
  "sku": "ALI-001",
  "barcode": "7501234567890",
  "unit": "UNIDAD",
  "category": {
    "id": "cat-uuid",
    "name": "Alimento"
  },
  "brand": {
    "id": "brand-uuid",
    "name": "PERRO FELIZ"
  },
  "mainImage": "https://cdn.example.com/product-main.jpg",
  "images": [
    "https://cdn.example.com/product-main.jpg",
    "https://cdn.example.com/product-side.jpg"
  ],
  "enabledForPos": true,
  "price": {
    "priceCents": 40000,
    "priceDecimal": 400.00,
    "priceListName": "PUBLICO"
  },
  "stock": {
    "quantity": 15,
    "minQuantity": 5,
    "location": "Estante B"
  },
  "variants": [
    {
      "id": "var-uuid-1",
      "name": "GRANDE",
      "sku": "ALI-001-G",
      "barcode": "7501234567891",
      "mainImage": "https://cdn.example.com/variant-grande.jpg",
      "price": {
        "priceCents": 40000,
        "priceDecimal": 400.00,
        "priceListName": "PUBLICO"
      },
      "stock": {
        "quantity": 15,
        "minQuantity": 5,
        "location": "Estante B"
      }
    },
    {
      "id": "var-uuid-2",
      "name": "MEDIANO",
      "sku": "ALI-001-M",
      "barcode": null,
      "mainImage": null,
      "price": {
        "priceCents": 30000,
        "priceDecimal": 300.00,
        "priceListName": "PUBLICO"
      },
      "stock": {
        "quantity": 8,
        "minQuantity": 3,
        "location": "Estante A"
      }
    }
  ]
}
```

### New Fields vs Existing `PosCatalogItem`

This response extends the existing `PosCatalogItem` type with:

| New Field | Type | Description |
|-----------|------|-------------|
| `description` | `string \| null` | Product description text |
| `stock.location` | `string \| null` | Physical location/shelf in the store |

All other fields already exist in `PosCatalogItem`. The key difference is that `stock.location` is new — it's used by the cajero to know WHERE to find the product physically.

### Errors

| HTTP | Code | When |
|------|------|------|
| 404 | `PRODUCT_NOT_FOUND` | Product doesn't exist |
| 403 | `FORBIDDEN` | User doesn't have required permission |

## Why Not Reuse Existing Endpoints?

- `GET /products/:id` — Returns the full admin product detail with fields the POS doesn't need (SEO, tax rules, supplier info). Also requires `product:read` permission which POS users may not have.
- `GET /sales/pos-catalog?q=...` — Returns a list, not a single product. Also doesn't include `description` or `stock.location`.

A dedicated POS-scoped detail endpoint keeps the response lean and permission-aligned.

## Frontend Usage

```typescript
// When user clicks "Ver Detalles" in cart item dropdown:
const detail = await saleApi.getProductDetail(item.productId, item.variantId)
// Open modal with full product info
```

## Priority

**Medium** — The POS works without it; it's a quality-of-life feature for cajeros who need to check stock location, see the product description, or verify details before selling.
