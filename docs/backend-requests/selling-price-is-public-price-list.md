# Backend Request: Eliminar `priceCents` del producto — el precio de venta ES la lista PUBLICO

## Contexto — Cómo funciona el legacy

En el sistema legacy, **no existe un campo "precio de venta" suelto en el modelo de producto**. Lo que aparece como "Precio de venta" en el formulario rápido (nuestro slideover) es en realidad un **shortcut directo a la lista de precios PUBLICO**.

### Flujo del legacy

1. Usuario abre el formulario rápido de creación de producto
2. Ingresa "300" en el campo "Precio de venta"
3. Al guardar, ese valor se escribe en la lista de precios **PUBLICO** del producto (no en un campo del producto)
4. Al abrir el editor completo → sección "Precios de Venta" → lista PUBLICO muestra $300

**PUBLICO es el precio por defecto.** Todos los productos lo tienen. No se puede eliminar. Es EL precio del producto.

### Lo que tenemos hoy (incorrecto)

Actualmente el modelo `Product` del backend tiene un campo `priceCents` como propiedad directa del producto:

```
Product
  - priceCents: Int  ← ESTE CAMPO NO DEBERÍA EXISTIR
```

Y el frontend envía `priceCents` en el payload de creación/actualización del producto:

```json
POST /products
{
  "name": "Jabón",
  "priceCents": 30000,
  ...
}
```

Esto es conceptualmente incorrecto. El precio de venta del producto debería vivir SIEMPRE en la lista de precios PUBLICO, no como campo suelto.

---

## Lo que el frontend necesita

### 1. Eliminar `priceCents` del modelo Product

El campo `priceCents` ya no debe existir como propiedad directa del producto. El precio de venta de un producto es **siempre** el precio de su lista PUBLICO.

#### Opción A (recomendada): campo virtual/calculado

Mantener `priceCents` en las respuestas del producto como un **campo calculado** que lee de la lista PUBLICO, sin que exista como columna en la tabla:

```json
GET /products/:id
{
  "id": "uuid",
  "name": "Jabón",
  "priceCents": 30000,       // ← calculado desde lista PUBLICO
  "priceDecimal": 300.00,    // ← calculado (bonus, ya lo tienen en price lists)
  ...
}
```

**Ventaja**: no rompe el contrato actual del listado. El frontend sigue mostrando precio en la tabla sin cambios.

#### Opción B: eliminar completamente de la respuesta

No devolver `priceCents` en el producto y que el frontend lo lea de `GET /products/:id/price-lists` filtrando por PUBLICO.

**Desventaja**: requiere un request adicional para el listado paginado, o un include/embed.

**Recomendación del frontend**: Opción A — campo calculado en la respuesta. Menos fricción, backwards compatible.

---

### 2. Cambiar el flujo de creación de producto

Cuando el frontend crea un producto con `POST /products`, hoy envía `priceCents` en el body. El nuevo comportamiento debe ser:

#### Opción A (recomendada): el backend sigue aceptando `priceCents` en el payload de creación, pero internamente lo escribe en la lista PUBLICO

```json
POST /products
{
  "name": "Jabón",
  "priceCents": 30000,    // ← el backend lo interpreta como precio de lista PUBLICO
  ...
}
```

Internamente:

1. Crea el producto (sin columna `priceCents` propia)
2. Auto-crea la lista PUBLICO con `priceCents: 30000`
3. Auto-crea las demás listas globales con `priceCents: 0`

**Ventaja**: el contrato del endpoint no cambia. El frontend sigue enviando lo mismo.

#### Opción B: el frontend envía el precio como parte de un sub-objeto o en un paso separado

```json
POST /products
{
  "name": "Jabón",
  "publicPriceCents": 30000,   // ← nombre explícito
  ...
}
```

O hacer `POST /products` sin precio + `PATCH /products/:id/price-lists/:publicoId` después.

**Desventaja**: más complejo, el frontend necesita 2 requests o un nuevo campo.

**Recomendación del frontend**: Opción A — aceptar `priceCents` en el payload y que el backend lo redirija internamente a la lista PUBLICO. Cero cambios en el contrato del frontend.

---

### 3. Cambiar el flujo de actualización de producto

Mismo concepto que la creación. Si el frontend envía `priceCents` en `PATCH /products/:id`, el backend debe actualizar el precio de la lista PUBLICO del producto.

```json
PATCH /products/:id
{
  "priceCents": 35000    // ← actualiza la lista PUBLICO
}
```

Internamente:

1. Buscar la lista PUBLICO del producto
2. Actualizar su `priceCents` a `35000`
3. NO actualizar ninguna columna `priceCents` del producto (ya no existe)

**Alternativa**: el frontend deja de enviar `priceCents` en el PATCH del producto y en su lugar usa `PATCH /products/:id/price-lists/:publicoId` directamente para cambiar el precio de PUBLICO. Esto es lo más correcto semánticamente pero requiere cambio en el frontend.

**Recomendación**: aceptar ambos caminos — si llega `priceCents` en el PATCH del producto, redirigir a la lista PUBLICO internamente. A futuro el frontend puede migrar a usar directamente el endpoint de price lists.

---

### 4. Respuesta del listado paginado

`GET /products` devuelve una lista de productos. Hoy cada producto tiene `priceCents`. Este campo debe seguir apareciendo pero ahora es un **campo calculado** desde la lista PUBLICO:

```json
GET /products?page=1&limit=10
{
  "data": [
    {
      "id": "uuid",
      "name": "Jabón",
      "priceCents": 30000,       // ← leído de la lista PUBLICO de este producto
      "priceDecimal": 300.00,    // ← bonus: el decimal ya calculado
      ...
    }
  ],
  "meta": { ... }
}
```

**Implementación sugerida**: JOIN o subquery a la tabla de price lists filtrando por lista PUBLICO (o la lista con `isDefault: true`).

---

## Invariantes

1. Todo producto **siempre** tiene una lista PUBLICO con un precio (mínimo `0`)
2. `priceCents` en la respuesta del producto es un campo **calculado** desde la lista PUBLICO — no una columna
3. Si el frontend envía `priceCents` en `POST /products` o `PATCH /products/:id`, el backend lo redirige a la lista PUBLICO
4. La lista PUBLICO no se puede eliminar (esto ya funciona)
5. Al crear un producto → se auto-crean registros de precio para TODAS las listas globales (ya documentado en `global-price-lists.md`)

---

## Resumen de cambios para el backend dev

### Cambio en el modelo

| Antes                                       | Después                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `Product.priceCents` es columna en la tabla | `Product.priceCents` es campo calculado/virtual, leído de la lista PUBLICO |

### Cambio en la lógica

| Operación                              | Antes                          | Después                              |
| -------------------------------------- | ------------------------------ | ------------------------------------ |
| `POST /products` con `priceCents`      | Guarda en columna del producto | Crea lista PUBLICO con ese valor     |
| `PATCH /products/:id` con `priceCents` | Actualiza columna del producto | Actualiza precio de lista PUBLICO    |
| `GET /products`                        | Lee `priceCents` de la tabla   | Lee de lista PUBLICO (join/subquery) |
| `GET /products/:id`                    | Lee `priceCents` de la tabla   | Lee de lista PUBLICO (join/subquery) |

### Lo que NO cambia

- Endpoints de price lists (`GET/PATCH /products/:id/price-lists/...`) — siguen igual
- Endpoints globales (`GET/POST/DELETE /price-lists`) — siguen igual
- Variant prices y sus endpoints — siguen igual
- Fórmulas de margen — siguen igual
- "PUBLICO" no se puede eliminar — sigue igual
- Contratos de request/response del frontend — sin cambios visibles

### Migración

```sql
-- 1. Para cada producto, copiar el priceCents actual al precio de la lista PUBLICO
UPDATE price_lists pl
SET price_cents = p.price_cents
FROM products p
WHERE pl.product_id = p.id
  AND pl.name = 'PUBLICO';

-- 2. Eliminar la columna priceCents del producto
ALTER TABLE products DROP COLUMN price_cents;
```

> **Nota**: si el backend dev prefiere mantener la columna y derivar gradualmente, es aceptable como paso intermedio. Lo importante es que el **source of truth** sea la lista PUBLICO.

### Decisión del implementador

El backend dev decide:

- (A) Eliminar la columna y calcular en runtime (JOIN/subquery)
- (B) Mantener la columna como cache/denormalización que se sincroniza con la lista PUBLICO
- (C) Otro approach

Lo importante es que conceptualmente `priceCents` del producto = precio de la lista PUBLICO. Un solo source of truth.

---

## Esfuerzo estimado

~3-5h incluyendo migración de datos, refactor del service, tests, y docs.

**No hay datos en producción** — el sistema no está en uso real, así que la migración es limpia.

---

## Relación con otros requests

- **`global-price-lists.md`**: La lista PUBLICO ya se auto-crea al crear producto. Este request complementa ese comportamiento asegurando que el precio del formulario rápido vaya directo a PUBLICO.
- **`variant-minquantity-and-cost.md`**: No afectado — el costo de compra sigue siendo campo directo del producto/variante, separado del precio de venta.

---

## Test cases sugeridos

### Creación

1. `POST /products` con `priceCents: 30000` → producto creado, lista PUBLICO tiene `priceCents: 30000`
2. `POST /products` con `priceCents: 0` → producto creado, lista PUBLICO tiene `priceCents: 0`
3. `POST /products` sin `priceCents` → producto creado, lista PUBLICO tiene `priceCents: 0` (default)
4. `GET /products/:id` después de crear → response incluye `priceCents: 30000` (calculado desde PUBLICO)

### Actualización

5. `PATCH /products/:id` con `priceCents: 50000` → lista PUBLICO actualizada a `50000`
6. `GET /products/:id` después de update → response refleja nuevo precio
7. `PATCH /products/:id/price-lists/:publicoId` con `priceCents: 60000` → `GET /products/:id` refleja `60000`

### Listado

8. `GET /products` → cada producto incluye `priceCents` calculado desde su lista PUBLICO
9. Producto con PUBLICO en `$0` → listado muestra `priceCents: 0`

### Consistencia

10. Cambiar precio vía `PATCH /products/:id` con `priceCents: 40000` + verificar `GET /products/:id/price-lists` → PUBLICO tiene `40000`
11. Cambiar precio vía `PATCH /products/:id/price-lists/:publicoId` con `priceCents: 45000` + verificar `GET /products/:id` → `priceCents: 45000`
