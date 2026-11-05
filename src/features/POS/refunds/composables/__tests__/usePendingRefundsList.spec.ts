import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { PendingRefundRow } from '@/features/POS/sales/interfaces/pending-refund.types'
import { withQuery } from './withQuery'

vi.mock('@/features/POS/sales/api/sale.api', () => ({
  saleApi: { listPendingRefunds: vi.fn(), listConfirmed: vi.fn() },
}))

import { saleApi } from '@/features/POS/sales/api/sale.api'
import { usePendingRefundsList } from '../usePendingRefundsList'

const listPending = vi.mocked(saleApi.listPendingRefunds)
const listSales = vi.mocked(saleApi.listConfirmed)

function refund(id: string, saleId: string, patch: Partial<PendingRefundRow> = {}): PendingRefundRow {
  return {
    id,
    saleId,
    method: 'cash',
    amountCents: 6555,
    settledCents: 2000,
    outstandingCents: 4555,
    reason: 'CUSTOMER_REQUEST',
    status: 'PENDING',
    createdAt: '2026-10-21T20:42:00.000Z',
    ...patch,
  }
}

function sale(id: string, folio: string | null, customer: string | null) {
  return {
    id,
    folio,
    status: 'CANCELED',
    paymentStatus: 'PAID',
    deliveryStatus: 'PENDING',
    totalCents: 6555,
    debtCents: 0,
    confirmedAt: '2026-10-21T20:00:00.000Z',
    dueDate: null,
    customer: customer ? { id: `c-${id}`, name: customer } : null,
    cashier: { id: 'u1', name: 'Laura' },
    seller: null,
    paymentMethods: ['CASH'],
  }
}

function salesPage(rows: unknown[], page: number, totalPages: number) {
  return {
    data: rows,
    pagination: { page, limit: 100, total: totalPages * 100, totalPages },
    counts: { all: 0, pendingPayments: 0, notDelivered: 0 },
    summary: { salesCount: 0, totalSoldCents: 0, outstandingDebtCents: 0 },
  } as never
}

const ROWS = [
  refund('r1', 's1'),
  refund('r2', 's2', { method: 'transfer', settledCents: 0, outstandingCents: 6555 }),
  refund('r3', 's3'),
]

function setup(enabled = true) {
  const search = ref('')
  const page = ref(1)
  const harness = withQuery(() =>
    usePendingRefundsList({ tenantId: () => 'tenant-1', enabled: () => enabled, page, limit: () => 20, search }),
  )
  return { ...harness, search, page }
}

describe('usePendingRefundsList', () => {
  beforeEach(() => {
    listPending.mockReset()
    listSales.mockReset()
    listPending.mockResolvedValue({
      data: ROWS,
      pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
    })
  })

  it('joins folio and customer from the cancelled sales, scanning pages until every sale is found', async () => {
    listSales
      .mockResolvedValueOnce(salesPage([sale('s1', 'A-202611-000022', 'María Fernanda López')], 1, 3))
      .mockResolvedValueOnce(salesPage([sale('s2', 'A-202611-000023', null), sale('x', 'A-1', 'Otro')], 2, 3))
      .mockResolvedValueOnce(salesPage([], 3, 3))
    const { result } = setup()
    await flushPromises()

    expect(listSales.mock.calls[0]![0]).toMatchObject({ status: ['CANCELED'], page: 1, limit: 100 })
    expect(result.rows.value.map((row) => [row.id, row.folioLabel, row.customerLabel])).toEqual([
      ['r1', 'A-202611-000022', 'María Fernanda López'],
      ['r2', 'A-202611-000023', 'Público general'],
      // Never an id: a sale missing from the cancelled list gets a neutral fallback.
      ['r3', 'Venta cancelada', 'Sin datos de la venta'],
    ])
  })

  it('stops scanning once every sale is found', async () => {
    listSales.mockResolvedValueOnce(
      salesPage([sale('s1', 'F1', 'A'), sale('s2', 'F2', 'B'), sale('s3', 'F3', 'C')], 1, 9),
    )
    setup()
    await flushPromises()
    expect(listSales).toHaveBeenCalledTimes(1)
  })

  it('searches the loaded page by folio or customer, without accents or case', async () => {
    listSales.mockResolvedValueOnce(
      salesPage([sale('s1', 'A-202611-000022', 'María López'), sale('s2', 'A-202611-000023', 'Clínica Patitas'), sale('s3', 'A-202611-000006', null)], 1, 1),
    )
    const { result, search } = setup()
    await flushPromises()

    search.value = 'maria'
    expect(result.visibleRows.value.map((row) => row.id)).toEqual(['r1'])
    search.value = '000023'
    expect(result.visibleRows.value.map((row) => row.id)).toEqual(['r2'])
    search.value = 'CLINICA'
    expect(result.visibleRows.value.map((row) => row.id)).toEqual(['r2'])
    search.value = ''
    expect(result.visibleRows.value).toHaveLength(3)
  })

  it('exposes the page pagination and the total outstanding of the loaded rows', async () => {
    listSales.mockResolvedValue(salesPage([], 1, 1))
    const { result } = setup()
    await flushPromises()

    expect(listPending).toHaveBeenCalledWith({ page: 1, limit: 20 }, expect.anything())
    expect(result.total.value).toBe(3)
    expect(result.outstandingOnPage.value).toBe(4555 + 6555 + 4555)
  })

  it('keeps the rows when the join fails, with the fallback labels', async () => {
    listSales.mockRejectedValue(new Error('boom'))
    const { result } = setup()
    await flushPromises()

    expect(result.isError.value).toBe(false)
    expect(result.rows.value[0]!.folioLabel).toBe('Venta cancelada')
  })

  it('never requests without the read permission', async () => {
    setup(false)
    await flushPromises()
    expect(listPending).not.toHaveBeenCalled()
    expect(listSales).not.toHaveBeenCalled()
  })
})
