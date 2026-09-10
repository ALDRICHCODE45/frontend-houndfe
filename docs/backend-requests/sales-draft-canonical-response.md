# Requerimiento Backend — Contrato canónico de respuesta para drafts de venta

## Acción requerida

Unificar la forma de respuesta de `GET /sales/drafts` y de **toda** ruta de mutación que devuelve el draft abierto actualizado, para que el objeto `Sale` incluya **siempre** los campos anidados `customer` y `shippingAddress`, con valor explícito `null` cuando no hay cliente ni dirección asignados.

Hoy la mayoría de esas rutas devuelven `Sale.toResponse()` con los ids escalares (`customerId`, `shippingAddressId`) pero **sin** los objetos anidados. El frontend reemplaza el draft cacheado con esa respuesta y pierde el cliente que el vendedor acaba de asignar, hasta que recarga la lista. El frontend ya aplica una reconciliación defensiva, pero el contrato correcto debe vivir en el backend.

## 1) Estado actual: la respuesta está partida en dos formatos

### Formato A — `Sale.toResponse()` (solo ids, omite los objetos anidados)

Respuesta actual de la mayoría de las mutaciones de carrito:

```json
{
  "id": "sale-1",
  "status": "DRAFT",
  "customerId": "cust-1",
  "shippingAddressId": "addr-1",
  "items": [{ "id": "item-1", "quantity": 2 }],
  "updatedAt": "2026-05-06T21:00:00.000Z"
}
```

`customer` y `shippingAddress` **no aparecen en el payload** (no vienen ni como `null`).

### Formato B — respuesta enriquecida (objetos anidados)

Lo que devuelve la ruta de asignación de cliente (`PUT /sales/drafts/:id/customer`) y la ruta de lista de precios (`PUT /sales/drafts/:id/price-list`, que responde con `findDraftResponseById`):

```json
{
  "id": "sale-1",
  "status": "DRAFT",
  "customerId": "cust-1",
  "customer": { "id": "cust-1", "firstName": "Ana", "lastName": "García" },
  "shippingAddress": {
    "id": "addr-1",
    "customerId": "cust-1",
    "street": "Calle Falsa",
    "exteriorNumber": "123",
    "city": "CDMX"
  },
  "items": [{ "id": "item-1", "quantity": 2 }],
  "updatedAt": "2026-05-06T21:00:00.000Z"
}
```

### Por qué solo fallan las mutaciones de carrito

- **Asignación de cliente/shipping address**: devuelve la Sale enriquecida (Formato B) → el panel muestra el cliente correctamente.
- **Lista de precios**: responde con `findDraftResponseById`, que incluye los objetos anidados (Formato B) → sin problema.
- **Mutaciones de carrito** (Formato A): el frontend reemplazaba el draft completo de su caché con la respuesta, y como `customer`/`shippingAddress` están ausentes, el cliente asignado desaparecía del panel hasta el próximo refetch de `GET /sales/drafts`.

## 2) Alcance del contrato

### Rutas incluidas (deben devolver la Sale enriquecida del Formato B)

| Ruta                                                                                                                            | Motivo                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /sales/drafts`                                                                                                             | Cada draft del listado debe incluir ambos campos anidados.                                     |
| `POST /sales/drafts` (crear)                                                                                                    | Devuelve un draft abierto nuevo; `customer` y `shippingAddress` deben venir `null` explícitos. |
| `POST /:id/items`, `PATCH /:id/items/:itemId`, `DELETE /:id/items/:itemId`, `DELETE /:id/items`                                 | Devuelven el draft abierto actualizado.                                                        |
| `PATCH /:id/items/:itemId/price`                                                                                                | Devuelve el draft abierto actualizado.                                                         |
| `PATCH /:id/items/:itemId/discount`, `DELETE /:id/items/:itemId/discount`                                                       | Devuelven el draft abierto actualizado.                                                        |
| `PATCH /:id/discount`, `DELETE /:id/discount` (descuento global)                                                                | Devuelven el draft abierto actualizado.                                                        |
| `POST /:id/manual-promotions/:promotionId`, `DELETE /:id/manual-promotions/:promotionId`, `DELETE /:id/promotions/:promotionId` | Devuelven el draft abierto actualizado.                                                        |
| `PUT /:id/customer`, `PUT /:id/shipping-address`                                                                                | Ya cumplen (Formato B); quedan como referencia del shape esperado.                             |
| `PUT /:id/price-list`                                                                                                           | Ya cumple (responde con `findDraftResponseById`); queda como control no-regresivo.             |

### Rutas excluidas explícitamente

| Ruta                                                   | Motivo de exclusión                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `DELETE /sales/drafts/:id` (cerrar draft)              | No devuelve Sale; el draft deja de existir.                                          |
| `DELETE /:id/customer`, `DELETE /:id/shipping-address` | Devuelven `void`.                                                                    |
| `POST /:id/charge`                                     | Devuelve `ChargeSaleResponse` (otro shape); el draft deja de existir al confirmarse. |

## 3) Contrato requerido (canónico)

Para **todas** las rutas incluidas, cada `Sale` de la respuesta debe incluir:

- `customer`: objeto anidado `{ id, firstName, lastName }` cuando hay cliente asignado, o **`null` explícito** cuando no.
- `shippingAddress`: objeto anidado de dirección cuando hay una asignada, o **`null` explícito** cuando no.
- Se mantienen los ids escalares (`customerId`, `shippingAddressId`) por compatibilidad.

### Respuesta esperada (ejemplo sin cliente asignado)

```json
{
  "id": "sale-1",
  "status": "DRAFT",
  "customerId": null,
  "customer": null,
  "shippingAddressId": null,
  "shippingAddress": null,
  "items": [{ "id": "item-1", "quantity": 2 }],
  "updatedAt": "2026-05-06T21:00:00.000Z"
}
```

Regla clave: **la propiedad siempre está presente**. `null` significa "sin asignar"; la ausencia de la propiedad ya no es un estado válido del contrato.

## 4) Checklist de aceptación

- [ ] `GET /sales/drafts` incluye `customer` y `shippingAddress` (objeto o `null`) en cada draft del listado.
- [ ] `POST /sales/drafts` devuelve el draft nuevo con ambos campos en `null` explícito.
- [ ] Las 4 rutas de items (`POST /:id/items`, `PATCH /:id/items/:itemId`, `DELETE /:id/items/:itemId`, `DELETE /:id/items`) incluyen ambos campos.
- [ ] `PATCH /sales/drafts/:id/items/:itemId/price` incluye ambos campos.
- [ ] `PATCH`/`DELETE /sales/drafts/:id/items/:itemId/discount` incluyen ambos campos.
- [ ] `PATCH`/`DELETE /sales/drafts/:id/discount` (descuento global) incluyen ambos campos.
- [ ] Las 3 rutas de promociones (`manual-promotions` POST/DELETE y veto de auto) incluyen ambos campos.
- [ ] Un draft sin cliente devuelve `customer: null` y `shippingAddress: null` (propiedades presentes, no omitidas).
- [ ] Un draft con cliente devuelve el objeto anidado completo (mismo shape que `PUT /:id/customer`).
- [ ] Las rutas excluidas (`DELETE /:id`, `DELETE /:id/customer`, `DELETE /:id/shipping-address`, `POST /:id/charge`) no requieren cambios.

## 5) Impacto

- **Sin migración de base de datos**: los datos ya existen; el cambio es solo de serialización en la capa de respuesta.
- **Frontend**: ya no dependerá de la reconciliación defensiva que hoy preserva el cliente cacheado cuando la mutación omite los campos; una vez desplegado el contrato, el frontend puede volver al reemplazo directo del draft en caché.
- **Compatibilidad**: agregar propiedades presentes siempre (objeto o `null`) es aditivo; no rompe consumidores actuales.
