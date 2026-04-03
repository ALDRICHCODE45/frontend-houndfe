# Backend Request: Agregar stock summary de variantes al listado de productos

## Contexto

El sistema legacy muestra en la grilla de productos: **"45 unidades en 1 variante"** cuando un producto tiene variantes. Actualmente `GET /products` devuelve `quantity: 0` para productos con variantes (correcto — el backend normaliza), pero el frontend no tiene forma de mostrar el stock real sin hacer N+1 queries.

## Cambio solicitado

Agregar al response de `GET /products` (shape de lista) dos campos calculados cuando `hasVariants = true`:

```json
{
  "id": "uuid",
  "name": "Alimento para perro",
  "quantity": 0,
  "hasVariants": true,
  "variantStockTotal": 45,
  "variantCount": 1,
  ...
}
```

### Campos nuevos

| Campo               | Tipo     | Descripción                                                                                        |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `variantStockTotal` | `number` | Suma de `quantity` de todas las variantes del producto. Solo presente cuando `hasVariants = true`. |
| `variantCount`      | `number` | Cantidad de variantes del producto. Solo presente cuando `hasVariants = true`.                     |

### Reglas

- Cuando `hasVariants = false`: no incluir los campos (o enviar `null`/`0`).
- Cuando `hasVariants = true`: calcular `SUM(variants.quantity)` y `COUNT(variants)`.
- Estos campos son de **solo lectura** — no afectan DTOs de create/update.

### Implementación sugerida

En el query de `GET /products`, agregar un subquery o un include con aggregate:

```typescript
// Prisma approach (select con _count y _sum)
const products = await prisma.product.findMany({
  include: {
    _count: { select: { variants: true } },
    variants: {
      select: { quantity: true },
    },
  },
});

// En toResponse():
variantStockTotal: product.hasVariants
  ? product.variants.reduce((sum, v) => sum + v.quantity, 0)
  : undefined,
variantCount: product.hasVariants
  ? product._count.variants
  : undefined,
```

Alternativa más eficiente si hay muchos productos:

```sql
SELECT p.*,
  COALESCE(SUM(v.quantity), 0) as "variantStockTotal",
  COUNT(v.id) as "variantCount"
FROM products p
LEFT JOIN variants v ON v."productId" = p.id
GROUP BY p.id
```

### Esfuerzo estimado

~1-2h — es un campo calculado en el response, sin migración.

## Frontend: qué hará con esto

En la grilla de productos, la celda de Stock mostrará:

- Sin variantes: `"33 unidades"` (como ahora)
- Con variantes: `"45 unidades en 1 variante"` o `"120 unidades en 3 variantes"`
