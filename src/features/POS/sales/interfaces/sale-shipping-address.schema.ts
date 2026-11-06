import { z } from 'zod'

/**
 * Sale shipping-address snapshot — the one shape every sale read returns (BE
 * docs/sale-shipping-snapshot-reads.md «Source status»): GET /sales rows, GET /sales/:id,
 * delivery-route stops and eligible sales.
 *
 * The address is the one captured at sale time; it is never replaced by the live customer
 * address. `sourceStatus` / `changedFields` say how the live address compares with it now.
 * Fields added after the first projection (visualReferences, carrierPhone, coordinates and the
 * status pair) are `.nullish()` so older payloads still parse.
 */
export const SaleAddressSourceStatusSchema = z.enum(['UNCHANGED', 'CHANGED', 'DELETED'])

export const SaleShippingAddressSnapshotSchema = z.object({
  // Source customer-address id; `null` once the customer deleted it (an optional reference,
  // never a missing-address signal).
  id: z.string().nullable(),
  street: z.string().nullable(),
  exteriorNumber: z.string().nullable(),
  interiorNumber: z.string().nullable(),
  zipCode: z.string().nullable(),
  neighborhood: z.string().nullable(),
  municipality: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  visualReferences: z.string().nullish(),
  carrierPhone: z.string().nullish(),
  label: z.string().nullable(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  sourceStatus: SaleAddressSourceStatusSchema.nullish(),
  changedFields: z.array(z.string()).nullish(),
})

export type SaleShippingAddressSnapshot = z.infer<typeof SaleShippingAddressSnapshotSchema>
