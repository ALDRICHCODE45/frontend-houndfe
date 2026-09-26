/** HD3B1 — pure labels, the mobile card contract, and desktop column metadata. */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HumanDecisionCard from '../HumanDecisionCard.vue'
import { useHumanDecisionColumns } from '../../composables/useHumanDecisionColumns'
import {
  BRANCH_FALLBACK,
  CREATED_AT_FALLBACK,
  QUANTITY_FALLBACK,
  SKU_FALLBACK,
  VARIANT_ABSENT_LABEL,
  VARIANT_PRESENT_LABEL,
  branchPresentationLabel,
  createdAtPresentationLabel,
  requestedQuantityPresentationLabel,
  skuPresentationLabel,
  variantPresentationLabel,
} from '../../utils/humanDecisionPresentation'
import type { PendingHumanDecision } from '../../interfaces/human-decision.types'

const UButtonStub = { template: '<button type="button"><slot /></button>' }

function makePending(overrides: Partial<PendingHumanDecision> = {}): PendingHumanDecision {
  return {
    id: 'hd-1',
    type: 'RESTOCK',
    title: 'Reposición solicitada',
    sanitizedSummary: 'Kibble 15kg',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'PENDING',
    version: 1,
    resolution: null,
    allowedActions: [],
    snapshot: {
      branchId: 'branch-1',
      branchName: 'Sucursal Centro',
      productId: 'product-1',
      productName: 'Kibble 15kg',
      variantId: 'variant-1',
      sku: 'KIB-15',
      requestedQuantity: 2,
      observedStockAtRequest: 0,
      stockObservedAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  }
}

function mountCard(decision: PendingHumanDecision) {
  return mount(HumanDecisionCard, {
    props: { decision },
    global: { stubs: { UButton: UButtonStub } },
  })
}

type Columns = ReturnType<typeof useHumanDecisionColumns>['columns']

function cell(columns: Columns, id: string, row: PendingHumanDecision) {
  const column = columns.find((c) => c.id === id) as
    | { accessorFn?: (r: PendingHumanDecision) => unknown }
    | undefined
  return column?.accessorFn?.(row)
}

describe('HD3B1 · presentation labels', () => {
  it('falls back for a missing branch and trims a present one', () => {
    expect(branchPresentationLabel(null)).toBe(BRANCH_FALLBACK)
    expect(branchPresentationLabel('   ')).toBe(BRANCH_FALLBACK)
    expect(branchPresentationLabel('  Sucursal Norte ')).toBe('Sucursal Norte')
  })
  it('falls back for a missing SKU', () => {
    expect(skuPresentationLabel(null)).toBe(SKU_FALLBACK)
    expect(skuPresentationLabel('  ')).toBe(SKU_FALLBACK)
    expect(skuPresentationLabel(' KIB-15 ')).toBe('KIB-15')
  })
  it('labels variant presence from the snapshot id', () => {
    expect(variantPresentationLabel(null)).toBe(VARIANT_ABSENT_LABEL)
    expect(variantPresentationLabel('variant-1')).toBe(VARIANT_PRESENT_LABEL)
  })
  it('copies requested quantity with singular/plural and fallback', () => {
    expect(requestedQuantityPresentationLabel(0)).toBe('0 unidades')
    expect(requestedQuantityPresentationLabel(1)).toBe('1 unidad')
    expect(requestedQuantityPresentationLabel(3)).toBe('3 unidades')
    expect(requestedQuantityPresentationLabel(null)).toBe(QUANTITY_FALLBACK)
  })
  it('renders createdAt deterministically in America/Mexico_City', () => {
    // 2026-01-01T00:00Z is 2025-12-31 18:00 in Mexico City (UTC-6).
    expect(createdAtPresentationLabel('2026-01-01T00:00:00.000Z')).toBe('31/12/2025, 18:00')
    expect(createdAtPresentationLabel('not-a-date')).toBe(CREATED_AT_FALLBACK)
  })
})

describe('HD3B1 · HumanDecisionCard', () => {
  it('renders title, product, branch, quantity and created time', () => {
    const wrapper = mountCard(makePending())
    expect(wrapper.find('[data-testid="human-decision-card"]').exists()).toBe(true)
    const text = wrapper.text()
    expect(wrapper.get('[data-testid="human-decision-status"]').text()).toBe('Pendiente')
    expect(text).toContain('Reposición solicitada')
    expect(text).toContain('Kibble 15kg')
    expect(text).toContain('Sucursal Centro')
    expect(text).toContain('2 unidades')
    expect(text).toContain('31/12/2025, 18:00')
  })
  it('renders HTML-bearing fields as literal text, never v-html', () => {
    const wrapper = mountCard(
      makePending({ title: '<b>t</b>', sanitizedSummary: '<img src=x onerror=alert(1)>' }),
    )
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<b>t</b>')
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  })
  it('exposes one accessible 44px-min open-detail button that emits the id', async () => {
    const wrapper = mountCard(makePending({ id: 'hd-42' }))
    const buttons = wrapper.findAll('[data-testid="human-decision-open-detail"]')
    expect(buttons).toHaveLength(1)
    const button = buttons[0]!
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.classes()).toContain('min-h-11')
    expect(button.attributes('aria-label')).toBeTruthy()
    await button.trigger('click')
    expect(wrapper.emitted('openDetail')).toEqual([['hd-42']])
  })
})

describe('HD3B1 · useHumanDecisionColumns', () => {
  it('exposes product, branch, requestedQuantity, createdAt and actions ids', () => {
    const { columns } = useHumanDecisionColumns()
    expect(columns.map((c) => c.id)).toEqual([
      'product',
      'status',
      'branch',
      'requestedQuantity',
      'createdAt',
      'response',
      'actions',
    ])
  })
  it('disables sorting on every column because the server owns ordering', () => {
    const { columns } = useHumanDecisionColumns()
    for (const column of columns) expect(column.enableSorting).toBe(false)
  })
  it('resolves cell values from the decision snapshot', () => {
    const { columns } = useHumanDecisionColumns()
    const row = makePending()
    expect(cell(columns, 'product', row)).toBe('Kibble 15kg')
    expect(cell(columns, 'branch', row)).toBe('Sucursal Centro')
    expect(cell(columns, 'requestedQuantity', row)).toBe('2 unidades')
    expect(cell(columns, 'createdAt', row)).toBe('2026-01-01T00:00:00.000Z')
  })
  it('keeps the actions column visible', () => {
    const { columns } = useHumanDecisionColumns()
    expect(columns.find((c) => c.id === 'actions')?.enableHiding).toBe(false)
  })
})
