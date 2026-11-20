/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention).
/**
 * CashClosingDetail — corte by folio from the frozen snapshot (§6): header,
 * physical-cash totals with the two differences apart, channels, handovers
 * sorted client-side, notes; PDF viewed/downloaded as a blob (object URL
 * revoked); loading and error states.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import { CLOSING, cashError } from './closingFixtures'

const state = {
  closing: ref(CLOSING),
  isLoading: ref(false),
  isError: ref(false),
  error: ref(null),
  refetch: vi.fn(),
}
vi.mock('../useCashClosing', () => ({ useCashClosingDetail: () => state }))

// Old cortes (snapshot.openedAt null) fall back to the session read, only with read:CashSession.
const access = { canReadSessions: ref(true) }
vi.mock('../../composables/useCashAccess', () => ({ useCashAccess: () => access }))
const sessionDetail = { detail: ref(null), isLoading: ref(false), isError: ref(false) }
const sessionIdsRead = []
vi.mock('../../composables/useCashSessions', async () => {
  const { toValue, watchEffect } = await import('vue')
  return {
    useCashSessionDetail: (id) => {
      watchEffect(() => sessionIdsRead.push(toValue(id)))
      return sessionDetail
    },
  }
})

const getClosingPdf = vi.fn()
vi.mock('../../api/cash.api', () => ({ cashApi: { getClosingPdf: (...a) => getClosingPdf(...a) } }))

import CashClosingDetail from '../CashClosingDetail.vue'

function mountDetail() {
  return mountWithUApp(CashClosingDetail, { props: { closingId: CLOSING.id } })
}

const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' })

beforeEach(() => {
  state.closing.value = CLOSING
  state.isLoading.value = false
  state.isError.value = false
  state.error.value = null
  state.refetch.mockReset()
  getClosingPdf.mockReset()
  access.canReadSessions.value = true
  sessionDetail.detail.value = null
  sessionIdsRead.length = 0
  URL.createObjectURL = vi.fn(() => 'blob:corte')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('CashClosingDetail', () => {
  it('shows the header by folio with register, people and times', () => {
    const wrapper = mountDetail()
    const header = wrapper.get('[data-testid="cash-closing-header"]')
    expect(header.text()).toContain('Folio CC-2f6d9c1e')
    const facts = wrapper.get('[data-testid="cash-closing-facts"]').text()
    expect(facts).toContain('Caja Mostrador 2')
    expect(facts).toContain('Ana Cajera')
    expect(facts).toContain('Luis Supervisor')
    expect(facts).toMatch(/Cerró/)
  })

  it('shows «Abrió» from snapshot.openedAt without reading the session', () => {
    const opened = mountDetail().get('[data-testid="cash-closing-opened"]')
    expect(opened.text()).toMatch(/Abrió/)
    expect(opened.text()).toMatch(/5 nov/)
    expect(sessionIdsRead.filter(Boolean)).toEqual([])
  })

  it('old corte (openedAt null): falls back to the session openedAt when sessions are readable', async () => {
    state.closing.value = { ...CLOSING, snapshot: { ...CLOSING.snapshot, openedAt: null } }
    const wrapper = mountDetail()
    expect(sessionIdsRead).toContain(CLOSING.sessionId)
    // Never a blank label while the session read is pending.
    expect(wrapper.find('[data-testid="cash-closing-opened"]').exists()).toBe(false)

    sessionDetail.detail.value = { session: { id: CLOSING.sessionId, openedAt: '2026-11-04T15:30:00.000Z' } }
    await nextTick()
    const opened = wrapper.get('[data-testid="cash-closing-opened"]')
    expect(opened.text()).toMatch(/Abrió/)
    expect(opened.text()).toMatch(/4 nov/)
  })

  it('old corte without read:CashSession: omits «Abrió» and reads no session', () => {
    access.canReadSessions.value = false
    state.closing.value = { ...CLOSING, snapshot: { ...CLOSING.snapshot, openedAt: null } }
    const wrapper = mountDetail()
    expect(wrapper.find('[data-testid="cash-closing-opened"]').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/Abrió/)
    expect(sessionIdsRead.filter(Boolean)).toEqual([])
  })

  it('old corte whose session has no openedAt: omits «Abrió» (never blank)', async () => {
    state.closing.value = { ...CLOSING, snapshot: { ...CLOSING.snapshot, openedAt: null } }
    sessionDetail.detail.value = { session: { id: CLOSING.sessionId } }
    const wrapper = mountDetail()
    await nextTick()
    expect(wrapper.text()).not.toMatch(/Abrió/)
  })

  it('shows the physical-cash totals and the two differences separately', () => {
    const totals = mountDetail().get('[data-testid="cash-closing-totals"]').text()
    expect(totals).toContain('$1,000.00') // fondo inicial
    expect(totals).toContain('$1,500.00') // esperado
    expect(totals).toContain('$1,495.00') // declarado / verificado
    expect(totals).toMatch(/Declarado vs esperado[\s\S]*-\$5\.00/)
    expect(totals).toMatch(/Verificado vs declarado[\s\S]*\$0\.00/)
  })

  it('renders every channel with expected, declared, verified and difference', () => {
    const rows = mountDetail().findAll('[data-testid="cash-closing-channel"]')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toMatch(/Efectivo[\s\S]*\$1,500\.00[\s\S]*\$1,495\.00[\s\S]*\$1,495\.00[\s\S]*-\$5\.00/)
    expect(rows[1].text()).toContain('Tarjeta de débito')
  })

  it('labels every cell with its column so narrow widths stack each row and no column is clipped (D5)', () => {
    const wrapper = mountDetail()
    for (const table of wrapper.findAll('table.cd-table')) {
      expect(table.classes()).toContain('cd-table--stack')
      const headers = table.findAll('thead th').map((th) => th.text())
      for (const row of table.findAll('tbody tr')) {
        expect(row.findAll('td').map((td) => td.attributes('data-label'))).toEqual(headers)
      }
    }
    expect(wrapper.findAll('table.cd-table').length).toBe(2)
  })

  it('sorts the unordered handovers by time', () => {
    const rows = mountDetail().findAll('[data-testid="cash-closing-handover"]')
    expect(rows.map((r) => r.text())).toEqual([
      expect.stringMatching(/Retiro[\s\S]*Luis Supervisor[\s\S]*\$495\.00/),
      expect.stringMatching(/Fondo[\s\S]*Ana Cajera[\s\S]*\$1,000\.00/),
    ])
  })

  it('«Recibió» shows the real name of a receiver who is not cashier/verifier/closer', () => {
    const [first, second] = CLOSING.snapshot.handovers
    state.closing.value = {
      ...CLOSING,
      snapshot: {
        ...CLOSING.snapshot,
        handovers: [
          { ...first, receiverUserId: 'outsider-1', receiptActorUserId: 'outsider-1', receiverName: 'Rita Receptora', receiptActorName: 'Rita Receptora' },
          { ...second, receiverUserId: 'outsider-2', receiptActorUserId: null, receiverName: 'Pedro Destino' },
        ],
      },
    }
    const text = mountDetail()
      .findAll('[data-testid="cash-closing-handover"]')
      .map((r) => r.text())
      .join('|')
    expect(text).toContain('Rita Receptora')
    expect(text).toContain('Pedro Destino')
    expect(text).not.toContain('Otra persona')
    expect(text).not.toContain('outsider')
  })

  it('shows the folio shortened on screen for an old uuid folio, keeping the full one in the PDF file name', () => {
    const wrapper = mountDetail()
    expect(wrapper.get('[data-testid="cash-closing-header"]').text()).toContain('Folio CC-2f6d9c1e')
    expect(wrapper.get('[data-testid="cash-closing-header"]').text()).not.toContain(CLOSING.folio)
    expect(wrapper.text()).toContain(`corte-caja-${CLOSING.folio}.pdf`)
  })

  it('shows the declaration and closing notes', () => {
    const notes = mountDetail().get('[data-testid="cash-closing-notes"]').text()
    expect(notes).toContain('Faltan 5 pesos de cambio')
    expect(notes).toContain('Cierre sin novedad')
  })

  it('«Ver PDF» opens the blob in a new tab and revokes the object URL', async () => {
    vi.useFakeTimers()
    const tab = { location: { href: '' }, opener: {}, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(tab)
    getClosingPdf.mockResolvedValue(pdf)
    const wrapper = mountDetail()

    await wrapper.get('[data-testid="cash-closing-pdf-view"]').trigger('click')
    await flushPromises()

    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(getClosingPdf).toHaveBeenCalledWith(CLOSING.id, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(tab.location.href).toBe('blob:corte')
    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:corte')
  })

  it('«Descargar PDF» saves corte-caja-<folio>.pdf and revokes the object URL', async () => {
    vi.useFakeTimers()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    getClosingPdf.mockResolvedValue(pdf)
    const wrapper = mountDetail()

    await wrapper.get('[data-testid="cash-closing-pdf-download"]').trigger('click')
    await flushPromises()

    expect(click.mock.contexts[0].download).toBe(`corte-caja-${CLOSING.folio}.pdf`)
    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:corte')
  })

  it('a PDF failure closes the pre-opened tab and shows the Spanish copy', async () => {
    const tab = { location: { href: '' }, opener: {}, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab)
    const body = new Blob([JSON.stringify({ statusCode: 500, error: 'CASH_CLOSING_SNAPSHOT_INVALID' })])
    getClosingPdf.mockRejectedValue({ response: { status: 500, data: body } })
    const wrapper = mountDetail()

    await wrapper.get('[data-testid="cash-closing-pdf-view"]').trigger('click')
    await flushPromises()

    expect(tab.close).toHaveBeenCalled()
    expect(wrapper.get('[data-testid="cash-closing-pdf-error"]').text()).toMatch(/corte guardado está dañado/)
  })

  it('loading and error states', async () => {
    state.closing.value = undefined
    state.isLoading.value = true
    let wrapper = mountDetail()
    expect(wrapper.get('[data-testid="cash-closing-loading"]').attributes('aria-busy')).toBe('true')

    state.isLoading.value = false
    state.isError.value = true
    state.error.value = cashError('CASH_CLOSING_NOT_FOUND')
    wrapper = mountDetail()
    expect(wrapper.text()).toMatch(/corte no existe/)
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(state.refetch).toHaveBeenCalled()
  })
})
