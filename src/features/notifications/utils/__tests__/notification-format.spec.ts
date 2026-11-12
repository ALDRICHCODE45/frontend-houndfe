import { describe, expect, it } from 'vitest'
import {
  bellLabel,
  countLabel,
  groupByDay,
  isClosedNotice,
  notificationCauseText,
  notificationDetailPath,
  notificationMeta,
  notificationReasonLabel,
  notificationRef,
  relativeTime,
} from '../notification-format'
import type { NotificationItem } from '../../interfaces/notifications.types'

// Local-time instants: grouping runs in the runtime zone, so the fixtures are built with it.
const NOW = new Date(2026, 10, 11, 11, 5, 0)
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000)

function item(over: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    type: 'REQUEST_CREATED',
    title: 'Nueva solicitud',
    body: 'Pregunta sin respuesta · S-000123',
    requestId: 'r1',
    createdAt: minutesAgo(5).toISOString(),
    readAt: null,
    ...over,
  }
}

describe('notificationMeta (text label, icon and tone per type)', () => {
  it.each([
    ['REQUEST_CREATED', 'Nueva', 'info'],
    ['REQUEST_REASSIGNED', 'Reasignada a ti', 'info'],
    ['REQUEST_CANCELLED', 'Cerrada', 'neutral'],
    ['REQUEST_CLAIM_REMINDER', 'Sin tomar', 'warning'],
    ['REQUEST_ESCALATION', 'Por vencer', 'warning'],
    ['REQUEST_OVERDUE', 'Vencida', 'danger'],
  ])('%s reads «%s» in the %s tone', (type, label, tone) => {
    const meta = notificationMeta(type)
    expect(meta.label).toBe(label)
    expect(meta.tone).toBe(tone)
    expect(meta.icon).toMatch(/^i-lucide-/)
  })

  it('falls back to a neutral «Aviso» for a type it has never seen', () => {
    expect(notificationMeta('SOMETHING_NEW')).toMatchObject({ label: 'Aviso', tone: 'neutral' })
  })
})

describe('countLabel / bellLabel', () => {
  it('caps the count at «99+»', () => {
    expect(countLabel(0)).toBe('0')
    expect(countLabel(99)).toBe('99')
    expect(countLabel(100)).toBe('99+')
    expect(countLabel(1234)).toBe('99+')
  })

  it('names the count in the aria-label, with the real number up to 99', () => {
    expect(bellLabel(0, false)).toBe('Notificaciones, sin avisos nuevos')
    expect(bellLabel(3, false)).toBe('Notificaciones, 3 sin leer')
    expect(bellLabel(250, false)).toBe('Notificaciones, más de 99 sin leer')
  })

  it('says when the count could not be refreshed', () => {
    expect(bellLabel(3, true)).toBe('Notificaciones, 3 sin leer (no se pudo actualizar)')
  })
})

describe('notificationDetailPath', () => {
  it('points at the request detail, encoded', () => {
    expect(notificationDetailPath('2b7c')).toBe('/chatbot/solicitudes/2b7c')
    expect(notificationDetailPath('a/b')).toBe('/chatbot/solicitudes/a%2Fb')
  })

  it('is null when the notice is not about a request', () => {
    expect(notificationDetailPath(null)).toBeNull()
  })
})

describe('relativeTime', () => {
  it('ahora under a minute, hace N min under an hour', () => {
    expect(relativeTime(minutesAgo(0).toISOString(), NOW)).toBe('ahora')
    expect(relativeTime(minutesAgo(7).toISOString(), NOW)).toBe('hace 7 min')
  })

  it('the clock time later the same day', () => {
    expect(relativeTime(new Date(2026, 10, 11, 8, 30).toISOString(), NOW)).toBe('08:30')
  })

  it('ayer with the time, then weekday and date', () => {
    expect(relativeTime(new Date(2026, 10, 10, 17, 2).toISOString(), NOW)).toBe('ayer 17:02')
    expect(relativeTime(new Date(2026, 10, 9, 9, 0).toISOString(), NOW)).toBe('lun 9 nov')
  })
})

describe('groupByDay', () => {
  it('splits «Hoy» from «Antes» and drops empty groups', () => {
    const today = item({ id: 'a' })
    const before = item({ id: 'b', createdAt: new Date(2026, 10, 9, 9, 0).toISOString() })

    expect(groupByDay([today, before], NOW).map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Hoy', ['a']],
      ['Antes', ['b']],
    ])
    expect(groupByDay([before], NOW).map((g) => g.label)).toEqual(['Antes'])
    expect(groupByDay([], NOW)).toEqual([])
  })
})

describe('structured fields helpers', () => {
  it('notificationRef joins folio and the shared subtype label', () => {
    expect(notificationRef({ folio: 'S-000118', subtype: 'UNKNOWN_QUESTION' })).toBe('S-000118 · Pregunta del bot')
    expect(notificationRef({ folio: null, subtype: null })).toBeNull()
    expect(notificationRef({})).toBeNull()
    expect(notificationRef({ folio: 'S-1', subtype: 'FUTURE' })).toBe('S-1')
  })

  it('notificationReasonLabel only speaks on 80 % / overdue notices', () => {
    expect(notificationReasonLabel({ type: 'REQUEST_OVERDUE', reason: 'ASSIGNEE' })).toBe('Tuya')
    expect(notificationReasonLabel({ type: 'REQUEST_ESCALATION', reason: 'ESCALATION' })).toBe('Por escalamiento')
    expect(notificationReasonLabel({ type: 'REQUEST_CREATED', reason: 'ASSIGNEE' })).toBeNull()
    expect(notificationReasonLabel({ type: 'REQUEST_OVERDUE', reason: null })).toBeNull()
  })

  it('notificationCauseText uses the handoff copy and skips what the title already says', () => {
    expect(notificationCauseText({ type: 'REQUEST_CANCELLED', cause: 'SIBLING_RESOLVED', title: 'x' })).toBe(
      'Se resolvió junto con otras de su zona',
    )
    expect(
      notificationCauseText({
        type: 'REQUEST_CANCELLED',
        cause: 'MERGED',
        title: 'Otra persona la unió con otra solicitud del cliente',
      }),
    ).toBeNull()
    expect(notificationCauseText({ type: 'REQUEST_CANCELLED', cause: null, title: 'x' })).toBeNull()
  })

  it('isClosedNotice is true only for requestOpen === false off the cancelled type', () => {
    expect(isClosedNotice({ type: 'REQUEST_OVERDUE', requestOpen: false })).toBe(true)
    expect(isClosedNotice({ type: 'REQUEST_OVERDUE', requestOpen: null })).toBe(false)
    expect(isClosedNotice({ type: 'REQUEST_OVERDUE' })).toBe(false)
    expect(isClosedNotice({ type: 'REQUEST_CANCELLED', requestOpen: false })).toBe(false)
  })
})
