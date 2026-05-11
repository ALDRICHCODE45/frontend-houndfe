# Requerimiento Backend — POS Cobrar / Registrar Venta

Este documento define el contrato backend para habilitar el flujo **Cobrar** del POS, alineado al comportamiento del sistema legacy y a lo que hoy existe en frontend.

## 1) Estado actual verificado en frontend

### Lo que YA existe
- Drafts de venta (`/sales/drafts`) con:
  - crear draft,
  - listar drafts,
  - agregar/quitar items,
  - cambiar cantidad,
  - override de precio,
  - descuento por item,
  - descuento global,
  - catálogo POS.
- Tipado actual: `SaleStatus = 'DRAFT'`.

### Gap crítico
- El botón **Cobrar** está deshabilitado (tooltip: *Disponible próximamente*).
- No existe endpoint de confirmación/cobro de venta ni modelo de pagos.

Referencias frontend:
- `src/features/POS/sales/components/SaleTotalsFooter.vue`
- `src/features/POS/sales/api/sale.api.ts`
- `src/features/POS/sales/interfaces/sale.types.ts`

---

## 2) Objetivo funcional

Permitir cerrar una venta POS desde draft a venta confirmada con estos métodos:
- Efectivo
- Crédito
- Tarjeta de crédito
- Tarjeta de débito
- Transferencia
- Múltiples métodos (combinación de los anteriores)

Condiciones del legado a respetar:
- Cliente por defecto: **"Público en General"**.
- Efectivo único: monto recibido debe ser **>= total** (para calcular cambio).
- Crédito: requiere cliente + fecha límite de cobro; genera deuda pendiente.
- Múltiples métodos: suma exacta de métodos = total de venta.
- Si hay porción a crédito en pago múltiple, esa porción crea deuda pendiente.

---

## 3) Modelo de dominio recomendado

## Aggregate principal: `Sale`
- `id`
- `tenant_id`
- `folio` (consecutivo por tenant)
- `status` (`DRAFT`, `CONFIRMED`, opcional futuro `CANCELLED`)
- `customer_id` (nullable solo si backend inyecta Público en General automáticamente)
- `cashier_user_id`
- `seller_user_id` (por ahora igual a `cashier_user_id`)
- `currency` (`MXN`)
- `subtotal_cents`
- `discount_cents`
- `total_cents`
- `paid_cents`
- `debt_cents`
- `payment_status` (`PAID`, `PARTIALLY_PAID`, `PENDING`)
- `delivery_status` (por ahora fijo `DELIVERED`)
- `channel` (por ahora fijo `POS`; futuro: `ECOMMERCE`, etc.)
- `register` (nombre de caja; por ahora fijo `Principal`)
- `confirmed_at`
- `created_at`, `updated_at`

### Entidades hijas
- `SaleItem`
  - snapshot de producto/variante/nombre/precio/cantidad/descuento al momento de cobrar.
- `SalePayment`
  - método, monto aplicado, metadata (ej. referencia transferencia/tarjeta, efectivo recibido, cambio).
- `SaleCreditTerm` (solo cuando exista crédito)
  - `amount_cents`, `due_date`, `status` (`PENDING`, `PAID`, etc).

### Reglas de negocio (invariantes)
1. **Draft no vacío** para cobrar.
2. En servidor se recalculan totales finales antes de confirmar.
3. **Pago único efectivo**: `tendered_cents >= total_cents`.
4. **Pago único no efectivo**: `amount_cents == total_cents`.
5. **Multi-método**: `sum(amount_cents) == total_cents` exacto.
6. **Crédito**: requiere `customer_id` real + `due_date` válida (> fecha actual).
7. Toda operación es **tenant-scoped**: no mezclar ventas/clientes/productos de otro tenant.
8. Cobro debe ser **idempotente** (reintentos/red).

---

## 4) API requerida

## 4.1 Cobro / confirmación

`POST /sales/drafts/{saleId}/charge`

Headers:
- `Idempotency-Key: <uuid>` (obligatorio)

Request (propuesto):

```json
{
  "customerId": "uuid-or-null",
  "sellerUserId": "uuid-optional",
  "payments": [
    {
      "method": "cash",
      "amountCents": 55000,
      "tenderedCents": 60000
    },
    {
      "method": "credit",
      "amountCents": 10000,
      "dueDate": "2026-06-15"
    },
    {
      "method": "card_credit",
      "amountCents": 20000,
      "reference": "AUTH-123"
    },
    {
      "method": "card_debit",
      "amountCents": 10000,
      "reference": "AUTH-456"
    },
    {
      "method": "transfer",
      "amountCents": 15000,
      "reference": "SPEI-789"
    }
  ]
}
```

Notas:
- Se permite 1 o N métodos.
- Si `customerId` es null, backend asigna cliente default **Público en General** del tenant.

Response 200 (resumen):

```json
{
  "saleId": "uuid",
  "folio": "V-000123",
  "status": "CONFIRMED",
  "paymentStatus": "PAID",
  "totalCents": 55000,
  "paidCents": 55000,
  "debtCents": 0,
  "changeDueCents": 5000,
  "customer": { "id": "uuid", "name": "Público en General" },
  "cashier": { "id": "uuid", "name": "Usuario" },
  "seller": { "id": "uuid", "name": "Usuario" },
  "confirmedAt": "2026-05-06T20:00:00Z"
}
```

### Errores de validación (422)
Devolver `code` + `message` (estable):
- `EMPTY_SALE`
- `PAYMENT_AMOUNT_MISMATCH`
- `INSUFFICIENT_TENDERED_CASH`
- `CREDIT_REQUIRES_CUSTOMER`
- `CREDIT_REQUIRES_DUE_DATE`
- `CREDIT_DUE_DATE_INVALID`
- `CUSTOMER_NOT_FOUND`
- `STOCK_INSUFFICIENT_AT_CONFIRM`
- `PRICE_OUT_OF_DATE`
- `SALE_ALREADY_CONFIRMED`

## 4.2 Asignar cliente en draft (opcional pero recomendado)
`PATCH /sales/drafts/{saleId}/customer`

```json
{
  "customerId": "uuid-or-null"
}
```

## 4.3 Listado de ventas

`GET /sales`

Query params mínimos:
- `status` (`CONFIRMED` default para módulo ventas)
- `paymentStatus` (`PAID`, `PARTIALLY_PAID`, `PENDING`)
- `deliveryStatus` (`DELIVERED`, `NOT_DELIVERED`)
- `from`, `to`
- `cashierUserId`
- `customerId`
- `q` (búsqueda por folio/cliente/cajero/vendedor)
- `limit`, `offset`

Response 200 (paginada):

```json
{
  "data": [
    {
      "id": "uuid",
      "folio": "V-000012",
      "confirmedAt": "2026-05-06T14:43:00Z",
      "customer": { "id": "uuid", "name": "Empresa F." },
      "paymentStatus": "PAID",
      "totalCents": 127000,
      "debtCents": 0,
      "deliveryStatus": "DELIVERED",
      "cashier": { "id": "uuid", "name": "cesar flores" },
      "seller": { "id": "uuid", "name": "cesar flores" },
      "channel": "POS",
      "register": "Principal"
    }
  ],
  "pagination": { "total": 50, "limit": 20, "offset": 0 },
  "counts": {
    "all": 50,
    "pendingPayments": 3,
    "notDelivered": 1
  }
}
```

Notas sobre el response del listado:
- `customer` es `null` cuando el cliente es **Público en General** (frontend lo muestra vacío).
- `channel`: por ahora siempre `"POS"`. Frontend lo muestra como "Punto de Venta".
- `register`: por ahora siempre `"Principal"`. Nombre de la caja registradora.
- `counts`: contadores para las tabs del frontend (**Todas**, **Pagos Pendientes**, **No Entregadas**). Deben calcularse sobre el mismo filtro base (tenant + status CONFIRMED) sin aplicar los filtros de paymentStatus/deliveryStatus, para que los tabs siempre reflejen totales reales.

## 4.4 Detalle de venta

`GET /sales/{id}`

Response 200:

```json
{
  "id": "uuid",
  "folio": "V-000012",
  "status": "CONFIRMED",
  "paymentStatus": "PAID",
  "deliveryStatus": "DELIVERED",
  "totalCents": 127000,
  "subtotalCents": 127000,
  "discountCents": 0,
  "paidCents": 127000,
  "debtCents": 0,
  "changeDueCents": 0,
  "currency": "MXN",
  "confirmedAt": "2026-05-06T14:43:00Z",
  "channel": "POS",
  "register": "Principal",
  "customer": { "id": "uuid", "name": "Empresa F." },
  "cashier": { "id": "uuid", "name": "cesar flores" },
  "seller": null,
  "items": [
    {
      "id": "uuid",
      "productName": "Jean Recto",
      "variantName": null,
      "imageUrl": "https://...",
      "unitPriceCents": 17000,
      "quantity": 1,
      "discountCents": 0,
      "subtotalCents": 17000
    }
  ],
  "payments": [
    {
      "id": "uuid",
      "method": "cash",
      "amountCents": 127000,
      "tenderedCents": 127000,
      "changeCents": 0,
      "reference": null,
      "paidAt": "2026-05-06T14:43:00Z"
    }
  ],
  "timeline": [
    {
      "event": "SALE_REGISTERED",
      "description": "Venta Registrada",
      "user": "cesar flores",
      "location": "Sucursal Principal",
      "occurredAt": "2026-05-06T14:43:00Z"
    },
    {
      "event": "PAYMENT_RECEIVED",
      "description": "Cobro de $1,270.00 en Efectivo",
      "user": "cesar flores",
      "location": "Caja Principal",
      "occurredAt": "2026-05-06T14:43:00Z"
    },
    {
      "event": "PRODUCTS_DELIVERED",
      "description": "Entrega de Productos",
      "user": "cesar flores",
      "location": "Sucursal Principal",
      "occurredAt": "2026-05-06T14:43:00Z"
    }
  ]
}
```

Notas sobre el detalle:
- `items[]`: snapshot inmutable al momento del cobro. Incluir `imageUrl` para que el frontend muestre thumbnail del producto.
- `payments[]`: cada método de pago aplicado. `paidAt` es el timestamp del cobro.
- `timeline[]`: eventos de la venta en orden cronológico (más antiguo primero). Por ahora siempre son 3 eventos (`SALE_REGISTERED`, `PAYMENT_RECEIVED`, `PRODUCTS_DELIVERED`) generados automáticamente al confirmar la venta. Cuando se implementen envíos, `PRODUCTS_DELIVERED` dejará de ser automático.
- `seller`: `null` cuando no se asignó vendedor (frontend muestra "Asignar Vendedor").
- `customer`: `null` cuando es Público en General.
- `channel`: `"POS"` fijo por ahora.
- `register`: `"Principal"` fijo por ahora.

---

## 5) Persistencia y relaciones (propuesta)

> Tenant-scoped en TODAS las tablas.

### `sales`
- PK `id`
- `tenant_id` index
- `folio` unique por tenant
- `status`, `payment_status`, `delivery_status` indexables
- `customer_id` FK customers
- `cashier_user_id` FK users
- `seller_user_id` FK users
- `channel` (`POS` default; futuro: `ECOMMERCE`, etc.)
- `register` (nombre de caja; `Principal` default)
- montos agregados (`subtotal_cents`, `discount_cents`, `total_cents`, `paid_cents`, `debt_cents`, `change_due_cents`)
- timestamps

### `sale_items`
- PK `id`
- `sale_id` FK sales
- `tenant_id`
- snapshot producto/variante + pricing + descuentos + quantity
- `image_url` (snapshot de imagen del producto al momento del cobro, para mostrar thumbnail en detalle)

### `sale_payments`
- PK `id`
- `sale_id` FK sales
- `tenant_id`
- `method` (`cash`,`credit`,`card_credit`,`card_debit`,`transfer`)
- `amount_cents`
- `tendered_cents` (solo efectivo)
- `change_cents` (solo efectivo)
- `reference` (nullable)
- `metadata` jsonb nullable

### `sale_credit_terms` (o `accounts_receivable` si ya existe)
- PK `id`
- `sale_id` FK sales
- `tenant_id`
- `customer_id`
- `amount_cents`
- `due_date`
- `status`

Índices recomendados:
- `(tenant_id, status, confirmed_at desc)`
- `(tenant_id, payment_status, confirmed_at desc)`
- `(tenant_id, folio)` unique

---

## 6) Qué debe ser transaccional vs event-driven

## Síncrono (misma transacción SQL del charge)
1. Lock del draft.
2. Validar ownership tenant + estado DRAFT.
3. Recalcular totales server-side.
4. Validar métodos de pago / crédito.
5. Persistir `sales`, `sale_items`, `sale_payments`.
6. Actualizar stock.
7. Pasar estado a `CONFIRMED`.
8. Commit + respuesta.

## Asíncrono (eventos post-commit)
Evento sugerido: `sale.confirmed`

Consumidores sugeridos:
- crear cuenta por cobrar (si hubo crédito),
- movimiento de caja/corte,
- notificaciones,
- analítica,
- integración externa (webhooks/ERP).

**Importante:** no mover a async nada que comprometa consistencia de la venta confirmada.

---

## 7) Contrato para vistas de "Ventas" en frontend

### 7.1 Tabla / listado de ventas

| Columna | Campo backend | Formato frontend | Notas |
|---------|---------------|------------------|-------|
| ☐ (checkbox) | — | Selección de filas | Estándar |
| Venta | `folio` | `#12` (link clickeable → detalle) | Navega a `/pos/sales/:id` |
| Fecha | `confirmedAt` | `06/05/2026 08:29:12` o relativo "Hoy a las 14:43" | |
| Cliente | `customer.name` | Nombre o vacío si `null` (Público en General) | |
| Pago | `paymentStatus` | Badge: `Pagada` (verde), `Impaga` (naranja), `Deuda pendiente` (rojo) | |
| Total | `totalCents` | `$1,270.00` (MXN) | |
| Deuda | `debtCents` | `$550.00` o vacío si 0 | |
| Productos | `deliveryStatus` | Badge: `Entregados` (verde) / `No Entregados` (rojo) | Siempre "Entregados" por ahora |
| Cajero | `cashier.name` | Nombre | |
| Vendedor | `seller.name` | Nombre o vacío | Por ahora = cajero o sin asignar |
| Canal | `channel` | "Punto de Venta" | Fijo por ahora |
| Factura | — | Columna visible pero **vacía** | Fuera de alcance |

### Tabs (filtros rápidos)

Los tabs se renderizan arriba de la tabla con contadores del campo `counts` del listado:

| Tab | Filtro | Contador |
|-----|--------|----------|
| **Todas** | Sin filtro adicional | `counts.all` |
| **Pagos Pendientes** | `paymentStatus != PAID` | `counts.pendingPayments` |
| **No Entregadas** | `deliveryStatus = NOT_DELIVERED` | `counts.notDelivered` |

### Barra superior
- **Buscador**: "Filtrar por productos, vendedor o cliente" → query param `q`
- **Filtrar**: botón para filtros avanzados (fecha, cajero, cliente, etc.)
- **Ordenar**: dropdown de ordenamiento

### 7.2 Vista de detalle de venta

Layout: dos columnas (panel principal izquierdo + sidebar derecho).

**Panel izquierdo (contenido principal):**
1. **Badge de entrega**: `Entregados` (verde) — siempre por ahora
2. **Tabla de productos**: thumbnail de imagen + nombre (link al producto) + precio unitario, cantidad, subtotal → de `items[]`
3. **Resumen de totales**: Subtotal, Descuentos, Total
4. **Historial (timeline)**: eventos cronológicos de `timeline[]`, del más reciente arriba al más antiguo abajo:
   - "Entrega de Productos" — usuario, sucursal, timestamp
   - "Cobro de $X en [Método]" — usuario, caja, timestamp
   - "Venta Registrada" — usuario, sucursal, timestamp

**Panel derecho (sidebar metadata):**

| Campo | Valor |
|-------|-------|
| Estado | Badge de `paymentStatus` (`Pagada` verde) + Total |
| Factura | **Ignorar** por ahora |
| Fecha | `confirmedAt` (relativo o absoluto) |
| Canal | `channel` → "Punto de Venta" (fijo) |
| Caja | `register` → "Principal" (fijo) |
| Cajero | `cashier.name` |
| Vendedor | `seller.name` o "Asignar Vendedor" si `null` |

**Header de la vista:**
- Flecha atrás + "Venta #12"
- Acciones: **TODAS IGNORADAS por ahora** (Más Acciones, Imprimir Ticket, Descargar PDF, Facturar Venta)

### 7.3 Valores por defecto fijos (fase actual)

Estos campos existen en el sistema legacy pero por ahora se manejan con valores fijos:

| Campo | Valor fijo | Cuándo cambia |
|-------|-----------|---------------|
| Canal | "Punto de Venta" (`POS`) | Cuando se agreguen otros canales (e-commerce, etc.) |
| Caja | "Principal" | Cuando se implementen múltiples cajas registradoras |
| Productos/Entrega | "Entregados" (`DELIVERED`) | Cuando se implementen envíos |
| Historial | Siempre 3 eventos automáticos | Cuando existan envíos, el evento de entrega dejará de ser automático |
| Vendedor | = Cajero o sin asignar | Cuando se implemente asignación real de vendedor |
| Factura | Vacío / no mostrar | Cuando se implemente CFDI |

---

## 8) Criterios de aceptación backend

1. Se puede confirmar una venta draft con cualquier método simple.
2. Efectivo no permite cobrar menos del total.
3. Crédito exige cliente + fecha límite y refleja deuda pendiente.
4. Multi-método exige suma exacta del total.
5. Cada cobro genera venta confirmada con folio y snapshot inmutable de items/pagos.
6. `GET /sales` devuelve todos los campos de la tabla 7.1 + `counts` para tabs.
7. `GET /sales/{id}` devuelve items con snapshot (imagen, nombre, precio), payments, timeline, y metadata del sidebar (canal, caja, cajero, vendedor).
8. Timeline del detalle incluye los 3 eventos automáticos (`SALE_REGISTERED`, `PAYMENT_RECEIVED`, `PRODUCTS_DELIVERED`) con usuario, ubicación y timestamp.
9. Aislamiento tenant validado en create, charge, list, detail.
10. Reintento con mismo `Idempotency-Key` no duplica cobro/venta.

---

## 9) Fuera de alcance (por ahora)

- CFDI / facturación (columna Factura visible pero vacía).
- Módulo de pedidos (estado "No entregados" real con envíos).
- Políticas avanzadas de crédito (límites por cliente, intereses, bloqueos).
- Reverso/cancelación de venta (se puede diseñar en siguiente fase).
- Acciones de venta: Imprimir Ticket, Descargar PDF, Facturar Venta, Más Acciones.
- Comentarios en historial de venta.
- Múltiples cajas registradoras (por ahora "Principal" fijo).
- Múltiples canales de venta (por ahora "Punto de Venta" fijo).
- Asignación real de vendedor (por ahora = cajero o sin asignar).

---

## 10) Recomendación de implementación incremental

1. **Fase 1:** Cobro simple (cash/card/transfer) + confirmar venta + **listado de ventas** (`GET /sales` con tabs/filtros/contadores) + **detalle de venta** (`GET /sales/{id}` con items, payments, timeline, metadata sidebar).
2. **Fase 2:** Crédito en pago único.
3. **Fase 3:** Multi-método incluyendo crédito parcial.
4. **Fase 4:** Eventos async y observabilidad (outbox/idempotencia end-to-end).

Esto minimiza riesgo y permite entregar valor temprano sin romper el flujo actual de drafts.
