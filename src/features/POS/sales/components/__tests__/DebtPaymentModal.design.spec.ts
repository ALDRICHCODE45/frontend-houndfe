/**
 * Style-cleanup U2 (owner S3 «una sola pieza»): «Cobrar deuda» wears the shared, marker-free
 * payment-sheet classes (`hf-pay-*`), so it looks the same with NO portal class (customer history
 * caller without a feature marker) as from the sale detail. One-line method tiles (icon · label ·
 * count, no absolute corner badge), muted entries, plain summary rows, no `rounded-xl/2xl`.
 * Source and DOM contracts only; jsdom never proves rendered geometry.
 */
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import DebtPaymentModal from '../DebtPaymentModal.vue'

vi.mock('../../composables/useDebtPayment', () => ({
  useDebtPayment: () => ({
    submitSafe: vi.fn(),
    isSubmitting: ref(false),
    externalErrorCode: ref<string | null>(null),
    shouldClose: ref(false),
    resetError: vi.fn(),
    catalogClearSignal: ref(0),
  }),
}))

vi.mock('../../composables/useSalePaymentMethods', () => ({
  useSalePaymentMethods: () => ({ data: ref([]) }),
}))

vi.mock('@/features/POS/cash-register/composables/useCashSaleSession', () => ({
  useCashSaleSession: () => ({
    canReadSessions: computed(() => false),
    availableSessions: computed(() => []),
    selectedId: ref<string | null>(null),
    isSelectionEligible: computed(() => false),
    page: computed(() => 1),
    pageSize: computed(() => 25),
    total: computed(() => 0),
    pageCount: computed(() => 1),
    isFetching: computed(() => false),
    isError: computed(() => false),
    selectSession: vi.fn(),
    clearSelection: vi.fn(),
    isSelectionScopeCurrent: () => false,
    revalidateSelection: () => false,
    setPage: vi.fn(),
    refetch: vi.fn(),
  }),
}))

vi.mock('@/features/POS/cash-register/composables/useCashAccess', () => ({
  useCashAccess: () => ({ canOpenSession: computed(() => false) }),
}))
vi.mock('../../composables/useCashRegisterNames', () => ({
  useCashRegisterNames: () => computed(() => ({})),
}))

const source = readFileSync('src/features/POS/sales/components/DebtPaymentModal.vue', 'utf8')
const sheetCss = readFileSync('src/core/shared/components/payments/payment-sheet.css', 'utf8')

afterEach(() => {
  document.body.innerHTML = ''
})

function q<T extends Element = HTMLElement>(selector: string): T | null {
  return document.body.querySelector<T>(selector)
}

async function mountWithoutPortalClass() {
  mountWithUApp(DebtPaymentModal, {
    props: { open: true, saleId: 'sale-1', debtCents: 80000 },
    attachTo: document.body,
  })
  await flushPromises()
}

describe('DebtPaymentModal — shared payment sheet look (U2)', () => {
  it('has no rounded-xl / rounded-2xl and imports the shared payment sheet', () => {
    expect(source).not.toMatch(/rounded-(?:xl|2xl)\b/)
    expect(source).toContain("import '@/core/shared/components/payments/payment-sheet.css'")
  })

  it('renders the hf-pay pieces with no portal class on the content root', async () => {
    await mountWithoutPortalClass()

    const content = q('[data-slot="content"]')
    expect(content).not.toBeNull()
    expect(content!.className).not.toMatch(/sales-(?:detail-portal|pos-checkout)/)

    expect(q('.hf-pay-total .hf-pay-total-label')?.textContent).toContain('Deuda pendiente')
    expect(q('.hf-pay-total .hf-pay-total-value')).not.toBeNull()
    expect(q('.hf-pay-methods')).not.toBeNull()
    expect(q('.hf-pay-empty')?.textContent).toContain('Selecciona un método de pago arriba')
    expect(q('.hf-pay-summary .hf-pay-summary-row')).not.toBeNull()
    expect(document.body.innerHTML).not.toMatch(/rounded-(?:xl|2xl)\b/)
  })

  it('method tiles are one line (icon · label · count) with the selected state on aria-pressed', async () => {
    await mountWithoutPortalClass()

    const tile = q<HTMLButtonElement>('[data-testid="payment-method-tile-cash"]')!
    expect(tile.classList.contains('hf-pay-tile')).toBe(true)
    expect(tile.getAttribute('aria-pressed')).toBe('false')
    expect(tile.querySelector('.hf-pay-tile-icon')).not.toBeNull()
    expect(tile.querySelector('.hf-pay-tile-label')?.textContent).toBeTruthy()
    // No stacked tile: no corner badge, no tall icon, no feature-only state marker.
    expect(tile.className).not.toMatch(/\b(?:relative|py-4)\b/)
    expect(tile.querySelector('.absolute')).toBeNull()

    tile.click()
    await flushPromises()

    expect(tile.getAttribute('aria-pressed')).toBe('true')
    expect(tile.querySelector('.hf-pay-tile-count')?.textContent?.trim()).toBe('1')
    const entry = q('[data-testid="payment-entry-0"]')!
    expect(entry.classList.contains('hf-pay-entry')).toBe(true)
    expect(entry.closest('.hf-pay-entries')).not.toBeNull()
    expect(entry.querySelector('.hf-pay-entry-head .hf-pay-entry-label')).not.toBeNull()
  })

  it('summary is plain rows, not a bordered box', async () => {
    await mountWithoutPortalClass()

    const summary = q('.hf-pay-summary')!
    expect(summary.className).not.toMatch(/\b(?:border|bg-elevated|px-4|py-3)\b/)
    expect(summary.textContent).toContain('Recibido:')
    expect(summary.textContent).toContain('Restante:')
  })

  it('the shared sheet is marker-free and token-only', () => {
    const declarations = sheetCss.replace(/\/\*[\s\S]*?\*\//g, '')
    const selectors = declarations.match(/^[^{}@]+(?=\{)/gm) ?? []
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      // Split on top-level commas only (`:is(a, b)` keeps its own).
      for (const part of selector.split(/,(?![^(]*\))/)) expect(part.trim()).toMatch(/^\.hf-pay-/)
    }
    expect(declarations).not.toMatch(/border-radius:(?!\s*var\(--hf-radius-(?:card|control)\))/)
    expect(declarations).not.toContain('!important')
    expect(declarations).not.toContain(':root')
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(declarations).not.toMatch(/\brgba?\(/)
  })
})
