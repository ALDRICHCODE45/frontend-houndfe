// catalogSettingsMappers.ts — PURE helpers. Hides GET ↔ PATCH asymmetry.

import {
  catalogSettingsResponseDtoSchema,
  catalogSettingsWarningSchema,
  type CatalogSettingsDraft,
  type CatalogSettingsPatchBody,
  type CatalogSettingsResponseDto,
  type CatalogStockPresentationDefaultDto,
} from '../interfaces/catalog-settings.types'

type SettingsField = keyof CatalogSettingsDraft | 'stockPresentationDefault'

const WARNING_COPY: Record<string, string> = {
  DEFAULT_CONTEXT_HAS_NO_VALID_PRICES:
    'El contexto de catálogo por defecto no tiene precios válidos',
}

const ERROR_COPY: Record<string, { field?: SettingsField; toast: string }> = {
  TENANT_NOT_ACTIVE: {
    field: 'catalogPublished',
    toast: 'El tenant no está activo; no se puede publicar el catálogo',
  },
  DEFAULT_OUT_OF_MEMBERSHIP: {
    field: 'catalogDefaultPriceListId',
    toast: 'La lista predeterminada debe estar entre las listas de precios públicas',
  },
  ALREADY_PUBLISHED: { toast: 'El catálogo ya está publicado' },
}

/** Closed-set error mapper: server code / HTTP status → Spanish toast (+ optional field). */
export function mapCatalogSettingsError(
  input: { code?: string; status?: number; message?: string } | null | undefined,
): { field?: SettingsField; toast: string } {
  if (input?.code) {
    const codeCopy = ERROR_COPY[input.code]
    if (codeCopy) return codeCopy
  }
  if (input?.status === 403) return { toast: 'No tienes permisos para guardar cambios' }
  if (input?.status === 401) return { toast: 'Tu sesión ha expirado' }
  if (input?.status === 400 && input.message) return { toast: input.message }
  return { toast: 'No se pudo guardar la configuración de catálogo' }
}

/** Parse raw GET / PATCH response; drop unknown warning codes; throw on malformed payload. */
export function parseCatalogSettingsResponse(raw: unknown): CatalogSettingsResponseDto {
  const parsed = catalogSettingsResponseDtoSchema.parse(raw)
  return {
    ...parsed,
    warnings: parsed.warnings.filter((c) => catalogSettingsWarningSchema.safeParse(c).success),
  }
}

/** Derive draft: publicPriceListIds from priceContexts[].priceListId in server order; default from isCatalogDefault. */
export function fromCatalogSettingsResponse(
  response: CatalogSettingsResponseDto,
): CatalogSettingsDraft {
  const def = response.priceContexts.find((c) => c.isCatalogDefault)
  return {
    catalogPublished: response.catalogPublished,
    publicPriceListIds: response.priceContexts.map((c) => c.priceListId),
    catalogDefaultPriceListId: def ? def.priceListId : null,
    stockPresentationDefault: { ...response.stockPresentationDefault },
  }
}

/** Validate editable draft. Publishing requires non-empty allowlist + selected default. */
export function validateCatalogSettingsDraft(draft: CatalogSettingsDraft): string[] {
  const errors: string[] = []
  const unique = new Set(draft.publicPriceListIds)
  if (unique.size !== draft.publicPriceListIds.length) {
    errors.push('La lista de precios públicas no puede tener duplicados')
  }
  if (
    draft.catalogDefaultPriceListId !== null &&
    !draft.publicPriceListIds.includes(draft.catalogDefaultPriceListId)
  ) {
    errors.push('La lista predeterminada debe pertenecer a la lista de precios públicas')
  }
  if (draft.catalogPublished) {
    if (draft.publicPriceListIds.length === 0) {
      errors.push('Publicar el catálogo requiere al menos una lista de precios pública')
    }
    if (draft.catalogDefaultPriceListId === null) {
      errors.push('Publicar el catálogo requiere una lista de precios predeterminada')
    }
  }
  return errors
}

/** Build PATCH body (draft vs pristine): whitelisted keys only. Atomic clear (REQ-9). */
export function toPatchCatalogSettingsBody(
  draft: CatalogSettingsDraft,
  pristine: CatalogSettingsDraft,
): CatalogSettingsPatchBody {
  const clearsLastPriceContext =
    pristine.catalogPublished === true &&
    draft.publicPriceListIds.length === 0 &&
    pristine.publicPriceListIds.length > 0
  const body: CatalogSettingsPatchBody = clearsLastPriceContext
    ? { catalogPublished: false, publicPriceListIds: [], catalogDefaultPriceListId: null }
    : {}
  if (!clearsLastPriceContext) {
    if (draft.catalogPublished !== pristine.catalogPublished) {
      body.catalogPublished = draft.catalogPublished
    }
    if (!sameArr(draft.publicPriceListIds, pristine.publicPriceListIds)) {
      body.publicPriceListIds = [...draft.publicPriceListIds]
    }
    if (draft.catalogDefaultPriceListId !== pristine.catalogDefaultPriceListId) {
      body.catalogDefaultPriceListId = draft.catalogDefaultPriceListId
    }
  }
  if (!sameStock(draft.stockPresentationDefault, pristine.stockPresentationDefault)) {
    body.stockPresentationDefault = serializeStockPresentationDefault(
      draft.stockPresentationDefault,
    )
  }
  return body
}

/** Snapshot diff over the whitelisted key set. */
export function isCatalogSettingsDirty(
  current: CatalogSettingsDraft,
  pristine: CatalogSettingsDraft,
): boolean {
  return (
    current.catalogPublished !== pristine.catalogPublished ||
    !sameArr(current.publicPriceListIds, pristine.publicPriceListIds) ||
    current.catalogDefaultPriceListId !== pristine.catalogDefaultPriceListId ||
    !sameStock(current.stockPresentationDefault, pristine.stockPresentationDefault)
  )
}

/** Rising-edge detector (false → true) for REQ-10's confirmation modal. */
export function isPublishRisingEdge(
  pristine: CatalogSettingsDraft,
  draft: CatalogSettingsDraft,
): boolean {
  return pristine.catalogPublished === false && draft.catalogPublished === true
}

/** CUSTOM_QUANTITY keeps the integer (0 preserved literally); others force null. */
export function serializeStockPresentationDefault(
  value: CatalogStockPresentationDefaultDto,
): CatalogStockPresentationDefaultDto {
  if (value.mode === 'CUSTOM_QUANTITY') {
    return { mode: 'CUSTOM_QUANTITY', customQuantity: value.customQuantity ?? 0 }
  }
  return { mode: value.mode, customQuantity: null }
}

/** Closed-set warning map. Unknown codes return null (dropped silently). */
export function mapCatalogSettingsWarning(code: string): string | null {
  return WARNING_COPY[code] ?? null
}

function sameArr(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function sameStock(
  a: CatalogStockPresentationDefaultDto,
  b: CatalogStockPresentationDefaultDto,
): boolean {
  return a.mode === b.mode && a.customQuantity === b.customQuantity
}
