import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import QuotationProgressStepper from '../QuotationProgressStepper.vue'
import type { QuotationStatus } from '../../interfaces/quotation.types'

const STATUSES: QuotationStatus[] = ['DRAFT', 'SENT', 'EXPIRED', 'CANCELLED']

const STEP_LABELS = ['BORRADOR', 'ENVIADA', 'EXPIRADA/CANCELADA']

function mountStepper(status: QuotationStatus) {
  return mount(QuotationProgressStepper, {
    props: { status },
  })
}

beforeEach(() => {
  // Pure presentational component — no mocks required.
})

// T-UI-09 / T-UI-10 — REQ-UI-003 progress stepper (3-state).
// The component receives `status: QuotationStatus` and renders exactly 3
// horizontal nodes with connector lines, applying active/completed/future
// styling per the spec. The status→step index mapping lives in
// `quotation.utils.ts` so this component owns only the visual logic.

describe('QuotationProgressStepper — root contract', () => {
  it.each(STATUSES)('renders the root container with testid "quotation-stepper" for %s', (status) => {
    const wrapper = mountStepper(status)
    const root = wrapper.find('[data-testid="quotation-stepper"]')
    expect(root.exists()).toBe(true)
  })

  it.each(STATUSES)('renders exactly 3 step nodes for %s', (status) => {
    const wrapper = mountStepper(status)
    const steps = wrapper.findAll('[data-testid^="stepper-step-"]')
    expect(steps).toHaveLength(3)
  })

  it.each(STATUSES)('renders the 3 step labels (BORRADOR, ENVIADA, EXPIRADA/CANCELADA) for %s', (status) => {
    const wrapper = mountStepper(status)
    const text = wrapper.text()
    for (const label of STEP_LABELS) {
      expect(text).toContain(label)
    }
  })
})

describe('QuotationProgressStepper — active step styling', () => {
  it('marks step 0 as active when status is DRAFT', () => {
    const wrapper = mountStepper('DRAFT')
    expect(wrapper.get('[data-testid="stepper-step-0"]').attributes('data-state')).toBe('active')
    expect(wrapper.get('[data-testid="stepper-step-1"]').attributes('data-state')).toBe('future')
    expect(wrapper.get('[data-testid="stepper-step-2"]').attributes('data-state')).toBe('future')
  })

  it('marks step 1 as active when status is SENT (steps 0 = completed, 2 = future)', () => {
    const wrapper = mountStepper('SENT')
    expect(wrapper.get('[data-testid="stepper-step-0"]').attributes('data-state')).toBe('completed')
    expect(wrapper.get('[data-testid="stepper-step-1"]').attributes('data-state')).toBe('active')
    expect(wrapper.get('[data-testid="stepper-step-2"]').attributes('data-state')).toBe('future')
  })

  it('marks step 2 as active when status is EXPIRED', () => {
    const wrapper = mountStepper('EXPIRED')
    expect(wrapper.get('[data-testid="stepper-step-0"]').attributes('data-state')).toBe('completed')
    expect(wrapper.get('[data-testid="stepper-step-1"]').attributes('data-state')).toBe('completed')
    expect(wrapper.get('[data-testid="stepper-step-2"]').attributes('data-state')).toBe('active')
  })

  it('marks step 2 as active when status is CANCELLED (terminal step shared with EXPIRED)', () => {
    const wrapper = mountStepper('CANCELLED')
    expect(wrapper.get('[data-testid="stepper-step-0"]').attributes('data-state')).toBe('completed')
    expect(wrapper.get('[data-testid="stepper-step-1"]').attributes('data-state')).toBe('completed')
    expect(wrapper.get('[data-testid="stepper-step-2"]').attributes('data-state')).toBe('active')
  })
})

describe('QuotationProgressStepper — connector lines', () => {
  it('renders 2 connector lines (one between each pair of nodes)', () => {
    const wrapper = mountStepper('DRAFT')
    const connectors = wrapper.findAll('[data-testid^="stepper-connector-"]')
    expect(connectors).toHaveLength(2)
  })

  it('marks connectors BEFORE the active step as completed (accent color)', () => {
    const wrapper = mountStepper('SENT')
    // step 0 → step 1 is completed (active is step 1, so the 0→1 connector is accent)
    expect(wrapper.get('[data-testid="stepper-connector-0"]').attributes('data-state')).toBe('completed')
    // step 1 → step 2 is future (active is step 1, so the 1→2 connector is neutral)
    expect(wrapper.get('[data-testid="stepper-connector-1"]').attributes('data-state')).toBe('future')
  })

  it('marks both connectors as completed when status is EXPIRED (terminal)', () => {
    const wrapper = mountStepper('EXPIRED')
    expect(wrapper.get('[data-testid="stepper-connector-0"]').attributes('data-state')).toBe('completed')
    expect(wrapper.get('[data-testid="stepper-connector-1"]').attributes('data-state')).toBe('completed')
  })

  it('marks both connectors as future when status is DRAFT (start)', () => {
    const wrapper = mountStepper('DRAFT')
    expect(wrapper.get('[data-testid="stepper-connector-0"]').attributes('data-state')).toBe('future')
    expect(wrapper.get('[data-testid="stepper-connector-1"]').attributes('data-state')).toBe('future')
  })
})

describe('QuotationProgressStepper — visual states via data attributes', () => {
  it('exposes a data-state on every step node so CSS can react without class enumeration', () => {
    const wrapper = mountStepper('CANCELLED')
    for (let i = 0; i < 3; i++) {
      const step = wrapper.get(`[data-testid="stepper-step-${i}"]`)
      const state = step.attributes('data-state')
      expect(state).toMatch(/^(active|completed|future)$/)
    }
  })

  it('keeps the stepper reactive — updating the status prop re-evaluates active/completed/future', async () => {
    const wrapper = mountStepper('DRAFT')
    expect(wrapper.get('[data-testid="stepper-step-0"]').attributes('data-state')).toBe('active')

    await wrapper.setProps({ status: 'SENT' })
    expect(wrapper.get('[data-testid="stepper-step-0"]').attributes('data-state')).toBe('completed')
    expect(wrapper.get('[data-testid="stepper-step-1"]').attributes('data-state')).toBe('active')

    await wrapper.setProps({ status: 'CANCELLED' })
    expect(wrapper.get('[data-testid="stepper-step-2"]').attributes('data-state')).toBe('active')
  })
})
