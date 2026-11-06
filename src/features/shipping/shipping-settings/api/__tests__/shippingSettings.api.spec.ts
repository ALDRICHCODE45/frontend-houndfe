import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { shippingSettingsApi } from '../shippingSettings.api'
import type { OpeningHoursBody, ShippingBox, ShippingOriginBody } from '../../interfaces/shipping-settings.types'

vi.mock('@/core/shared/api/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const box: ShippingBox = {
  id: 'box-1',
  name: 'Caja chica',
  innerLengthCm: 30,
  innerWidthCm: 20,
  innerHeightCm: 15,
  weightG: 180,
  maxContentWeightG: 5000,
  isActive: true,
  createdAt: '2026-11-06T18:00:00.000Z',
  updatedAt: '2026-11-06T18:00:00.000Z',
}

describe('shippingSettingsApi — boxes (handoff §5)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists the boxes of the tenant from { data }', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { data: [box] } })
    await expect(shippingSettingsApi.listBoxes('t-1')).resolves.toEqual([box])
    expect(http.get).toHaveBeenCalledWith('/tenants/t-1/shipping-boxes')
  })

  it('creates with POST, edits with PATCH and deletes with DELETE on the box path', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: box })
    vi.mocked(http.patch).mockResolvedValue({ data: { ...box, isActive: false } })
    vi.mocked(http.delete).mockResolvedValue({ data: '' })
    const body = {
      name: 'Caja chica',
      innerLengthCm: 30,
      innerWidthCm: 20,
      innerHeightCm: 15,
      weightG: 180,
      maxContentWeightG: 5000,
    }

    await expect(shippingSettingsApi.createBox('t-1', body)).resolves.toEqual(box)
    await expect(shippingSettingsApi.updateBox('t-1', 'box-1', { isActive: false })).resolves.toMatchObject({ isActive: false })
    await shippingSettingsApi.deleteBox('t-1', 'box-1')

    expect(http.post).toHaveBeenCalledWith('/tenants/t-1/shipping-boxes', body)
    expect(http.patch).toHaveBeenCalledWith('/tenants/t-1/shipping-boxes/box-1', { isActive: false })
    expect(http.delete).toHaveBeenCalledWith('/tenants/t-1/shipping-boxes/box-1')
  })
})

describe('shippingSettingsApi — origin (handoff §6)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads { configured, origin } and replaces it with PUT', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { configured: false, origin: null } })
    await expect(shippingSettingsApi.getOrigin('t-1')).resolves.toEqual({ configured: false, origin: null })
    expect(http.get).toHaveBeenCalledWith('/tenants/t-1/shipping-origin')

    const body: ShippingOriginBody = {
      addressLine1: 'Av. Insurgentes Sur 1458',
      addressLine2: null,
      neighborhood: 'Del Valle Centro',
      municipality: 'Benito Juárez',
      state: 'Ciudad de México',
      postalCode: '03100',
      contactPhone: '5555432100',
    }
    vi.mocked(http.put).mockResolvedValue({ data: { configured: true, origin: { ...body, updatedAt: 'x' } } })
    await expect(shippingSettingsApi.putOrigin('t-1', body)).resolves.toMatchObject({ configured: true })
    expect(http.put).toHaveBeenCalledWith('/tenants/t-1/shipping-origin', body)
  })
})

describe('shippingSettingsApi — opening hours (handoff §7)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads { configured, openingHours } and replaces the week with PUT', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { configured: false, openingHours: null } })
    await expect(shippingSettingsApi.getOpeningHours('t-1')).resolves.toEqual({ configured: false, openingHours: null })
    expect(http.get).toHaveBeenCalledWith('/tenants/t-1/opening-hours')

    const body: OpeningHoursBody = { timeZone: 'America/Mexico_City', days: [{ day: 'MONDAY', ranges: [] }] }
    vi.mocked(http.put).mockResolvedValue({ data: { configured: true, openingHours: { ...body, updatedAt: 'x' } } })
    await shippingSettingsApi.putOpeningHours('t-1', body)
    expect(http.put).toHaveBeenCalledWith('/tenants/t-1/opening-hours', body)
  })
})
