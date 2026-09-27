// sellerReportPrint.spec.ts — isolated-document rendering and print lifecycle.
//
// Mutation-sensitive: printing the main window instead of the isolated frame,
// reusing a stale document, skipping HTML escaping, dropping a row, aggregating
// canceled amounts into the confirmed totals, waiting forever for a frame that
// never loads, or leaking the frame/listeners when `afterprint` never arrives
// fails at least one test.

import { describe, expect, it, vi } from 'vitest'
import type { SellerSalesReport } from '../../interfaces/seller-report.types'
import {
  SELLER_REPORT_PRINT_CLEANUP_TIMEOUT_MS,
  SELLER_REPORT_PRINT_LOAD_TIMEOUT_MS,
  createSellerReportPrintEnvironment,
  createSellerReportPrinter,
  escapeSellerReportHtml,
  renderSellerReportDocumentHtml,
  type SellerReportPrintEnvironment,
  type SellerReportPrintFrame,
  type SellerReportPrintTimerHandle,
  type SellerReportPrintWindow,
} from '../sellerReportPrint'

const SELLER_ID = '8f14e45f-ceea-4a2b-9c3d-1a2b3c4d5e6f'
const TENANT_ID = '11111111-2222-4333-8444-555555555555'
const FROM = '2025-03-01'
const TO = '2025-04-01'

function makeReport(overrides: Partial<SellerSalesReport> = {}): SellerSalesReport {
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
    rowCount: 3,
    confirmed: {
      dateBasis: 'confirmedAt',
      summary: {
        saleCount: 2,
        netSalesCents: 174_000,
        collectedCents: 74_000,
        outstandingDebtCents: 100_000,
        averageTicketCents: 87_000,
      },
      rows: [
        {
          id: 'a1111111-1111-4111-8111-111111111111',
          folio: 'F-0001',
          confirmedAt: '2025-03-05T18:30:00.000Z',
          totalCents: 116_000,
          paidCents: 16_000,
          debtCents: 100_000,
          paymentStatus: 'PARTIAL',
        },
        {
          id: 'b2222222-2222-4222-8222-222222222222',
          folio: null,
          confirmedAt: '2025-03-06T17:00:00.000Z',
          totalCents: 58_000,
          paidCents: 58_000,
          debtCents: 0,
          paymentStatus: 'PAID',
        },
      ],
    },
    canceled: {
      dateBasis: 'canceledAt',
      saleCount: 1,
      rows: [
        {
          id: 'c3333333-3333-4333-8333-333333333333',
          folio: 'F-0003',
          confirmedAt: '2025-03-07T16:00:00.000Z',
          canceledAt: '2025-03-08T15:00:00.000Z',
          totalCents: 70_000,
        },
      ],
    },
    ...overrides,
  }
}

describe('escapeSellerReportHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeSellerReportHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    )
  })

  it('leaves plain text untouched', () => {
    expect(escapeSellerReportHtml('Ana Vendedora — folio F-0001')).toBe(
      'Ana Vendedora — folio F-0001',
    )
  })
})

describe('renderSellerReportDocumentHtml', () => {
  it('renders a standalone document with inline print CSS and no remote asset', () => {
    const html = renderSellerReportDocumentHtml(makeReport())

    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<meta charset="utf-8"')
    expect(html).toContain('lang="es-MX"')
    expect(html).toContain('<title>')
    expect(html).toContain('<style>')
    expect(html).toContain('@page')
    expect(html).toContain('@media print')

    // No remote asset, no script, no navigation: the document must print from
    // the bytes it already has.
    for (const forbidden of [
      '<script',
      '<link',
      '<img',
      '<iframe',
      'src="http',
      'href="http',
      '@import',
      'url(',
      'fetch(',
      'XMLHttpRequest',
    ]) {
      expect(html).not.toContain(forbidden)
    }
  })

  it('renders every confirmed and canceled row with its authoritative amounts', () => {
    const html = renderSellerReportDocumentHtml(makeReport())

    expect(html).toContain('F-0001')
    expect(html).toContain('a1111111-1111-4111-8111-111111111111')
    expect(html).toContain('$1,160.00')
    expect(html).toContain('$160.00')
    expect(html).toContain('$1,000.00')
    expect(html).toContain('Parcial')
    expect(html).toContain('Pagada')
    // The second confirmed row carries the authoritative MXN amounts too.
    expect(html).toContain('b2222222-2222-4222-8222-222222222222')
    expect(html).toContain('$580.00')
    // Canceled rows are present with their informational amount.
    expect(html).toContain('F-0003')
    expect(html).toContain('c3333333-3333-4333-8333-333333333333')
    expect(html).toContain('$700.00')
  })

  it('renders the authoritative summary metrics without recomputing them', () => {
    const html = renderSellerReportDocumentHtml(makeReport())

    expect(html).toContain('$1,740.00')
    expect(html).toContain('$740.00')
    expect(html).toContain('$1,000.00')
    expect(html).toContain('$870.00')
    expect(html).toContain('Ventas confirmadas')
    expect(html).toContain('Ventas canceladas')
  })

  it('labels the Mexico City zone and the generated timestamp', () => {
    const html = renderSellerReportDocumentHtml(makeReport())

    expect(html).toContain('America/Mexico_City')
    // 15:04 UTC is 09:04 in Mexico City.
    expect(html).toContain('01/04/2025, 09:04')
  })

  it('discloses current attribution, reassignment across periods and current balances', () => {
    const html = renderSellerReportDocumentHtml(makeReport())

    // Same approved business rule as the on-screen report: the document is
    // attributed to the CURRENTLY assigned seller, and a reassignment also moves
    // past periods in this report.
    expect(html).toContain('Ventas atribuidas al vendedor asignado actualmente.')
    expect(html).toContain(
      'Si una venta se reasigna a otro vendedor, su atribución cambia también en este reporte de periodos anteriores.',
    )
    // The current-balances caveat is retained in the printed document.
    expect(html).toContain('Saldos actuales')
    // The previous wording implied the seller had confirmed the sales personally.
    expect(html).not.toContain('Ventas confirmadas por este vendedor')
  })

  it('explains the canceled exclusion in the printed document', () => {
    const html = renderSellerReportDocumentHtml(makeReport())

    expect(html).toContain('No se suman a las ventas confirmadas')
  })

  it('escapes hostile seller, folio and id content', () => {
    const html = renderSellerReportDocumentHtml(
      makeReport({
        seller: { id: SELLER_ID, name: '<img src=x onerror="alert(1)">Ana' },
        confirmed: {
          dateBasis: 'confirmedAt',
          summary: makeReport().confirmed.summary,
          rows: [
            {
              ...makeReport().confirmed.rows[0]!,
              folio: '"><script>alert(1)</script>',
            },
          ],
        },
      }),
    )

    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror="alert(1)"')
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;Ana')
    expect(html).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('renders a placeholder for a missing folio and a missing confirmed instant', () => {
    const html = renderSellerReportDocumentHtml(makeReport())

    // The second confirmed row has a null folio.
    expect(html).toContain('Sin folio')
    expect(html).toContain('Fecha de confirmación')
    expect(html).toContain('Fecha de cancelación')
  })

  it('renders an empty report without inventing a row or a total', () => {
    const html = renderSellerReportDocumentHtml(
      makeReport({
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
      }),
    )

    expect(html).toContain('Sin ventas confirmadas en el periodo')
    expect(html).toContain('Sin ventas canceladas en el periodo')
    expect(html).not.toContain('F-0001')
  })
})

/**
 * Frame/printing port double.
 *
 * jsdom never loads an iframe document, so the load, error and afterprint
 * events are emitted explicitly by the test instead of being awaited from the
 * browser.
 */
function createFakeEnvironment() {
  const windows: FakeWindow[] = []
  const frames: FakeFrame[] = []
  const scheduled = new Map<SellerReportPrintTimerHandle, () => void>()
  const cancelled: SellerReportPrintTimerHandle[] = []
  const appended: SellerReportPrintFrame[] = []
  const delays: number[] = []
  let nextHandle = 1

  class FakeWindow implements SellerReportPrintWindow {
    readonly listeners = new Map<string, Set<() => void>>()
    readonly print = vi.fn()

    addEventListener(type: string, listener: () => void): void {
      const set = this.listeners.get(type) ?? new Set()
      set.add(listener)
      this.listeners.set(type, set)
    }

    removeEventListener(type: string, listener: () => void): void {
      this.listeners.get(type)?.delete(listener)
    }

    emit(type: string): void {
      // Iterating the live Set is safe: a listener that removes itself during
      // dispatch is simply skipped by the ongoing iteration.
      for (const listener of this.listeners.get(type) ?? []) listener()
    }

    listenerCount(): number {
      let total = 0
      for (const listeners of this.listeners.values()) total += listeners.size
      return total
    }
  }

  class FakeFrame implements SellerReportPrintFrame {
    readonly attributes = new Map<string, string>()
    readonly removed = vi.fn()
    readonly frameWindow = new FakeWindow()

    constructor() {
      windows.push(this.frameWindow)
      frames.push(this)
    }

    setAttribute(name: string, value: string): void {
      this.attributes.set(name, value)
    }

    window(): SellerReportPrintWindow {
      return this.frameWindow
    }

    remove(): void {
      this.removed()
    }
  }

  const environment: SellerReportPrintEnvironment = {
    createFrame: () => new FakeFrame(),
    host: () => ({ append: (frame) => appended.push(frame) }),
    schedule: (callback, delayMs) => {
      const handle = nextHandle++
      scheduled.set(handle, callback)
      delays.push(delayMs)
      return handle
    },
    cancel: (handle) => {
      cancelled.push(handle)
      scheduled.delete(handle)
    },
  }

  return {
    environment,
    frames,
    windows,
    appended,
    cancelled,
    delays,
    pending: scheduled,
    runAllScheduled: () => {
      for (const callback of scheduled.values()) callback()
    },
  }
}

describe('createSellerReportPrinter — isolated frame lifecycle', () => {
  it('mounts an off-screen isolated document and resolves ready on load', async () => {
    const fake = createFakeEnvironment()
    const printer = createSellerReportPrinter({ environment: fake.environment })

    const session = printer.mount('<html>snapshot</html>')
    const frame = fake.frames[0]!

    expect(fake.appended).toEqual([frame])
    expect(frame.attributes.get('srcdoc')).toBe('<html>snapshot</html>')
    expect(frame.attributes.get('aria-hidden')).toBe('true')
    expect(frame.attributes.get('sandbox')).toBeUndefined()
    expect(frame.attributes.get('style')).toContain('-10000px')
    expect(frame.attributes.get('style')).not.toContain('display:none')

    let ready = false
    void session.ready.then(() => {
      ready = true
    })
    expect(ready).toBe(false)

    fake.windows[0]!.emit('load')
    await expect(session.ready).resolves.toBeUndefined()
  })

  it('rejects ready when the isolated document fails to load', async () => {
    const fake = createFakeEnvironment()
    const printer = createSellerReportPrinter({ environment: fake.environment })

    const session = printer.mount('<html></html>')
    fake.windows[0]!.emit('error')

    await expect(session.ready).rejects.toThrow(/no se pudo cargar/i)
  })

  it('rejects ready when the isolated document never loads and cancels the wait on dispose', async () => {
    const fake = createFakeEnvironment()
    const printer = createSellerReportPrinter({
      environment: fake.environment,
      loadTimeoutMs: 1234,
    })

    const session = printer.mount('<html></html>')
    expect(fake.pending.size).toBe(1)
    // The injected load timeout is the one that was scheduled.
    expect(fake.delays).toEqual([1234])

    let settled = false
    void session.ready.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )

    const [handle] = fake.pending.keys()
    session.dispose()
    expect(fake.cancelled).toContain(handle)
    expect(fake.pending.size).toBe(0)

    // Nothing is left pending: a disposed session never settles its ready promise.
    fake.runAllScheduled()
    await Promise.resolve()
    expect(settled).toBe(false)
  })

  it('rejects ready when the mount timeout elapses without a load event', async () => {
    const fake = createFakeEnvironment()
    const printer = createSellerReportPrinter({ environment: fake.environment })

    const session = printer.mount('<html></html>')
    const scheduled = [...fake.pending.values()]
    expect(scheduled).toHaveLength(1)
    scheduled[0]!()

    await expect(session.ready).rejects.toThrow(/no se pudo cargar/i)
  })

  it('commits by printing the isolated frame window, never the main window', () => {
    const fake = createFakeEnvironment()
    const mainPrint = vi.spyOn(window, 'print')
    const printer = createSellerReportPrinter({ environment: fake.environment })

    const session = printer.mount('<html></html>')
    fake.windows[0]!.emit('load')
    session.commit()

    expect(fake.windows[0]!.print).toHaveBeenCalledTimes(1)
    expect(mainPrint).not.toHaveBeenCalled()
    mainPrint.mockRestore()
  })

  it('refuses to commit before a frame window exists', async () => {
    const fake = createFakeEnvironment()
    const printer = createSellerReportPrinter({
      environment: {
        ...fake.environment,
        createFrame: () => ({
          setAttribute: () => {},
          window: () => null,
          remove: vi.fn(),
        }),
      },
    })

    const session = printer.mount('<html></html>')
    await expect(session.ready).rejects.toThrow(/no se pudo cargar/i)
    expect(() => session.commit()).toThrow(/no se pudo abrir la impresión/i)
  })

  it('cleans the frame up on afterprint and cancels the defensive timer', () => {
    const fake = createFakeEnvironment()
    const printer = createSellerReportPrinter({ environment: fake.environment })

    const session = printer.mount('<html></html>')
    fake.windows[0]!.emit('load')
    session.commit()

    const frame = fake.frames[0]!
    expect(frame.removed).not.toHaveBeenCalled()
    // The defensive cleanup timer is armed for the configured window.
    expect(fake.delays).toEqual([
      SELLER_REPORT_PRINT_LOAD_TIMEOUT_MS,
      SELLER_REPORT_PRINT_CLEANUP_TIMEOUT_MS,
    ])

    fake.windows[0]!.emit('afterprint')

    expect(frame.removed).toHaveBeenCalledTimes(1)
    expect(fake.cancelled.length).toBeGreaterThan(0)
    expect(fake.windows[0]!.listenerCount()).toBe(0)
  })

  it('cleans the frame up with the defensive timer when afterprint never arrives', () => {
    const fake = createFakeEnvironment()
    const printer = createSellerReportPrinter({ environment: fake.environment })

    const session = printer.mount('<html></html>')
    fake.windows[0]!.emit('load')
    session.commit()

    // Load timeout (already fired/cancelled) plus the commit cleanup timer.
    fake.runAllScheduled()

    expect(fake.frames[0]!.removed).toHaveBeenCalledTimes(1)
  })

  it('disposes idempotently and refuses to commit afterwards', () => {
    const fake = createFakeEnvironment()
    const printer = createSellerReportPrinter({ environment: fake.environment })

    const session = printer.mount('<html></html>')
    fake.windows[0]!.emit('load')
    session.dispose()
    session.dispose()

    // Idempotent: the frame is detached exactly once.
    expect(fake.frames[0]!.removed).toHaveBeenCalledTimes(1)
    expect(() => session.commit()).toThrow(/no se pudo abrir la impresión/i)
  })

  it('cancels the load timer once the document has loaded', async () => {
    const fake = createFakeEnvironment()
    const printer = createSellerReportPrinter({ environment: fake.environment })

    const session = printer.mount('<html></html>')
    fake.windows[0]!.emit('load')
    await session.ready

    expect(fake.cancelled.length).toBeGreaterThan(0)
  })

  it('exposes the committed defaults for both timers', () => {
    expect(SELLER_REPORT_PRINT_LOAD_TIMEOUT_MS).toBe(15_000)
    expect(SELLER_REPORT_PRINT_CLEANUP_TIMEOUT_MS).toBe(60_000)
  })
})

describe('createSellerReportPrintEnvironment — DOM adapter', () => {
  it('mounts through the real DOM as an off-screen iframe without sandbox', () => {
    const printer = createSellerReportPrinter()
    const session = printer.mount('<html>dom</html>')

    const iframe = document.body.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute('srcdoc')).toBe('<html>dom</html>')
    expect(iframe?.getAttribute('sandbox')).toBeNull()
    expect(iframe?.getAttribute('aria-hidden')).toBe('true')
    expect(iframe?.getAttribute('style')).toContain('-10000px')
    expect(iframe?.getAttribute('style')).not.toContain('display:none')

    // Dispose cancels the pending load timer, so no real timer outlives the test.
    session.dispose()
    expect(document.body.querySelector('iframe')).toBeNull()
  })

  it('exposes the frame browsing context only while it is attached', () => {
    const environment = createSellerReportPrintEnvironment()
    const frame = environment.createFrame()

    expect(frame.window()).toBeNull()

    environment.host()?.append(frame)
    expect(frame.window()).not.toBeNull()

    frame.remove()
    expect(frame.window()).toBeNull()
  })

  it('schedules and cancels work through the global timers', () => {
    vi.useFakeTimers()
    try {
      const environment = createSellerReportPrintEnvironment()
      const fired = vi.fn()
      const cancelled = vi.fn()

      const handle = environment.schedule(cancelled, 5)
      environment.schedule(fired, 5)
      environment.cancel(handle)
      vi.advanceTimersByTime(50)

      expect(fired).toHaveBeenCalledTimes(1)
      expect(cancelled).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
