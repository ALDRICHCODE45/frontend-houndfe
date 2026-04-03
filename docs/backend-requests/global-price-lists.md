# Backend Request: Listas de Precios Globales

## Contexto — Cómo funciona el legacy

En el sistema legacy, las **listas de precios son globales** — existen a nivel del negocio, no por producto. Cuando un usuario crea la lista "Mayorista" desde cualquier producto, esa lista aparece automáticamente en TODOS los productos y en TODAS las variantes.

Lo que varía por producto/variante es el **precio** (el valor en centavos), no la lista en sí.

### Ejemplo del legacy

1. Usuario abre Producto A, agrega lista "Mayorista" con precio $30
2. Abre Producto B → la lista "Mayorista" ya está ahí (con precio $0 por defecto)
3. Abre variante de Producto B → la lista "Mayorista" ya está ahí (con precio $0 por defecto)
4. La lista "PUBLICO" siempre existe y no se puede eliminar (esto ya funciona)

## Estado actual del backend

Hoy las listas están **atadas a cada producto**:

```prisma
model PriceList {
  id         String   @id @default(uuid())
  productId  String          // ← FK a products
  name       String
  priceCents Int
  // ...
  @@unique([productId, name])  // ← unicidad por producto
}
```

Esto significa que si creo "Mayorista" en Producto A, Producto B NO la tiene. Y las variantes de Producto B tampoco.

## Lo que el frontend necesita

### 1. Catálogo global de listas de precios

Una entidad separada que represente las listas de precios del negocio:

```
GlobalPriceList (o PriceListCatalog)
  - id: uuid
  - name: string (unique global, ej: "PUBLICO", "Mayorista", "Minoristas")
  - createdAt, updatedAt
```

- "PUBLICO" siempre existe, no se puede eliminar (como hoy).
- El usuario puede crear nuevas listas desde cualquier producto.
- El nombre es único globalmente.

### 2. Los precios por producto siguen existiendo

La tabla `price_lists` actual puede evolucionar a ser la **relación producto ↔ lista global con su precio**:

```
ProductPrice (evolución de price_lists)
  - id: uuid
  - productId: FK a products
  - globalPriceListId: FK a GlobalPriceList  // ← reemplaza name
  - priceCents: int
  - tierPrices: TierPrice[]
  // ...
  @@unique([productId, globalPriceListId])
```

O alternativamente, mantener el modelo actual pero hacer que **al crear una lista en cualquier producto, se cree automáticamente en TODOS los productos existentes** (con precio 0). El approach depende del backend dev.

### 3. Los precios por variante ya usan priceListId

La tabla `variant_prices` ya tiene `priceListId` — esta relación sigue funcionando. Lo que cambia es que el priceList al que apunta debe ser derivado del catálogo global.

### 4. Endpoints que el frontend necesita

#### A. CRUD de listas globales

| Método   | Path               | Body               | Respuesta                        |
| -------- | ------------------ | ------------------ | -------------------------------- |
| `GET`    | `/price-lists`     | —                  | `200`, todas las listas globales |
| `POST`   | `/price-lists`     | `{ name: string }` | `201`, lista creada              |
| `DELETE` | `/price-lists/:id` | —                  | `204` (no PUBLICO)               |

Al crear una lista global:

- Se crea el registro global
- Se auto-crean registros de precio ($0) para TODOS los productos existentes
- Para cada producto con variantes, se auto-crean VariantPrice ($0) para todas las variantes

Al eliminar una lista global:

- Se eliminan en cascade todos los precios de producto y variante asociados
- "PUBLICO" no se puede eliminar

#### B. Precios por producto (evolución de lo actual)

Los endpoints actuales de price lists por producto pueden seguir funcionando, pero:

| Método                                         | Path        | Qué cambia                                                   |
| ---------------------------------------------- | ----------- | ------------------------------------------------------------ |
| `GET /products/:id/price-lists`                | Sin cambios | Devuelve todas las listas CON sus precios para este producto |
| `PATCH /products/:id/price-lists/:priceListId` | Sin cambios | Actualiza el precio + tiers de este producto para esta lista |

La diferencia es que `POST /products/:id/price-lists` ya no crea una lista nueva — **crear listas se hace desde el catálogo global** (`POST /price-lists`).

Opcionalmente, para mantener backwards compatibility, se puede permitir `POST /products/:id/price-lists` con un `name` y que internamente:

1. Si la lista global no existe → crearla globalmente + auto-crear en todos los productos
2. Si ya existe → solo actualizar el precio de este producto

#### C. Lectura de catálogo + precios

El frontend necesita poder obtener TODAS las listas globales (para saber cuáles existen) y los precios de un producto específico. Dos opciones:

**Opción A** (recomendada): `GET /products/:id/price-lists` ya devuelve TODAS las listas con el precio de ese producto (incluyendo las que tienen $0). Esto ya parece funcionar hoy porque al crear variante/lista se auto-crean los cruces.

**Opción B**: Endpoint separado `GET /price-lists` para el catálogo + `GET /products/:id/price-lists` para precios.

### 5. Invariantes necesarias

1. Al crear un producto nuevo → auto-crear registros de precio ($0) para TODAS las listas globales existentes (no solo PUBLICO)
2. Al crear una lista global → auto-crear registros de precio ($0) para TODOS los productos existentes + VariantPrice ($0) para todas las variantes
3. Al crear una variante → auto-crear VariantPrice ($0) para TODAS las listas globales (esto ya funciona parcialmente)
4. "PUBLICO" no se puede eliminar (ya funciona)
5. Si se elimina una lista global → cascade delete de precios de producto + variante

### 6. Response shape esperado

Para `GET /price-lists` (catálogo global):

```json
[
  { "id": "uuid-1", "name": "PUBLICO", "createdAt": "..." },
  { "id": "uuid-2", "name": "Mayorista", "createdAt": "..." },
  { "id": "uuid-3", "name": "Minoristas", "createdAt": "..." }
]
```

Para `GET /products/:id/price-lists` (precios del producto — sin cambios de shape):

```json
[
  {
    "id": "uuid",
    "name": "PUBLICO",
    "priceCents": 5000,
    "priceDecimal": 50.00,
    "margin": { "amountCents": 5000, "percent": 100, "amountDecimal": 50.00 },
    "tierPrices": []
  },
  {
    "id": "uuid",
    "name": "Mayorista",
    "priceCents": 3000,
    "priceDecimal": 30.00,
    "margin": { ... },
    "tierPrices": []
  }
]
```

---

## Resumen para el backend dev

### El cambio conceptual

Las listas de precios pasan de ser **per-product** a **globales del negocio**. El nombre es global, el precio es por producto/variante.

### Lo mínimo que necesito del backend

1. **Un endpoint `GET /price-lists`** que devuelva las listas globales (para saber cuáles existen y poder crear nuevas)
2. **Un endpoint `POST /price-lists`** para crear una lista nueva (globaliza automáticamente a todos los productos + variantes con precio $0)
3. **Un endpoint `DELETE /price-lists/:id`** para eliminar una lista (cascade, excepto PUBLICO)
4. **Que `GET /products/:id/price-lists` siga devolviendo TODAS las listas con precios** de ese producto (ya debería funcionar si los cruces se crean correctamente)
5. **Auto-crear cruces** cuando se crea un producto nuevo (para todas las listas globales, no solo PUBLICO)

### Lo que NO cambia

- `PATCH /products/:id/price-lists/:priceListId` — actualizar precio + tiers de un producto
- `variant_prices` y sus endpoints — siguen igual
- La fórmula de margen — sigue igual
- "PUBLICO" no se puede eliminar — sigue igual

### Decisión del implementador

El backend dev decide si:

- (A) Crear una tabla `global_price_lists` separada y refactorizar `price_lists` para que referencie la global
- (B) Mantener `price_lists` como está pero agregar lógica de "globalización" cuando se crea/elimina una lista (crear/borrar en todos los productos)
- (C) Otro approach que considere más limpio

Lo importante es que el frontend pueda:

1. Listar las listas que existen globalmente
2. Crear una nueva y que aparezca en todos los productos
3. Ver todas las listas con sus precios para un producto dado

### Esfuerzo estimado

Dependiendo del approach: 4-8h incluyendo migración, tests, y docs.

### No hay datos en producción

El sistema no está en uso real — migración de datos limpia.
