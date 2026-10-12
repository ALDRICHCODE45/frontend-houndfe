/**
 * S1 subset — transport contract for `cash.api.ts`.
 *
 * Grounded field-by-field in the authoritative backend contract
 * (`houndfe-backend/.tmp/cash-register-closing/docs/cash-register-closing.md`,
 * routes/envelopes/idempotency/errors sections) and the frontend handoff
 * (`docs/cash-register-frontend-handoff.md`).
 *
 * Pinned here:
 *   - exact paths, methods and plain-JSON unwrapped responses (no `data` key);
 *   - explicit `Idempotency-Key` on every command and on no `GET`;
 *   - whitelisted request construction: no `tenantId`, actor, receipt actor,
 *     `expectedCents` or `differenceCents` can leak into a body or query;
 *   - fractional / out-of-range cents are rejected before any HTTP call;
 *   - blind absence is preserved (no coercion to `0`, nothing synthesized);
 *   - normal and fallback declaration `comparison` documents both survive.
 *
 * The S1 subset intentionally excludes sales binding and closing/PDF.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cashApi } from '../cash.api'
import { http } from '@/core/shared/api/http'
import type {
  CashComparisonFallback,
  CashComparisonNormal,
  CashCountPayload,
  CashCustody,
  CashDeclaration,
  CashHandover,
  CashRegister,
  CashSession,
  CashSessionDetail,
} from '../../interfaces/cash.types'

vi.mock('@/core/shared/api/http', () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

// ─── Fixtures (fictitious, contract-shaped) ──────────────────────────────────

const REGISTER: CashRegister = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Caja principal',
  isActive: true,
  createdAt: '2026-10-01T10:00:00.000Z',
}

const SESSION: CashSession = {
  id: '33333333-3333-4333-8333-333333333333',
  tenantId: '11111111-1111-4111-8111-111111111111',
  registerId: REGISTER.id,
  status: 'OPEN',
  cashierUserId: '44444444-4444-4444-8444-444444444444',
  openingCents: 50000,
  frozenAt: null,
  drawerReleasedAt: null,
  blind: true,
}

/** Example A: owner, OPEN, blind — nothing frozen yet. */
const DETAIL_OPEN_BLIND: CashSessionDetail = {
  session: SESSION,
  register: { id: REGISTER.id, name: REGISTER.name, isActive: true },
  movements: [],
  counts: [],
  handovers: [],
  closing: null,
  channelSnapshot: null,
}

/** Example B: owner, COUNTING, blind, identity-only `requiredChannels`. */
const DETAIL_COUNTING_BLIND: CashSessionDetail = {
  ...DETAIL_OPEN_BLIND,
  session: { ...SESSION, status: 'COUNTING', frozenAt: '2026-10-07T18:30:00.000Z' },
  requiredChannels: [
    { channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH' },
    {
      channelKey: 'PM:77777777-7777-4777-8777-777777777777',
      channelLabel: 'Visa Crédito',
      method: 'CARD_CREDIT',
    },
  ],
}

const COUNT_BODY: CashCountPayload = {
  lines: [
    { channelKey: 'CASH', amountCents: 158000 },
    { channelKey: 'PM:77777777-7777-4777-8777-777777777777', amountCents: 40000 },
  ],
  denominations: [
    { denominationCents: 100000, quantity: 1 },
    { denominationCents: 50000, quantity: 1 },
    { denominationCents: 5000, quantity: 1 },
    { denominationCents: 2000, quantity: 1 },
    { denominationCents: 1000, quantity: 1 },
  ],
  notes: 'Sobrante de 500 centavos por cambio no entregado al cliente',
}

const DECLARATION: CashDeclaration = {
  revision: 1,
  lines: [
    { channelKey: 'CASH', amountCents: 158000 },
    { channelKey: 'PM:77777777-7777-4777-8777-777777777777', amountCents: 40000 },
  ],
  denominations: [{ denominationCents: 100000, quantity: 1 }],
  notes: null,
  cashCents: 158000,
}

/** Example D: normal declaration comparison (all three differences). */
const COMPARISON_NORMAL: CashComparisonNormal = {
  expectedCents: 157500,
  declaredCents: 158000,
  verifiedCents: null,
  declarationDifferenceCents: 500,
  verificationDifferenceCents: null,
  verifiedVsExpectedDifferenceCents: null,
  requiresDeclarationNotes: true,
  requiresVerificationNotes: false,
  hasDiscrepancy: true,
}

/** Example E: fallback declaration comparison (missing explanation). */
const COMPARISON_FALLBACK: CashComparisonFallback = {
  expectedCents: 157500,
  declaredCents: 158000,
  verifiedCents: null,
  differenceCents: 500,
  requiresDeclarationNotes: true,
  requiresVerificationNotes: false,
  hasDiscrepancy: true,
  notesRequired: true,
}

const HANDOVER: CashHandover = {
  id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
  sessionId: SESSION.id,
  kind: 'FLOAT',
  declaredCents: 150000,
  receivedCents: 150000,
  senderUserId: '44444444-4444-4444-8444-444444444444',
  receiverUserId: '66666666-6666-4666-8666-666666666666',
  receiptActorUserId: '66666666-6666-4666-8666-666666666666',
  declaredAt: '2026-10-07T19:20:00.000Z',
  receivedAt: '2026-10-07T19:25:00.000Z',
  notes: 'Fondo para el siguiente turno',
  receiptNotes: 'Recibido completo',
}

const CUSTODY: CashCustody = {
  pendingHandovers: {
    items: [
      {
        id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
        sessionId: '33333333-3333-4333-8333-333333333342',
        kind: 'FLOAT',
        declaredCents: 30000,
        receivedCents: null,
        senderUserId: '44444444-4444-4444-8444-444444444445',
        receiverUserId: '66666666-6666-4666-8666-666666666666',
        declaredAt: '2026-10-07T20:05:00.000Z',
        receivedAt: null,
        sourceRegisterId: '22222222-2222-4222-8222-222222222223',
        sourceDrawerReleasedAt: null,
      },
    ],
    page: 1,
    limit: 25,
    total: 1,
  },
  eligibleFloat: { items: [], page: 1, limit: 25, total: 0 },
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Registers ───────────────────────────────────────────────────────────────

describe('cashApi.listRegisters', () => {
  it('GETs /cash-registers, sends no idempotency header and unwraps `items`', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { items: [REGISTER] } })

    const result = await cashApi.listRegisters()

    expect(http.get).toHaveBeenCalledWith('/cash-registers')
    expect(result).toEqual([REGISTER])
  })
})

describe('cashApi.createRegister', () => {
  it('POSTs /cash-registers with `name` and the explicit idempotency key', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: REGISTER })

    const result = await cashApi.createRegister({ name: 'Caja principal' }, 'register-key-1')

    expect(http.post).toHaveBeenCalledWith(
      '/cash-registers',
      { name: 'Caja principal' },
      { headers: { 'Idempotency-Key': 'register-key-1' } },
    )
    expect(result).toEqual(REGISTER)
  })

  it('never forwards tenant or actor fields the caller may have attached', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: REGISTER })
    const leaked = {
      name: 'Caja principal',
      tenantId: 'tenant-leak',
      actorUserId: 'actor-leak',
      createdByUserId: 'actor-leak',
    }

    await cashApi.createRegister(leaked, 'register-key-2')

    expect(http.post).toHaveBeenCalledWith(
      '/cash-registers',
      { name: 'Caja principal' },
      { headers: { 'Idempotency-Key': 'register-key-2' } },
    )
  })
})

describe('cashApi.updateRegister', () => {
  it('PATCHes /cash-registers/:id with `isActive` and the idempotency key', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: { ...REGISTER, isActive: false } })

    const result = await cashApi.updateRegister(REGISTER.id, { isActive: false }, 'register-key-3')

    expect(http.patch).toHaveBeenCalledWith(
      `/cash-registers/${REGISTER.id}`,
      { isActive: false },
      { headers: { 'Idempotency-Key': 'register-key-3' } },
    )
    expect(result.isActive).toBe(false)
  })

  it('omits absent fields and drops any tenant/actor leak from the patch body', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: REGISTER })
    const leaked = { name: 'Caja renombrada', tenantId: 'tenant-leak', actorUserId: 'actor-leak' }

    await cashApi.updateRegister(REGISTER.id, leaked, 'register-key-4')

    expect(http.patch).toHaveBeenCalledWith(
      `/cash-registers/${REGISTER.id}`,
      { name: 'Caja renombrada' },
      { headers: { 'Idempotency-Key': 'register-key-4' } },
    )
  })

  it('sends an empty body when neither name nor isActive is provided', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: REGISTER })

    await cashApi.updateRegister(REGISTER.id, {}, 'register-key-5')

    expect(http.patch).toHaveBeenCalledWith(
      `/cash-registers/${REGISTER.id}`,
      {},
      { headers: { 'Idempotency-Key': 'register-key-5' } },
    )
  })
})

// ─── Sessions: list and detail ───────────────────────────────────────────────

describe('cashApi.listSessions', () => {
  it('GETs /cash-sessions with the page envelope untouched and no idempotency header', async () => {
    const response = { items: [SESSION], page: 1, limit: 25, total: 1 }
    vi.mocked(http.get).mockResolvedValue({ data: response })

    const result = await cashApi.listSessions({ page: 1, limit: 25 })

    expect(http.get).toHaveBeenCalledWith('/cash-sessions', { params: { page: 1, limit: 25 } })
    expect(result).toEqual(response)
  })

  it('forwards only documented filters and drops tenant/recipient leaks', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { items: [], page: 2, limit: 50, total: 0 } })
    const leaked = {
      page: 2,
      limit: 50,
      registerId: REGISTER.id,
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-08T00:00:00.000Z',
      cashierUserId: '44444444-4444-4444-8444-444444444444',
      pendingOnly: true,
      tenantId: 'tenant-leak',
      recipientUserId: 'recipient-leak',
    }

    await cashApi.listSessions(leaked)

    expect(http.get).toHaveBeenCalledWith('/cash-sessions', {
      params: {
        page: 2,
        limit: 50,
        registerId: REGISTER.id,
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-08T00:00:00.000Z',
        cashierUserId: '44444444-4444-4444-8444-444444444444',
        pendingOnly: true,
      },
    })
  })

  it('sends an empty params object when no filter is provided', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { items: [], page: 1, limit: 25, total: 0 } })

    await cashApi.listSessions({})

    expect(http.get).toHaveBeenCalledWith('/cash-sessions', { params: {} })
  })
})

describe('cashApi.getSession', () => {
  it('GETs /cash-sessions/:id and returns the detail document verbatim', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: DETAIL_COUNTING_BLIND })

    const result = await cashApi.getSession(SESSION.id)

    expect(http.get).toHaveBeenCalledWith(`/cash-sessions/${SESSION.id}`)
    expect(result).toEqual(DETAIL_COUNTING_BLIND)
  })

  it('preserves blind absence: expected/difference stay absent instead of becoming 0', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: DETAIL_OPEN_BLIND })

    const result = await cashApi.getSession(SESSION.id)

    expect('expectedCashCents' in result.session).toBe(false)
    expect('differenceCents' in result.session).toBe(false)
    expect('requiredChannels' in result).toBe(false)
    expect(result.channelSnapshot).toBeNull()
  })
})

describe('cashApi.openSession', () => {
  it('POSTs /cash-registers/:id/sessions with the confirmed opening fund', async () => {
    const response = {
      session: SESSION,
      register: { id: REGISTER.id, name: REGISTER.name, isActive: true },
    }
    vi.mocked(http.post).mockResolvedValue({ data: response })

    const result = await cashApi.openSession(
      REGISTER.id,
      { openingCents: 50000, openingConfirmed: true },
      'open-key-1',
    )

    expect(http.post).toHaveBeenCalledWith(
      `/cash-registers/${REGISTER.id}/sessions`,
      { openingCents: 50000, openingConfirmed: true },
      { headers: { 'Idempotency-Key': 'open-key-1' } },
    )
    expect(result).toEqual(response)
  })

  it('includes the optional received-FLOAT handover id when provided', async () => {
    vi.mocked(http.post).mockResolvedValue({
      data: {
        session: SESSION,
        register: { id: REGISTER.id, name: REGISTER.name, isActive: true },
      },
    })

    await cashApi.openSession(
      REGISTER.id,
      { openingCents: 50000, openingConfirmed: true, openingHandoverId: '1f2e-handover' },
      'open-key-2',
    )

    expect(http.post).toHaveBeenCalledWith(
      `/cash-registers/${REGISTER.id}/sessions`,
      { openingCents: 50000, openingConfirmed: true, openingHandoverId: '1f2e-handover' },
      { headers: { 'Idempotency-Key': 'open-key-2' } },
    )
  })

  it('drops tenant/actor/float-derived leaks from the opening body', async () => {
    vi.mocked(http.post).mockResolvedValue({
      data: {
        session: SESSION,
        register: { id: REGISTER.id, name: REGISTER.name, isActive: true },
      },
    })
    const leaked = {
      openingCents: 50000,
      openingConfirmed: true as const,
      tenantId: 'tenant-leak',
      cashierUserId: 'actor-leak',
      expectedCashCents: 50000,
    }

    await cashApi.openSession(REGISTER.id, leaked, 'open-key-3')

    expect(http.post).toHaveBeenCalledWith(
      `/cash-registers/${REGISTER.id}/sessions`,
      { openingCents: 50000, openingConfirmed: true },
      { headers: { 'Idempotency-Key': 'open-key-3' } },
    )
  })

  it('rejects a fractional opening fund before any HTTP call', async () => {
    await expect(
      cashApi.openSession(
        REGISTER.id,
        { openingCents: 500.5, openingConfirmed: true },
        'open-key-4',
      ),
    ).rejects.toThrow(RangeError)
    expect(http.post).not.toHaveBeenCalled()
  })

  it('rejects an out-of-range opening fund before any HTTP call', async () => {
    await expect(
      cashApi.openSession(
        REGISTER.id,
        { openingCents: 2147483648, openingConfirmed: true },
        'open-key-5',
      ),
    ).rejects.toThrow(RangeError)
    expect(http.post).not.toHaveBeenCalled()
  })

  it('rejects a negative opening fund before any HTTP call', async () => {
    await expect(
      cashApi.openSession(REGISTER.id, { openingCents: -1, openingConfirmed: true }, 'open-key-6'),
    ).rejects.toThrow(RangeError)
    expect(http.post).not.toHaveBeenCalled()
  })
})

// ─── Blind count and declaration ─────────────────────────────────────────────

describe('cashApi.startCount', () => {
  it('POSTs /cash-sessions/:id/start-count with no body and the idempotency key', async () => {
    const response = {
      session: { ...SESSION, status: 'COUNTING' as const, frozenAt: '2026-10-07T18:30:00.000Z' },
    }
    vi.mocked(http.post).mockResolvedValue({ data: response })

    const result = await cashApi.startCount(SESSION.id, 'count-key-1')

    expect(http.post).toHaveBeenCalledWith(`/cash-sessions/${SESSION.id}/start-count`, undefined, {
      headers: { 'Idempotency-Key': 'count-key-1' },
    })
    expect(result).toEqual(response)
  })
})

describe('cashApi.declare', () => {
  it('POSTs the whitelisted blind count body and returns the normal comparison document', async () => {
    const response = {
      sessionId: SESSION.id,
      status: 'SUBMITTED' as const,
      declaration: DECLARATION,
      comparison: COMPARISON_NORMAL,
    }
    vi.mocked(http.post).mockResolvedValue({ data: response })

    const result = await cashApi.declare(SESSION.id, COUNT_BODY, 'decl-key-1')

    expect(http.post).toHaveBeenCalledWith(
      `/cash-sessions/${SESSION.id}/declarations`,
      COUNT_BODY,
      { headers: { 'Idempotency-Key': 'decl-key-1' } },
    )
    expect(result).toEqual(response)
  })

  it('strips every non-whitelisted key, including a pre-submission expected/difference oracle', async () => {
    vi.mocked(http.post).mockResolvedValue({
      data: {
        sessionId: SESSION.id,
        status: 'SUBMITTED',
        declaration: DECLARATION,
        comparison: COMPARISON_NORMAL,
      },
    })
    const leakedLine = { channelKey: 'CASH', amountCents: 158000, expectedCents: 157500 }
    const leakedDenomination = { denominationCents: 100000, quantity: 1, amountCents: 100000 }
    const leakedBody = {
      lines: [leakedLine],
      denominations: [leakedDenomination],
      notes: 'Conteo inicial sin novedad',
      tenantId: 'tenant-leak',
      cashierUserId: 'actor-leak',
      expectedCents: 157500,
      differenceCents: 500,
    }

    await cashApi.declare(SESSION.id, leakedBody, 'decl-key-2')

    expect(http.post).toHaveBeenCalledWith(
      `/cash-sessions/${SESSION.id}/declarations`,
      {
        lines: [{ channelKey: 'CASH', amountCents: 158000 }],
        denominations: [{ denominationCents: 100000, quantity: 1 }],
        notes: 'Conteo inicial sin novedad',
      },
      { headers: { 'Idempotency-Key': 'decl-key-2' } },
    )
  })

  it('omits optional denominations and notes when the caller leaves them out', async () => {
    vi.mocked(http.post).mockResolvedValue({
      data: {
        sessionId: SESSION.id,
        status: 'SUBMITTED',
        declaration: DECLARATION,
        comparison: COMPARISON_NORMAL,
      },
    })

    await cashApi.declare(
      SESSION.id,
      { lines: [{ channelKey: 'CASH', amountCents: 158000 }] },
      'decl-key-3',
    )

    expect(http.post).toHaveBeenCalledWith(
      `/cash-sessions/${SESSION.id}/declarations`,
      { lines: [{ channelKey: 'CASH', amountCents: 158000 }] },
      { headers: { 'Idempotency-Key': 'decl-key-3' } },
    )
  })

  it('preserves the fallback comparison document with `differenceCents`/`notesRequired`', async () => {
    const response = {
      sessionId: SESSION.id,
      status: 'SUBMITTED' as const,
      declaration: { ...DECLARATION, notes: null },
      comparison: COMPARISON_FALLBACK,
    }
    vi.mocked(http.post).mockResolvedValue({ data: response })

    const result = await cashApi.declare(
      SESSION.id,
      { ...COUNT_BODY, notes: undefined },
      'decl-key-4',
    )

    expect(result.comparison).toEqual(COMPARISON_FALLBACK)
    expect('differenceCents' in result.comparison).toBe(true)
    expect('declarationDifferenceCents' in result.comparison).toBe(false)
  })

  it('rejects a fractional declared line before any HTTP call', async () => {
    await expect(
      cashApi.declare(
        SESSION.id,
        { lines: [{ channelKey: 'CASH', amountCents: 1580.5 }] },
        'decl-key-5',
      ),
    ).rejects.toThrow(RangeError)
    expect(http.post).not.toHaveBeenCalled()
  })

  it('accepts zero denomination quantities when cash is explicitly zero', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: {} })
    const body = {
      lines: [{ channelKey: 'CASH', amountCents: 0 }],
      denominations: [{ denominationCents: 1000, quantity: 0 }],
    }
    await cashApi.declare(SESSION.id, body, 'decl-zero')
    expect(http.post).toHaveBeenCalledWith(`/cash-sessions/${SESSION.id}/declarations`, body, {
      headers: { 'Idempotency-Key': 'decl-zero' },
    })
  })

  it.each([-1, 0.5, 2147483648])(
    'rejects invalid denomination quantity %s before transport',
    async (quantity) => {
      await expect(
        cashApi.declare(
          SESSION.id,
          {
            lines: [{ channelKey: 'CASH', amountCents: 0 }],
            denominations: [{ denominationCents: 1000, quantity }],
          },
          'decl-invalid',
        ),
      ).rejects.toThrow(RangeError)
      expect(http.post).not.toHaveBeenCalled()
    },
  )

  it('rejects zero denomination value before transport', async () => {
    await expect(
      cashApi.declare(
        SESSION.id,
        {
          lines: [{ channelKey: 'CASH', amountCents: 0 }],
          denominations: [{ denominationCents: 0, quantity: 0 }],
        },
        'decl-invalid-value',
      ),
    ).rejects.toThrow(RangeError)
    expect(http.post).not.toHaveBeenCalled()
  })
})

describe('cashApi.appendNotes', () => {
  it('POSTs /cash-sessions/:id/declaration-notes with only `notes`', async () => {
    const response = {
      sessionId: SESSION.id,
      revision: 2,
      lines: DECLARATION.lines,
      denominations: null,
      notes: 'Faltante de 500 por cambio entregado sin registrar',
    }
    vi.mocked(http.post).mockResolvedValue({ data: response })
    const leaked = {
      notes: 'Faltante de 500 por cambio entregado sin registrar',
      tenantId: 'tenant-leak',
      actorUserId: 'actor-leak',
      amountCents: 500,
    }

    const result = await cashApi.appendNotes(SESSION.id, leaked, 'notes-key-1')

    expect(http.post).toHaveBeenCalledWith(
      `/cash-sessions/${SESSION.id}/declaration-notes`,
      { notes: 'Faltante de 500 por cambio entregado sin registrar' },
      { headers: { 'Idempotency-Key': 'notes-key-1' } },
    )
    expect(result).toEqual(response)
  })
})

// ─── Independent verification ────────────────────────────────────────────────

describe('cashApi.verify', () => {
  it('POSTs the whitelisted recount body and returns verification plus the normal comparison', async () => {
    const comparison: CashComparisonNormal = {
      expectedCents: 157500,
      declaredCents: 158000,
      verifiedCents: 158300,
      declarationDifferenceCents: 500,
      verificationDifferenceCents: 300,
      verifiedVsExpectedDifferenceCents: 800,
      requiresDeclarationNotes: true,
      requiresVerificationNotes: true,
      hasDiscrepancy: true,
    }
    const response = {
      sessionId: SESSION.id,
      verification: { ...DECLARATION, actorUserId: '55555555-5555-4555-8555-555555555555' },
      comparison,
    }
    vi.mocked(http.post).mockResolvedValue({ data: response })
    const leakedLine = { channelKey: 'CASH', amountCents: 158300, expectedCents: 157500 }
    const leakedBody = { lines: [leakedLine], notes: 'Recuento', expectedCents: 157500 }

    const result = await cashApi.verify(SESSION.id, leakedBody, 'verify-key-1')

    expect(http.post).toHaveBeenCalledWith(
      `/cash-sessions/${SESSION.id}/verifications`,
      { lines: [{ channelKey: 'CASH', amountCents: 158300 }], notes: 'Recuento' },
      { headers: { 'Idempotency-Key': 'verify-key-1' } },
    )
    expect(result).toEqual(response)
  })

  it('rejects a fractional recount before any HTTP call', async () => {
    await expect(
      cashApi.verify(
        SESSION.id,
        { lines: [{ channelKey: 'CASH', amountCents: 1.5 }] },
        'verify-key-2',
      ),
    ).rejects.toThrow(RangeError)
    expect(http.post).not.toHaveBeenCalled()
  })
})

// ─── Manual movements ────────────────────────────────────────────────────────

describe('cashApi.cashIn / cashApi.cashOut', () => {
  it('POSTs /cash-in with amount, reason and the idempotency key', async () => {
    const response = {
      id: 'b0000004-0000-4000-8000-000000000004',
      sessionId: SESSION.id,
      kind: 'CASH_IN' as const,
      deltaCents: 20000,
      occurredAt: '2026-10-07T17:15:00.000Z',
    }
    vi.mocked(http.post).mockResolvedValue({ data: response })

    const result = await cashApi.cashIn(
      SESSION.id,
      { amountCents: 20000, reason: 'Cambio adicional para morralla' },
      'in-key-1',
    )

    expect(http.post).toHaveBeenCalledWith(
      `/cash-sessions/${SESSION.id}/cash-in`,
      { amountCents: 20000, reason: 'Cambio adicional para morralla' },
      { headers: { 'Idempotency-Key': 'in-key-1' } },
    )
    expect(result).toEqual(response)
  })

  it('POSTs /cash-out and strips tenant/actor/delta leaks', async () => {
    const response = {
      id: 'b0000005-0000-4000-8000-000000000005',
      sessionId: SESSION.id,
      kind: 'CASH_OUT' as const,
      deltaCents: -2500,
      occurredAt: '2026-10-07T17:45:00.000Z',
    }
    vi.mocked(http.post).mockResolvedValue({ data: response })
    const leaked = {
      amountCents: 2500,
      reason: 'Compra de bolsas',
      deltaCents: -2500,
      tenantId: 'tenant-leak',
      actorUserId: 'actor-leak',
    }

    const result = await cashApi.cashOut(SESSION.id, leaked, 'out-key-1')

    expect(http.post).toHaveBeenCalledWith(
      `/cash-sessions/${SESSION.id}/cash-out`,
      { amountCents: 2500, reason: 'Compra de bolsas' },
      { headers: { 'Idempotency-Key': 'out-key-1' } },
    )
    expect(result).toEqual(response)
  })

  it('rejects a fractional movement amount before any HTTP call', async () => {
    await expect(
      cashApi.cashIn(SESSION.id, { amountCents: 2500.25, reason: 'Compra de bolsas' }, 'in-key-2'),
    ).rejects.toThrow(RangeError)
    expect(http.post).not.toHaveBeenCalled()
  })
})

// ─── Custody, FLOAT receipt and drawer release ───────────────────────────────

describe('cashApi.declareHandover', () => {
  it('POSTs /handovers with the declared custody and the idempotency key', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: HANDOVER })

    const result = await cashApi.declareHandover(
      SESSION.id,
      {
        handoverKind: 'FLOAT',
        recipientUserId: '66666666-6666-4666-8666-666666666666',
        declaredCents: 150000,
        notes: 'Fondo para el siguiente turno',
      },
      'handover-key-1',
    )

    expect(http.post).toHaveBeenCalledWith(
      `/cash-sessions/${SESSION.id}/handovers`,
      {
        handoverKind: 'FLOAT',
        recipientUserId: '66666666-6666-4666-8666-666666666666',
        declaredCents: 150000,
        notes: 'Fondo para el siguiente turno',
      },
      { headers: { 'Idempotency-Key': 'handover-key-1' } },
    )
    expect(result).toEqual(HANDOVER)
  })

  it('omits optional notes and never lets a receipt actor leak into the declaration', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: HANDOVER })
    const leaked = {
      handoverKind: 'WITHDRAWAL' as const,
      recipientUserId: '66666666-6666-4666-8666-666666666666',
      declaredCents: 8000,
      receiptActorUserId: 'actor-leak',
      receivedCents: 8000,
      tenantId: 'tenant-leak',
    }

    await cashApi.declareHandover(SESSION.id, leaked, 'handover-key-2')

    expect(http.post).toHaveBeenCalledWith(
      `/cash-sessions/${SESSION.id}/handovers`,
      {
        handoverKind: 'WITHDRAWAL',
        recipientUserId: '66666666-6666-4666-8666-666666666666',
        declaredCents: 8000,
      },
      { headers: { 'Idempotency-Key': 'handover-key-2' } },
    )
  })

  it('rejects an out-of-range declared amount before any HTTP call', async () => {
    await expect(
      cashApi.declareHandover(
        SESSION.id,
        {
          handoverKind: 'FLOAT',
          recipientUserId: '66666666-6666-4666-8666-666666666666',
          declaredCents: 2147483648,
        },
        'handover-key-3',
      ),
    ).rejects.toThrow(RangeError)
    expect(http.post).not.toHaveBeenCalled()
  })
})

describe('cashApi.receiveHandover', () => {
  it('POSTs /cash-handovers/:id/receive with the explicit received amount only', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: HANDOVER })
    const leaked = {
      receivedCents: 150000,
      notes: 'Recibido en efectivo',
      recipientUserId: 'recipient-leak',
      receiptActorUserId: 'actor-leak',
      receivedAt: '2026-10-07T19:25:00.000Z',
    }

    const result = await cashApi.receiveHandover(HANDOVER.id, leaked, 'receive-key-1')

    expect(http.post).toHaveBeenCalledWith(
      `/cash-handovers/${HANDOVER.id}/receive`,
      { receivedCents: 150000, notes: 'Recibido en efectivo' },
      { headers: { 'Idempotency-Key': 'receive-key-1' } },
    )
    expect(result).toEqual(HANDOVER)
  })

  it('rejects a fractional received amount before any HTTP call', async () => {
    await expect(
      cashApi.receiveHandover(HANDOVER.id, { receivedCents: 1500.5 }, 'receive-key-2'),
    ).rejects.toThrow(RangeError)
    expect(http.post).not.toHaveBeenCalled()
  })
})

describe('cashApi.getCustody', () => {
  it('GETs /cash-handovers/custody with only page/limit and returns both sub-pages', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: CUSTODY })
    const leaked = {
      page: 1,
      limit: 25,
      tenantId: 'tenant-leak',
      recipientUserId: 'recipient-leak',
    }

    const result = await cashApi.getCustody(leaked)

    expect(http.get).toHaveBeenCalledWith('/cash-handovers/custody', {
      params: { page: 1, limit: 25 },
    })
    expect(result).toEqual(CUSTODY)
  })

  it('keeps an unreleased source drawer visible instead of filtering or reserving it', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: CUSTODY })

    const result = await cashApi.getCustody({ page: 1, limit: 25 })

    expect(result.pendingHandovers.items[0]?.sourceDrawerReleasedAt).toBeNull()
  })
})

describe('cashApi.releaseDrawer', () => {
  it('POSTs /cash-sessions/:id/release-drawer with no body and the idempotency key', async () => {
    const response = { sessionId: SESSION.id, drawerReleasedAt: '2026-10-07T19:40:00.000Z' }
    vi.mocked(http.post).mockResolvedValue({ data: response })

    const result = await cashApi.releaseDrawer(SESSION.id, 'release-key-1')

    expect(http.post).toHaveBeenCalledWith(
      `/cash-sessions/${SESSION.id}/release-drawer`,
      undefined,
      { headers: { 'Idempotency-Key': 'release-key-1' } },
    )
    expect(result).toEqual(response)
  })
})

// ─── Transport discipline ────────────────────────────────────────────────────

describe('cashApi transport discipline', () => {
  it('sends the caller key as-is on each command without generating or reusing one', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: HANDOVER })

    await cashApi.declareHandover(
      SESSION.id,
      { handoverKind: 'FLOAT', recipientUserId: 'recipient-1', declaredCents: 1000 },
      'explicit-key-a',
    )
    await cashApi.declareHandover(
      SESSION.id,
      { handoverKind: 'FLOAT', recipientUserId: 'recipient-1', declaredCents: 1000 },
      'explicit-key-b',
    )

    expect(http.post).toHaveBeenNthCalledWith(
      1,
      `/cash-sessions/${SESSION.id}/handovers`,
      { handoverKind: 'FLOAT', recipientUserId: 'recipient-1', declaredCents: 1000 },
      { headers: { 'Idempotency-Key': 'explicit-key-a' } },
    )
    expect(http.post).toHaveBeenNthCalledWith(
      2,
      `/cash-sessions/${SESSION.id}/handovers`,
      { handoverKind: 'FLOAT', recipientUserId: 'recipient-1', declaredCents: 1000 },
      { headers: { 'Idempotency-Key': 'explicit-key-b' } },
    )
  })

  it('propagates a transport failure without an automatic retry', async () => {
    vi.mocked(http.post).mockRejectedValue(new Error('422 CASH_DISCREPANCY_NOTES_REQUIRED'))

    await expect(cashApi.declare(SESSION.id, COUNT_BODY, 'decl-key-7')).rejects.toThrow(
      '422 CASH_DISCREPANCY_NOTES_REQUIRED',
    )
    expect(http.post).toHaveBeenCalledTimes(1)
  })

  it('never attaches an idempotency header to a GET read', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: DETAIL_OPEN_BLIND })

    await cashApi.getSession(SESSION.id)

    expect(http.get).toHaveBeenCalledWith(`/cash-sessions/${SESSION.id}`)
    expect(vi.mocked(http.get).mock.calls[0]?.[1]).toBeUndefined()
  })
})
