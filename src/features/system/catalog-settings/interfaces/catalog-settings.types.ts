// catalog-settings.types.ts — DTOs and Zod schemas for
// /tenants/:tenantId/catalog-settings.
//
// The Zod schemas are the single source of truth for both the response DTO and
// the PATCH body. The response schema is `.strict()`-shaped so any future
// additive server field that the front has not yet been updated for is parsed
// by the WU2B mappers; the client never enforces structural parsing here for
// unknown keys (a closed-set warning filter lives in the mapper layer).
//
// PATCH body keys are an explicit whitelist: the backend DTO uses
// `forbidNonWhitelisted`, so any extra key (tenantId / effectivePublication /
// priceContexts / warnings / updatedAt) is rejected with 400. The TypeScript
// type mirrors that whitelist.

import { z } from 'zod'

/** Backend-closed stock presentation modes for the tenant default. */
export type OnlineStockPresentationMode =
  | 'SYSTEM_STATUS'
  | 'ABSTRACT_STATUS'
  | 'CUSTOM_QUANTITY'
  | 'HIDDEN'

/** Variant publication mode — typed here for symmetry, body/UI land in WU6. */
export type CatalogPublishMode = 'INHERIT' | 'ON' | 'OFF'

/** Closed-set warning codes the backend may emit. */
export type CatalogSettingsWarning = 'DEFAULT_CONTEXT_HAS_NO_VALID_PRICES'

export const onlineStockPresentationModeSchema = z.enum([
  'SYSTEM_STATUS',
  'ABSTRACT_STATUS',
  'CUSTOM_QUANTITY',
  'HIDDEN',
])

export const catalogSettingsWarningSchema = z.enum(['DEFAULT_CONTEXT_HAS_NO_VALID_PRICES'])

export const catalogPriceContextDtoSchema = z.object({
  priceListId: z.string().min(1),
  name: z.string(),
  isCatalogDefault: z.boolean(),
})

export const catalogStockPresentationDefaultDtoSchema = z.object({
  mode: onlineStockPresentationModeSchema,
  customQuantity: z.number().int().nonnegative().nullable(),
})

export const catalogSettingsResponseDtoSchema = z.object({
  catalogPublished: z.boolean(),
  effectivePublication: z.boolean(),
  priceContexts: z.array(catalogPriceContextDtoSchema),
  stockPresentationDefault: catalogStockPresentationDefaultDtoSchema,
  warnings: z.array(z.string()),
  updatedAt: z.string(),
})

export const catalogSettingsPatchBodySchema = z.object({
  catalogPublished: z.boolean().optional(),
  publicPriceListIds: z.array(z.string().min(1)).optional(),
  catalogDefaultPriceListId: z.string().min(1).nullable().optional(),
  stockPresentationDefault: catalogStockPresentationDefaultDtoSchema.optional(),
})

export type CatalogPriceContextDto = z.infer<typeof catalogPriceContextDtoSchema>
export type CatalogStockPresentationDefaultDto = z.infer<
  typeof catalogStockPresentationDefaultDtoSchema
>
export type CatalogSettingsResponseDto = z.infer<typeof catalogSettingsResponseDtoSchema>
export type CatalogSettingsPatchBody = z.infer<typeof catalogSettingsPatchBodySchema>

/**
 * Editable form snapshot. Derived from the response by
 * `fromCatalogSettingsResponse` in the WU2B mappers. WU2A only ships the
 * shape so PATCH consumers can speak the body type explicitly.
 */
export interface CatalogSettingsDraft {
  catalogPublished: boolean
  publicPriceListIds: string[]
  catalogDefaultPriceListId: string | null
  stockPresentationDefault: CatalogStockPresentationDefaultDto
}
