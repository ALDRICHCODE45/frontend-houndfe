# Backend Request — Additive Fields for the Delivery-Route Driver Cockpit

The approved driver cockpit redesign needs a handful of **additive, optional fields** on the existing delivery-route detail response (`GET /delivery-routes/:id`). Nothing in this request requires changing existing field shapes, enum values, request payloads, or the existing delivery action; every proposed field is nullable or may be omitted while unavailable so the frontend can ship safely before, alongside, or after the backend work.

Frontend contract references: `src/features/delivery-routes/interfaces/delivery-route.types.ts`, `src/features/delivery-routes/api/delivery-routes.api.ts`, and `openspec/specs/delivery-route-check-in/spec.md`. The API currently returns typed Axios data without invoking the Zod response schema at runtime.

## Quick path

1. Backend reviews the field table (§2) and marks each row **accept / defer / counter-propose**.
2. Backend confirms the existing delivery semantics and whether `SKIPPED` needs a public transition (§4).
3. Backend ships accepted additive fields; the frontend will use `.nullish()` for partial-rollout compatibility (§6).
4. Backend verifies the acceptance checklist (§7).

---

## 1. What the frontend already has (existing contract)

For reference — these fields exist today and the cockpit already consumes them. **No change requested.**

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Route id |
| `status` | `'DRAFT' \| 'ACTIVE' \| 'COMPLETED' \| 'CANCELLED'` | Route status |
| `driver` | `{ id, name, email } \| null` | Assigned driver |
| `startedAt` / `completedAt` / `cancelledAt` | `string \| null` (ISO 8601) | Route lifecycle timestamps |
| `notes` | `string \| null` | Route-level note (≤ 280 chars, backend-trimmed) |
| `stops[]` | array, sorted by `sortOrder` ASC | Never re-sorted client-side |
| `stops[].id`, `saleId`, `saleFolio` | `string`, `string`, `string \| null` | Sale linkage |
| `stops[].sortOrder` | `number` | 0-based position |
| `stops[].status` | `'PENDING' \| 'IN_PROGRESS' \| 'COMPLETED' \| 'SKIPPED'` | Stop status |
| `stops[].checkedInAt` / `completedAt` | `string \| null` (ISO 8601) | Stop lifecycle timestamps |
| `stops[].customer` | `{ id, name, email \| null } \| null` | Customer projection |
| `stops[].shippingAddress` | full address projection, `label` included; `latitude`/`longitude` optional-nullish | Stop location |
| `timeline[]` | 5-event discriminated union (`ROUTE_CREATED`, `ROUTE_STARTED`, `STOP_CHECKED_IN`, `ROUTE_COMPLETED`, `ROUTE_CANCELLED`), each with `at` and nullable `actor`, sorted by `at` ASC | Activity history |

## 2. Requested additions — field by field

All fields are **additive** on `GET /delivery-routes/:id` (the route detail response). The frontend will tolerate both omission (`undefined`) and explicit `null` for every new field. Suggested names are proposals; the backend may rename as long as semantics match and the frontend is told the final names.

| # | Proposed field | Where | Type & nullability | Semantics | Source of truth (backend-owned) | Cockpit use |
|---|---|---|---|---|---|---|
| 1 | `scheduledDate` | route | `string \| null` — ISO 8601 **date** (`YYYY-MM-DD`) or full ISO datetime | The calendar day the route is planned for. `null` when unscheduled. | Backend (route scheduling data) | Header: "Fecha programada" |
| 2 | `label` | route | `string \| null` | Optional human route/area name (e.g. "Zona Norte — Ruta 7"). `null` when unnamed. | Backend (route name/area) | Header title fallback; distinguish routes on the same day |
| 3 | `plannedArrivalAt` | stop | `string \| null` — ISO 8601 datetime | Planned arrival time for the stop in its sequence. `null` when no schedule was computed. If the backend only models a relative slot, see alternative in §3.2. | Backend (planning) | Stop panel: planned time / ETA |
| 4 | `estimatedDurationMinutes` | route | `number \| null` | Total planned driving + service time in whole minutes. `null` when not computed. | Backend (routing engine or planning data) | Header: "~2 h 15 min" |
| 5 | `estimatedDistanceKm` | route | `number \| null` | Planned distance in **kilometres**, one decimal allowed. `null` when not computed. | Backend (routing engine) | Header: "≈ 34.5 km" |
| 6 | `packageCount` | stop | `number \| null` | Physical packages to deliver at this stop. `null` when unknown/not tracked. **Must count packages, not sales or line items** (§3.3). | Backend (sale → package projection) | Stop panel: "3 paquetes" |
| 7 | `totalPackages` | route | `number \| null` | Sum of packages across all stops of the route. `null` when unknown. Must equal Σ `stops[].packageCount` when both are non-null. | Backend | Header: "12 paquetes · 5 paradas" |
| 8 | `deliveryInstructions` | stop | `string \| null` | Free-text instructions specific to this stop (gate code, "dejar con vigilante", etc.). Independent of route-level `notes`. Recommend same ≤ 280 trimmed convention as `notes`. | Backend (sale delivery note) | Stop panel instruction banner |
| 9 | `phone` | `stops[].customer` | `string \| null` | Customer contact phone. `null` when the customer has none. Presence (`null` vs missing) drives whether the call/WhatsApp quick action renders. | Backend (customer record) | Quick action: call customer |
| 10 | `progress` | route | object, see §3.1 | Authoritative progress counters so the cockpit does not have to infer business semantics from statuses. | Backend (server-derived on read) | Header progress bar + counts |
| 11 | `updatedAt` | route | `string \| null` - ISO 8601 | Last time any part of this route (status, stops, notes, assignment) changed. `null` only when unavailable. | Backend (DB `updatedAt`) | “Last updated 2 min ago” in the history drawer |
| 12 | `ROUTE_ASSIGNED` timeline event | `timeline[]` | new union member, see §3.5 | Emitted when the route's driver is assigned, reassigned, or removed, with `actor` and `at`. | Backend (event store) | History drawer entry |

### 3.1 Progress object (field 10) — authoritative semantics

Today `useDriverRouteCockpit` derives `progress = { completed, total }` from `stops[].status` on the client. For the redesigned cockpit the backend should own the numbers so they stay consistent with the timeline and can later include server-side states the client cannot see. Proposed shape:

```json
"progress": {
  "delivered": 3,
  "skipped": 1,
  "resolved": 4,
  "total": 6,
  "deliveredPercent": 50,
  "resolvedPercent": 67
}
```

| Key | Type | Semantics |
|---|---|---|
| `delivered` | `number` | Stops with status `COMPLETED` (= "Entregada" in the UI). |
| `skipped` | `number` | Stops with status `SKIPPED`. |
| `resolved` | `number` | `delivered + skipped` — stops that require no further driver action. |
| `total` | `number` | `stops.length` - every stop currently attached to the route, regardless of status. |
| `deliveredPercent` | `number` | `total === 0 ? 0 : round(delivered / total * 100)`, integer 0-100. This powers the UI's delivery progress. |
| `resolvedPercent` | `number` | `total === 0 ? 0 : round(resolved / total * 100)`, integer 0-100. This indicates route resolution when skipped stops exist. |

Rules: all six keys always appear together once `progress` exists; percentages never exceed 100; both percentages are `0` for an empty route. The frontend will keep a client-side fallback while `progress` is absent, so this field is safe to ship last.

### 3.2 Planned time alternative

If the backend cannot compute a per-stop datetime, a relative pair is acceptable instead (frontend will render "≈ 10 min" after the previous stop): `plannedServiceMinutes` (`number | null`) per stop, or a single route-level `plannedStartAt` plus per-stop offsets. Pick one model; do not ship both.

### 3.3 Counting discipline (do not conflate)

The cockpit shows three different magnitudes that must never be merged:

- **Stops** = `stops[].length` — delivery points.
- **Sales** = number of linked sales (each stop links to exactly one `saleId` today, so stops ≈ sales; keep them distinct fields anyway).
- **Items** = sale line items (products) — not requested here.
- **Packages** = physical parcels handed to the driver (fields 6–7) — this is what the cockpit labels "paquetes".

If one sale can later produce multiple packages or multiple stops, the backend must keep `packageCount` as the package total, independent of stop and item counts.

### 3.4 Existing delivery action semantics

The existing cockpit already uses `POST /delivery-routes/:id/stops/:stopId/check-in` as its **"Marcar entregada"** action. The established frontend contract expects an eligible `PENDING` stop to return as `COMPLETED` with `completedAt` set, emit `STOP_CHECKED_IN`, increment delivered progress, and possibly complete the route after the final delivery. This redesign preserves that endpoint, copy, confirmation flow, and exactly-once mutation behavior.

The endpoint name and event name are legacy terminology. The frontend does not need a second `complete` endpoint for this redesign. Backend should only confirm that deployed behavior still matches the established contract. `IN_PROGRESS` remains a readable status in the DTO, but this request does not invent a new transition for it.

`SKIPPED` exists in `DeliveryRouteStopStatusSchema` but no frontend endpoint currently transitions to it. That path is optional and does not block this redesign.

### 3.5 Timeline additions

One new discriminated-union member is requested:

```ts
{
  type: 'ROUTE_ASSIGNED',            // final name may follow backend conventions
  at: string,                        // ISO 8601
  actor: { id, name } | null,        // who performed the assignment; null for system
  driver: { id, name } | null        // driver assigned (null when unassigned)
}
```

Ordering rules are unchanged: the timeline stays sorted by `at` ASC and the frontend never re-sorts. If the backend already stores assignment events, exposing them through the union is enough; no new event types beyond assignment are requested.

---

## 4. Confirmations needed from backend/product

| # | Confirmation | Frontend behavior |
|---|---|---|
| C1 | Confirm that `POST /delivery-routes/:id/stops/:stopId/check-in` still performs the established delivery transition: eligible `PENDING` stop to `COMPLETED`, sets `completedAt`, emits `STOP_CHECKED_IN`, and may complete the route after the final delivery. | Preserve the current endpoint and the UI label "Marcar entregada". No new completion endpoint is required. |
| C2 | Confirm whether drivers need to mark a stop `SKIPPED`. If yes, document the endpoint, required reason, allowed source statuses, timeline event, and route-completion semantics. | Hide skip affordances until an explicit contract exists. This does not block the redesign. |

## 5. Example response fragment (target state)

Additive fields marked with `// NEW`. Everything else is the current contract, unchanged.

```json
{
  "id": "uuid",
  "status": "ACTIVE",
  "scheduledDate": "2026-09-02",                    // NEW
  "label": "Zona Norte — Ruta 7",                   // NEW
  "estimatedDurationMinutes": 135,                  // NEW
  "estimatedDistanceKm": 34.5,                      // NEW
  "totalPackages": 12,                              // NEW
  "progress": { "delivered": 3, "skipped": 1, "resolved": 4, "total": 6, "deliveredPercent": 50, "resolvedPercent": 67 }, // NEW
  "updatedAt": "2026-09-02T15:42:10.000Z",          // NEW
  "driver": { "id": "uuid", "name": "María López", "email": "maria@example.com" },
  "startedAt": "2026-09-02T09:00:00.000Z",
  "completedAt": null,
  "cancelledAt": null,
  "notes": "Cobrar contraentrega en la última parada",
  "stops": [
    {
      "id": "uuid",
      "saleId": "uuid",
      "saleFolio": "A-202609-000012",
      "sortOrder": 3,
      "status": "IN_PROGRESS",
      "checkedInAt": "2026-09-02T11:20:00.000Z",
      "completedAt": null,
      "plannedArrivalAt": "2026-09-02T11:10:00.000Z",   // NEW
      "packageCount": 3,                                 // NEW
      "deliveryInstructions": "Portón gris, tocar el timbre 2", // NEW
      "customer": {
        "id": "uuid",
        "name": "Bodega El Progreso",
        "email": null,
        "phone": "+52 55 1234 5678"                      // NEW
      },
      "shippingAddress": { "id": "uuid", "street": "Av. Reforma 120", "label": "Sucursal", "latitude": 19.43, "longitude": -99.13 }
    }
  ],
  "timeline": [
    { "type": "ROUTE_CREATED", "at": "2026-09-01T18:00:00.000Z", "actor": null },
    { "type": "ROUTE_ASSIGNED", "at": "2026-09-01T18:05:00.000Z", "actor": { "id": "uuid", "name": "Ana Rey" }, "driver": { "id": "uuid", "name": "María López" } }, // NEW
    { "type": "ROUTE_STARTED", "at": "2026-09-02T09:00:00.000Z", "actor": { "id": "uuid", "name": "María López" } },
    { "type": "STOP_CHECKED_IN", "at": "2026-09-02T11:20:00.000Z", "stopId": "uuid", "sortOrder": 3, "actor": { "id": "uuid", "name": "María López" } }
  ]
}
```

## 6. Backwards compatibility & rollout

- **All new response fields are optional on the wire.** The frontend schema will validate them with `.nullish()` (tolerates both omission and `null`), matching the existing pattern used for `latitude`/`longitude`. The backend may ship fields one at a time, in any order, without breaking the frontend.
- **No existing field changes shape.** No enum value is renamed or removed. `notes` stays route-level; `deliveryInstructions` is a separate per-stop field.
- **No request payload changes.** `CreateDeliveryRouteSchema`, `UpdateDeliveryRouteSchema`, `AppendDeliveryRouteStopSchema`, and `ReorderDeliveryRouteStopsSchema` stay strict and unchanged. The existing `check-in` request remains unchanged. A skip endpoint is optional and only needed if C2 is accepted.
- **Client-side fallbacks while fields are absent:** progress derived from `stops[].status`; package counts, phone actions, ETA, duration/distance, and scheduled-date chips hidden; timeline renders only known event types. The current discriminated union does **not** tolerate unknown event types, so the backend must not emit `ROUTE_ASSIGNED` before the frontend schema update lands. Coordinate that rollout or let the frontend schema land first.
- **Suggested rollout order:** (1) `scheduledDate`, `label`, `phone`, `deliveryInstructions`, `packageCount`, `totalPackages` (pure projections); (2) `progress` and `updatedAt`; (3) the coordinated timeline event; (4) an optional skip endpoint if C2 is accepted.

## 7. Backend acceptance checklist

- [ ] `GET /delivery-routes/:id` returns all accepted §2 fields; every accepted field is nullable or may be omitted, and no existing field changed shape.
- [ ] `scheduledDate` is a date (or ISO datetime) for the planned route day; `null` when unscheduled.
- [ ] `plannedArrivalAt` (or the §3.2 alternative) is a real per-stop schedule value, not the current server time.
- [ ] `estimatedDurationMinutes` is integer minutes; `estimatedDistanceKm` is kilometres (decimal allowed); both `null` when uncomputed.
- [ ] `packageCount` counts **packages**, not sales or line items; `totalPackages` equals Σ `packageCount` when both present.
- [ ] `deliveryInstructions` is per-stop and independent of route `notes`; length/trims follow the `notes` convention.
- [ ] `stops[].customer.phone` is present and `null` (not omitted) when the customer has no phone.
- [ ] `progress` keys are always co-present; `resolved === delivered + skipped`; `total === stops.length`; both percentages are integers from 0-100 and `0` for an empty route.
- [ ] `updatedAt` reflects the last mutation of any route part, in ISO 8601 UTC.
- [ ] New timeline event(s) include `at` (ISO 8601), nullable `actor`, and remain ASC-ordered in `timeline[]` without breaking the 5 existing event types.
- [ ] C1 confirmed: the deployed `check-in` endpoint preserves the established PENDING-to-COMPLETED delivery semantics and `completedAt` behavior.
- [ ] C2 answered: skip transition contract, or explicit confirmation that it remains unavailable and hidden.
- [ ] Existing clients are unaffected: a consumer pinned to the old schema still parses responses after every rollout step.

## Next step

Backend marks each §2 row and answers C1/C2. The frontend can ship the current-data redesign immediately, then add each accepted optional field behind availability checks.
