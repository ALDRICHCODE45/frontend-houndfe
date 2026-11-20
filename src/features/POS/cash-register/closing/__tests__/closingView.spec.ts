import { describe, expect, it } from 'vitest'
import {
  closingDateRange,
  closingHandoverReceiverName,
  closingPersonName,
  displayClosingFolio,
  sortedClosingHandovers,
} from '../closingView'
import { CLOSING } from './closingFixtures'

describe('sortedClosingHandovers', () => {
  it('sorts the unordered snapshot handovers by declaredAt, then id', () => {
    const sorted = sortedClosingHandovers(CLOSING.snapshot.handovers)
    expect(sorted.map((h) => h.kind)).toEqual(['WITHDRAWAL', 'FLOAT'])
    // The source array is never mutated.
    expect(CLOSING.snapshot.handovers[0]!.kind).toBe('FLOAT')
  })

  it('breaks declaredAt ties by handoverId', () => {
    const [a, b] = CLOSING.snapshot.handovers
    const same = [
      { ...a!, handoverId: 'b', declaredAt: '2026-11-05T22:00:00.000Z' },
      { ...b!, handoverId: 'a', declaredAt: '2026-11-05T22:00:00.000Z' },
    ]
    expect(sortedClosingHandovers(same).map((h) => h.handoverId)).toEqual(['a', 'b'])
  })
})

describe('closingPersonName', () => {
  it('names the people the snapshot knows', () => {
    const s = CLOSING.snapshot
    expect(closingPersonName(s, s.cashierUserId)).toBe('Ana Cajera')
    expect(closingPersonName(s, s.closedByUserId)).toBe('Luis Supervisor')
    expect(closingPersonName(s, 'someone-else')).toBe('Otra persona')
    expect(closingPersonName(s, null)).toBe('—')
  })
})

describe('closingDateRange', () => {
  it('turns local days into an ISO range with explicit timezone (to is exclusive)', () => {
    const range = closingDateRange('2026-11-01', '2026-11-03')
    expect(range.from).toBe(new Date(2026, 10, 1).toISOString())
    expect(range.to).toBe(new Date(2026, 10, 4).toISOString())
  })

  it('omits empty ends', () => {
    expect(closingDateRange('', '')).toEqual({})
    expect(Object.keys(closingDateRange('2026-11-01', ''))).toEqual(['from'])
  })
})

describe('closingHandoverReceiverName', () => {
  const s = CLOSING.snapshot
  const base = { ...s.handovers[0]!, receiverUserId: null, receiptActorUserId: null }

  it('prefers the receipt actor name when that id is set', () => {
    const h = { ...base, receiptActorUserId: 'u-actor', receiverUserId: 'u-recv', receiptActorName: '  Rosa Recibe ', receiverName: 'Otro Nombre' }
    expect(closingHandoverReceiverName(s, h)).toBe('Rosa Recibe')
  })

  it('uses the receiver name when there is no receipt actor', () => {
    const h = { ...base, receiverUserId: 'u-recv', receiverName: 'Rita Receptora' }
    expect(closingHandoverReceiverName(s, h)).toBe('Rita Receptora')
  })

  it('a name only counts when its own id exists', () => {
    const h = { ...base, receiptActorName: 'Fantasma', receiverName: 'Fantasma 2' }
    expect(closingHandoverReceiverName(s, h)).toBe('—')
    const h2 = { ...base, receiverUserId: 'u-recv', receiptActorName: 'Fantasma', receiverName: 'Rita' }
    expect(closingHandoverReceiverName(s, h2)).toBe('Rita')
  })

  it('blank or missing name falls back to the snapshot lookup, then «Otra persona»', () => {
    const known = { ...base, receiptActorUserId: s.cashierUserId, receiptActorName: '   ' }
    expect(closingHandoverReceiverName(s, known)).toBe('Ana Cajera')
    const unknown = { ...base, receiverUserId: 'u-unknown', receiverName: null }
    expect(closingHandoverReceiverName(s, unknown)).toBe('Otra persona')
    const missing = { ...base, receiverUserId: 'u-unknown' }
    expect(closingHandoverReceiverName(s, missing)).toBe('Otra persona')
  })

  it('both ids null → «—»', () => {
    expect(closingHandoverReceiverName(s, base)).toBe('—')
  })
})

describe('displayClosingFolio', () => {
  it('shortens an old uuid folio to its first 8 chars', () => {
    expect(displayClosingFolio('CC-2f6d9c1e-8b7a-4c3d-9e2f-1a0b9c8d7e6f')).toBe('CC-2f6d9c1e')
  })

  it('preserves case of an uppercase uuid folio', () => {
    expect(displayClosingFolio('CC-2F6D9C1E-8B7A-4C3D-9E2F-1A0B9C8D7E6F')).toBe('CC-2F6D9C1E')
  })

  it('leaves new numeric folios and arbitrary strings unchanged', () => {
    expect(displayClosingFolio('CC-000124')).toBe('CC-000124')
    expect(displayClosingFolio('CC-1000000')).toBe('CC-1000000')
    expect(displayClosingFolio('algo raro')).toBe('algo raro')
    expect(displayClosingFolio('')).toBe('')
  })
})
