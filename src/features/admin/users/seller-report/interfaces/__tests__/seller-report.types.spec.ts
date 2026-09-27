// seller-report.types.spec.ts — wire-contract validation for the seller sales report.
//
// Mutation-sensitive: relaxing `.strict()` on any object, accepting a non-UUID
// seller id, allowing negative/fractional/unsafe cents or counts, ignoring the
// echoed tenant/seller/window, trusting `rowCount`/`saleCount` instead of the
// arrays, accepting a row whose Mexico City local day leaves `[from,to)`,
// accepting duplicate or out-of-order rows, or mapping a failure by `message`,
// `timestamp` or HTTP status alone instead of `status` + `error` fails at least
// one of these tests.

import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import {
  parseSellerReportFailure,
  parseSellerSalesReportResponse,
  type SellerReportExpectation,
} from '../seller-report.types'

const SELLER_ID = '8f14e45f-ceea-4a2b-9c3d-1a2b3c4d5e6f'
const TENANT_ID = '11111111-2222-4333-8444-555555555555'
const OTHER_SELLER_ID = '00000000-1111-4222-8333-444444444444'
const ROW_ID_A = 'a1111111-1111-4111-8111-111111111111'
const ROW_ID_B = 'b2222222-2222-4222-8222-222222222222'
const FROM = '2025-03-01'
const TO = '2025-04-01'

const EXPECTATION: SellerReportExpectation = {
  tenantId: TENANT_ID,
  sellerUserId: SELLER_ID,
  from: FROM,
  to: TO,
}

/** 2025-03-05 12:30 in America/Mexico_City (UTC-6). */
const CONFIRMED_AT = '2025-03-05T18:30:00.000Z'
/** 2025-03-07 09:00 in America/Mexico_City. */
const CANCELED_AT = '2025-03-07T15:00:00.000Z'
/** 2025-03-06 11:00 in America/Mexico_City. */
const CONFIRMED_AT_B = '2025-03-06T17:00:00.000Z'

function makeConfirmedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ROW_ID_A,
    folio: 'F-0001',
    confirmedAt: CONFIRMED_AT,
    totalCents: 116_000,
    paidCents: 116_000,
    debtCents: 0,
    paymentStatus: 'PAID',
    ...overrides,
  }
}

function makeCanceledRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ROW_ID_B,
    folio: null,
    confirmedAt: CONFIRMED_AT_B,
    canceledAt: CANCELED_AT,
    totalCents: 58_000,
    ...overrides,
  }
}

function makeReport(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    seller: { id: SELLER_ID, name: 'Ana Vendedora' },
    tenantId: TENANT_ID,
    timeZone: 'America/Mexico_City',
    from: FROM,
    to: TO,
    generatedAt: '2025-04-01T15:04:05.000Z',
    attribution: 'CURRENT_SELLER',
    balances: 'CURRENT',
    rowLimit: 1000,
    rowCount: 2,
    confirmed: {
      dateBasis: 'confirmedAt',
      summary: {
        saleCount: 1,
        netSalesCents: 116_000,
        collectedCents: 116_000,
        outstandingDebtCents: 0,
        averageTicketCents: 116_000,
      },
      rows: [makeConfirmedRow()],
    },
    canceled: {
      dateBasis: 'canceledAt',
      saleCount: 1,
      rows: [makeCanceledRow()],
    },
    ...overrides,
  }
}

/** Clone + mutate the canonical valid payload so exactly one rule is violated. */
function mutated(mutate: (payload: Record<string, unknown>) => void): unknown {
  const copy = structuredClone(makeReport())
  mutate(copy)
  return copy
}

function mutateConfirmed(
  payload: Record<string, unknown>,
  mutate: (section: Record<string, unknown>) => void,
): void {
  mutate(payload.confirmed as Record<string, unknown>)
}

function mutateCanceled(
  payload: Record<string, unknown>,
  mutate: (section: Record<string, unknown>) => void,
): void {
  mutate(payload.canceled as Record<string, unknown>)
}

function confirmedRow(payload: Record<string, unknown>, index = 0): Record<string, unknown> {
  const section = payload.confirmed as { rows: Array<Record<string, unknown>> }
  return section.rows[index] as Record<string, unknown>
}

function canceledRow(payload: Record<string, unknown>, index = 0): Record<string, unknown> {
  const section = payload.canceled as { rows: Array<Record<string, unknown>> }
  return section.rows[index] as Record<string, unknown>
}

function expectRejection(value: unknown): void {
  expect(() => parseSellerSalesReportResponse(value, EXPECTATION)).toThrow(ZodError)
}

/** Fixture-only UTC arithmetic: never used to move a production calendar day. */
function utcMinutesAfter(startIso: string, minutes: number): string {
  return new Date(Date.parse(startIso) + minutes * 60_000).toISOString()
}

/**
 * A COUNT-reconciled payload: `count` ascending confirmed rows plus the single
 * canonical canceled row, with `rowCount` equal to their total. Only the row cap
 * can be out of contract.
 */
function reportWithConfirmedRows(count: number): unknown {
  const rows = Array.from({ length: count }, (_, index) =>
    makeConfirmedRow({
      id: `a1111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
      // 06:00 UTC is 00:00 in Mexico City: every row stays on 2025-03-01 and in order.
      confirmedAt: utcMinutesAfter('2025-03-01T06:00:00.000Z', index),
    }),
  )

  return mutated((payload) => {
    payload.rowCount = count + 1
    mutateConfirmed(payload, (section) => {
      section.summary = {
        saleCount: count,
        netSalesCents: 0,
        collectedCents: 0,
        outstandingDebtCents: 0,
        averageTicketCents: 0,
      }
      section.rows = rows
    })
    mutateCanceled(payload, (section) => {
      section.saleCount = 1
      section.rows = [makeCanceledRow()]
    })
  })
}

describe('parseSellerSalesReportResponse — accepted contract', () => {
  it('accepts a contract-valid payload and returns it verbatim', () => {
    const payload = makeReport()

    const report = parseSellerSalesReportResponse(payload, EXPECTATION)

    // Identity proves nothing was rebuilt, padded, sorted or derived.
    expect(report).toEqual(payload)
    expect(report.seller.name).toBe('Ana Vendedora')
    expect(report.confirmed.rows).toHaveLength(1)
    expect(report.canceled.rows).toHaveLength(1)
  })

  it('accepts an empty 200 with zero rows, zero counts and null folios', () => {
    const empty = mutated((payload) => {
      payload.rowCount = 0
      payload.confirmed = {
        dateBasis: 'confirmedAt',
        summary: {
          saleCount: 0,
          netSalesCents: 0,
          collectedCents: 0,
          outstandingDebtCents: 0,
          averageTicketCents: 0,
        },
        rows: [],
      }
      payload.canceled = { dateBasis: 'canceledAt', saleCount: 0, rows: [] }
    })

    expect(() => parseSellerSalesReportResponse(empty, EXPECTATION)).not.toThrow()
  })

  it('accepts eligible rows at both window edges and null folios/confirmedAt', () => {
    const payload = mutated((payload) => {
      payload.rowCount = 2
      mutateConfirmed(payload, (section) => {
        section.summary = {
          saleCount: 1,
          netSalesCents: 1,
          collectedCents: 0,
          outstandingDebtCents: 1,
          averageTicketCents: 1,
        }
        // 2025-03-01 00:00 CDMX is the inclusive lower boundary.
        section.rows = [makeConfirmedRow({ folio: null, confirmedAt: '2025-03-01T06:00:00.000Z' })]
      })
      mutateCanceled(payload, (section) => {
        // 2025-03-31 23:30 CDMX is inside the exclusive upper boundary.
        section.rows = [makeCanceledRow({ confirmedAt: null, canceledAt: '2025-04-01T05:30:00Z' })]
      })
    })

    expect(() => parseSellerSalesReportResponse(payload, EXPECTATION)).not.toThrow()
  })
})

describe('parseSellerSalesReportResponse — strict shape', () => {
  it('rejects an unknown top-level key', () => {
    expectRejection(mutated((payload) => (payload.extraAggregateCents = 10)))
  })

  it('rejects unknown keys nested in seller, summary and rows', () => {
    expectRejection(
      mutated((payload) => ((payload.seller as Record<string, unknown>).phone = '55')),
    )
    expectRejection(
      mutated((payload) =>
        mutateConfirmed(payload, (s) => ((s.summary as Record<string, unknown>).taxCents = 1)),
      ),
    )
    expectRejection(mutated((payload) => (confirmedRow(payload).customerEmail = 'a@b.c')))
    expectRejection(mutated((payload) => (canceledRow(payload).refundedCents = 1)))
  })

  it('rejects a non-UUID seller id', () => {
    expectRejection(
      mutated((payload) => ((payload.seller as Record<string, unknown>).id = 'seller-1')),
    )
  })

  it('rejects a blank seller name, folio and row id', () => {
    expectRejection(mutated((payload) => ((payload.seller as Record<string, unknown>).name = '')))
    expectRejection(mutated((payload) => (confirmedRow(payload).folio = '')))
    expectRejection(mutated((payload) => (confirmedRow(payload).id = '')))
  })

  it('rejects a wrong time zone, attribution, balances or date basis', () => {
    expectRejection(mutated((payload) => (payload.timeZone = 'America/Mexico_City ')))
    expectRejection(mutated((payload) => (payload.attribution = 'CURRENT_TENANT')))
    expectRejection(mutated((payload) => (payload.balances = 'HISTORIC')))
    expectRejection(
      mutated((payload) => mutateConfirmed(payload, (s) => (s.dateBasis = 'createdAt'))),
    )
    expectRejection(
      mutated((payload) => mutateCanceled(payload, (s) => (s.dateBasis = 'confirmedAt'))),
    )
  })

  it('rejects a row limit other than the authoritative 1000', () => {
    expectRejection(mutated((payload) => (payload.rowLimit = 500)))
    expectRejection(mutated((payload) => (payload.rowLimit = '1000')))
  })

  it('rejects an unknown payment status', () => {
    expectRejection(mutated((payload) => (confirmedRow(payload).paymentStatus = 'REFUNDED')))
  })

  it('rejects non-UTC and malformed instants', () => {
    expectRejection(mutated((payload) => (payload.generatedAt = '2025-04-01T15:04:05-06:00')))
    expectRejection(mutated((payload) => (payload.generatedAt = '2025-02-30T15:04:05.000Z')))
    expectRejection(mutated((payload) => (confirmedRow(payload).confirmedAt = '2025-03-05')))
    expectRejection(mutated((payload) => (canceledRow(payload).canceledAt = 'not-a-date')))
  })
})

describe('parseSellerSalesReportResponse — metric safety', () => {
  const METRIC_PATHS: ReadonlyArray<[string, (payload: Record<string, unknown>) => void]> = [
    ['totalCents', (payload) => (confirmedRow(payload).totalCents = -1)],
    ['paidCents', (payload) => (confirmedRow(payload).paidCents = -1)],
    ['debtCents', (payload) => (confirmedRow(payload).debtCents = -1)],
    ['canceled totalCents', (payload) => (canceledRow(payload).totalCents = -1)],
    [
      'netSalesCents',
      (payload) =>
        mutateConfirmed(
          payload,
          (s) => ((s.summary as Record<string, unknown>).netSalesCents = -1),
        ),
    ],
  ]

  it.each(METRIC_PATHS)('rejects a negative %s', (_label, mutate) => {
    expectRejection(mutated(mutate))
  })

  it('rejects fractional cents, unsafe integers and numeric strings', () => {
    expectRejection(mutated((payload) => (confirmedRow(payload).totalCents = 1.5)))
    expectRejection(
      mutated((payload) => (confirmedRow(payload).totalCents = Number.MAX_SAFE_INTEGER + 2)),
    )
    expectRejection(mutated((payload) => (confirmedRow(payload).totalCents = '116000')))
    expectRejection(mutated((payload) => (confirmedRow(payload).totalCents = null)))
  })

  it('rejects negative or fractional counts', () => {
    expectRejection(mutated((payload) => (payload.rowCount = -1)))
    expectRejection(
      mutated((payload) =>
        mutateConfirmed(payload, (s) => ((s.summary as Record<string, unknown>).saleCount = 1.5)),
      ),
    )
    expectRejection(mutated((payload) => mutateCanceled(payload, (s) => (s.saleCount = -2))))
  })

  it('rejects a missing required metric field', () => {
    expectRejection(mutated((payload) => delete confirmedRow(payload).debtCents))
    expectRejection(
      mutated((payload) =>
        mutateConfirmed(
          payload,
          (s) => delete (s.summary as Record<string, unknown>).collectedCents,
        ),
      ),
    )
  })
})

describe('parseSellerSalesReportResponse — request echo', () => {
  it('rejects an echoed tenant that is not the request tenant', () => {
    expectRejection(mutated((payload) => (payload.tenantId = 'other-tenant')))
  })

  it('rejects an echoed seller that is not the requested seller', () => {
    expectRejection(
      mutated((payload) => ((payload.seller as Record<string, unknown>).id = OTHER_SELLER_ID)),
    )
  })

  it('rejects echoed boundaries that differ from the request', () => {
    expectRejection(mutated((payload) => (payload.from = '2025-02-01')))
    expectRejection(mutated((payload) => (payload.to = '2025-05-01')))
  })

  it('rejects an impossible echoed window even when the request matches it', () => {
    const emptyFor = (from: string, to: string): unknown => ({
      seller: { id: SELLER_ID, name: 'Ana Vendedora' },
      tenantId: TENANT_ID,
      timeZone: 'America/Mexico_City',
      from,
      to,
      generatedAt: '2025-04-01T15:04:05.000Z',
      attribution: 'CURRENT_SELLER',
      balances: 'CURRENT',
      rowLimit: 1000,
      rowCount: 0,
      confirmed: {
        dateBasis: 'confirmedAt',
        summary: {
          saleCount: 0,
          netSalesCents: 0,
          collectedCents: 0,
          outstandingDebtCents: 0,
          averageTicketCents: 0,
        },
        rows: [],
      },
      canceled: { dateBasis: 'canceledAt', saleCount: 0, rows: [] },
    })

    // Empty payloads isolate the WINDOW rule: counts and rows cannot fail.
    expect(() =>
      parseSellerSalesReportResponse(emptyFor('2025-04-01', '2025-03-01'), {
        ...EXPECTATION,
        from: '2025-04-01',
        to: '2025-03-01',
      }),
    ).toThrow(ZodError)

    expect(() =>
      parseSellerSalesReportResponse(emptyFor('2024-01-01', '2025-01-02'), {
        ...EXPECTATION,
        from: '2024-01-01',
        to: '2025-01-02',
      }),
    ).toThrow(ZodError)

    // Exactly 366 local days is the longest accepted window.
    expect(() =>
      parseSellerSalesReportResponse(emptyFor('2024-01-01', '2025-01-01'), {
        ...EXPECTATION,
        from: '2024-01-01',
        to: '2025-01-01',
      }),
    ).not.toThrow()
  })
})

describe('parseSellerSalesReportResponse — counts, order and window membership', () => {
  it('rejects a rowCount that does not equal the total row arrays', () => {
    expectRejection(mutated((payload) => (payload.rowCount = 3)))
    expectRejection(mutated((payload) => (payload.rowCount = 1)))
  })

  it('accepts exactly the row cap and rejects one row above it', () => {
    // 999 confirmed + 1 canceled = exactly the authoritative 1000-row cap.
    expect(() =>
      parseSellerSalesReportResponse(reportWithConfirmedRows(999), EXPECTATION),
    ).not.toThrow()

    // 1000 confirmed + 1 canceled: every count still reconciles, only the cap is violated.
    expectRejection(reportWithConfirmedRows(1000))
  })

  it('rejects a summary saleCount that does not equal the confirmed rows', () => {
    expectRejection(
      mutated((payload) =>
        mutateConfirmed(payload, (s) => ((s.summary as Record<string, unknown>).saleCount = 2)),
      ),
    )
  })

  it('rejects a canceled saleCount that does not equal the canceled rows', () => {
    expectRejection(mutated((payload) => mutateCanceled(payload, (s) => (s.saleCount = 0))))
  })

  it('rejects a row whose Mexico City local day leaves the window', () => {
    // 2025-03-01T05:30:00Z is 2025-02-28 23:30 in Mexico City: the UTC day is
    // inside the window, the local day is not.
    expectRejection(
      mutated((payload) => (confirmedRow(payload).confirmedAt = '2025-03-01T05:30:00.000Z')),
    )
    // 2025-04-01T05:30:00Z is 2025-03-31 23:30 local: still inside [from,to).
    expectRejection(
      mutated((payload) => (confirmedRow(payload).confirmedAt = '2025-04-01T06:00:00.000Z')),
    )
    expectRejection(
      mutated((payload) => (canceledRow(payload).canceledAt = '2025-02-28T18:00:00.000Z')),
    )
  })

  it('rejects duplicate or out-of-order confirmed rows', () => {
    const rows = [
      makeConfirmedRow() as Record<string, unknown>,
      makeConfirmedRow({ id: ROW_ID_B, confirmedAt: CONFIRMED_AT_B }) as Record<string, unknown>,
    ]
    // Descending instants: the list must already be ascending.
    const descending = mutated((payload) => {
      payload.rowCount = 3
      mutateConfirmed(payload, (section) => {
        section.summary = {
          saleCount: 2,
          netSalesCents: 0,
          collectedCents: 0,
          outstandingDebtCents: 0,
          averageTicketCents: 0,
        }
        section.rows = rows.slice().reverse()
      })
    })
    expectRejection(descending)

    const orderedPair = mutated((payload) => {
      payload.rowCount = 3
      mutateConfirmed(payload, (section) => {
        section.summary = {
          saleCount: 2,
          netSalesCents: 0,
          collectedCents: 0,
          outstandingDebtCents: 0,
          averageTicketCents: 0,
        }
        section.rows = [rows[0], rows[1]]
      })
    })
    expect(() => parseSellerSalesReportResponse(orderedPair, EXPECTATION)).not.toThrow()

    const sameInstantOutOfOrder = mutated((payload) => {
      payload.rowCount = 2
      mutateConfirmed(payload, (section) => {
        section.summary = {
          saleCount: 2,
          netSalesCents: 0,
          collectedCents: 0,
          outstandingDebtCents: 0,
          averageTicketCents: 0,
        }
        section.rows = [
          makeConfirmedRow({ id: ROW_ID_B, confirmedAt: CONFIRMED_AT }),
          makeConfirmedRow({ id: ROW_ID_A, confirmedAt: CONFIRMED_AT }),
        ]
      })
      mutateCanceled(payload, (section) => {
        section.saleCount = 0
        section.rows = []
      })
    })
    expectRejection(sameInstantOutOfOrder)
  })

  it('rejects duplicate or out-of-order canceled rows ordered by canceledAt', () => {
    const payload = mutated((payload) => {
      payload.rowCount = 2
      mutateCanceled(payload, (section) => {
        section.saleCount = 2
        section.rows = [
          makeCanceledRow({ id: ROW_ID_B, canceledAt: CANCELED_AT }),
          makeCanceledRow({ id: ROW_ID_A, canceledAt: '2025-03-08T15:00:00.000Z' }),
        ]
      })
    })
    expectRejection(payload)
  })

  it('rejects a non-array rows field', () => {
    expectRejection(mutated((payload) => mutateConfirmed(payload, (s) => (s.rows = {}))))
    expectRejection(mutated((payload) => (payload.confirmed = null)))
    expectRejection(mutated((payload) => delete payload.canceled))
  })
})

describe('parseSellerReportFailure — status + error code mapping', () => {
  function axiosError(status: number, data: unknown): unknown {
    return { isAxiosError: true, response: { status, data } }
  }

  const NOT_FOUND_BODY = {
    statusCode: 404,
    error: 'SELLER_NOT_FOUND',
    message: 'SELLER_NOT_FOUND',
    timestamp: '2025-04-01T15:04:05.000Z',
  }

  const ROW_LIMIT_BODY = {
    statusCode: 422,
    error: 'SELLER_REPORT_ROW_LIMIT_EXCEEDED',
    message: 'SELLER_REPORT_ROW_LIMIT_EXCEEDED',
    timestamp: '2025-04-01T15:04:05.000Z',
    rowLimit: 1000,
    rowCount: 1500,
  }

  it('maps the exact 404 envelope to seller-not-found', () => {
    expect(parseSellerReportFailure(axiosError(404, NOT_FOUND_BODY))).toEqual({
      kind: 'seller-not-found',
      status: 404,
      rowLimit: null,
      rowCount: null,
    })
  })

  it('maps the exact 422 envelope and surfaces the reported cap and count', () => {
    expect(parseSellerReportFailure(axiosError(422, ROW_LIMIT_BODY))).toEqual({
      kind: 'row-limit-exceeded',
      status: 422,
      rowLimit: 1000,
      rowCount: 1500,
    })
  })

  it('reads the code from `error`, never from `message` or `timestamp`', () => {
    // Same status, different code: the message must not be trusted.
    expect(
      parseSellerReportFailure(axiosError(404, { ...NOT_FOUND_BODY, error: 'SOMETHING_ELSE' }))
        .kind,
    ).toBe('unknown')
    // Same code with a different human message is still the same contract error.
    expect(
      parseSellerReportFailure(
        axiosError(404, { ...NOT_FOUND_BODY, message: 'no such seller', timestamp: 'nonsense' }),
      ).kind,
    ).toBe('seller-not-found')
    // A 200-shaped body on a failure status is not a domain error.
    expect(parseSellerReportFailure(axiosError(500, NOT_FOUND_BODY)).kind).toBe('unknown')
    expect(
      parseSellerReportFailure(axiosError(422, { ...ROW_LIMIT_BODY, error: 'OTHER' })).kind,
    ).toBe('unknown')
  })

  it('ignores non-numeric cap/count values instead of coercing them', () => {
    const failure = parseSellerReportFailure(
      axiosError(422, { ...ROW_LIMIT_BODY, rowLimit: '1000', rowCount: -5 }),
    )
    expect(failure.kind).toBe('row-limit-exceeded')
    expect(failure.rowLimit).toBeNull()
    expect(failure.rowCount).toBeNull()
  })

  it('maps transport statuses without a domain body', () => {
    expect(parseSellerReportFailure(axiosError(401, {})).kind).toBe('unauthorized')
    expect(parseSellerReportFailure(axiosError(403, { message: 'Forbidden' })).kind).toBe(
      'forbidden',
    )
    expect(parseSellerReportFailure(axiosError(400, {})).kind).toBe('invalid-request')
    expect(parseSellerReportFailure(axiosError(404, undefined)).kind).toBe('unknown')
  })

  it('treats a missing, malformed or network failure as unknown with a null status', () => {
    expect(parseSellerReportFailure(new Error('Network Error'))).toEqual({
      kind: 'unknown',
      status: null,
      rowLimit: null,
      rowCount: null,
    })
    expect(parseSellerReportFailure(undefined).status).toBeNull()
    expect(parseSellerReportFailure({ response: { status: 'oops', data: null } }).kind).toBe(
      'unknown',
    )
    expect(new ZodError([]) instanceof Error).toBe(true)
    expect(parseSellerReportFailure(new ZodError([])).kind).toBe('unknown')
  })
})
