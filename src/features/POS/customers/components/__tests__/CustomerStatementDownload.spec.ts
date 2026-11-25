/**
 * Sales history backend data T4 (S1, handoff 29): «Descargar estado de cuenta» — a period picker
 * (presets + custom days with the real Nuxt UI calendar), the last included day shown while `to`
 * is sent exclusive, a range checked before the request, a busy button and one message per failure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { CalendarDate } from '@internationalized/date'
import { mountWithUApp } from '@/test/mountWithUApp'
import CustomerStatementDownload from '../CustomerStatementDownload.vue'

const getStatementPdf = vi.fn()
vi.mock('../../api/customer.api', () => ({
  customerApi: { getStatementPdf: (...args: unknown[]) => getStatementPdf(...args) },
}))
const save = vi.fn()
vi.mock('../../statement/customerStatementFile', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  saveCustomerStatementPdf: (...args: unknown[]) => save(...args),
}))

const PDF = { blob: new Blob(['%PDF-1.7']), fileName: 'estado-de-cuenta.pdf' }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

let wrapper: VueWrapper | undefined
function mountDownload() {
  wrapper = mountWithUApp(CustomerStatementDownload, {
    props: { customerId: 'c-1' },
    attachTo: document.body,
  })
  return wrapper
}

const q = (selector: string) => document.body.querySelector<HTMLElement>(selector)
const text = (element: HTMLElement | null) =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
const preset = (label: string) => {
  const found = [
    ...document.body.querySelectorAll<HTMLElement>('[data-testid="statement-preset"]'),
  ].find((button) => text(button) === label)
  if (!found) throw new Error(`preset ${label} not found`)
  return found
}
const submit = () => q('[data-testid="statement-submit"]') as HTMLButtonElement

async function openPicker() {
  q('[data-testid="statement-trigger"]')!.click()
  await flushPromises()
}

async function pickDay(iso: string) {
  const cell = q(`[data-testid="statement-calendar"] [data-value="${iso}"]`)
  if (!cell) throw new Error(`calendar cell ${iso} was not rendered`)
  // Reka closes a range on the day the pointer/focus is on (its highlighted range), then the click.
  cell.focus()
  await flushPromises()
  cell.click()
  await flushPromises()
}

describe('CustomerStatementDownload', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-25T18:00:00.000Z'))
    getStatementPdf.mockReset()
    save.mockReset()
    document.body.innerHTML = ''
  })
  afterEach(() => {
    wrapper?.vm.$root?.$?.appContext.app.unmount()
    wrapper = undefined
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('is a secondary 44 px action named «Descargar estado de cuenta»', () => {
    mountDownload()
    const trigger = q('[data-testid="statement-trigger"]')!
    expect(trigger.getAttribute('aria-label')).toBe('Descargar estado de cuenta')
    expect(text(trigger)).toContain('Estado de cuenta')
    expect(trigger.className).toContain('min-h-11')
    expect(trigger.className).toContain('min-w-11')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('opens with «Este mes» and shows the last included day; sends `to` exclusive', async () => {
    getStatementPdf.mockResolvedValue(PDF)
    mountDownload()
    await openPicker()
    expect(preset('Este mes').getAttribute('aria-pressed')).toBe('true')
    expect(preset('Mes anterior').getAttribute('aria-pressed')).toBe('false')
    expect(text(q('[data-testid="statement-period"]'))).toBe('1 – 30 nov 2026')
    submit().click()
    await flushPromises()
    expect(getStatementPdf).toHaveBeenCalledWith(
      'c-1',
      { from: '2026-11-01', to: '2026-12-01' },
      expect.anything(),
    )
    expect(save).toHaveBeenCalledWith(PDF.blob, 'estado-de-cuenta.pdf')
    // Success closes the picker.
    expect(q('[data-testid="statement-picker"]')).toBeNull()
  })

  it('«Mes anterior» and «Últimos 3 meses» send whole months', async () => {
    getStatementPdf.mockResolvedValue(PDF)
    mountDownload()
    await openPicker()
    preset('Mes anterior').click()
    await flushPromises()
    expect(preset('Mes anterior').getAttribute('aria-pressed')).toBe('true')
    expect(text(q('[data-testid="statement-period"]'))).toBe('1 – 31 oct 2026')
    submit().click()
    await flushPromises()
    expect(getStatementPdf.mock.calls[0]![1]).toEqual({ from: '2026-10-01', to: '2026-11-01' })

    await openPicker()
    preset('Últimos 3 meses').click()
    await flushPromises()
    expect(text(q('[data-testid="statement-period"]'))).toBe('1 sep – 30 nov 2026')
    submit().click()
    await flushPromises()
    expect(getStatementPdf.mock.calls[1]![1]).toEqual({ from: '2026-09-01', to: '2026-12-01' })
  })

  it('custom days come from the project calendar (no native date input); last day + 1 is sent', async () => {
    getStatementPdf.mockResolvedValue(PDF)
    mountDownload()
    await openPicker()
    q('[data-testid="statement-custom-toggle"]')!.click()
    await flushPromises()
    expect(document.body.querySelector('input[type="date"]:not([aria-hidden="true"])')).toBeNull()
    await pickDay('2026-11-03')
    await pickDay('2026-11-20')
    expect(text(q('[data-testid="statement-period"]'))).toBe('3 – 20 nov 2026')
    expect(preset('Este mes').getAttribute('aria-pressed')).toBe('false')
    submit().click()
    await flushPromises()
    expect(getStatementPdf.mock.calls[0]![1]).toEqual({ from: '2026-11-03', to: '2026-11-21' })
  })

  it('an incomplete custom range is rejected before any request', async () => {
    mountDownload()
    await openPicker()
    q('[data-testid="statement-custom-toggle"]')!.click()
    await flushPromises()
    await pickDay('2026-11-03')
    expect(text(q('[data-testid="statement-validation"]'))).toBe(
      'Elige el primer y el último día del periodo.',
    )
    expect(submit().disabled).toBe(true)
    submit().click()
    await flushPromises()
    expect(getStatementPdf).not.toHaveBeenCalled()
  })

  it('more than 366 days is rejected before any request', async () => {
    const mounted = mountDownload()
    await openPicker()
    q('[data-testid="statement-custom-toggle"]')!.click()
    await flushPromises()
    mounted.findComponent({ name: 'Calendar' }).vm.$emit('update:modelValue', {
      start: new CalendarDate(2025, 1, 1),
      end: new CalendarDate(2026, 6, 30),
    })
    await flushPromises()
    expect(text(q('[data-testid="statement-validation"]'))).toBe(
      'El periodo puede ser de hasta 366 días.',
    )
    expect(submit().disabled).toBe(true)
    expect(getStatementPdf).not.toHaveBeenCalled()
  })

  it('busy while downloading: the buttons say so and a second click does nothing', async () => {
    const pending = deferred<typeof PDF>()
    getStatementPdf.mockReturnValue(pending.promise)
    mountDownload()
    await openPicker()
    submit().click()
    await flushPromises()
    expect(submit().disabled).toBe(true)
    expect(text(submit())).toContain('Generando')
    expect(q('[data-testid="statement-trigger"]')!.getAttribute('aria-busy')).toBe('true')
    submit().click()
    await flushPromises()
    expect(getStatementPdf).toHaveBeenCalledTimes(1)
    pending.resolve(PDF)
    await flushPromises()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it.each([
    [{ response: { status: 400, data: {} } }, 'Revisa el periodo: debe ser de 1 a 366 días.'],
    [
      { response: { status: 404, data: { error: 'CUSTOMER_NOT_FOUND' } } },
      'El cliente ya no existe.',
    ],
  ])(
    'a non-retryable failure shows its message without «Reintentar» (%#)',
    async (failure, message) => {
      getStatementPdf.mockRejectedValue(failure)
      mountDownload()
      await openPicker()
      submit().click()
      await flushPromises()
      expect(text(q('[data-testid="statement-error"]'))).toContain(message)
      expect(q('[data-testid="statement-retry"]')).toBeNull()
      expect(save).not.toHaveBeenCalled()
    },
  )

  it('500 PDF_GENERATION_FAILED: «No se pudo generar el estado de cuenta» with «Reintentar»', async () => {
    getStatementPdf
      .mockRejectedValueOnce({
        response: { status: 500, data: { error: 'PDF_GENERATION_FAILED' } },
      })
      .mockResolvedValueOnce(PDF)
    mountDownload()
    await openPicker()
    submit().click()
    await flushPromises()
    expect(text(q('[data-testid="statement-error"]'))).toContain(
      'No se pudo generar el estado de cuenta.',
    )
    expect(save).not.toHaveBeenCalled()
    q('[data-testid="statement-retry"]')!.click()
    await flushPromises()
    expect(getStatementPdf).toHaveBeenCalledTimes(2)
    expect(getStatementPdf.mock.calls[1]![1]).toEqual({ from: '2026-11-01', to: '2026-12-01' })
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('390: the picker fits the viewport and its controls are 44 px', async () => {
    mountDownload()
    await openPicker()
    const picker = q('[data-testid="statement-picker"]')!
    expect(picker.className).toContain('max-w-[calc(100vw-2rem)]')
    for (const button of [
      preset('Este mes'),
      preset('Mes anterior'),
      preset('Últimos 3 meses'),
      q('[data-testid="statement-custom-toggle"]')!,
      submit(),
    ]) {
      expect(button.className).toContain('min-h-11')
    }
  })
})
