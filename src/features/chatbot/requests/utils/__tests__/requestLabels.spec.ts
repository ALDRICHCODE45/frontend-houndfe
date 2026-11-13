import { describe, expect, it } from 'vitest'
import {
  AUDIT_TYPE_LABELS,
  auditEventLabel,
  CANCEL_REASON_LABELS,
  cancelCauseLabel,
  DISPLAY_STATUS_LABELS,
  formatAvailableFrom,
  formatFolioNumber,
  SLA_LEVEL_LABELS,
  STAFF_CANCEL_REASON_LABELS,
  SUBTYPE_LABELS,
  formatScheduledFor,
  formatWhen,
  windowClosingTag,
} from '../requestLabels'
import type { ChatbotRequestAuditType } from '../../interfaces/chatbot-request.types'

describe('requestLabels (copy from design/chatbot-requests)', () => {
  it('labels every subtype', () => {
    expect(SUBTYPE_LABELS).toEqual({
      RESTOCK: 'Reposición',
      EXPIRATION: 'Caducidad',
      DELIVERY_ZONE: 'Zona de entrega',
      TRANSFER_RECEIPT: 'Comprobante',
      TALK_TO_HUMAN: 'Hablar con una persona',
      COMPLAINT: 'Queja',
      UNKNOWN_QUESTION: 'Pregunta del bot',
      DISCOUNT: 'Descuento',
    })
  })

  it('labels every displayStatus (EXPIRED reads «Vencida»)', () => {
    expect(DISPLAY_STATUS_LABELS).toEqual({
      NEW: 'Nueva',
      IN_PROGRESS: 'En atención',
      RESOLVED: 'Resuelta',
      CANCELLED: 'Cancelada',
      EXPIRED: 'Vencida',
    })
  })

  it('labels every cancelReason and staffCancelReason', () => {
    expect(Object.keys(CANCEL_REASON_LABELS).sort()).toEqual(
      ['AUTO_RESOLVED', 'CUSTOMER_WITHDREW', 'STAFF', 'SUPERSEDED'],
    )
    expect(CANCEL_REASON_LABELS.CUSTOMER_WITHDREW).toBe('El cliente la retiró')
    expect(CANCEL_REASON_LABELS.AUTO_RESOLVED).toBe('El chatbot la cerró solo')
    expect(Object.keys(STAFF_CANCEL_REASON_LABELS).sort()).toEqual(
      ['CUSTOMER_UNREACHABLE', 'DUPLICATE', 'NOT_ACTIONABLE', 'OTHER'],
    )
    expect(STAFF_CANCEL_REASON_LABELS.DUPLICATE).toBe('Duplicada')
    expect(STAFF_CANCEL_REASON_LABELS.NOT_ACTIONABLE).toBe('No se puede atender')
    expect(STAFF_CANCEL_REASON_LABELS.CUSTOMER_UNREACHABLE).toBe('El cliente no responde')
    expect(STAFF_CANCEL_REASON_LABELS.OTHER).toBe('Otro motivo')
  })

  it('labels the four slaLevels the backend sends (no thresholds computed here)', () => {
    expect(Object.keys(SLA_LEVEL_LABELS).sort()).toEqual(['ESCALATION', 'HALF', 'OK', 'OVERDUE'])
    expect(SLA_LEVEL_LABELS.OVERDUE).toBe('Vencida')
  })
})

describe('cancelCauseLabel', () => {
  it('says nothing for open and resolved rows', () => {
    expect(cancelCauseLabel({ cancelReason: null, staffCancelReason: null, mergedInto: null })).toBeNull()
  })

  it('customer withdrew / auto resolved', () => {
    expect(cancelCauseLabel({ cancelReason: 'CUSTOMER_WITHDREW', staffCancelReason: null, mergedInto: null })).toBe(
      'El cliente la retiró',
    )
    expect(cancelCauseLabel({ cancelReason: 'AUTO_RESOLVED', staffCancelReason: null, mergedInto: null })).toBe(
      'El chatbot la cerró solo',
    )
  })

  it('staff cancel names the staff reason', () => {
    expect(
      cancelCauseLabel({ cancelReason: 'STAFF', staffCancelReason: 'DUPLICATE', mergedInto: null }),
    ).toBe('Cancelada por el personal · Duplicada')
  })

  it('staff cancel without a staff reason (defensive) keeps the generic cause', () => {
    expect(cancelCauseLabel({ cancelReason: 'STAFF', staffCancelReason: null, mergedInto: null })).toBe(
      'Cancelada por el personal',
    )
  })

  it('superseded names the surviving folio when there is one', () => {
    expect(
      cancelCauseLabel({
        cancelReason: 'SUPERSEDED',
        staffCancelReason: null,
        mergedInto: { id: 'req-9', folio: 'S-000044' },
      }),
    ).toBe('Unida con S-000044')
    expect(cancelCauseLabel({ cancelReason: 'SUPERSEDED', staffCancelReason: null, mergedInto: null })).toBe(
      'Unida con otra solicitud',
    )
  })
})

describe('audit labels', () => {
  const types: ChatbotRequestAuditType[] = [
    'CREATED', 'MERGED', 'CLAIMED', 'RELEASED', 'AUTO_RELEASED', 'REASSIGNED', 'RESOLVED', 'REPLIED',
    'TEMPLATE_SENT', 'FINISHED', 'CANCELLED', 'RESCHEDULED', 'CUSTOMER_LINKED', 'SLA_MILESTONE', 'DELIVERY_OUTCOME',
  ]

  it('labels every official audit type', () => {
    for (const type of types) expect(AUDIT_TYPE_LABELS[type]).toBeTruthy()
    expect(Object.keys(AUDIT_TYPE_LABELS).sort()).toEqual([...types].sort())
  })

  it('SLA_MILESTONE with milestone OVERDUE reads «Venció»', () => {
    expect(auditEventLabel('SLA_MILESTONE', { milestone: 'OVERDUE' })).toBe('Venció')
  })

  it('SLA_MILESTONE HALF and ESCALATION are not «Venció»', () => {
    expect(auditEventLabel('SLA_MILESTONE', { milestone: 'HALF' })).toBe('Pasó la mitad del tiempo')
    expect(auditEventLabel('SLA_MILESTONE', { milestone: 'ESCALATION' })).toBe('Cerca de vencer')
    expect(auditEventLabel('SLA_MILESTONE', {})).toBe(AUDIT_TYPE_LABELS.SLA_MILESTONE)
    expect(auditEventLabel('SLA_MILESTONE', null)).toBe(AUDIT_TYPE_LABELS.SLA_MILESTONE)
  })

  it('design copy for the common events', () => {
    expect(auditEventLabel('CREATED')).toBe('Solicitud creada')
    expect(auditEventLabel('CLAIMED')).toBe('Tomada')
    expect(auditEventLabel('RELEASED')).toBe('Liberada')
    expect(auditEventLabel('REASSIGNED')).toBe('Reasignada')
    expect(auditEventLabel('RESOLVED')).toBe('Resuelta')
    expect(auditEventLabel('CANCELLED')).toBe('Cancelada')
    expect(auditEventLabel('MERGED')).toBe('Unida con otra solicitud')
    expect(auditEventLabel('CUSTOMER_LINKED')).toBe('Cliente vinculado')
  })

  it('an unknown type shows a generic line, never the raw code', () => {
    expect(auditEventLabel('SOMETHING_FROM_UNIT_14')).toBe('Evento de la solicitud')
  })
})

describe('formatFolioNumber', () => {
  it('formats the numeric folio of a MERGED event as S-000123', () => {
    expect(formatFolioNumber(123)).toBe('S-000123')
    expect(formatFolioNumber(1)).toBe('S-000001')
    expect(formatFolioNumber(1234567)).toBe('S-1234567')
  })
})

describe('windowClosingTag', () => {
  const now = new Date('2026-11-11T17:05:00.000Z')

  it('shows the closing tag only within the next 2 hours', () => {
    expect(windowClosingTag('2026-11-11T18:20:00.000Z', now)).toBe('Ventana de 24 h cierra en 1 h 15 min')
    expect(windowClosingTag('2026-11-11T17:35:00.000Z', now)).toBe('Ventana de 24 h cierra en 30 min')
    expect(windowClosingTag('2026-11-11T19:05:00.000Z', now)).toBe('Ventana de 24 h cierra en 2 h')
  })

  it('has no tag when the window is far, closed, absent or invalid', () => {
    expect(windowClosingTag('2026-11-11T19:06:00.000Z', now)).toBeNull()
    expect(windowClosingTag('2026-11-11T17:00:00.000Z', now)).toBeNull()
    expect(windowClosingTag(null, now)).toBeNull()
    expect(windowClosingTag('not a date', now)).toBeNull()
  })

  it('follows the backend windowClosingSoon flag when present (branch windowWarningMinutes), keeping the local countdown', () => {
    // 4 h left: outside the old fixed 2 h, but the branch warns at 5 h → the server says soon.
    expect(windowClosingTag('2026-11-11T21:05:00.000Z', now, true)).toBe('Ventana de 24 h cierra en 4 h')
    // 30 min left but the server says not soon (e.g. the request is closed or the branch warns at 15 min).
    expect(windowClosingTag('2026-11-11T17:35:00.000Z', now, false)).toBeNull()
    // Already closed: no tag even if the flag is stale.
    expect(windowClosingTag('2026-11-11T17:00:00.000Z', now, true)).toBeNull()
  })
})

describe('formatScheduledFor / formatWhen', () => {
  const tz = 'America/Mexico_City'
  const now = new Date('2026-11-11T17:05:00.000Z') // Wed 11 nov, 11:05 in Mexico City

  it('«mar 10:30» for a scheduled conversation', () => {
    expect(formatScheduledFor('2026-11-17T16:30:00.000Z', { timeZone: tz })).toBe('mar 10:30')
  })

  it('reads hoy / mañana / ayer and a dated form further away', () => {
    expect(formatWhen('2026-11-11T21:00:00.000Z', { timeZone: tz, now })).toBe('hoy 15:00')
    expect(formatWhen('2026-11-12T15:00:00.000Z', { timeZone: tz, now })).toBe('mañana 9:00')
    expect(formatWhen('2026-11-10T15:00:00.000Z', { timeZone: tz, now })).toBe('ayer 9:00')
    expect(formatWhen('2026-11-13T15:00:00.000Z', { timeZone: tz, now })).toBe('vie 13 nov 9:00')
  })

  it('compares days in the display zone, not in UTC', () => {
    // 2026-11-12T04:00Z is still 11 nov 22:00 in Mexico City.
    expect(formatWhen('2026-11-12T04:00:00.000Z', { timeZone: tz, now })).toBe('hoy 22:00')
  })

  it('formatAvailableFrom: only the time today, the day named otherwise, never zero padded', () => {
    expect(formatAvailableFrom('2026-11-11T15:25:00.000Z', { timeZone: tz, now })).toBe('9:25')
    expect(formatAvailableFrom('2026-11-12T15:25:00.000Z', { timeZone: tz, now })).toBe('mañana 9:25')
    expect(formatAvailableFrom('2026-11-16T15:55:00.000Z', { timeZone: tz, now })).toBe('lun 16 nov 9:55')
    // 2026-11-12T04:00Z is still 11 nov 22:00 in Mexico City: today.
    expect(formatAvailableFrom('2026-11-12T04:00:00.000Z', { timeZone: tz, now })).toBe('22:00')
    expect(formatAvailableFrom(null, { timeZone: tz, now })).toBeNull()
    expect(formatAvailableFrom('nope', { timeZone: tz, now })).toBeNull()
  })

  it('returns null for absent or invalid input', () => {
    expect(formatWhen(null)).toBeNull()
    expect(formatWhen('nope')).toBeNull()
    expect(formatScheduledFor(null)).toBeNull()
    expect(formatScheduledFor('nope')).toBeNull()
  })
})
