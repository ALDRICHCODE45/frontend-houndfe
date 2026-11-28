/**
 * customers-bulk-actions T1 (S3): the dialog of the bulk downloads — the statements period picker
 * (same presets and validation as the single statement), the progress with «Cancelar», and the
 * failure with its next step («Reintentar sin ellos», «Reintentar» after the wait).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import CustomerBulkDownloadDialog from '../CustomerBulkDownloadDialog.vue'

let wrapper: VueWrapper | undefined
let liveProps: Record<string, unknown> = {}

function mountDialog(props: Record<string, unknown> = {}) {
  liveProps = reactive({
    open: true,
    kind: 'statements',
    count: 3,
    running: false,
    error: null,
    canRetry: false,
    canRetryWithoutMissing: false,
    ...props,
  })
  wrapper = mountWithUApp(CustomerBulkDownloadDialog, { props: liveProps, attachTo: document.body })
  return wrapper
}

const q = (selector: string) => document.body.querySelector<HTMLElement>(selector)
const all = (selector: string) => [...document.body.querySelectorAll<HTMLElement>(selector)]
const text = (element: HTMLElement | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
const dialogComponent = () => wrapper!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-25T18:00:00.000Z'))
  document.body.innerHTML = ''
})
afterEach(() => {
  wrapper?.vm.$root?.$?.appContext.app.unmount()
  wrapper = undefined
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('CustomerBulkDownloadDialog — statements', () => {
  it('offers the single-statement presets with «Este mes» chosen and submits its half-open range', async () => {
    mountDialog()
    await flushPromises()
    expect(all('[data-testid="bulk-statement-preset"]').map(text)).toEqual([
      'Este mes',
      'Mes anterior',
      'Últimos 3 meses',
    ])
    expect(text(q('[data-testid="bulk-statement-period"]'))).toBe('1 – 30 nov 2026')
    expect(text(q('[data-testid="bulk-dialog-summary"]'))).toContain('3 clientes')

    all('[data-testid="bulk-statement-preset"]')[1]!.click()
    await flushPromises()
    q('[data-testid="bulk-dialog-submit"]')!.click()
    await flushPromises()
    expect(dialogComponent().emitted('submit')?.slice(-1)[0]).toEqual([{ from: '2026-10-01', to: '2026-11-01' }])
  })

  it('shows progress with «Cancelar» while running and hides the picker', async () => {
    mountDialog({ running: true, count: 50 })
    await flushPromises()
    expect(q('[data-testid="bulk-statement-preset"]')).toBeNull()
    expect(text(q('[data-testid="bulk-dialog-progress"]'))).toContain('Generando 50 estados de cuenta')
    q('[data-testid="bulk-dialog-cancel"]')!.click()
    await flushPromises()
    expect(dialogComponent().emitted('cancel')).toHaveLength(1)
  })
})

describe('CustomerBulkDownloadDialog — failures', () => {
  it('404 offers «Reintentar sin ellos»', async () => {
    mountDialog({
      kind: 'csv',
      error: { code: 'BULK_CUSTOMERS_NOT_FOUND', message: '2 clientes de la selección ya no existen.', canRetry: false, missingIds: ['a', 'b'] },
      canRetryWithoutMissing: true,
    })
    await flushPromises()
    expect(text(q('[data-testid="bulk-dialog-error"]'))).toContain('2 clientes de la selección ya no existen.')
    expect(q('[data-testid="bulk-dialog-retry"]')).toBeNull()
    q('[data-testid="bulk-dialog-retry-without"]')!.click()
    await flushPromises()
    expect(dialogComponent().emitted('retry-without-missing')).toHaveLength(1)
  })

  it('429 keeps «Reintentar» disabled until the wait is over', async () => {
    const error = { code: 'BULK_EXPORT_BUSY', message: 'Hay otra descarga en curso; reintenta en 7 s.', canRetry: true, retryAfterSeconds: 10 }
    mountDialog({ error, canRetry: false })
    await flushPromises()
    const retry = () => q('[data-testid="bulk-dialog-retry"]') as HTMLButtonElement
    expect(text(q('[data-testid="bulk-dialog-error"]'))).toContain('reintenta en 7 s')
    expect(retry().disabled).toBe(true)

    liveProps.canRetry = true
    await flushPromises()
    expect(retry().disabled).toBe(false)
    retry().click()
    await flushPromises()
    expect(dialogComponent().emitted('retry')).toHaveLength(1)
  })

  it('INVALID_PERIOD shows the picker again with the error inline and lets the user submit another period', async () => {
    mountDialog({ error: { code: 'INVALID_PERIOD', message: 'Revisa el periodo: debe ser de 1 a 366 días.', canRetry: false } })
    await flushPromises()
    expect(text(q('[data-testid="bulk-dialog-error"]'))).toContain('Revisa el periodo')
    expect(all('[data-testid="bulk-statement-preset"]')).toHaveLength(3)
    expect(q('[data-testid="bulk-dialog-back"]')).toBeNull()

    all('[data-testid="bulk-statement-preset"]')[2]!.click()
    await flushPromises()
    q('[data-testid="bulk-dialog-submit"]')!.click()
    await flushPromises()
    expect(dialogComponent().emitted('submit')?.slice(-1)[0]).toEqual([{ from: '2026-09-01', to: '2026-12-01' }])
  })

  it('statements BULK_EXPORT_TIMEOUT offers «Volver» back to the period picker (and «Cerrar»)', async () => {
    mountDialog({ error: { code: 'BULK_EXPORT_TIMEOUT', message: 'La descarga tardó demasiado; prueba con menos clientes.', canRetry: false } })
    await flushPromises()
    expect(q('[data-testid="bulk-statement-preset"]')).toBeNull()
    expect(q('[data-testid="bulk-dialog-close"]')).not.toBeNull()
    q('[data-testid="bulk-dialog-back"]')!.click()
    await flushPromises()
    expect(dialogComponent().emitted('back')).toHaveLength(1)
    expect(dialogComponent().emitted('update:open')).toBeUndefined()
  })

  it.each([
    ['statements', 'BULK_SELECTION_TOO_LARGE', 'La selección tiene 63 clientes y el máximo es 50 por descarga. Quita algunos e intenta de nuevo.'],
    ['statements', 'BULK_SELECTION_EMPTY', 'La selección ya no tiene clientes. Actualizamos la lista.'],
    ['csv', 'BULK_SELECTION_TOO_LARGE', 'La selección tiene 12,000 clientes y el máximo es 10,000 por exportación. Quita algunos e intenta de nuevo.'],
    ['csv', 'BULK_SELECTION_EMPTY', 'La selección ya no tiene clientes. Actualizamos la lista.'],
    ['csv', 'BULK_EXPORT_TIMEOUT', 'La descarga tardó demasiado; prueba con menos clientes.'],
  ])('%s %s offers «Volver», which closes back to the table (the selection must change)', async (kind, code, message) => {
    mountDialog({ kind, error: { code, message, canRetry: false } })
    await flushPromises()
    expect(text(q('[data-testid="bulk-dialog-error"]'))).toContain(message)
    expect(q('[data-testid="bulk-statement-preset"]')).toBeNull()
    // One way out, not two buttons doing the same.
    expect(q('[data-testid="bulk-dialog-close"]')).toBeNull()
    const back = q('[data-testid="bulk-dialog-back"]')!
    expect(text(back)).toBe('Volver')
    back.click()
    await flushPromises()
    expect(dialogComponent().emitted('update:open')).toEqual([[false]])
    expect(dialogComponent().emitted('back')).toBeUndefined()
  })

  it('CSV has no period picker', async () => {
    mountDialog({ kind: 'csv', running: true, count: 1200 })
    await flushPromises()
    expect(q('[data-testid="bulk-statement-preset"]')).toBeNull()
    expect(text(q('[data-testid="bulk-dialog-progress"]'))).toContain('Exportando 1,200 clientes')
  })
})
