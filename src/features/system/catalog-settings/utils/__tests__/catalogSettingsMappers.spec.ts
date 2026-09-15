// catalogSettingsMappers.spec.ts — PURE mapper boundary tests (zero mocks).

import { describe, it, expect } from 'vitest'
import {
  parseCatalogSettingsResponse, fromCatalogSettingsResponse,
  toPatchCatalogSettingsBody, validateCatalogSettingsDraft,
  isCatalogSettingsDirty, isPublishRisingEdge,
  serializeStockPresentationDefault, mapCatalogSettingsWarning,
  mapCatalogSettingsError,
} from '../catalogSettingsMappers'
import type { CatalogSettingsDraft, CatalogSettingsResponseDto }
  from '../../interfaces/catalog-settings.types'

const D = (o: Partial<CatalogSettingsDraft> = {}): CatalogSettingsDraft => ({
  catalogPublished: true,
  publicPriceListIds: ['pl_a'],
  catalogDefaultPriceListId: 'pl_a',
  stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
  ...o,
})

const R = (o: Partial<CatalogSettingsResponseDto> = {}): CatalogSettingsResponseDto => ({
  catalogPublished: true, effectivePublication: true, priceContexts: [],
  stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
  warnings: [], updatedAt: '2026-01-01T00:00:00.000Z',
  ...o,
})

describe('parseCatalogSettingsResponse', () => {
  it.each([
    ['parses a complete response into the typed DTO',
      R({ priceContexts: [{ priceListId: 'pl_a', name: 'Retail', isCatalogDefault: true }] }),
      (o: CatalogSettingsResponseDto) => o.priceContexts[0]?.priceListId === 'pl_a'],
    ['drops unknown warning codes silently',
      R({ warnings: ['SOME_FUTURE_CODE'] }),
      (o: CatalogSettingsResponseDto) => o.warnings.length === 0],
    ['keeps DEFAULT_CONTEXT_HAS_NO_VALID_PRICES',
      R({ warnings: ['DEFAULT_CONTEXT_HAS_NO_VALID_PRICES'] }),
      (o: CatalogSettingsResponseDto) => o.warnings[0] === 'DEFAULT_CONTEXT_HAS_NO_VALID_PRICES'],
  ])('%s', (_n, input, check) => { check(parseCatalogSettingsResponse(input)) })
  it('throws on a malformed payload', () => {
    expect(() => parseCatalogSettingsResponse({ catalogPublished: true })).toThrow()
  })
})

describe('fromCatalogSettingsResponse', () => {
  it.each([
    ['derives publicPriceListIds in server order and picks isCatalogDefault',
      R({ priceContexts: [
        { priceListId: 'pl_a', name: 'Retail', isCatalogDefault: true },
        { priceListId: 'pl_b', name: 'Wholesale', isCatalogDefault: false },
      ]}),
      (d: CatalogSettingsDraft) =>
        d.publicPriceListIds[0] === 'pl_a' &&
        d.publicPriceListIds[1] === 'pl_b' &&
        d.catalogDefaultPriceListId === 'pl_a'],
    ['empty priceContexts ⇒ [] allowlist + null default',
      R({ priceContexts: [] }),
      (d: CatalogSettingsDraft) =>
        d.publicPriceListIds.length === 0 && d.catalogDefaultPriceListId === null],
    ['preserves catalogPublished=false and CUSTOM_QUANTITY 0',
      R({ catalogPublished: false, priceContexts: [],
         stockPresentationDefault: { mode: 'CUSTOM_QUANTITY', customQuantity: 0 } }),
      (d: CatalogSettingsDraft) =>
        d.catalogPublished === false &&
        d.stockPresentationDefault.mode === 'CUSTOM_QUANTITY' &&
        d.stockPresentationDefault.customQuantity === 0],
  ])('%s', (_n, input, check) => { check(fromCatalogSettingsResponse(input)) })
})

describe('toPatchCatalogSettingsBody', () => {
  it.each([
    ['sends only changed whitelisted keys (no response-only / tenantId)',
      D(),
      D({ stockPresentationDefault: { mode: 'HIDDEN', customQuantity: null } }),
      { stockPresentationDefault: { mode: 'HIDDEN', customQuantity: null } },
      ['effectivePublication', 'priceContexts', 'warnings', 'updatedAt', 'tenantId',
       'catalogPublished', 'publicPriceListIds', 'catalogDefaultPriceListId']],
    ['atomic clear: published + cleared last allowlist → false / [] / null triple',
      D({ catalogPublished: true, publicPriceListIds: ['pl_a'], catalogDefaultPriceListId: 'pl_a' }),
      D({ catalogPublished: true, publicPriceListIds: [], catalogDefaultPriceListId: null }),
      { catalogPublished: false, publicPriceListIds: [], catalogDefaultPriceListId: null }, []],
    ['ordinary unpublish (allowlist intact) → only {catalogPublished:false}',
      D({ catalogPublished: true, publicPriceListIds: ['pl_a', 'pl_b'], catalogDefaultPriceListId: 'pl_a' }),
      D({ catalogPublished: false, publicPriceListIds: ['pl_a', 'pl_b'], catalogDefaultPriceListId: 'pl_a' }),
      { catalogPublished: false }, ['publicPriceListIds', 'catalogDefaultPriceListId']],
    ['no changes ⇒ empty patch body', D(), D(), {}, []],
    ['CUSTOM_QUANTITY 0 preserved literally ("Mostrar 0")',
      D({ stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null } }),
      D({ stockPresentationDefault: { mode: 'CUSTOM_QUANTITY', customQuantity: 0 } }),
      { stockPresentationDefault: { mode: 'CUSTOM_QUANTITY', customQuantity: 0 } }, []],
    ['switching default emits only catalogDefaultPriceListId',
      D({ publicPriceListIds: ['pl_a', 'pl_b'], catalogDefaultPriceListId: 'pl_a' }),
      D({ publicPriceListIds: ['pl_a', 'pl_b'], catalogDefaultPriceListId: 'pl_b' }),
      { catalogDefaultPriceListId: 'pl_b' }, ['publicPriceListIds', 'catalogPublished']],
    ['atomic clear does NOT trigger when pristine allowlist was already empty',
      D({ catalogPublished: false, publicPriceListIds: [], catalogDefaultPriceListId: null }),
      D({ catalogPublished: false, publicPriceListIds: [], catalogDefaultPriceListId: null }),
      {}, []],
  ])('%s', (_n, pristine, draft, expected, forbidden) => {
    const out = toPatchCatalogSettingsBody(draft, pristine)
    expect(out).toEqual(expected)
    for (const k of forbidden) expect(Object.keys(out)).not.toContain(k)
  })
})

describe('validateCatalogSettingsDraft', () => {
  it.each([
    ['published + non-empty allowlist + default ⇒ valid', D(), 0],
    ['published + empty allowlist ⇒ blocks', D({ publicPriceListIds: [], catalogDefaultPriceListId: null }), 1],
    ['published + non-empty + no default ⇒ blocks', D({ publicPriceListIds: ['pl_a'], catalogDefaultPriceListId: null }), 1],
    ['unpublished + empty + null default ⇒ valid', D({ catalogPublished: false, publicPriceListIds: [], catalogDefaultPriceListId: null }), 0],
    ['default outside allowlist ⇒ blocks', D({ publicPriceListIds: ['pl_a'], catalogDefaultPriceListId: 'pl_ghost' }), 1],
    ['duplicate ids ⇒ blocks', D({ publicPriceListIds: ['pl_a', 'pl_a'], catalogDefaultPriceListId: 'pl_a' }), 1],
  ])('%s', (_n, draft, expectErrors) => {
    const errors = validateCatalogSettingsDraft(draft)
    if (expectErrors === 0) expect(errors).toEqual([])
    else expect(errors.length).toBeGreaterThan(0)
  })
})

describe('isCatalogSettingsDirty', () => {
  it.each([
    ['identical ⇒ not dirty', D(), D(), false],
    ['catalogPublished differs ⇒ dirty', D(), D({ catalogPublished: false }), true],
    ['stockPresentationDefault mode changes ⇒ dirty',
      D(), D({ stockPresentationDefault: { mode: 'HIDDEN', customQuantity: null } }), true],
  ])('%s', (_n, pristine, draft, expected) => {
    expect(isCatalogSettingsDirty(draft, pristine)).toBe(expected)
  })
})

describe('isPublishRisingEdge (REQ-10 gate)', () => {
  it.each([
    ['false → true ⇒ rising edge', false, true, true],
    ['true → false ⇒ declining edge', true, false, false],
    ['true → true ⇒ no change', true, true, false],
    ['false → false ⇒ no change', false, false, false],
  ])('%s', (_n, p, d, expected) => {
    expect(isPublishRisingEdge(D({ catalogPublished: p }), D({ catalogPublished: d }))).toBe(expected)
  })
})

describe('serializeStockPresentationDefault', () => {
  it.each([
    ['CUSTOM_QUANTITY 0 preserved ("Mostrar 0")',
      { mode: 'CUSTOM_QUANTITY' as const, customQuantity: 0 },
      { mode: 'CUSTOM_QUANTITY' as const, customQuantity: 0 }],
    ['CUSTOM_QUANTITY positive preserved',
      { mode: 'CUSTOM_QUANTITY' as const, customQuantity: 7 },
      { mode: 'CUSTOM_QUANTITY' as const, customQuantity: 7 }],
    ['SYSTEM_STATUS forces null quantity',
      { mode: 'SYSTEM_STATUS' as const, customQuantity: 5 },
      { mode: 'SYSTEM_STATUS' as const, customQuantity: null }],
    ['ABSTRACT_STATUS forces null quantity',
      { mode: 'ABSTRACT_STATUS' as const, customQuantity: 5 },
      { mode: 'ABSTRACT_STATUS' as const, customQuantity: null }],
    ['HIDDEN forces null quantity',
      { mode: 'HIDDEN' as const, customQuantity: 5 },
      { mode: 'HIDDEN' as const, customQuantity: null }],
  ])('%s', (_n, input, expected) => {
    expect(serializeStockPresentationDefault(input)).toEqual(expected)
  })
})

describe('mapCatalogSettingsWarning', () => {
  it.each([
    ['DEFAULT_CONTEXT_HAS_NO_VALID_PRICES ⇒ Spanish copy',
      'DEFAULT_CONTEXT_HAS_NO_VALID_PRICES',
      'El contexto de catálogo por defecto no tiene precios válidos'],
    ['unknown code ⇒ null (dropped silently)', 'SOME_FUTURE_CODE', null],
    ['empty code ⇒ null', '', null],
  ])('%s', (_n, code, expected) => {
    expect(mapCatalogSettingsWarning(code)).toBe(expected)
  })
})

describe('mapCatalogSettingsError', () => {
  it.each([
    ['TENANT_NOT_ACTIVE ⇒ catalogPublished + Spanish toast',
      { code: 'TENANT_NOT_ACTIVE' }, 'catalogPublished', 'no está activo'],
    ['status 403 ⇒ permission denied', { status: 403 }, undefined, 'permisos'],
    ['unknown code + status 500 ⇒ generic Spanish toast',
      { code: 'UNKNOWN', status: 500 }, undefined, 'No se pudo guardar'],
    ['null input ⇒ generic Spanish toast', null, undefined, 'No se pudo guardar'],
  ])('%s', (_n, input, expectedField, toastIncludes) => {
    const out = mapCatalogSettingsError(input)
    expect(out.field).toBe(expectedField)
    expect(out.toast).toContain(toastIncludes)
  })
})
