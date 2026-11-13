import { describe, expect, it } from 'vitest'
import { makeMessage } from '../conversation-fixture'
import {
  authorLabel,
  formatBytes,
  momentLabel,
  groupByDay,
  mediaKind,
  messageSide,
  messageTime,
} from '../conversation-format'

const TZ = 'America/Mexico_City'
const NOW = new Date('2026-11-12T18:00:00.000Z') // jueves 12 nov, 12:00 en CDMX

describe('messageSide', () => {
  it('puts the customer left and the bot / staff right, by author', () => {
    expect(messageSide(makeMessage({ author: 'CUSTOMER', direction: 'IN' }))).toBe('them')
    expect(messageSide(makeMessage({ author: 'BOT', direction: 'OUT' }))).toBe('bot')
    expect(messageSide(makeMessage({ author: 'STAFF', direction: 'OUT' }))).toBe('staff')
    expect(messageSide(makeMessage({ author: 'SYSTEM', direction: 'OUT', type: 'SYSTEM' }))).toBe('system')
  })
})

describe('authorLabel', () => {
  it('names Cliente, Bot, the staff member and Sistema', () => {
    expect(authorLabel(makeMessage({ author: 'CUSTOMER' }))).toBe('Cliente')
    expect(authorLabel(makeMessage({ author: 'BOT' }))).toBe('Bot')
    expect(authorLabel(makeMessage({ author: 'STAFF', staff: { id: 'u', displayName: 'Ana Ruiz' } }))).toBe('Ana Ruiz')
    expect(authorLabel(makeMessage({ author: 'STAFF', staff: null }))).toBe('Equipo')
    expect(authorLabel(makeMessage({ author: 'SYSTEM' }))).toBe('Sistema')
  })
})

describe('messageTime', () => {
  it('shows the provider time in the given zone, falling back to createdAt', () => {
    expect(messageTime(makeMessage({ providerTimestamp: '2026-11-12T16:05:00.000Z' }), TZ)).toBe('10:05')
    expect(
      messageTime(makeMessage({ providerTimestamp: null, createdAt: '2026-11-12T21:30:00.000Z' }), TZ),
    ).toBe('15:30')
  })

  it('is empty for an invalid date', () => {
    expect(messageTime(makeMessage({ providerTimestamp: null, createdAt: 'nope' }), TZ)).toBe('')
  })
})

describe('groupByDay', () => {
  it('splits by local day in seq order with Hoy, Ayer and a dated label', () => {
    const groups = groupByDay(
      [
        makeMessage({ seq: 1, providerTimestamp: '2026-11-09T16:00:00.000Z' }),
        makeMessage({ seq: 2, providerTimestamp: '2026-11-11T16:00:00.000Z' }),
        makeMessage({ seq: 3, providerTimestamp: '2026-11-11T17:00:00.000Z' }),
        makeMessage({ seq: 4, providerTimestamp: '2026-11-12T15:00:00.000Z' }),
      ],
      { now: NOW, timeZone: TZ },
    )
    expect(groups.map((g) => g.label)).toEqual(['lun 9 nov', 'Ayer', 'Hoy'])
    expect(groups.map((g) => g.messages.map((m) => m.seq))).toEqual([[1], [2, 3], [4]])
  })

  it('uses the local day, not UTC (23:30 CDMX is the next UTC day)', () => {
    const groups = groupByDay(
      [
        makeMessage({ seq: 1, providerTimestamp: '2026-11-12T05:30:00.000Z' }), // 11 nov 23:30 CDMX
        makeMessage({ seq: 2, providerTimestamp: '2026-11-12T06:30:00.000Z' }), // 12 nov 00:30 CDMX
      ],
      { now: NOW, timeZone: TZ },
    )
    expect(groups.map((g) => g.label)).toEqual(['Ayer', 'Hoy'])
  })

  it('adds the year for another year', () => {
    const groups = groupByDay([makeMessage({ providerTimestamp: '2025-03-02T16:00:00.000Z' })], { now: NOW, timeZone: TZ })
    expect(groups[0]!.label).toBe('dom 2 mar 2025')
  })

  it('returns no groups for no messages', () => {
    expect(groupByDay([], { now: NOW, timeZone: TZ })).toEqual([])
  })
})

describe('mediaKind', () => {
  const media = { id: 'm', mimeType: 'x', sizeBytes: 1, durationSec: null, hasThumb: false, purged: false }
  it('maps each type to its inline treatment', () => {
    expect(mediaKind(makeMessage({ type: 'IMAGE', media }))).toBe('image')
    expect(mediaKind(makeMessage({ type: 'STICKER', media }))).toBe('sticker')
    expect(mediaKind(makeMessage({ type: 'DOCUMENT', media }))).toBe('pdf')
    expect(mediaKind(makeMessage({ type: 'AUDIO', media }))).toBe('audio')
  })

  it('is null for text, templates, unsupported and for a media type without a media object', () => {
    expect(mediaKind(makeMessage({ type: 'TEXT' }))).toBeNull()
    expect(mediaKind(makeMessage({ type: 'TEMPLATE' }))).toBeNull()
    expect(mediaKind(makeMessage({ type: 'UNSUPPORTED', text: 'Video recibido' }))).toBeNull()
    expect(mediaKind(makeMessage({ type: 'IMAGE', media: null }))).toBeNull()
  })
})

describe('formatBytes', () => {
  it('reads KB and MB, tolerating null', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(182_344)).toBe('178 KB')
    expect(formatBytes(2_621_440)).toBe('2.5 MB')
    expect(formatBytes(null)).toBe('')
  })
})

describe('momentLabel — «ayer a las 10:05»', () => {
  const TZ = 'America/Mexico_City'
  const now = new Date('2026-11-13T22:00:00.000Z') // 16:00 in Mexico City
  it('says hoy, ayer or the date, then the local time', () => {
    expect(momentLabel('2026-11-13T16:05:00.000Z', { now, timeZone: TZ })).toBe('hoy a las 10:05')
    expect(momentLabel('2026-11-12T16:05:00.000Z', { now, timeZone: TZ })).toBe('ayer a las 10:05')
    expect(momentLabel('2026-11-09T16:05:00.000Z', { now, timeZone: TZ })).toBe('el lun 9 nov a las 10:05')
  })
  it('is null without a valid date', () => {
    expect(momentLabel(null, { now, timeZone: TZ })).toBeNull()
    expect(momentLabel('nope', { now, timeZone: TZ })).toBeNull()
  })
})
