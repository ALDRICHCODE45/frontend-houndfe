// cashRules.spec.ts — the pure UI-side cash rules that protect the contract:
// blind windows, missing-vs-zero, frozen channels, denominations, the two
// distinct differences, and custody/FLOAT opening semantics.
import { describe, expect, it } from 'vitest'
import {
  blindSafeDetail,
  buildCountPayload,
  buildCountPayloadPesos,
  canReceiveHandover,
  cashSessionFacts,
  comparisonView,
  countEntryErrors,
  countEntryErrorsPesos,
  denominationError,
  floatOpeningMismatch,
  floatSourceDrawerAdvisory,
  isSelfVerification,
  requiredChannelIdentities,
} from '../cashRules'
import type {
  CashChannelIdentity,
  CashCustodyItem,
  CashEligibleFloatItem,
  CashSession,
  CashSessionDetail,
} from '../../interfaces/cash.types'

function makeSession(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: 's-1',
    tenantId: 't-1',
    registerId: 'r-1',
    status: 'OPEN',
    cashierUserId: 'cashier-1',
    openingCents: 50000,
    frozenAt: null,
    drawerReleasedAt: null,
    blind: true,
    ...overrides,
  }
}

const CASH_CHANNEL: CashChannelIdentity = {
  channelKey: 'CASH',
  channelLabel: 'Efectivo',
  method: 'CASH',
}
const CARD_CHANNEL: CashChannelIdentity = {
  channelKey: 'PM:card',
  channelLabel: 'Visa Crédito',
  method: 'CARD_CREDIT',
}

function makeDetail(overrides: Partial<CashSessionDetail> = {}): CashSessionDetail {
  return {
    session: makeSession(),
    register: { id: 'r-1', name: 'Caja principal', isActive: true },
    movements: [],
    counts: [],
    handovers: [],
    closing: null,
    channelSnapshot: null,
    ...overrides,
  }
}

function makeFloat(overrides: Partial<CashEligibleFloatItem> = {}): CashEligibleFloatItem {
  return {
    id: 'f-1',
    sessionId: 's-0',
    kind: 'FLOAT',
    declaredCents: 30000,
    receivedCents: 29500,
    senderUserId: 'sender-1',
    receiverUserId: 'receiver-1',
    declaredAt: '2026-10-07T19:00:00.000Z',
    receivedAt: '2026-10-07T19:10:00.000Z',
    sourceRegisterId: 'r-other',
    sourceDrawerReleasedAt: '2026-10-07T19:30:00.000Z',
    ...overrides,
  }
}

describe('cashRules · blind window', () => {
  it('drops expected/difference when the window is blind, even if the payload carries them', () => {
    const facts = cashSessionFacts(
      makeSession({ blind: true, expectedCashCents: 157500, differenceCents: 500 }),
    )
    expect(facts.blind).toBe(true)
    expect(facts.expectedVisible).toBe(false)
    expect(facts.expectedCashCents).toBeNull()
    expect(facts.differenceCents).toBeNull()
  })

  it('reads an ABSENT expected/difference as null, never as zero', () => {
    const facts = cashSessionFacts(makeSession({ blind: false }))
    expect(facts.expectedCashCents).toBeNull()
    expect(facts.differenceCents).toBeNull()
    expect(facts.expectedVisible).toBe(false)
  })

  it('exposes a visible, non-zero difference untouched', () => {
    const facts = cashSessionFacts(
      makeSession({
        blind: false,
        status: 'SUBMITTED',
        expectedCashCents: 157500,
        differenceCents: 500,
      }),
    )
    expect(facts.expectedCashCents).toBe(157500)
    expect(facts.differenceCents).toBe(500)
  })

  it('keeps session status and drawer release as two independent facts', () => {
    const counting = cashSessionFacts(
      makeSession({ status: 'COUNTING', blind: true, frozenAt: '2026-10-07T18:30:00.000Z' }),
    )
    expect(counting.status).toBe('COUNTING')
    expect(counting.drawerReleasedAt).toBeNull()

    const released = cashSessionFacts(
      makeSession({
        status: 'COUNTING',
        blind: true,
        drawerReleasedAt: '2026-10-07T19:00:00.000Z',
      }),
    )
    expect(released.status).toBe('COUNTING')
    expect(released.drawerReleasedAt).toBe('2026-10-07T19:00:00.000Z')
  })

  it('strips movements and channelSnapshot from a blind detail even when malformed values are loaded', () => {
    const malformed = makeDetail({
      session: makeSession({ blind: true, status: 'COUNTING' }),
      movements: [
        {
          id: 'm-1',
          kind: 'CASH_IN',
          deltaCents: 20000,
          method: 'CASH',
          channelKey: 'CASH',
          channelLabel: 'Efectivo',
          sourceType: 'MANUAL',
          sourceId: 'src-1',
          actorUserId: 'cashier-1',
          reason: null,
          occurredAt: '2026-10-07T17:15:00.000Z',
        },
      ],
      channelSnapshot: [{ ...CASH_CHANNEL, expectedCents: 157500 }],
    })
    const safe = blindSafeDetail(malformed)!
    expect(safe.movements).toEqual([])
    expect(safe.channelSnapshot).toBeNull()
    expect(safe.session.blind).toBe(true)
  })

  it('leaves a visible detail untouched', () => {
    const visible = makeDetail({ session: makeSession({ blind: false, status: 'SUBMITTED' }) })
    expect(blindSafeDetail(visible)).toBe(visible)
  })

  it('exposes identity-only frozen channels only in the blind COUNTING window', () => {
    const countingBlind = makeDetail({
      session: makeSession({ blind: true, status: 'COUNTING' }),
      requiredChannels: [CASH_CHANNEL, CARD_CHANNEL],
    })
    expect(requiredChannelIdentities(countingBlind).map((c) => c.channelKey)).toEqual([
      'CASH',
      'PM:card',
    ])

    const openBlind = makeDetail({
      session: makeSession({ blind: true, status: 'OPEN' }),
      requiredChannels: [CASH_CHANNEL],
    })
    expect(requiredChannelIdentities(openBlind)).toEqual([])

    const submitted = makeDetail({
      session: makeSession({ blind: false, status: 'SUBMITTED' }),
      requiredChannels: [CASH_CHANNEL],
    })
    expect(requiredChannelIdentities(submitted)).toEqual([])
  })
})

describe('cashRules · count entry', () => {
  it('treats a blank channel as missing and an explicit zero as counted zero', () => {
    const channels = [CASH_CHANNEL, CARD_CHANNEL]
    const errors = countEntryErrors(channels, { CASH: '0' })
    expect(errors.CASH).toBeUndefined()
    expect(errors['PM:card']).toMatch(/cero debe ser explícito/i)
  })

  it('rejects decimals, negatives and exponents without accepting them as zero', () => {
    const channels = [CASH_CHANNEL]
    for (const value of ['1.5', '-1', '1e2', '2147483648']) {
      expect(countEntryErrors(channels, { CASH: value }).CASH).toBeDefined()
    }
  })

  it('builds a body with only lines/denominations/notes — never an expected or difference oracle', () => {
    const payload = buildCountPayload([CASH_CHANNEL, CARD_CHANNEL], {
      CASH: '158000',
      'PM:card': '0',
    })
    expect(payload).toEqual({
      lines: [
        { channelKey: 'CASH', amountCents: 158000 },
        { channelKey: 'PM:card', amountCents: 0 },
      ],
    })
    expect(Object.keys(payload!)).toEqual(['lines'])
  })

  it('omits denominations entirely when none are provided', () => {
    expect(buildCountPayload([CASH_CHANNEL], { CASH: '0' }, ' sin novedad ', [])).toEqual({
      lines: [{ channelKey: 'CASH', amountCents: 0 }],
      notes: 'sin novedad',
    })
  })

  it('returns null instead of a partial body when a channel is blank', () => {
    expect(buildCountPayload([CASH_CHANNEL, CARD_CHANNEL], { CASH: '10' })).toBeNull()
  })

  it('requires supplied denominations to sum exactly to the CASH line', () => {
    expect(denominationError([], null)).toBeNull()
    expect(denominationError([{ denominationCents: 5000, quantity: 1 }], 5000)).toBeNull()
    expect(denominationError([{ denominationCents: 5000, quantity: 1 }], 6000)).toMatch(/sumar/i)
  })

  it('accepts a ZERO denomination quantity, which contributes zero to the sum', () => {
    expect(denominationError([{ denominationCents: 1000, quantity: 0 }], 0)).toBeNull()
    expect(denominationError([{ denominationCents: 1000, quantity: 0 }], 1000)).toMatch(/sumar/i)
  })
})

describe('cashRules · pesos count entry (money UI)', () => {
  it('treats a blank channel as missing and an explicit zero as counted zero in pesos', () => {
    const errors = countEntryErrorsPesos([CASH_CHANNEL, CARD_CHANNEL], { CASH: '0.00' })
    expect(errors.CASH).toBeUndefined()
    expect(errors['PM:card']).toMatch(/cero debe ser explícito/i)
  })

  it('rejects excess decimals, negatives, exponents and overflow in pesos', () => {
    const channels = [CASH_CHANNEL]
    for (const value of ['1.234', '-1', '1e2', '21474836.48']) {
      expect(countEntryErrorsPesos(channels, { CASH: value }).CASH).toBeDefined()
    }
    expect(countEntryErrorsPesos(channels, { CASH: '1580.00' }).CASH).toBeUndefined()
  })

  it('builds the same integer-cents body from pesos entry values', () => {
    const payload = buildCountPayloadPesos([CASH_CHANNEL, CARD_CHANNEL], {
      CASH: '1580.00',
      'PM:card': '0',
    })
    expect(payload).toEqual({
      lines: [
        { channelKey: 'CASH', amountCents: 158000 },
        { channelKey: 'PM:card', amountCents: 0 },
      ],
    })
    expect(Object.keys(payload!)).toEqual(['lines'])
  })

  it('returns null instead of a partial body when a pesos channel is blank', () => {
    expect(buildCountPayloadPesos([CASH_CHANNEL, CARD_CHANNEL], { CASH: '10' })).toBeNull()
    expect(buildCountPayloadPesos([], {})).toBeNull()
  })

  it('passes supplied denominations through unchanged and keeps notes trimmed', () => {
    const payload = buildCountPayloadPesos([CASH_CHANNEL], { CASH: '50.00' }, '  sin novedad  ', [
      { denominationCents: 5000, quantity: 1 },
    ])
    expect(payload).toEqual({
      lines: [{ channelKey: 'CASH', amountCents: 5000 }],
      notes: 'sin novedad',
      denominations: [{ denominationCents: 5000, quantity: 1 }],
    })
  })
})

describe('cashRules · differences', () => {
  it('keeps the two differences distinct in the normal comparison', () => {
    const view = comparisonView({
      expectedCents: 157500,
      declaredCents: 158000,
      verifiedCents: 158300,
      declarationDifferenceCents: 500,
      verificationDifferenceCents: 300,
      verifiedVsExpectedDifferenceCents: 800,
      requiresDeclarationNotes: true,
      requiresVerificationNotes: true,
      hasDiscrepancy: true,
    })
    expect(view?.declarationDifferenceCents).toBe(500)
    expect(view?.verificationDifferenceCents).toBe(300)
  })

  it('maps the DECLARE fallback single difference to the declaration step', () => {
    const view = comparisonView({
      expectedCents: 157500,
      declaredCents: 158000,
      verifiedCents: null,
      differenceCents: 500,
      requiresDeclarationNotes: true,
      requiresVerificationNotes: false,
      hasDiscrepancy: true,
      notesRequired: true,
    })
    expect(view?.declarationDifferenceCents).toBe(500)
    expect(view?.notesRequired).toBe(true)
    expect(view?.verificationDifferenceCents).toBeNull()
  })

  it('returns null for an absent comparison', () => {
    expect(comparisonView(null)).toBeNull()
  })
})

describe('cashRules · separation of duties and custody', () => {
  it('detects self-verification', () => {
    expect(isSelfVerification('cashier-1', 'cashier-1')).toBe(true)
    expect(isSelfVerification('cashier-1', 'verifier-2')).toBe(false)
    expect(isSelfVerification(null, 'verifier-2')).toBe(false)
  })

  it('allows receipt only for the designated, still-unreceived recipient', () => {
    const own: CashCustodyItem = {
      id: 'h-1',
      sessionId: 's-1',
      kind: 'FLOAT',
      declaredCents: 30000,
      receivedCents: null,
      senderUserId: 'sender-1',
      receiverUserId: 'receiver-1',
      declaredAt: '2026-10-07T20:05:00.000Z',
      receivedAt: null,
    }
    expect(canReceiveHandover(own, 'receiver-1')).toBe(true)
    expect(canReceiveHandover(own, 'someone-else')).toBe(false)
    expect(
      canReceiveHandover({ ...own, receivedAt: '2026-10-07T20:10:00.000Z' }, 'receiver-1'),
    ).toBe(false)
  })

  it('treats the received FLOAT amount (not the declared one) as the opening fund', () => {
    expect(floatOpeningMismatch(29500, 29500)).toBe(false)
    expect(floatOpeningMismatch(29500, 30000)).toBe(true)
    expect(floatOpeningMismatch(null, 30000)).toBe(false)
  })

  it('blocks only the SAME register while the source drawer is unreleased', () => {
    const unreleased = makeFloat({ sourceDrawerReleasedAt: null, sourceRegisterId: 'r-1' })
    expect(floatSourceDrawerAdvisory(unreleased, 'r-1')?.blocked).toBe(true)
    expect(floatSourceDrawerAdvisory(unreleased, 'r-2')?.blocked).toBe(false)
    const released = makeFloat()
    expect(floatSourceDrawerAdvisory(released, 'r-1')).toBeNull()
  })
})

describe('cashRules · session identity scoping (permission/tenant/user)', () => {
  it('is deterministic and order-insensitive over the permission codes', async () => {
    const { cashPermissionFingerprint } = await import('../cashRules')
    const a = cashPermissionFingerprint(['read:CashSession', 'create:CashHandover'])
    const b = cashPermissionFingerprint(['create:CashHandover', 'read:CashSession'])
    expect(a).toBe(b)
    expect(a).not.toBe(cashPermissionFingerprint(['read:CashSession']))
    expect(cashPermissionFingerprint([])).toBe(cashPermissionFingerprint([]))
  })

  it('treats a permission generation change as a different identity', async () => {
    const { isSameCashIdentity } = await import('../cashRules')
    const base = { tenantId: 't-1', userId: 'u-1', permissionFingerprint: 'fp-a', generation: 1 }
    expect(isSameCashIdentity(base, { ...base })).toBe(true)
    expect(isSameCashIdentity(base, { ...base, permissionFingerprint: 'fp-b' })).toBe(false)
    expect(isSameCashIdentity(base, { ...base, userId: 'u-2' })).toBe(false)
    expect(isSameCashIdentity(base, { ...base, tenantId: 't-2' })).toBe(false)
    expect(isSameCashIdentity(null, base)).toBe(false)
    expect(isSameCashIdentity(base, null)).toBe(false)
  })

  it('treats a new SESSION lifecycle generation as a different identity even with identical principal and permissions', async () => {
    const { isSameCashIdentity } = await import('../cashRules')
    const base = { tenantId: 't-1', userId: 'u-1', permissionFingerprint: 'fp-a', generation: 7 }
    // A logout->login with the SAME user/tenant/permissions is NOT the same session.
    expect(isSameCashIdentity(base, { ...base, generation: 8 })).toBe(false)
  })

  it('keeps a token ROTATION on the same generation: a refresh is the same session', async () => {
    const { isSameCashIdentity } = await import('../cashRules')
    const base = { tenantId: 't-1', userId: 'u-1', permissionFingerprint: 'fp-a', generation: 7 }
    expect(isSameCashIdentity(base, { ...base })).toBe(true)
  })
})
