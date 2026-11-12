import { describe, expect, it } from 'vitest'
import { makeGroup, makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'
import {
  groupCountLabel,
  groupDisplayName,
  groupPhone,
  groupTone,
  mergeGroupRows,
  overdueCount,
  pausedResumeAt,
  rowTone,
} from '../list-group'

const NOW = new Date('2026-11-11T17:05:00.000Z')

describe('rowTone — only the backend slaLevel, paused and scheduled', () => {
  it('maps the levels to the traffic light', () => {
    expect(rowTone(makeRow({ slaLevel: 'OK' }), NOW)).toBe('ok')
    expect(rowTone(makeRow({ slaLevel: 'HALF' }), NOW)).toBe('warn')
    expect(rowTone(makeRow({ slaLevel: 'ESCALATION' }), NOW)).toBe('bad')
    expect(rowTone(makeRow({ slaLevel: 'OVERDUE' }), NOW)).toBe('bad')
  })

  it('OVERDUE stays red while paused; another level reads as paused', () => {
    expect(rowTone(makeRow({ slaLevel: 'OVERDUE', slaPaused: true }), NOW)).toBe('bad')
    expect(rowTone(makeRow({ slaLevel: 'HALF', slaPaused: true }), NOW)).toBe('pause')
  })

  it('a future scheduledFor is scheduled; closed rows and no level have no tone', () => {
    expect(rowTone(makeRow({ scheduledFor: '2026-11-17T16:30:00.000Z' }), NOW)).toBe('sched')
    expect(rowTone(makeRow({ status: 'RESOLVED', displayStatus: 'RESOLVED', slaLevel: null }), NOW)).toBeNull()
    expect(rowTone(makeRow({ slaLevel: null }), NOW)).toBe('none')
  })
})

describe('groupTone — the most urgent row', () => {
  it('red beats amber beats green', () => {
    const rows = [makeRow({ id: 'a', slaLevel: 'OK' }), makeRow({ id: 'b', slaLevel: 'ESCALATION' }), makeRow({ id: 'c', slaLevel: 'HALF' })]
    expect(groupTone(rows, NOW)).toBe('bad')
    expect(groupTone(rows.slice(0, 1).concat(rows.slice(2)), NOW)).toBe('warn')
  })

  it('a group of closed rows (or none) is «none»', () => {
    expect(groupTone([], NOW)).toBe('none')
    expect(groupTone([makeRow({ status: 'CANCELLED', displayStatus: 'CANCELLED', slaLevel: null })], NOW)).toBe('none')
  })
})

describe('overdueCount', () => {
  it('counts open rows with overdueAt / EXPIRED, never closed ones', () => {
    const rows = [
      makeRow({ id: 'a', overdueAt: '2026-11-11T16:00:00.000Z', displayStatus: 'EXPIRED' }),
      makeRow({ id: 'b' }),
      makeRow({ id: 'c', status: 'RESOLVED', displayStatus: 'RESOLVED', overdueAt: '2026-11-10T16:00:00.000Z' }),
    ]
    expect(overdueCount(rows)).toBe(1)
  })
})

describe('mergeGroupRows — «Ver las N restantes»', () => {
  it('keeps the first rows, appends the new ones, never repeats an id', () => {
    const first = [makeRow({ id: 'a' }), makeRow({ id: 'b' })]
    const fetched = [makeRow({ id: 'b' }), makeRow({ id: 'c' }), makeRow({ id: 'd' })]
    expect(mergeGroupRows(first, fetched).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('group header copy', () => {
  it('open tabs read «N abiertas» from the customer total', () => {
    const group = { ...makeGroup('k1.a'), openCount: 11 }
    expect(groupCountLabel(group, 'open', 3)).toBe('11 abiertas')
    expect(groupCountLabel({ ...group, openCount: 1 }, 'scheduled', 1)).toBe('1 abierta')
  })

  it('closed tabs read the closed rows of the group (loaded + the rest)', () => {
    const group = { ...makeGroup('k1.a'), openCount: 0, moreRequests: 4 }
    expect(groupCountLabel(group, 'resolved', 10)).toBe('14 resueltas')
    expect(groupCountLabel({ ...group, moreRequests: 0 }, 'cancelled', 1)).toBe('1 cancelada')
  })

  it('name and phone are what the server sent', () => {
    expect(groupDisplayName({ id: null, displayName: null, phone: null, isTrusted: false })).toBe('Cliente sin vincular')
    expect(groupDisplayName({ id: 'c', displayName: 'Ana López', phone: null, isTrusted: true })).toBe('Ana López')
    expect(groupPhone({ id: null, displayName: null, phone: '55 **** 5678', isTrusted: false })).toBe('55 **** 5678')
    expect(groupPhone({ id: null, displayName: null, phone: null, isTrusted: false })).toBe('Sin teléfono')
  })
})

describe('pausedResumeAt', () => {
  it('is the first slaResumesAt of a paused open row, else null', () => {
    const rows = [makeRow({ id: 'a' }), makeRow({ id: 'b', slaPaused: true, slaResumesAt: '2026-11-12T15:00:00.000Z' })]
    expect(pausedResumeAt(rows)).toEqual({ paused: true, resumesAt: '2026-11-12T15:00:00.000Z' })
    expect(pausedResumeAt([makeRow()])).toEqual({ paused: false, resumesAt: null })
  })

  it('paused with no resume time still reports paused', () => {
    expect(pausedResumeAt([makeRow({ slaPaused: true, slaResumesAt: null })])).toEqual({ paused: true, resumesAt: null })
  })
})
