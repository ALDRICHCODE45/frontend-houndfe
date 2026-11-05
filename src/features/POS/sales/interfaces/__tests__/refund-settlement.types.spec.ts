import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { parseRefundSettlementResponse } from '../refund-settlement.types'

// Real exchanges from odd/handoff/06-refund-settlements.md §4 and §5.
const PARTIAL = {
  settlementId: '1cd165f0-6aa9-4001-8441-b8648ca54b07',
  refundId: 'cmw2iwsa00000r965efhf292s',
  saleId: '291e8f35-0c17-46df-8c87-6ad6cbfdcd46',
  amountCents: 2000,
  method: 'cash',
  reference: 'DOC-EXAMPLE',
  settledAt: '2026-11-05T16:30:00.000Z',
  settledCents: 4000,
  outstandingCents: 2555,
}

const FINAL = {
  settlementId: 'b642c79a-1522-4db6-84cf-e66392c9d038',
  refundId: 'cmw2iwsa00000r965efhf292s',
  saleId: '291e8f35-0c17-46df-8c87-6ad6cbfdcd46',
  amountCents: 2555,
  method: 'transfer',
  reference: 'DOC-EXAMPLE SPEI 0012345678',
  settledAt: '2026-11-05T17:00:00.000Z',
  settledCents: 6555,
  outstandingCents: 0,
}

// The replay comes back from the DB with another key order (§5).
const REPLAY = JSON.parse(
  '{"method":"cash","saleId":"291e8f35-0c17-46df-8c87-6ad6cbfdcd46","refundId":"cmw2iwsa00000r965efhf292s","reference":"DOC-EXAMPLE","settledAt":"2026-11-05T16:30:00.000Z","amountCents":2000,"settledCents":4000,"settlementId":"1cd165f0-6aa9-4001-8441-b8648ca54b07","outstandingCents":2555}',
)

const expected = { refundId: 'cmw2iwsa00000r965efhf292s' }

describe('parseRefundSettlementResponse', () => {
  it('accepts the real partial settlement', () => {
    expect(parseRefundSettlementResponse(PARTIAL, expected)).toEqual(PARTIAL)
  })

  it('accepts the real final settlement (outstanding 0)', () => {
    expect(parseRefundSettlementResponse(FINAL, expected)).toEqual(FINAL)
  })

  it('accepts the replay whatever its key order, compared by field', () => {
    expect(parseRefundSettlementResponse(REPLAY, expected)).toEqual(PARTIAL)
  })

  it('accepts a null reference (omitted in the request)', () => {
    expect(parseRefundSettlementResponse({ ...PARTIAL, reference: null }, expected).reference).toBeNull()
  })

  it('rejects an unknown key (strict)', () => {
    expect(() => parseRefundSettlementResponse({ ...PARTIAL, note: 'x' }, expected)).toThrow(ZodError)
  })

  it('rejects a missing key', () => {
    const { settledCents: _omit, ...rest } = PARTIAL
    expect(() => parseRefundSettlementResponse(rest, expected)).toThrow(ZodError)
  })

  it('rejects a response for another refund', () => {
    expect(() =>
      parseRefundSettlementResponse(PARTIAL, { refundId: 'cmw2iwsdh0001r965z1rmw0n0' }),
    ).toThrow(ZodError)
  })

  it.each([
    ['an unknown method', { method: 'check' }],
    ['a zero amount', { amountCents: 0 }],
    ['fractional cents', { amountCents: 10.5 }],
    ['negative outstanding', { outstandingCents: -1 }],
    ['a settledAt with no zone', { settledAt: '2026-11-05T11:05:00' }],
    ['a settled total below this return', { settledCents: 1999 }],
  ])('rejects %s', (_label, patch) => {
    expect(() => parseRefundSettlementResponse({ ...PARTIAL, ...patch }, expected)).toThrow(ZodError)
  })
})
