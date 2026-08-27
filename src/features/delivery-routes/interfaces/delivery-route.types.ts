import { z } from 'zod'

/**
 * delivery-route.types.ts — Zod schemas + inferred DTOs + label/tone maps.
 *
 * Locked contract (sdd delivery-routes, design.md §5.1, §5.3, §6.2):
 *   - `SaleDeliveryStatus` widens automatically in `sale.types.ts` via the
 *     derived type once `SHIPPED` is added to `SALE_DELIVERY_STATUS` (S1a).
 *   - Lat/lng on `DeliveryRouteShippingAddress` are OPTIONAL-nullish until the
 *     backend ships the Float? + DTO projection; `.nullish()` tolerates both
 *     omission and null.
 *   - 5-event timeline discriminated union per backend §4 (timeline sorted by
 *     `at` ASC, stops sorted by `sortOrder` ASC — never re-sorted client-side).
 *   - All request payloads are zod-strict whitelists so forbidden keys (id,
 *     tenantId, timeline, activeRouteId, startedAt, completedAt, cancelledAt,
 *     createdAt, updatedAt, status, stops, driver) can NEVER cross the wire
 *     even if a buggy caller forwards them. The backend additionally enforces
 *     this with `forbidNonWhitelisted` → 400; the client pre-validates first.
 *   - Label/tone maps are typed against the inferred `Record<...>` — no string
 *     widening at the call site.
 */

// ─── Primitives ─────────────────────────────────────────────────────────────────
const UuidSchema = z.string().uuid()

// ─── Actor (timeline event) ────────────────────────────────────────────────────
export const DeliveryRouteActorSchema = z.object({
  id: z.string(),
  name: z.string(),
})

// ─── Status enums (single source; TS types derived below) ─────────────────────
export const DeliveryRouteStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'])
export const DeliveryRouteStopStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'])

// ─── Shipping address (stop projection) ────────────────────────────────────────
// label is present in the delivery-route stop projection (backend §2). latitude/
// longitude are OPTIONAL-nullish until the backend ships the Float? + DTO
// projection for the S3 map; .nullish() tolerates both omission and null.
export const DeliveryRouteShippingAddressSchema = z.object({
  id: z.string(),
  street: z.string().nullable(),
  exteriorNumber: z.string().nullable(),
  interiorNumber: z.string().nullable(),
  zipCode: z.string().nullable(),
  neighborhood: z.string().nullable(),
  municipality: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  label: z.string().nullable(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
})

// ─── Stop ───────────────────────────────────────────────────────────────────────
export const DeliveryRouteStopSchema = z.object({
  id: z.string(),
  saleId: z.string(),
  saleFolio: z.string().nullable(),
  sortOrder: z.number(), // 0-based position
  status: DeliveryRouteStopStatusSchema,
  checkedInAt: z.string().nullable(), // ISO 8601
  completedAt: z.string().nullable(), // ISO 8601
  customer: z
    .object({ id: z.string(), name: z.string(), email: z.string().nullable() })
    .nullable(),
  shippingAddress: DeliveryRouteShippingAddressSchema.nullable(),
})

// ─── Timeline discriminated union (5 events, backend §4) ───────────────────────
// forbidNonWhitelisted guards against an extra `actor` field on ROUTE_CREATED
// (actor must be null there).
export const DeliveryRouteTimelineEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ROUTE_CREATED'), at: z.string(), actor: z.null() }),
  z.object({
    type: z.literal('ROUTE_STARTED'),
    at: z.string(),
    actor: DeliveryRouteActorSchema.nullable(),
  }),
  z.object({
    type: z.literal('STOP_CHECKED_IN'),
    at: z.string(),
    stopId: z.string(),
    sortOrder: z.number(),
    actor: DeliveryRouteActorSchema.nullable(),
  }),
  z.object({
    type: z.literal('ROUTE_COMPLETED'),
    at: z.string(),
    actor: DeliveryRouteActorSchema.nullable(),
  }),
  z.object({
    type: z.literal('ROUTE_CANCELLED'),
    at: z.string(),
    actor: DeliveryRouteActorSchema.nullable(),
  }),
])

// ─── Response DTO ───────────────────────────────────────────────────────────────
export const DeliveryRouteResponseSchema = z.object({
  id: z.string(),
  status: DeliveryRouteStatusSchema,
  driver: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  notes: z.string().nullable(), // ≤ 280, trimmed by backend
  stops: z.array(DeliveryRouteStopSchema), // sorted by sortOrder ASC
  timeline: z.array(DeliveryRouteTimelineEventSchema),
})

// ─── Request payloads (whitelisted; nothing else crosses the wire) ────────────
// forbidNonWhitelisted: NEVER id/tenantId/createdAt/updatedAt/timeline/activeRouteId.
// .strict() forbids unknown keys; combined with the explicit whitelist this is
// the client-side mirror of the backend `forbidNonWhitelisted` behavior.
export const CreateDeliveryRouteSchema = z
  .object({
    saleIds: z.array(UuidSchema).min(1, 'Selecciona al menos una venta'),
    driverUserId: UuidSchema,
    notes: z.string().trim().max(280, 'Máximo 280 caracteres').optional(),
  })
  .strict()

export const UpdateDeliveryRouteSchema = z
  .object({
    driverUserId: UuidSchema.optional(),
    // null clears the notes field (PATCH semantics).
    notes: z.string().trim().max(280, 'Máximo 280 caracteres').nullable().optional(),
  })
  .strict()

export const AppendDeliveryRouteStopSchema = z
  .object({
    saleId: UuidSchema,
  })
  .strict()

export const ReorderDeliveryRouteStopsSchema = z
  .object({
    orderedStopIds: z.array(UuidSchema).min(1, 'La ruta debe tener al menos una parada'),
  })
  .strict()

// ─── Inferred TS types ─────────────────────────────────────────────────────────
export type DeliveryRouteStatus = z.infer<typeof DeliveryRouteStatusSchema>
export type DeliveryRouteStopStatus = z.infer<typeof DeliveryRouteStopStatusSchema>
export type DeliveryRouteActor = z.infer<typeof DeliveryRouteActorSchema>
export type DeliveryRouteShippingAddress = z.infer<typeof DeliveryRouteShippingAddressSchema>
export type DeliveryRouteStop = z.infer<typeof DeliveryRouteStopSchema>
export type DeliveryRouteTimelineEvent = z.infer<typeof DeliveryRouteTimelineEventSchema>
export type DeliveryRouteResponseDto = z.infer<typeof DeliveryRouteResponseSchema>
export type CreateDeliveryRouteRequest = z.infer<typeof CreateDeliveryRouteSchema>
export type UpdateDeliveryRouteRequest = z.infer<typeof UpdateDeliveryRouteSchema>
export type AppendDeliveryRouteStopRequest = z.infer<typeof AppendDeliveryRouteStopSchema>
export type ReorderDeliveryRouteStopsRequest = z.infer<typeof ReorderDeliveryRouteStopsSchema>

// ─── Label / tone maps (single source for table cells + timeline) ─────────────
// Typed against the inferred Record<…> so adding a new status without a label
// is a compile-time error (no silent widening).
export const DELIVERY_ROUTE_STATUS_LABELS: Record<DeliveryRouteStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
}

export const DELIVERY_ROUTE_STATUS_TONES: Record<
  DeliveryRouteStatus,
  'success' | 'warning' | 'error' | 'neutral'
> = {
  DRAFT: 'neutral',
  ACTIVE: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
}

export const DELIVERY_ROUTE_STOP_STATUS_LABELS: Record<DeliveryRouteStopStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Entregada',
  SKIPPED: 'Omitida',
}