import { describe, expect, it } from 'vitest'
import { makeMessage } from '../conversation-fixture'
import { appendNewer, emptyThread, firstSeq, lastSeq, mergeMessages, prependOlder } from '../conversation-thread'

const seqs = (items: { seq: number }[]) => items.map((m) => m.seq)

describe('mergeMessages', () => {
  it('orders by seq, never by timestamps', () => {
    const a = makeMessage({ seq: 3, createdAt: '2026-11-09T10:00:00.000Z' })
    const b = makeMessage({ seq: 2, createdAt: '2026-11-09T11:00:00.000Z' })
    expect(seqs(mergeMessages([a], [b]))).toEqual([2, 3])
  })

  it('dedupes by seq and the incoming copy wins (a status that moved forward)', () => {
    const old = makeMessage({ seq: 5, deliveryStatus: 'SENT' })
    const fresh = makeMessage({ seq: 5, deliveryStatus: 'READ' })
    const merged = mergeMessages([makeMessage({ seq: 4 }), old], [fresh, makeMessage({ seq: 6 })])
    expect(seqs(merged)).toEqual([4, 5, 6])
    expect(merged[1]!.deliveryStatus).toBe('READ')
  })

  it('does not mutate its inputs', () => {
    const existing = [makeMessage({ seq: 1 })]
    mergeMessages(existing, [makeMessage({ seq: 0 })])
    expect(seqs(existing)).toEqual([1])
  })
})

describe('thread paging helpers', () => {
  it('starts empty with nothing older', () => {
    expect(emptyThread()).toEqual({ items: [], hasMoreBefore: false })
  })

  it('prependOlder takes hasMoreBefore from the older page', () => {
    const thread = { items: [makeMessage({ seq: 10 })], hasMoreBefore: true }
    const next = prependOlder(thread, { items: [makeMessage({ seq: 8 }), makeMessage({ seq: 9 })], hasMoreBefore: false })
    expect(seqs(next.items)).toEqual([8, 9, 10])
    expect(next.hasMoreBefore).toBe(false)
  })

  it('appendNewer keeps the thread hasMoreBefore (an after page says nothing new about older)', () => {
    const thread = { items: [makeMessage({ seq: 10 })], hasMoreBefore: true }
    const next = appendNewer(thread, { items: [makeMessage({ seq: 11 })], hasMoreBefore: true })
    expect(seqs(next.items)).toEqual([10, 11])
    expect(next.hasMoreBefore).toBe(true)
    const none = appendNewer({ items: [], hasMoreBefore: false }, { items: [makeMessage({ seq: 1 })], hasMoreBefore: false })
    expect(none.hasMoreBefore).toBe(false)
  })

  it('firstSeq / lastSeq: null for an empty thread', () => {
    expect(firstSeq([])).toBeNull()
    expect(lastSeq([])).toBeNull()
    const items = [makeMessage({ seq: 4 }), makeMessage({ seq: 9 })]
    expect(firstSeq(items)).toBe(4)
    expect(lastSeq(items)).toBe(9)
  })
})

describe('mergeMessages — T5L.F: a staff delivery status never goes backwards', () => {
  const out = (seq: number, deliveryStatus: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'DEFERRED' | 'UNKNOWN' | 'FAILED') =>
    makeMessage({ seq, direction: 'OUT', author: 'STAFF', deliveryStatus })
  const statusOf = (existing: ReturnType<typeof out>, incoming: ReturnType<typeof out>) =>
    mergeMessages([existing], [incoming])[0]!.deliveryStatus

  it.each([
    ['READ', 'DELIVERED'],
    ['READ', 'SENT'],
    ['READ', 'QUEUED'],
    ['DELIVERED', 'SENT'],
    ['DELIVERED', 'QUEUED'],
    ['SENT', 'QUEUED'],
  ] as const)('a stale %s → %s answer keeps %s', (held, stale) => {
    expect(statusOf(out(5, held), out(5, stale))).toBe(held)
  })

  it.each([
    ['QUEUED', 'SENT'],
    ['SENT', 'DELIVERED'],
    ['DELIVERED', 'READ'],
    ['QUEUED', 'READ'],
    ['SENT', 'SENT'],
  ] as const)('%s → %s moves forward', (held, next) => {
    expect(statusOf(out(5, held), out(5, next))).toBe(next)
  })

  it.each(['DEFERRED', 'UNKNOWN', 'FAILED'] as const)('%s from the server is always taken (it is not on the ladder)', (next) => {
    expect(statusOf(out(5, 'READ'), out(5, next))).toBe(next)
    expect(statusOf(out(5, 'SENT'), out(5, next))).toBe(next)
  })

  it.each(['DEFERRED', 'UNKNOWN', 'FAILED'] as const)('a resend or a late report after %s moves it back onto the ladder', (held) => {
    expect(statusOf(out(5, held), out(5, 'QUEUED'))).toBe('QUEUED')
    expect(statusOf(out(5, held), out(5, 'DELIVERED'))).toBe('DELIVERED')
  })

  it('keeps the rest of the incoming copy while holding the status', () => {
    const merged = mergeMessages([out(5, 'READ')], [{ ...out(5, 'SENT'), text: 'corregido' }])
    expect(merged[0]).toMatchObject({ deliveryStatus: 'READ', text: 'corregido' })
  })

  it('does not apply to customer messages', () => {
    const merged = mergeMessages([makeMessage({ seq: 5, deliveryStatus: 'READ' })], [makeMessage({ seq: 5, deliveryStatus: 'SENT' })])
    expect(merged[0]!.deliveryStatus).toBe('SENT')
  })
})
