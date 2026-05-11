# Requerimiento Backend — Agregar `debtCents` al listado de ventas

## Contexto

El endpoint `GET /sales` actualmente NO incluye `debtCents` en cada item del array `data[]`. El frontend necesita mostrar la columna **Deuda** en la tabla de ventas, que indica el monto pendiente cuando una venta fue pagada parcial o totalmente con crédito.

En el detalle (`GET /sales/:id`) ya se devuelve `debtCents`. Solo falta agregarlo al listado.

## Cambio requerido

Agregar el campo `debtCents` a cada objeto del array `data[]` en la respuesta de `GET /sales`.

### Response actual

```json
{
  "data": [
    {
      "id": "uuid",
      "folio": "A-202605-000012",
      "status": "CONFIRMED",
      "paymentStatus": "PAID",
      "deliveryStatus": "DELIVERED",
      "totalCents": 127000,
      "confirmedAt": "2026-05-06T14:43:00.000Z",
      "customer": { "id": "uuid", "name": "Empresa F." },
      "cashier": { "id": "uuid", "name": "cesar flores" },
      "seller": null
    }
  ]
}
```

### Response esperado

```json
{
  "data": [
    {
      "id": "uuid",
      "folio": "A-202605-000012",
      "status": "CONFIRMED",
      "paymentStatus": "PAID",
      "deliveryStatus": "DELIVERED",
      "totalCents": 127000,
      "debtCents": 0,
      "confirmedAt": "2026-05-06T14:43:00.000Z",
      "customer": { "id": "uuid", "name": "Empresa F." },
      "cashier": { "id": "uuid", "name": "cesar flores" },
      "seller": null
    }
  ]
}
```

## Reglas

- `debtCents` es `number` (entero, en centavos).
- Cuando `paymentStatus = "PAID"`, `debtCents` es `0`.
- Cuando `paymentStatus = "PARTIAL"` o `"CREDIT"`, `debtCents` refleja el monto de deuda pendiente.
- El campo ya existe en la tabla `sales` (se persiste al confirmar la venta), así que es solo un `select` adicional en la query del listado.

## Impacto

- Solo afecta `GET /sales` (select + DTO/serialización).
- No requiere migración.
- No rompe clientes existentes (campo nuevo, aditivo).

## Prioridad

Alta — el frontend está implementando la tabla de ventas y necesita este campo para la columna Deuda.
