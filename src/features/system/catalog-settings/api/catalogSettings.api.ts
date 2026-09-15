// catalogSettings.api.ts — HTTP client for /tenants/:tenantId/catalog-settings.
//
// Two endpoints: GET and PATCH. The PATCH body MUST be built by the WU2B
// mapper (`toPatchCatalogSettingsBody`) — the backend DTO uses
// `forbidNonWhitelisted`, so any extra key would be rejected with 400.
//
// The API boundary (a) parses GET/PATCH responses with the Zod response schema
// so unknown fields are stripped and invalid payloads throw, and (b) parses
// the PATCH body through the Zod patch schema so the body that reaches
// http.patch contains ONLY the four documented whitelisted keys
// (`catalogPublished`, `publicPriceListIds`, `catalogDefaultPriceListId`,
// `stockPresentationDefault`). Zod's default object behavior strips unknown
// fields, so this catches every forged arbitrary key — not only the previously
// known response-only keys — even when callers bypass the TypeScript type with
// `as unknown as CatalogSettingsPatchBody`.

import { http } from '@/core/shared/api/http'
import {
  catalogSettingsPatchBodySchema,
  catalogSettingsResponseDtoSchema,
} from '../interfaces/catalog-settings.types'
import type {
  CatalogSettingsPatchBody,
  CatalogSettingsResponseDto,
} from '../interfaces/catalog-settings.types'

/** GET /tenants/:tenantId/catalog-settings. No 404-as-default fallback. */
async function get(tenantId: string): Promise<CatalogSettingsResponseDto> {
  const { data } = await http.get(`/tenants/${tenantId}/catalog-settings`)
  return catalogSettingsResponseDtoSchema.parse(data)
}

/**
 * PATCH /tenants/:tenantId/catalog-settings with a true runtime whitelist.
 *
 * The body is parsed through `catalogSettingsPatchBodySchema`. Zod's default
 * object behavior strips unknown fields, so the resulting object can contain
 * ONLY the four documented whitelisted keys (`catalogPublished`,
 * `publicPriceListIds`, `catalogDefaultPriceListId`,
 * `stockPresentationDefault`). A caller who bypasses the TypeScript type with
 * `as unknown as CatalogSettingsPatchBody` still cannot smuggle any other key
 * — including arbitrary forged keys the API boundary has never seen.
 */
async function patch(
  tenantId: string,
  body: CatalogSettingsPatchBody,
): Promise<CatalogSettingsResponseDto> {
  const whitelisted = catalogSettingsPatchBodySchema.parse(body)
  const { data } = await http.patch(`/tenants/${tenantId}/catalog-settings`, whitelisted)
  return catalogSettingsResponseDtoSchema.parse(data)
}

export const catalogSettingsApi = { get, patch }