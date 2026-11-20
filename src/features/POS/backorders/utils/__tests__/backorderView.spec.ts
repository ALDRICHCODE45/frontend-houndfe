import { describe, expect, it } from 'vitest'
import { makeBackorder } from '../../interfaces/__tests__/backorder.fixture'
import {
  BACKORDER_TABS,
  backorderCancelCopy,
  backorderPrice,
  backorderStatusInfo,
  backorderStatusLabel,
  backorderStatusTone,
  backorderTimeline,
  canCancelBackorder,
  isBackorderStatus,
  productLabel,
} from '../backorderView'

describe('status vocabulary (S1, S4)', () => {
  it('tabs are the five states in the owner order, with plural Spanish labels', () => {
    expect(BACKORDER_TABS.map((t) => [t.status, t.label])).toEqual([
      ['WAITING', 'En espera'],
      ['RESERVED', 'Apartados'],
      ['CONFIRMED', 'Confirmados'],
      ['EXPIRED', 'Vencidos'],
      ['CANCELLED', 'Cancelados'],
    ])
  })

  it('badge labels are singular and no status is painted danger (pending is never red)', () => {
    expect(backorderStatusLabel('WAITING')).toBe('En espera')
    expect(backorderStatusLabel('RESERVED')).toBe('Apartado')
    for (const { status } of BACKORDER_TABS) expect(backorderStatusTone(status)).not.toBe('danger')
    expect(isBackorderStatus('RESERVED')).toBe(true)
    expect(isBackorderStatus('SAVED')).toBe(false)
    expect(isBackorderStatus(null)).toBe(false)
  })

  it('only WAITING and RESERVED can be cancelled', () => {
    expect(BACKORDER_TABS.filter((t) => canCancelBackorder({ status: t.status })).map((t) => t.status)).toEqual([
      'WAITING',
      'RESERVED',
    ])
  })
})

describe('backorderPrice', () => {
  it('shows only the final price when reference and current equal it', () => {
    const row = makeBackorder({ referencePriceCents: 100000, currentPriceCents: 100000, finalPriceCents: 100000 })
    expect(backorderPrice(row)).toEqual({ final: '$1,000.00', notes: [] })
  })

  it('shows the reference («al agendar») when it differs, from S3\'s example', () => {
    expect(backorderPrice(makeBackorder())).toEqual({ final: '$1,099.00', notes: ['Al agendar $1,149.00'] })
  })

  it('shows both when neither equals the final price', () => {
    const row = makeBackorder({ referencePriceCents: 120000, currentPriceCents: 115000, finalPriceCents: 110000 })
    expect(backorderPrice(row).notes).toEqual(['Al agendar $1,200.00', 'Vigente $1,150.00'])
  })
})

describe('productLabel', () => {
  it('joins product and variant, never an id', () => {
    expect(productLabel(makeBackorder())).toEqual({ name: 'Croquetas Adulto Raza Grande 18 kg', variant: null })
    expect(productLabel(makeBackorder({ variantName: 'Pollo' })).variant).toBe('Pollo')
  })
})

describe('backorderStatusInfo (S1 per-status cell)', () => {
  it('WAITING → «#N en la fila» and the passed-over warning only when > 0', () => {
    const waiting = makeBackorder({ status: 'WAITING', queuePosition: 3, reservedAt: null, reservedUntil: null })
    expect(backorderStatusInfo(waiting)).toEqual({ lines: ['#3 en la fila'], warning: null, link: null })
    const passed = backorderStatusInfo({ ...waiting, passedOverCount: 2 })
    expect(passed.warning).toBe('Se lo saltaron 2 veces')
    expect(backorderStatusInfo({ ...waiting, passedOverCount: 1 }).warning).toBe('Se lo saltaron 1 vez')
  })

  it('WAITING without a queue position says nothing about the queue', () => {
    expect(backorderStatusInfo(makeBackorder({ status: 'WAITING', queuePosition: null })).lines).toEqual([])
  })

  it('RESERVED → «Apartado hasta …»', () => {
    const info = backorderStatusInfo(makeBackorder(), new Date('2026-11-20T12:00:00-06:00'))
    expect(info.lines).toHaveLength(1)
    expect(info.lines[0]).toMatch(/^Apartado hasta 21 nov, \d{2}:\d{2}$/)
  })

  it('CONFIRMED → a «Ver venta» link to the sale', () => {
    const info = backorderStatusInfo(makeBackorder({ status: 'CONFIRMED', saleId: 's1', saleStatus: 'CONFIRMED' }))
    expect(info.link).toEqual({ label: 'Ver venta', to: '/pos/ventas/s1' })
    expect(backorderStatusInfo(makeBackorder({ status: 'CONFIRMED', saleId: null })).link).toBeNull()
  })

  it('EXPIRED → when it expired', () => {
    const info = backorderStatusInfo(makeBackorder({ status: 'EXPIRED', expiredAt: '2026-11-21T09:00:00-06:00' }))
    expect(info.lines[0]).toMatch(/^Venció el 21 nov/)
  })

  it('CANCELLED → who and why', () => {
    const staff = backorderStatusInfo(
      makeBackorder({
        status: 'CANCELLED',
        cancelledByKind: 'STAFF',
        cancelledBy: { id: 'u1', name: 'Ana Gómez' },
        cancelReason: 'Proveedor descontinuó',
      }),
    )
    expect(staff.lines).toEqual(['Canceló Ana Gómez', 'Proveedor descontinuó'])
    expect(
      backorderStatusInfo(makeBackorder({ status: 'CANCELLED', cancelledByKind: 'CUSTOMER' })).lines,
    ).toEqual(['Canceló el cliente'])
    expect(
      backorderStatusInfo(makeBackorder({ status: 'CANCELLED', cancelledByKind: 'STAFF', cancelledBy: null })).lines,
    ).toEqual(['Canceló el equipo'])
  })
})

describe('backorderTimeline', () => {
  it('lists only the dates present, in chronological order', () => {
    const entries = backorderTimeline(makeBackorder())
    expect(entries.map((e) => e.key)).toEqual(['scheduledAt', 'reservedAt', 'reminderAt', 'reservedUntil', 'estimatedAt'])
    expect(entries.every((e) => e.at)).toBe(true)
  })

  it('a cancelled order shows cancelledAt and drops the reserve deadline labels that never happened', () => {
    const entries = backorderTimeline(
      makeBackorder({
        status: 'CANCELLED',
        reservedAt: null,
        reservedUntil: null,
        reminderAt: null,
        cancelledAt: '2026-11-16T10:00:00-06:00',
      }),
    )
    expect(entries.map((e) => e.key)).toEqual(['scheduledAt', 'cancelledAt', 'estimatedAt'])
  })

  it('confirmed and expired dates are included', () => {
    const keys = backorderTimeline(
      makeBackorder({ confirmedAt: '2026-11-20T15:00:00-06:00', expiredAt: '2026-11-22T00:00:00-06:00' }),
    ).map((e) => e.key)
    expect(keys).toContain('confirmedAt')
    expect(keys).toContain('expiredAt')
  })
})

describe('backorderCancelCopy', () => {
  it('RESERVED says the units go to the next customer in line', () => {
    expect(backorderCancelCopy('RESERVED')).toContain('pasan al siguiente cliente en la fila')
  })

  it('WAITING says the customer leaves the queue and no units are released', () => {
    const copy = backorderCancelCopy('WAITING')
    expect(copy).toContain('sale de la fila')
    expect(copy).not.toContain('siguiente cliente')
  })
})
