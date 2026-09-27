import type { SellerSalesReport } from '../interfaces/seller-report.types'
import {
  SELLER_REPORT_PAYMENT_STATUS_LABELS,
  SELLER_REPORT_TIME_ZONE_LABEL,
  formatSellerReportCalendarDate,
  formatSellerReportCents,
  formatSellerReportCount,
  formatSellerReportInstant,
} from './sellerReportPresentation'

/**
 * sellerReportPrint.ts — the print half of the seller report.
 *
 * Why a whole module, and why a port:
 *   - The report must be printed from a FRESH, freshly validated snapshot. The
 *     orchestration lives in the composable; this module only turns an already
 *     validated snapshot into a document and drives the browser's print dialog.
 *   - The document is a self-contained HTML string rendered inside a throwaway
 *     IFRAME via `srcdoc`: no remote asset, no script, no network request, and
 *     never `window.print()` on the application window (which would print the
 *     whole SPA shell). Every dynamic value is escaped, so a hostile seller
 *     name or folio cannot inject markup into the printed page.
 *   - `SellerReportPrintEnvironment` is a tiny port over the frame + timers.
 *     jsdom never loads an iframe document (no `load`, no `afterprint`, no
 *     `contentWindow` until the frame is attached), so the lifecycle — load,
 *     failure, `afterprint`, defensive cleanup, teardown — is only testable
 *     deterministically through an injected environment.
 */

/** How long the isolated document may take to load before printing is refused. */
export const SELLER_REPORT_PRINT_LOAD_TIMEOUT_MS = 15_000

/**
 * Defensive cleanup window: `afterprint` is not emitted by every engine, so the
 * frame is detached unconditionally after this long.
 */
export const SELLER_REPORT_PRINT_CLEANUP_TIMEOUT_MS = 60_000

/** Off-screen but still rendered: `display:none` frames are not printable. */
const OFF_SCREEN_FRAME_STYLE =
  'position:fixed;left:-10000px;top:0;width:1024px;height:768px;border:0;'

const LOAD_FAILURE_MESSAGE = 'No se pudo cargar el documento de impresión'
const PRINT_FAILURE_MESSAGE =
  'No se pudo abrir la impresión: el documento aislado no está disponible'

/** The printable surface of an isolated frame window. */
export interface SellerReportPrintWindow {
  addEventListener(type: 'load' | 'error' | 'afterprint', listener: () => void): void
  removeEventListener(type: 'load' | 'error' | 'afterprint', listener: () => void): void
  print(): void
}

/** One isolated frame. */
export interface SellerReportPrintFrame {
  setAttribute(name: string, value: string): void
  /** The frame's browsing context, or `null` while it is not attached. */
  window(): SellerReportPrintWindow | null
  remove(): void
}

/** Where an isolated frame is mounted. */
export interface SellerReportPrintHost {
  append(frame: SellerReportPrintFrame): void
}

/**
 * Opaque timer handle.
 *
 * The browser returns a number, while Node (and therefore jsdom under Vitest)
 * returns a `Timeout` object. The port never inspects the handle, it only hands
 * it back to `cancel`, so the honest type is a named opaque union instead of a
 * numeric lie.
 */
export type SellerReportPrintTimerHandle = number | object

/** Timers and DOM access, injectable for deterministic lifecycle tests. */
export interface SellerReportPrintEnvironment {
  createFrame(): SellerReportPrintFrame
  host(): SellerReportPrintHost | null
  schedule(callback: () => void, delayMs: number): SellerReportPrintTimerHandle
  cancel(handle: SellerReportPrintTimerHandle): void
}

/** A mounted isolated document. */
export interface SellerReportPrintSession {
  /** Settles when the document has loaded; rejects when it never does. */
  readonly ready: Promise<void>
  /** Hands the isolated document to the browser's print dialog. */
  commit(): void
  /** Detaches the frame and its listeners. Idempotent. */
  dispose(): void
}

/** Turns a validated report into a printable isolated document. */
export interface SellerReportPrinter {
  mount(html: string): SellerReportPrintSession
}

export interface SellerReportPrinterOptions {
  environment?: SellerReportPrintEnvironment
  loadTimeoutMs?: number
  cleanupTimeoutMs?: number
}

/** Escape every HTML-significant character of an untrusted value. */
export function escapeSellerReportHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function cell(value: string): string {
  return `<td>${escapeSellerReportHtml(value)}</td>`
}

/**
 * One table row. `rowId` travels as an escaped `data-row-id` attribute instead of
 * a visible column: the printed statement stays readable while every row remains
 * unambiguously traceable back to its sale (no folio is required to identify it).
 */
function row(cells: string[], rowId: string, className = ''): string {
  const attributes = ` data-row-id="${escapeSellerReportHtml(rowId)}"${
    className ? ` class="${className}"` : ''
  }`
  return `<tr${attributes}>${cells.join('')}</tr>`
}

function headerRow(labels: string[]): string {
  return `<tr>${labels.map((label) => `<th scope="col">${escapeSellerReportHtml(label)}</th>`).join('')}</tr>`
}

function metric(label: string, value: string): string {
  return `<div class="metric"><dt>${escapeSellerReportHtml(label)}</dt><dd>${escapeSellerReportHtml(value)}</dd></div>`
}

function folioOf(folio: string | null): string {
  return folio === null ? 'Sin folio' : folio
}

/** An instant cell: canceled rows may never have been confirmed. */
function instantOf(instant: string | null): string {
  return instant === null ? '—' : formatSellerReportInstant(instant)
}

/**
 * Build the complete print document for one validated report.
 *
 * The document is intentionally dependency-free: inline styles, system fonts,
 * no remote asset, no script. Every value comes from the validated payload, so
 * the printed page can never disagree with the validated snapshot, and canceled
 * rows are rendered in their own section with an explicit note that their
 * amounts are informational.
 */
export function renderSellerReportDocumentHtml(report: SellerSalesReport): string {
  const summary = report.confirmed.summary
  const sellerName = escapeSellerReportHtml(report.seller.name)

  const confirmedRows =
    report.confirmed.rows.length === 0
      ? `<tr><td colspan="6" class="empty">Sin ventas confirmadas en el periodo</td></tr>`
      : report.confirmed.rows
          .map((sale) =>
            row(
              [
                cell(folioOf(sale.folio)),
                cell(formatSellerReportInstant(sale.confirmedAt)),
                cell(SELLER_REPORT_PAYMENT_STATUS_LABELS[sale.paymentStatus]),
                cell(formatSellerReportCents(sale.totalCents)),
                cell(formatSellerReportCents(sale.paidCents)),
                cell(formatSellerReportCents(sale.debtCents)),
              ],
              sale.id,
            ),
          )
          .join('')

  const canceledRows =
    report.canceled.rows.length === 0
      ? `<tr><td colspan="4" class="empty">Sin ventas canceladas en el periodo</td></tr>`
      : report.canceled.rows
          .map((sale) =>
            row(
              [
                cell(folioOf(sale.folio)),
                cell(instantOf(sale.confirmedAt)),
                cell(formatSellerReportInstant(sale.canceledAt)),
                cell(formatSellerReportCents(sale.totalCents)),
              ],
              sale.id,
              'canceled',
            ),
          )
          .join('')

  return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<title>Reporte de ventas — ${sellerName}</title>
<style>
@page { margin: 12mm; }
@media print {
  body { margin: 0; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 16px;
  color: #111827;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 12px;
  line-height: 1.45;
}
h1 { margin: 0 0 4px; font-size: 20px; }
h2 { margin: 20px 0 6px; font-size: 15px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
p { margin: 0 0 6px; }
.muted { color: #4b5563; }
.meta { margin: 8px 0 0; }
.meta dt { display: inline; font-weight: 600; }
.meta dd { display: inline; margin: 0 12px 0 4px; }
.metrics { display: flex; flex-wrap: wrap; gap: 12px 24px; margin: 8px 0 0; padding: 0; }
.metric { min-width: 120px; }
.metric dt { color: #4b5563; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.metric dd { margin: 2px 0 0; font-size: 15px; font-weight: 600; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; }
th, td { border-bottom: 1px solid #e5e7eb; padding: 5px 6px; text-align: left; vertical-align: top; }
th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
td:last-child, th:last-child { text-align: right; }
.empty { color: #4b5563; font-style: italic; text-align: center; }
tr.canceled td { color: #4b5563; }
.note { margin-top: 6px; color: #4b5563; font-style: italic; }
footer { margin-top: 24px; color: #6b7280; font-size: 11px; }
</style>
</head>
<body>
<header>
  <h1>Reporte de ventas</h1>
  <p class="muted">${sellerName}</p>
  <dl class="meta">
    <dt>Periodo:</dt><dd>${escapeSellerReportHtml(formatSellerReportCalendarDate(report.from))} → ${escapeSellerReportHtml(formatSellerReportCalendarDate(report.to))}</dd>
    <dt>Generado:</dt><dd>${escapeSellerReportHtml(formatSellerReportInstant(report.generatedAt))}</dd>
    <dt>Zona:</dt><dd>${escapeSellerReportHtml(SELLER_REPORT_TIME_ZONE_LABEL)}</dd>
  </dl>
</header>

<section>
  <h2>Ventas confirmadas</h2>
  <p class="muted">Ventas atribuidas al vendedor asignado actualmente. Si una venta se reasigna a otro vendedor, su atribución cambia también en este reporte de periodos anteriores. Los cobros y saldos mostrados son los Saldos actuales leídos al generar el reporte.</p>
  <dl class="metrics">
    ${metric('Ventas confirmadas', formatSellerReportCount(summary.saleCount))}
    ${metric('Ventas netas', formatSellerReportCents(summary.netSalesCents))}
    ${metric('Cobrado', formatSellerReportCents(summary.collectedCents))}
    ${metric('Saldo pendiente', formatSellerReportCents(summary.outstandingDebtCents))}
    ${metric('Ticket promedio', formatSellerReportCents(summary.averageTicketCents))}
  </dl>
  <table>
    <thead>${headerRow(['Folio', 'Fecha de confirmación', 'Estado', 'Total', 'Pagado', 'Saldo'])}</thead>
    <tbody>${confirmedRows}</tbody>
  </table>
</section>

<section>
  <h2>Ventas canceladas</h2>
  <p class="muted">Los montos de esta sección son informativos. No se suman a las ventas confirmadas ni a los saldos actuales.</p>
  <table>
    <thead>${headerRow(['Folio', 'Fecha de confirmación', 'Fecha de cancelación', 'Total'])}</thead>
    <tbody>${canceledRows}</tbody>
  </table>
  <p class="note">Filas incluidas: ${escapeSellerReportHtml(formatSellerReportCount(report.rowCount))} de ${escapeSellerReportHtml(formatSellerReportCount(report.rowLimit))}.</p>
</section>

<footer>${escapeSellerReportHtml(SELLER_REPORT_TIME_ZONE_LABEL)} · Documento generado localmente desde el reporte validado.</footer>
</body>
</html>`
}

/**
 * DOM adapter: the only place that knows about a real `HTMLIFrameElement`.
 *
 * The port frame is not the element itself, so the element is tracked in a
 * `WeakMap` and appended by the host. `window()` answers `null` until the frame
 * is attached (no browsing context exists before that) and again after it is
 * removed, so a disposed session can never print.
 */
export function createSellerReportPrintEnvironment(): SellerReportPrintEnvironment {
  const elements = new WeakMap<SellerReportPrintFrame, HTMLIFrameElement>()

  return {
    createFrame: () => {
      const element = document.createElement('iframe')
      const frame: SellerReportPrintFrame = {
        setAttribute: (name, value) => {
          element.setAttribute(name, value)
        },
        window: () => {
          if (!element.isConnected) return null
          const frameWindow = element.contentWindow
          // SAFETY: DOM types an iframe context as `WindowProxy`; a frame window
          // is a real Window, and this port only exposes add/removeEventListener
          // and print(), which every engine implements on it.
          return frameWindow ? (frameWindow as unknown as SellerReportPrintWindow) : null
        },
        remove: () => {
          element.remove()
        },
      }
      elements.set(frame, element)
      return frame
    },
    host: () => ({
      append: (frame) => {
        const element = elements.get(frame)
        if (element) document.body.append(element)
      },
    }),
    schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
    // SAFETY: the handle came from `window.setTimeout` (the only producer in
    // this environment), so narrowing the opaque union back to a timer id is
    // sound for `clearTimeout`.
    cancel: (handle) => window.clearTimeout(handle as number),
  }
}

/**
 * Create a printer.
 *
 * Lifecycle:
 *   1. `mount(html)` builds an off-screen isolated frame, sets `srcdoc` to the
 *      exact document it was given, and starts waiting for `load`.
 *   2. `ready` settles with the load result; it REJECTS on a load error and on
 *      the load timeout, so a caller can never print a blank or half-loaded
 *      document.
 *   3. `commit()` arms the defensive cleanup timer and calls `print()` on the
 *      ISOLATED window — never on the application window.
 *   4. The frame is removed on `afterprint`, on the defensive timeout, or on
 *      `dispose()`; `dispose()` is idempotent, and a disposed or already
 *      finished session refuses to commit.
 */
export function createSellerReportPrinter(
  options: SellerReportPrinterOptions = {},
): SellerReportPrinter {
  const environment = options.environment ?? createSellerReportPrintEnvironment()
  const loadTimeoutMs = options.loadTimeoutMs ?? SELLER_REPORT_PRINT_LOAD_TIMEOUT_MS
  const cleanupTimeoutMs = options.cleanupTimeoutMs ?? SELLER_REPORT_PRINT_CLEANUP_TIMEOUT_MS

  return {
    mount(html: string): SellerReportPrintSession {
      const frame = environment.createFrame()
      frame.setAttribute('srcdoc', html)
      frame.setAttribute('aria-hidden', 'true')
      frame.setAttribute('tabindex', '-1')
      frame.setAttribute('title', 'Documento de impresión del reporte de ventas')
      frame.setAttribute('style', OFF_SCREEN_FRAME_STYLE)
      environment.host()?.append(frame)

      const printWindow = frame.window()
      let disposed = false
      let finished = false
      let loadTimeoutHandle: SellerReportPrintTimerHandle | null = null
      let cleanupTimeoutHandle: SellerReportPrintTimerHandle | null = null
      let afterPrintListener: (() => void) | null = null

      const cancelLoadTimeout = (): void => {
        if (loadTimeoutHandle === null) return
        environment.cancel(loadTimeoutHandle)
        loadTimeoutHandle = null
      }

      /** Single teardown path: timers, listeners, frame. Safe to call twice. */
      const detach = (): void => {
        cancelLoadTimeout()
        if (cleanupTimeoutHandle !== null) {
          environment.cancel(cleanupTimeoutHandle)
          cleanupTimeoutHandle = null
        }
        if (afterPrintListener !== null) {
          const win = frame.window()
          win?.removeEventListener('afterprint', afterPrintListener)
          afterPrintListener = null
        }
        frame.remove()
        finished = true
      }

      const ready = new Promise<void>((resolve, reject) => {
        if (!printWindow) {
          reject(new Error(LOAD_FAILURE_MESSAGE))
          return
        }

        const settle = (): void => {
          cancelLoadTimeout()
          printWindow.removeEventListener('load', onLoad)
          printWindow.removeEventListener('error', onError)
        }
        const onLoad = (): void => {
          settle()
          resolve()
        }
        const onError = (): void => {
          settle()
          reject(new Error(LOAD_FAILURE_MESSAGE))
        }

        printWindow.addEventListener('load', onLoad)
        printWindow.addEventListener('error', onError)
        loadTimeoutHandle = environment.schedule(() => {
          loadTimeoutHandle = null
          settle()
          reject(new Error(LOAD_FAILURE_MESSAGE))
        }, loadTimeoutMs)
      })

      return {
        ready,
        commit: (): void => {
          if (disposed || finished) throw new Error(PRINT_FAILURE_MESSAGE)

          const win = frame.window()
          if (!win || typeof win.print !== 'function') throw new Error(PRINT_FAILURE_MESSAGE)

          afterPrintListener = () => {
            detach()
          }
          win.addEventListener('afterprint', afterPrintListener)
          cleanupTimeoutHandle = environment.schedule(() => {
            cleanupTimeoutHandle = null
            detach()
          }, cleanupTimeoutMs)

          win.print()
        },
        dispose: (): void => {
          if (disposed) return
          disposed = true
          detach()
        },
      }
    },
  }
}
