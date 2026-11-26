# Handoff 32 — customers module v1 (backend c974c8b7)

Verbatim copy of what the backend session sent (2026-11-26). Backend doc: houndfe-backend docs/frontend-handoff/31-customers-module.md (its own numbering). Merged on backend local main (HEAD c974c8b7), served on dev :3003, migration 20261126110000_customers_listing_sales_index applied (additive indexes only). Commits: 3cfe56a6 contract · 6bd81dfa payments feed · 15476114 listing · 81a73364 isTrusted + sales-summary · f9792e3b filters + options · c974c8b7 handoff.

## Listing row (GET /customers/listing, contract v1 §2)
```json
{
  "id": "uuid",
  "firstName": "Ana",
  "lastName": "López",
  "businessName": null,
  "phoneCountryCode": "52",
  "phone": "5512345678",
  "email": "ana@example.com",
  "globalPriceList": { "id": "uuid", "name": "Mayoreo" },
  "rfc": "LOAA800101XXX",
  "fiscalRegime": "612",
  "preferredPaymentMethod": "transferencia",
  "isTrusted": false,
  "createdAt": "2026-03-02T17:04:11.000Z",
  "primaryAddress": { "id": "uuid", "neighborhood": "Del Valle", "municipality": "Benito Juárez", "city": "Ciudad de México", "state": "Ciudad de México", "zipCode": "03100" },
  "activePetsCount": 2,
  "petSpecies": ["DOG", "CAT"],
  "matchedPetName": null,
  "metrics": {
    "openDebtCents": 78500,
    "overdueDebtCents": 30000,
    "overdueCount": 1,
    "oldestOverdueDueDate": "2026-11-01",
    "salesCount": 14,
    "totalSoldCents": 1250000,
    "averageTicketCents": 89286,
    "lastPurchaseAt": "2026-11-20T19:31:02.000Z"
  }
}
```
Notas: la fila no trae la lista completa de direcciones, ni comments, ni la dirección de facturación (eso sale de GET /customers/:id). primaryAddress es la dirección más vieja, o null si no tiene. petSpecies son las especies distintas de las mascotas ACTIVE en orden DOG, CAT, OTHER ([] si no hay). matchedPetName es null si no hay search. Sin ventas: conteos y sumas en 0; oldestOverdueDueDate, lastPurchaseAt y averageTicketCents en null. La respuesta completa es {data:[fila], pagination, filterSummary:{count, openDebtCents, overdueDebtCents}}. Con un filtro de ubicación, la fila además trae matchedAddressId.

## Payments feed (GET /customers/:customerId/payments, contract v1)
```json
{
  "data": [
    { "kind": "collection", "eventId": "uuid-collection", "occurredAt": "2026-11-26T18:02:11.000Z",
      "amountCents": 90000, "tenderedCents": 90000, "changeDueCents": 0,
      "payments": [ { "method": "card_debit", "amountCents": 60000, "catalog": null }, { "method": "cash", "amountCents": 30000, "catalog": null } ],
      "sales": [ { "saleId": "uuid", "folio": "V-000123", "status": "CONFIRMED", "appliedCents": 30000 } ],
      "cashier": { "id": "uuid", "name": "María" },
      "receiptPath": "/collections/uuid-collection/pdf" },
    { "kind": "payment", "eventId": "uuid-payment", "occurredAt": "2026-11-20T19:31:02.000Z",
      "method": "cash", "catalog": null, "reference": null,
      "amountCents": 45000, "tenderedCents": 50000, "changeCents": 5000,
      "sale": { "id": "uuid", "folio": "V-000140", "status": "CONFIRMED", "totalCents": 45000 },
      "cashier": { "id": "uuid", "name": "Luis" },
      "receiptPath": "/sales/uuid/pdf" }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 37, "totalPages": 1 }
}
```
- En "collection": amountCents = lo aplicado a las ventas; tenderedCents y changeDueCents salen del cobro; `payments` usa el mismo formato que GET /collections/:id; sales[].status es el estado actual de cada venta.
- En "payment": amountCents = tendered − change (neto, misma regla que el estado de cuenta). method en minúsculas en los dos tipos (unificado en v1).
- receiptPath es relativo, y le agregás ?format=. Para collection: ticket|a4 (default ticket). Para sale: receipt-a4|receipt-ticket (default receipt-a4). Si la venta de un pago suelto ya no está CONFIRMED, viene null. El recibo de un cobro se sigue imprimiendo aunque después se haya cancelado una de sus ventas.
- Los pagos de ventas canceladas después se incluyen marcados con status CANCELED. Los reembolsos quedan fuera de v1: no lo presentes como un saldo.

## Handoff message (verbatim)
Rutas:
1. GET /customers/listing (read:Customer): paginado {data, pagination, filterSummary}, page 1, limit 50 (máx 100). Filas y métricas exactamente como la v1 §2. Ordena con sortBy/sortOrder por name, createdAt, openDebt, oldestOverdue, lastPurchaseAt, totalSold, salesCount y averageTicket. search incluye el nombre de mascota.
   Sin read:Sale: 200, pero la key metrics viene omitida y filterSummary trae solo {count}. Los 16 filtros de métricas y los 6 órdenes de métricas responden 400 LISTING_PARAM_REQUIRES_PERMISSION {field, details.required}.
2. Filtros: hasDebt, openDebtMin/Max, hasOverdue, overdueMoreThanDays (estricto), oldestOverdueFrom/To, totalSoldMin/Max, salesCountMin/Max, averageTicketMin/Max, lastPurchaseFrom/To, noPurchaseMoreThanDays (incluye a los que nunca compraron), createdFrom/To, petSpecies, petSize (misma mascota ACTIVE), activePetsMin/Max, hasPets, neighborhood, municipality, city, zipCode (multi; ver interpretación 1), deliveryZoneType, deliveryZoneNone, priceListId, priceListIncludeNull, isTrusted, hasRfc, fiscalRegime, hasEmail, hasPhone, hasChatbotRequests. preferredPaymentMethod NO es filtro (desconocido → 400). Con un filtro de ubicación, cada fila trae matchedAddressId.
   Errores: LISTING_INVALID_NUMBER (también para negativos o no enteros), LISTING_INVERTED_RANGE (field = nombre del rango, p. ej. openDebt), LISTING_INVALID_DATE, LISTING_INVALID_ENUM_VALUE, LISTING_TOO_MANY_VALUES, LISTING_INVALID_UUID y LISTING_PARAM_REQUIRES_PERMISSION. Los booleanos inválidos, los días fuera de 1–3650 y los params desconocidos dan el 400 estándar por campo. Si en el mismo request hay un error de listing y uno de validación, gana el body del de listing.
3. GET /customers/listing/options?field=neighborhood|municipality|city|zipCode|fiscalRegime&q=&limit= (default 50, máx 200), read:Customer. Devuelve valores distintos con su conteo de clientes, ordenados por conteo desc. fiscalRegime se limita al catálogo SAT.
4. PATCH /customers/:id acepta isTrusted: boolean estricto ("true", 1 y null → 400, y no se escribe nada); sigue con update:Customer. isTrusted también sale en GET /customers/:id y en las respuestas de PATCH y POST (en POST siempre false; mandarlo en POST da 400). GET /customers (el array del POS) NO cambia.
5. GET /customers/:customerId/sales-summary (read:Sale) → { customerId, metrics } con las mismas reglas que la fila del listado. Cliente desconocido o de otra sucursal → 404 {statusCode:404,error:"CUSTOMER_NOT_FOUND",message:"CUSTOMER_NOT_FOUND"}; id que no es UUID → 400; sin permiso → 403.
6. GET /customers/:customerId/payments?page=&limit= (read:Sale), con la misma forma que te pasé en la v1: eventos collection/payment, method en minúsculas en los dos tipos, montos netos de cambio y receiptPath relativo (?format=ticket|a4 para collection, receipt-a4|receipt-ticket para venta; null si la venta ya no está CONFIRMED). Incluye pagos de ventas canceladas, marcados. Sin reembolsos. Los errores 404, 400 y 403 son iguales a los de sales-summary.

Interpretaciones a tener en cuenta:
- Si mandás varios params de ubicación, se tienen que cumplir sobre UNA misma dirección (eso es lo que explica matchedAddressId).
- deliveryZoneType y deliveryZoneNone=true se combinan con OR («gratis o sin zona»).
- priceListIncludeNull=true solo lista los clientes sin lista de precios.

Verificación: suite completa 17581 ✓; integraciones de clientes y ventas 87 ✓. Verificador independiente PASS en T2 y T4, y review nativa APPROVED en T4.
