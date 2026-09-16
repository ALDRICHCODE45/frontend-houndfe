// catalogSettings.api.spec.ts — RED-first transport contract for
// GET / PATCH /tenants/:tenantId/catalog-settings (REQ-5 / REQ-7 / REQ-18).
//
// Pins (a) the exact URL + tenant path, (b) the minimum runtime body
// whitelist (forged response-only keys stripped before http.patch), and
// (c) Zod response parse at the API boundary (unknown fields stripped,
// invalid payloads throw). The mapper layer (WU2B) owns the whitelisted
// body shape; this test only pins the transport.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http } from '@/core/shared/api/http'
import { catalogSettingsApi } from '../catalogSettings.api'
import type {
  CatalogSettingsPatchBody,
  CatalogSettingsResponseDto,
} from '../../interfaces/catalog-settings.types'

vi.mock('@/core/shared/api/http', () => ({
  http: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

const sampleResponse: CatalogSettingsResponseDto = {
  catalogPublished: true,
  effectivePublication: true,
  priceContexts: [{ priceListId: 'pl_a', name: 'Retail', isCatalogDefault: true }],
  stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
  warnings: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('catalogSettingsApi.get (sdd online-catalog-backoffice WU2A)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls GET /tenants/:tenantId/catalog-settings with the tenant id in the path', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: sampleResponse })

    await catalogSettingsApi.get('tenant-1')

    expect(http.get).toHaveBeenCalledTimes(1)
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/catalog-settings')
  })

  it('returns the parsed response (Zod strips unknown fields, throws on invalid)', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: sampleResponse })

    const result = await catalogSettingsApi.get('tenant-1')

    expect(result).toEqual(sampleResponse)
  })

  it('encodes different tenant ids as different URLs (no cross-tenant leakage)', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: sampleResponse })

    await catalogSettingsApi.get('tenant-A')
    await catalogSettingsApi.get('tenant-B')

    expect(vi.mocked(http.get).mock.calls[0]![0]).toBe('/tenants/tenant-A/catalog-settings')
    expect(vi.mocked(http.get).mock.calls[1]![0]).toBe('/tenants/tenant-B/catalog-settings')
  })
})

describe('catalogSettingsApi.get — Zod response parsing (REQ-5 / REQ-7 pin)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('strips unknown response fields via Zod parse at the API boundary', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: { ...sampleResponse, rogueField: 'no', anotherRogue: { nested: 'no' } },
    })

    const result = await catalogSettingsApi.get('tenant-1')

    expect(result).not.toHaveProperty('rogueField')
    expect(result).not.toHaveProperty('anotherRogue')
  })

  it('rejects an invalid response payload (unknown stock mode)', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: {
        ...sampleResponse,
        stockPresentationDefault: { mode: 'UNKNOWN_MODE', customQuantity: null },
      },
    })

    await expect(catalogSettingsApi.get('tenant-1')).rejects.toBeDefined()
  })
})

describe('catalogSettingsApi.get — warning boundary (mapper-driven filter)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retains DEFAULT_CONTEXT_HAS_NO_VALID_PRICES and strips unknown string codes', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: {
        ...sampleResponse,
        warnings: ['DEFAULT_CONTEXT_HAS_NO_VALID_PRICES', 'SOME_FUTURE_CODE', 'ANOTHER_UNKNOWN'],
      },
    })

    const result = await catalogSettingsApi.get('tenant-1')

    expect(result.warnings).toEqual(['DEFAULT_CONTEXT_HAS_NO_VALID_PRICES'])
  })

  it('rejects a warnings array containing an object member', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: {
        ...sampleResponse,
        warnings: [{ code: 'DEFAULT_CONTEXT_HAS_NO_VALID_PRICES' }],
      },
    })

    await expect(catalogSettingsApi.get('tenant-1')).rejects.toBeDefined()
  })

  it('rejects a warnings array containing a numeric member', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: {
        ...sampleResponse,
        warnings: [42],
      },
    })

    await expect(catalogSettingsApi.get('tenant-1')).rejects.toBeDefined()
  })

  it('rejects a warnings array containing a null member', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: {
        ...sampleResponse,
        warnings: [null],
      },
    })

    await expect(catalogSettingsApi.get('tenant-1')).rejects.toBeDefined()
  })
})

    describe('catalogSettingsApi.patch — warning boundary (mapper-driven filter)', () => {
      beforeEach(() => vi.clearAllMocks())

      it('retains DEFAULT_CONTEXT_HAS_NO_VALID_PRICES and strips unknown string codes', async () => {
        vi.mocked(http.patch).mockResolvedValue({
          data: {
            ...sampleResponse,
            warnings: ['DEFAULT_CONTEXT_HAS_NO_VALID_PRICES', 'SOME_FUTURE_CODE', 'ANOTHER_UNKNOWN'],
          },
        })

        const result = await catalogSettingsApi.patch('tenant-1', { catalogPublished: true })

        expect(result.warnings).toEqual(['DEFAULT_CONTEXT_HAS_NO_VALID_PRICES'])
      })

      it('rejects a warnings array containing an object member', async () => {
        vi.mocked(http.patch).mockResolvedValue({
          data: {
            ...sampleResponse,
            warnings: [{ code: 'DEFAULT_CONTEXT_HAS_NO_VALID_PRICES' }],
          },
        })

        await expect(catalogSettingsApi.patch('tenant-1', { catalogPublished: true })).rejects.toBeDefined()
      })

      it('rejects a warnings array containing a numeric member', async () => {
        vi.mocked(http.patch).mockResolvedValue({
          data: {
            ...sampleResponse,
            warnings: [42],
          },
        })

        await expect(catalogSettingsApi.patch('tenant-1', { catalogPublished: true })).rejects.toBeDefined()
      })

      it('rejects a warnings array containing a null member', async () => {
        vi.mocked(http.patch).mockResolvedValue({
          data: {
            ...sampleResponse,
            warnings: [null],
          },
        })

        await expect(catalogSettingsApi.patch('tenant-1', { catalogPublished: true })).rejects.toBeDefined()
      })
    })

    describe('catalogSettingsApi.patch (sdd online-catalog-backoffice WU2A)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls PATCH /tenants/:tenantId/catalog-settings with the body forwarded verbatim', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: sampleResponse })

    const body: CatalogSettingsPatchBody = {
      catalogPublished: false,
      publicPriceListIds: [],
      catalogDefaultPriceListId: null,
    }
    await catalogSettingsApi.patch('tenant-1', body)

    expect(http.patch).toHaveBeenCalledTimes(1)
    const [url, payload] = vi.mocked(http.patch).mock.calls[0]!
    expect(url).toBe('/tenants/tenant-1/catalog-settings')
    expect(payload).toEqual(body)
  })

  it('PATCH body never carries forbidden response keys (REQ-7 / REQ-18 pin)', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: sampleResponse })

    const safeBody: CatalogSettingsPatchBody = {
      catalogPublished: true,
      publicPriceListIds: ['pl_a'],
      catalogDefaultPriceListId: 'pl_a',
      stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    }
    await catalogSettingsApi.patch('tenant-1', safeBody)

    const [, payload] = vi.mocked(http.patch).mock.calls[0]!
    const keys = Object.keys(payload as object)
    for (const forbidden of [
      'tenantId',
      'effectivePublication',
      'priceContexts',
      'warnings',
      'updatedAt',
    ]) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('returns the parsed backend response so the mutation can re-hydrate from priceContexts', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: sampleResponse })

    const body: CatalogSettingsPatchBody = { catalogPublished: true }
    const result = await catalogSettingsApi.patch('tenant-1', body)

    expect(result).toEqual(sampleResponse)
  })

  it('encodes different tenant ids as different URLs (no cross-tenant leakage)', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: sampleResponse })

    const body: CatalogSettingsPatchBody = { catalogPublished: false }
    await catalogSettingsApi.patch('tenant-A', body)
    await catalogSettingsApi.patch('tenant-B', body)

    expect(vi.mocked(http.patch).mock.calls[0]![0]).toBe('/tenants/tenant-A/catalog-settings')
    expect(vi.mocked(http.patch).mock.calls[1]![0]).toBe('/tenants/tenant-B/catalog-settings')
  })
})

describe('catalogSettingsApi.patch — runtime body whitelist (REQ-7 pin)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('strips forged tenantId smuggled in via `as any`', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: sampleResponse })

    const forged = {
      catalogPublished: true,
      tenantId: 'rogue-tenant',
    } as unknown as CatalogSettingsPatchBody

    await catalogSettingsApi.patch('tenant-1', forged)

    const [, payload] = vi.mocked(http.patch).mock.calls[0]!
    expect(Object.keys(payload as object)).not.toContain('tenantId')
  })

  it('strips every forged response-only key from the body', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: sampleResponse })

    const forged = {
      catalogPublished: false,
      effectivePublication: false,
      priceContexts: [],
      warnings: [],
      updatedAt: '2099-01-01T00:00:00Z',
    } as unknown as CatalogSettingsPatchBody

    await catalogSettingsApi.patch('tenant-1', forged)

    const [, payload] = vi.mocked(http.patch).mock.calls[0]!
    const keys = Object.keys(payload as object)
    for (const forbidden of [
      'tenantId',
      'effectivePublication',
      'priceContexts',
      'warnings',
      'updatedAt',
    ]) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('strips an arbitrary unknown PATCH key that the denylist has never seen (true whitelist)', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: sampleResponse })

    // Forge three keys that are NEITHER in the documented four-key whitelist
    // (`catalogPublished` / `publicPriceListIds` / `catalogDefaultPriceListId` /
    // `stockPresentationDefault`) NOR in the previous response-only denylist.
    // A true whitelist must drop every one of them — the API boundary cannot
    // rely on a denylist, because callers can smuggle arbitrary keys via
    // `as unknown as CatalogSettingsPatchBody`.
    const forged = {
      catalogPublished: true,
      arbitraryUnknownField: 'rogue-value',
      anotherUnknownKey: 42,
      yetAnotherForged: { nested: 'no' },
    } as unknown as CatalogSettingsPatchBody

    await catalogSettingsApi.patch('tenant-1', forged)

    const [, payload] = vi.mocked(http.patch).mock.calls[0]!
    const keys = Object.keys(payload as object)
    expect(keys).not.toContain('arbitraryUnknownField')
    expect(keys).not.toContain('anotherUnknownKey')
    expect(keys).not.toContain('yetAnotherForged')
  })
})