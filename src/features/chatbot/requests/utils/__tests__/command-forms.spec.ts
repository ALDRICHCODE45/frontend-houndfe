import { describe, expect, it } from 'vitest'
import {
  buildCancelBody,
  buildLinkBody,
  buildMergeBody,
  buildFinishBody,
  buildReassignBody,
  buildReplyBody,
  emptyFinishDraft,
  emptyReplyDraft,
  validateFinish,
  validateReply,
  FINISH_NOTE_MAX,
  REPLY_MAX,
  buildRescheduleBody,
  buildResolveBody,
  defaultResolveOption,
  emptyCancelDraft,
  emptyReassignDraft,
  emptyResolveDraft,
  validateCancel,
  validateReassign,
  validateResolve,
  type ResolveDraft,
} from '../command-forms'

const resolveDraft = (overrides: Partial<ResolveDraft> = {}): ResolveDraft => ({
  ...emptyResolveDraft(),
  ...overrides,
})

describe('cancel form (handoff 11 §3.4)', () => {
  it('preselects NOT_ACTIONABLE with empty notes', () => {
    expect(emptyCancelDraft()).toEqual({ reason: 'NOT_ACTIONABLE', note: '', customerNote: '' })
  })

  it('requires the internal note with OTHER, and only then', () => {
    expect(validateCancel({ reason: 'OTHER', note: '   ', customerNote: '' })).toEqual({
      note: 'Con «Otro motivo» la nota interna es obligatoria.',
    })
    expect(validateCancel({ reason: 'OTHER', note: 'Fuera de giro', customerNote: '' })).toEqual({})
    for (const reason of ['DUPLICATE', 'NOT_ACTIONABLE', 'CUSTOMER_UNREACHABLE'] as const) {
      expect(validateCancel({ reason, note: '', customerNote: '' })).toEqual({})
    }
  })

  it('bounds both notes at 500 characters', () => {
    const tooLong = 'x'.repeat(501)
    expect(validateCancel({ reason: 'NOT_ACTIONABLE', note: tooLong, customerNote: tooLong })).toEqual({
      note: 'Máximo 500 caracteres.',
      customerNote: 'Máximo 500 caracteres.',
    })
    const edge = 'x'.repeat(500)
    expect(validateCancel({ reason: 'NOT_ACTIONABLE', note: edge, customerNote: edge })).toEqual({})
  })

  it('does not judge the customer message of a DUPLICATE (it is not sent)', () => {
    expect(validateCancel({ reason: 'DUPLICATE', note: '', customerNote: 'x'.repeat(900) })).toEqual({})
  })

  it('sends reason, trimmed note and customerNote; blank optional notes are left out', () => {
    expect(
      buildCancelBody(
        { reason: 'NOT_ACTIONABLE', note: ' Pregunta fuera de giro ', customerNote: ' Gracias por escribirnos. ' },
        3,
      ),
    ).toEqual({
      expectedVersion: 3,
      reason: 'NOT_ACTIONABLE',
      note: 'Pregunta fuera de giro',
      customerNote: 'Gracias por escribirnos.',
    })
    expect(buildCancelBody({ reason: 'CUSTOMER_UNREACHABLE', note: '  ', customerNote: '' }, 3)).toEqual({
      expectedVersion: 3,
      reason: 'CUSTOMER_UNREACHABLE',
    })
  })

  it('never sends customerNote with DUPLICATE, even if one was typed before switching', () => {
    const body = buildCancelBody({ reason: 'DUPLICATE', note: 'Repetida', customerNote: 'No debe salir' }, 2)
    expect(body).toEqual({ expectedVersion: 2, reason: 'DUPLICATE', note: 'Repetida' })
    expect('customerNote' in body).toBe(false)
  })
})

describe('reassign form (handoff 11 §3.3)', () => {
  it('requires an assignee and bounds the note at 500', () => {
    expect(validateReassign(emptyReassignDraft())).toEqual({ toUserId: 'Elige a quién se la pasas.' })
    expect(validateReassign({ toUserId: 'u-2', note: 'x'.repeat(501) })).toEqual({ note: 'Máximo 500 caracteres.' })
    expect(validateReassign({ toUserId: 'u-2', note: '' })).toEqual({})
  })

  it('sends toUserId and the trimmed note only when there is one', () => {
    expect(buildReassignBody({ toUserId: 'u-2', note: ' Cambio de turno ' }, 4)).toEqual({
      expectedVersion: 4,
      toUserId: 'u-2',
      note: 'Cambio de turno',
    })
    expect(buildReassignBody({ toUserId: 'u-2', note: '  ' }, 4)).toEqual({ expectedVersion: 4, toUserId: 'u-2' })
  })
})

describe('merge and link bodies (handoff 11 §3.5, §3.6)', () => {
  it('merge sends the source version and the target id and version', () => {
    expect(buildMergeBody({ id: 'req-9', version: 4 }, 2)).toEqual({
      expectedVersion: 2,
      intoRequestId: 'req-9',
      intoExpectedVersion: 4,
    })
  })

  it('link sends the chosen customer only', () => {
    expect(buildLinkBody('cus-7', 1)).toEqual({ expectedVersion: 1, customerId: 'cus-7' })
  })
})

describe('resolve — RESTOCK (handoff 12 §2)', () => {
  it('defaults to giving an estimate', () => {
    expect(defaultResolveOption('RESTOCK')).toBe('GIVE')
  })

  it.each([
    ['', 'Escribe un número de días entre 1 y 365.'],
    ['0', 'Escribe un número de días entre 1 y 365.'],
    ['366', 'Escribe un número de días entre 1 y 365.'],
    ['2.5', 'Escribe un número de días entre 1 y 365.'],
    ['abc', 'Escribe un número de días entre 1 y 365.'],
  ])('rejects %j days', (restockDays, message) => {
    expect(validateResolve('RESTOCK', resolveDraft({ option: 'GIVE', restockDays }))).toEqual({ restockDays: message })
  })

  it('accepts 1 and 365 and sends the integer', () => {
    expect(validateResolve('RESTOCK', resolveDraft({ option: 'GIVE', restockDays: '1' }))).toEqual({})
    expect(validateResolve('RESTOCK', resolveDraft({ option: 'GIVE', restockDays: '365' }))).toEqual({})
    expect(buildResolveBody('RESTOCK', resolveDraft({ option: 'GIVE', restockDays: ' 7 ' }), 1)).toEqual({
      expectedVersion: 1,
      action: 'PROVIDE_RESTOCK_ESTIMATE',
      restockDays: 7,
    })
  })

  it('«No hay fecha estimada» sends the action alone, no restockDays at all', () => {
    const draft = resolveDraft({ option: 'NONE', restockDays: '99' })
    expect(validateResolve('RESTOCK', draft)).toEqual({})
    const body = buildResolveBody('RESTOCK', draft, 1)
    expect(body).toEqual({ expectedVersion: 1, action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE' })
    expect('restockDays' in body!).toBe(false)
  })
})

describe('resolve — EXPIRATION', () => {
  it('requires a text up to 500 characters', () => {
    expect(validateResolve('EXPIRATION', resolveDraft({ option: 'GIVE', expirationText: '  ' }))).toEqual({
      expirationText: 'Escribe la caducidad que verá el cliente.',
    })
    expect(
      validateResolve('EXPIRATION', resolveDraft({ option: 'GIVE', expirationText: 'x'.repeat(501) })),
    ).toEqual({ expirationText: 'Máximo 500 caracteres.' })
    expect(
      validateResolve('EXPIRATION', resolveDraft({ option: 'GIVE', expirationText: 'x'.repeat(500) })),
    ).toEqual({})
  })

  it('sends the trimmed text, or the bare «No disponible» action', () => {
    expect(
      buildResolveBody('EXPIRATION', resolveDraft({ option: 'GIVE', expirationText: ' marzo de 2027 ' }), 2),
    ).toEqual({ expectedVersion: 2, action: 'PROVIDE_EXPIRATION_TEXT', expirationText: 'marzo de 2027' })
    const none = buildResolveBody('EXPIRATION', resolveDraft({ option: 'NONE', expirationText: 'ignorado' }), 2)
    expect(none).toEqual({ expectedVersion: 2, action: 'REPORT_EXPIRATION_UNAVAILABLE' })
  })
})

describe('resolve — DELIVERY_ZONE', () => {
  it('defaults to approving', () => {
    expect(defaultResolveOption('DELIVERY_ZONE')).toBe('APPROVE')
  })

  it('FREE needs the delivery days (0–60) and no surcharge', () => {
    expect(validateResolve('DELIVERY_ZONE', resolveDraft({ option: 'APPROVE', zoneType: 'FREE', etaDays: '' }))).toEqual({
      etaDays: 'Escribe de 0 a 60 días.',
    })
    expect(
      validateResolve('DELIVERY_ZONE', resolveDraft({ option: 'APPROVE', zoneType: 'FREE', etaDays: '61' })),
    ).toEqual({ etaDays: 'Escribe de 0 a 60 días.' })
    expect(
      validateResolve('DELIVERY_ZONE', resolveDraft({ option: 'APPROVE', zoneType: 'FREE', etaDays: '0' })),
    ).toEqual({})
    expect(
      buildResolveBody(
        'DELIVERY_ZONE',
        resolveDraft({ option: 'APPROVE', zoneType: 'FREE', etaDays: '2', surcharge: '99' }),
        3,
        7,
      ),
    ).toEqual({
      expectedVersion: 3,
      action: 'APPROVE_DELIVERY_ZONE',
      zoneType: 'FREE',
      etaDays: 2,
      expectedZoneSetVersion: 7,
    })
  })

  it('SURCHARGE needs a surcharge above $0.00 and the days, sent as cents', () => {
    expect(
      validateResolve(
        'DELIVERY_ZONE',
        resolveDraft({ option: 'APPROVE', zoneType: 'SURCHARGE', surcharge: '', etaDays: '' }),
      ),
    ).toEqual({ surchargeCents: 'Escribe un cargo mayor a $0.00.', etaDays: 'Escribe de 0 a 60 días.' })
    expect(
      validateResolve(
        'DELIVERY_ZONE',
        resolveDraft({ option: 'APPROVE', zoneType: 'SURCHARGE', surcharge: '0', etaDays: '3' }),
      ),
    ).toEqual({ surchargeCents: 'Escribe un cargo mayor a $0.00.' })
    expect(
      buildResolveBody(
        'DELIVERY_ZONE',
        resolveDraft({ option: 'APPROVE', zoneType: 'SURCHARGE', surcharge: '50.00', etaDays: '3' }),
        1,
        7,
      ),
    ).toEqual({
      expectedVersion: 1,
      action: 'APPROVE_DELIVERY_ZONE',
      zoneType: 'SURCHARGE',
      surchargeCents: 5000,
      etaDays: 3,
      expectedZoneSetVersion: 7,
    })
  })

  it('CARRIER_ONLY needs neither and sends neither', () => {
    const draft = resolveDraft({ option: 'APPROVE', zoneType: 'CARRIER_ONLY', surcharge: '10', etaDays: '4' })
    expect(validateResolve('DELIVERY_ZONE', draft)).toEqual({})
    const body = buildResolveBody('DELIVERY_ZONE', draft, 1, 9)
    expect(body).toEqual({
      expectedVersion: 1,
      action: 'APPROVE_DELIVERY_ZONE',
      zoneType: 'CARRIER_ONLY',
      expectedZoneSetVersion: 9,
    })
  })

  it('reject sends the version and expectedZoneSetVersion only', () => {
    const draft = resolveDraft({ option: 'REJECT', zoneType: 'SURCHARGE', surcharge: '5' })
    expect(validateResolve('DELIVERY_ZONE', draft)).toEqual({})
    expect(buildResolveBody('DELIVERY_ZONE', draft, 2, 11)).toEqual({
      expectedVersion: 2,
      action: 'REJECT_DELIVERY_ZONE',
      expectedZoneSetVersion: 11,
    })
  })

  it('cannot be built without the zone set version', () => {
    expect(buildResolveBody('DELIVERY_ZONE', resolveDraft({ option: 'REJECT' }), 2)).toBeNull()
  })
})

describe('resolve — TRANSFER_RECEIPT', () => {
  it('defaults to confirming', () => {
    expect(defaultResolveOption('TRANSFER_RECEIPT')).toBe('CONFIRM')
  })

  it('confirm needs an amount of at least 1 cent', () => {
    expect(validateResolve('TRANSFER_RECEIPT', resolveDraft({ option: 'CONFIRM', amount: '' }))).toEqual({
      amountCents: 'Escribe el monto recibido.',
    })
    expect(validateResolve('TRANSFER_RECEIPT', resolveDraft({ option: 'CONFIRM', amount: '0' }))).toEqual({
      amountCents: 'El monto debe ser mayor que $0.00.',
    })
    expect(validateResolve('TRANSFER_RECEIPT', resolveDraft({ option: 'CONFIRM', amount: '0.01' }))).toEqual({})
    expect(buildResolveBody('TRANSFER_RECEIPT', resolveDraft({ option: 'CONFIRM', amount: '1,840.00' }), 2)).toEqual({
      expectedVersion: 2,
      action: 'CONFIRM_RECEIPT',
      amountCents: 184000,
    })
  })

  it('reject needs the internal reason (≤1000) and the customer reason (1–300 after trimming)', () => {
    expect(validateResolve('TRANSFER_RECEIPT', resolveDraft({ option: 'REJECT', reason: ' ', customerReason: ' ' }))).toEqual({
      reason: 'Escribe el motivo interno.',
      customerReason: 'El mensaje para el cliente es obligatorio.',
    })
    expect(
      validateResolve(
        'TRANSFER_RECEIPT',
        resolveDraft({ option: 'REJECT', reason: 'x'.repeat(1001), customerReason: 'y'.repeat(301) }),
      ),
    ).toEqual({ reason: 'Máximo 1000 caracteres.', customerReason: 'Máximo 300 caracteres.' })
    expect(
      validateResolve(
        'TRANSFER_RECEIPT',
        resolveDraft({ option: 'REJECT', reason: 'x'.repeat(1000), customerReason: 'y'.repeat(300) }),
      ),
    ).toEqual({})
    expect(
      buildResolveBody(
        'TRANSFER_RECEIPT',
        resolveDraft({ option: 'REJECT', reason: ' monto distinto ', customerReason: ' El monto no coincide. ', amount: '5' }),
        2,
      ),
    ).toEqual({
      expectedVersion: 2,
      action: 'REJECT_RECEIPT',
      reason: 'monto distinto',
      customerReason: 'El monto no coincide.',
    })
  })
})

describe('resolve — a subtype with no resolve form', () => {
  it('builds nothing', () => {
    expect(buildResolveBody('UNKNOWN_QUESTION', emptyResolveDraft(), 1)).toBeNull()
    expect(validateResolve('UNKNOWN_QUESTION', emptyResolveDraft())).toEqual({})
  })
})

describe('reply form (handoff 19 §1)', () => {
  it('limits are 1–1500 characters after trimming', () => {
    expect(REPLY_MAX).toBe(1500)
    expect(validateReply({ text: '   ' })).toEqual({ text: 'Escribe la respuesta para el cliente.' })
    expect(validateReply(emptyReplyDraft())).toEqual({ text: 'Escribe la respuesta para el cliente.' })
    expect(validateReply({ text: 'a'.repeat(1500) })).toEqual({})
    expect(validateReply({ text: ' ' + 'a'.repeat(1500) + ' ' })).toEqual({})
    expect(validateReply({ text: 'a'.repeat(1501) })).toEqual({ text: 'Máximo 1500 caracteres.' })
  })

  it('counts an emoji as one character, like the backend', () => {
    expect(validateReply({ text: '😀'.repeat(1500) })).toEqual({})
  })

  it('builds exactly {expectedVersion, text} with the text trimmed, line breaks kept', () => {
    expect(buildReplyBody({ text: '  Hola\n\nGracias  ' }, 4)).toEqual({ expectedVersion: 4, text: 'Hola\n\nGracias' })
  })
})

describe('finish form (handoff 20 §4)', () => {
  it('the note is required, 1–1000, internal', () => {
    expect(FINISH_NOTE_MAX).toBe(1000)
    expect(validateFinish('UNKNOWN_QUESTION', emptyFinishDraft())).toEqual({ note: 'Escribe una nota interna.' })
    expect(validateFinish('TALK_TO_HUMAN', { note: 'a'.repeat(1001), complaintOutcome: '' })).toEqual({
      note: 'Máximo 1000 caracteres.',
    })
    expect(validateFinish('TALK_TO_HUMAN', { note: 'Listo', complaintOutcome: '' })).toEqual({})
  })

  it('a complaint also needs one of the four outcomes', () => {
    expect(validateFinish('COMPLAINT', { note: 'Listo', complaintOutcome: '' })).toEqual({
      complaintOutcome: 'Elige cómo terminó la queja.',
    })
    expect(validateFinish('COMPLAINT', { note: 'Listo', complaintOutcome: 'NOPE' })).toEqual({
      complaintOutcome: 'Elige cómo terminó la queja.',
    })
    for (const outcome of ['RETURN', 'REPLACEMENT', 'REFUND', 'NO_ACTION']) {
      expect(validateFinish('COMPLAINT', { note: 'Listo', complaintOutcome: outcome })).toEqual({})
    }
  })

  it('sends complaintOutcome only for a complaint, even if one was picked before', () => {
    expect(buildFinishBody('COMPLAINT', { note: ' Listo ', complaintOutcome: 'REFUND' }, 5)).toEqual({
      expectedVersion: 5,
      note: 'Listo',
      complaintOutcome: 'REFUND',
    })
    expect(buildFinishBody('TALK_TO_HUMAN', { note: 'Listo', complaintOutcome: 'REFUND' }, 5)).toEqual({
      expectedVersion: 5,
      note: 'Listo',
    })
  })

  it('returns null for an invalid draft', () => {
    expect(buildFinishBody('COMPLAINT', { note: 'Listo', complaintOutcome: '' }, 5)).toBeNull()
    expect(buildFinishBody('TALK_TO_HUMAN', { note: '  ', complaintOutcome: '' }, 5)).toBeNull()
  })
})

describe('reschedule body (handoff 21 §3)', () => {
  it('is exactly {expectedVersion, scheduledFor}, the block start untouched', () => {
    expect(buildRescheduleBody('2026-11-14T16:00:00.000Z', 4)).toEqual({
      expectedVersion: 4,
      scheduledFor: '2026-11-14T16:00:00.000Z',
    })
  })
})

