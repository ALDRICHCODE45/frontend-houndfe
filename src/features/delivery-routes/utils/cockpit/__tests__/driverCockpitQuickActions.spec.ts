// driverCockpitQuickActions.spec.ts — strict-TDD tests for S2 (design §8,
// REQ-DCK-005). SSR / blocked popup / clipboard rejection paths included.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  canOpenExternalMap,
  canCopyAddress,
  canOpenEmail,
  openExternalMap,
  copyAddressToClipboard,
  openEmail,
  QUICK_ACTION_FAILURE_MESSAGES,
} from '../driverCockpitQuickActions'

// ─── canOpenExternalMap (REQ-DCK-005) ────────────────────────────────────────

describe('canOpenExternalMap (REQ-DCK-005)', () => {
  it.each([
    ['trimmed address alone', { address: 'Reforma 123, CDMX' }, true],
    ['both finite coords, no address', { latitude: 19.4326, longitude: -99.1332 }, true],
    ['0,0 as finite legal pin', { latitude: 0, longitude: 0 }, true],
    ['only latitude finite', { latitude: 19.4326, longitude: undefined }, false],
    ['only longitude finite', { latitude: null, longitude: -99.1332 }, false],
    ['NaN latitude', { latitude: NaN, longitude: -99.1332 }, false],
    ['Infinity longitude', { latitude: 19.4326, longitude: Infinity }, false],
    ['whitespace-only address', { address: '   ' }, false],
    ['empty address', { address: '' }, false],
    ['fully empty input', {}, false],
    ['all-null input', { address: null, latitude: null, longitude: null }, false],
    ['undefined address', { address: undefined }, false],
  ] as const)('is %s → %s', (_label, input, expected) => {
    expect(canOpenExternalMap(input)).toBe(expected)
  })
})

// ─── canCopyAddress + canOpenEmail share the trim contract ───────────────────

describe.each([
  ['canCopyAddress', canCopyAddress],
  ['canOpenEmail', canOpenEmail],
] as const)('%s (REQ-DCK-005)', (_name, predicate) => {
  it.each([
    ['non-empty trimmed', 'Reforma 123', true],
    ['whitespace-only', '   ', false],
    ['empty', '', false],
    ['null', null, false],
    ['undefined', undefined, false],
  ] as const)('is %s → %s', (_label, input, expected) => {
    expect(predicate(input)).toBe(expected)
  })
})

// ─── openExternalMap (REQ-DCK-005) ───────────────────────────────────────────

describe('openExternalMap (REQ-DCK-005)', () => {
  let openSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    openSpy = vi.fn().mockReturnValue({ focus: () => {} })
    window.open = openSpy as unknown as typeof window.open
  })

  it('returns typed failure without calling window.open when predicate is false', () => {
    expect(openExternalMap({})).toEqual({
      ok: false,
      message: QUICK_ACTION_FAILURE_MESSAGES.map,
    })
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('prefers the finite coordinate pair in the encoded Google Maps query', () => {
    openExternalMap({ address: 'Reforma 123', latitude: 19.4326, longitude: -99.1332 })
    const [url] = openSpy.mock.calls[0]!
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/)
    expect(url).toContain('19.4326%2C-99.1332')
    expect(url).not.toContain('Reforma')
  })

  it('falls back to the encoded address when coordinates are missing', () => {
    openExternalMap({ address: 'Reforma 123, CDMX' })
    expect(openSpy.mock.calls[0]![0]).toContain('Reforma+123%2C+CDMX')
  })

  it('uses _blank target with noopener,noreferrer features', () => {
    openExternalMap({ latitude: 19.4326, longitude: -99.1332 })
    expect(openSpy).toHaveBeenCalledWith(expect.any(String), '_blank', 'noopener,noreferrer')
  })

  it('returns typed failure when window.open returns null (popup blocked)', () => {
    openSpy.mockReturnValue(null)
    expect(openExternalMap({ latitude: 19.4326, longitude: -99.1332 })).toEqual({
      ok: false,
      message: QUICK_ACTION_FAILURE_MESSAGES.map,
    })
  })

  it('never throws when window.open synchronously throws', () => {
    openSpy.mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(openExternalMap({ latitude: 19.4326, longitude: -99.1332 })).toEqual({
      ok: false,
      message: QUICK_ACTION_FAILURE_MESSAGES.map,
    })
  })

  it('returns typed failure on SSR (no window)', () => {
    vi.stubGlobal('window', undefined)
    try {
      expect(openExternalMap({ latitude: 19.4326, longitude: -99.1332 })).toEqual({
        ok: false,
        message: QUICK_ACTION_FAILURE_MESSAGES.map,
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

// ─── copyAddressToClipboard (REQ-DCK-005) ────────────────────────────────────

describe('copyAddressToClipboard (REQ-DCK-005)', () => {
  let writeTextSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextSpy },
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
  })

  it('writes the trimmed address and resolves to ok=true', async () => {
    const result = await copyAddressToClipboard('  Reforma 123, CDMX  ')
    expect(result).toEqual({ ok: true, message: '' })
    expect(writeTextSpy).toHaveBeenCalledWith('Reforma 123, CDMX')
  })

  it('resolves to typed failure without calling writeText on whitespace input', async () => {
    const result = await copyAddressToClipboard('   ')
    expect(result).toEqual({ ok: false, message: QUICK_ACTION_FAILURE_MESSAGES.copy })
    expect(writeTextSpy).not.toHaveBeenCalled()
  })

  it('resolves to typed failure when clipboard is unavailable', async () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    const result = await copyAddressToClipboard('Reforma 123')
    expect(result).toEqual({ ok: false, message: QUICK_ACTION_FAILURE_MESSAGES.copy })
    expect(writeTextSpy).not.toHaveBeenCalled()
  })

  it('resolves to typed failure when writeText rejects', async () => {
    writeTextSpy.mockRejectedValueOnce(new Error('permission denied'))
    const result = await copyAddressToClipboard('Reforma 123')
    expect(result).toEqual({ ok: false, message: QUICK_ACTION_FAILURE_MESSAGES.copy })
  })

  it('resolves to typed failure when writeText synchronously throws', async () => {
    writeTextSpy.mockImplementation(() => {
      throw new Error('explode')
    })
    const result = await copyAddressToClipboard('Reforma 123')
    expect(result).toEqual({ ok: false, message: QUICK_ACTION_FAILURE_MESSAGES.copy })
  })

  it('resolves to typed failure on SSR (no navigator)', async () => {
    vi.stubGlobal('navigator', undefined)
    try {
      const result = await copyAddressToClipboard('Reforma 123')
      expect(result).toEqual({ ok: false, message: QUICK_ACTION_FAILURE_MESSAGES.copy })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

// ─── openEmail (REQ-DCK-005) ─────────────────────────────────────────────────

describe('openEmail (REQ-DCK-005)', () => {
  let locationAssignSpy: ReturnType<typeof vi.fn>
  let savedLocation: Location

  beforeEach(() => {
    locationAssignSpy = vi.fn()
    savedLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...savedLocation, href: '', assign: locationAssignSpy },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: savedLocation,
    })
  })

  it('assigns an encoded mailto URL and never calls window.open', () => {
    const result = openEmail('driver@example.com')
    expect(result).toEqual({ ok: true, message: '' })
    expect(window.open).not.toHaveBeenCalled()
    expect(window.location.href.startsWith('mailto:driver%40example.com')).toBe(true)
  })

  it('trims the email before encoding', () => {
    openEmail('  driver@example.com  ')
    expect(window.location.href.startsWith('mailto:driver%40example.com')).toBe(true)
    expect(window.location.href).not.toContain('+')
  })

  it('returns typed failure without touching location for empty/whitespace/null/undefined', () => {
    const before = window.location.href
    for (const input of ['   ', '', null, undefined] as const) {
      expect(openEmail(input)).toEqual({
        ok: false,
        message: QUICK_ACTION_FAILURE_MESSAGES.email,
      })
    }
    expect(window.location.href).toBe(before)
    expect(locationAssignSpy).not.toHaveBeenCalled()
  })

  it('returns typed failure on SSR (no window)', () => {
    vi.stubGlobal('window', undefined)
    try {
      expect(openEmail('driver@example.com')).toEqual({
        ok: false,
        message: QUICK_ACTION_FAILURE_MESSAGES.email,
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

// ─── Result-shape + copy-pin invariants ──────────────────────────────────────

describe('shape + copy pins', () => {
  it('every helper returns { ok: boolean; message: string }', async () => {
    const results = [
      openExternalMap({ latitude: 19.4326, longitude: -99.1332 }),
      await copyAddressToClipboard('Reforma 123'),
      openEmail('a@b.com'),
    ]
    for (const r of results) {
      expect(typeof r.ok).toBe('boolean')
      expect(typeof r.message).toBe('string')
    }
  })

  it('exposes the spec-pinned copy-failure message for S3 to mirror', () => {
    expect(QUICK_ACTION_FAILURE_MESSAGES.copy).toBe('No se pudo copiar la dirección')
    expect(QUICK_ACTION_FAILURE_MESSAGES.map.length).toBeGreaterThan(0)
    expect(QUICK_ACTION_FAILURE_MESSAGES.email.length).toBeGreaterThan(0)
  })
})