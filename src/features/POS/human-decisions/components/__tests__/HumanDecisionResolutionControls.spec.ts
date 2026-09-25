import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HumanDecisionResolutionControls from '../HumanDecisionResolutionControls.vue'
import type { PendingHumanDecision } from '../../interfaces/human-decision.types'

const UButtonStub = {
  props: ['disabled', 'loading'],
  template: '<button type="button" :disabled="disabled || loading"><slot /></button>',
}
const UInputStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `
    <input
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  `,
}
const ConfirmModalStub = {
  props: ['open', 'title', 'description', 'loading'],
  emits: ['confirm', 'update:open'],
  template: `
    <div v-if="open" role="dialog">
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
      <button data-testid="close-confirmation" @click="$emit('update:open', false)">Cerrar</button>
      <button data-testid="confirm-resolution" :disabled="loading" @click="$emit('confirm')">
        Confirmar
      </button>
    </div>
  `,
}

function pending(allowed = true): PendingHumanDecision {
  return {
    id: 'decision-1',
    type: 'RESTOCK',
    title: 'Solicitud de reposición',
    sanitizedSummary: 'Se solicitó una estimación.',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'PENDING',
    version: 1,
    resolution: null,
    allowedActions: allowed
      ? ['PROVIDE_RESTOCK_ESTIMATE', 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE']
      : [],
    snapshot: {
      branchId: 'branch-1',
      branchName: 'Centro',
      productId: 'product-1',
      productName: 'Alimento',
      variantId: null,
      sku: null,
      requestedQuantity: 2,
      observedStockAtRequest: null,
      stockObservedAt: null,
    },
  }
}

function mountControls(
  props: Partial<{
    decision: PendingHumanDecision
    canUpdate: boolean
    resolving: boolean
    conflict: boolean
  }> = {},
) {
  return mount(HumanDecisionResolutionControls, {
    props: {
      decision: pending(),
      canUpdate: true,
      resolving: false,
      conflict: false,
      ...props,
    },
    global: {
      stubs: { UButton: UButtonStub, UInput: UInputStub, ConfirmModal: ConfirmModalStub },
    },
  })
}

describe('HumanDecisionResolutionControls', () => {
  it('requires both update permission and server allowed actions', () => {
    const readOnly = mountControls({ canUpdate: false })
    expect(readOnly.text()).toContain('Solo lectura')
    expect(readOnly.find('[data-testid="provide-restock-estimate"]').exists()).toBe(false)
    expect(readOnly.find('[data-testid="report-estimate-unavailable"]').exists()).toBe(false)

    const disallowed = mountControls({ decision: pending(false) })
    expect(disallowed.text()).toContain('No hay acciones disponibles')
    expect(disallowed.find('[data-testid="provide-restock-estimate"]').exists()).toBe(false)
  })

  it.each(['0', '1.5', '366', 'texto'])(
    'rejects invalid restockDays %s before confirmation',
    async (value) => {
      const wrapper = mountControls()
      await wrapper.get('[data-testid="restock-days-input"]').setValue(value)
      await wrapper.get('[data-testid="provide-restock-estimate"]').trigger('click')
      expect(wrapper.get('[role="alert"]').text()).toContain(
        'Ingresa un número entero entre 1 y 365',
      )
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      expect(wrapper.emitted('resolve')).toBeUndefined()
    },
  )

  it('confirms a positive natural-day estimate and emits the CAS input', async () => {
    const wrapper = mountControls()
    await wrapper.get('[data-testid="restock-days-input"]').setValue('12')
    await wrapper.get('[data-testid="provide-restock-estimate"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      'Registrar una estimación de 12 días naturales.',
    )
    await wrapper.get('[data-testid="confirm-resolution"]').trigger('click')
    expect(wrapper.emitted('resolve')).toEqual([
      [{ action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 12, expectedVersion: 1 }],
    ])
    expect(wrapper.emitted('resolve')![0]![0]).not.toHaveProperty('resolutionRequestId')
  })

  it('confirms temporary unavailability with exact honest copy and no days field', async () => {
    const wrapper = mountControls()
    await wrapper.get('[data-testid="report-estimate-unavailable"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      'Por ahora no tenemos una fecha estimada de reposición.',
    )
    await wrapper.get('[data-testid="confirm-resolution"]').trigger('click')
    expect(wrapper.emitted('resolve')).toEqual([
      [{ action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE', expectedVersion: 1 }],
    ])
    expect(wrapper.emitted('resolve')![0]![0]).not.toHaveProperty('restockDays')
  })

  it('becomes read-only after a conflict and disables confirmation while resolving', async () => {
    const conflicted = mountControls({ conflict: true })
    expect(conflicted.get('[role="alert"]').text()).toContain('ya fue atendida')
    expect(conflicted.find('[data-testid="provide-restock-estimate"]').exists()).toBe(false)

    const resolving = mountControls()
    await resolving.get('[data-testid="report-estimate-unavailable"]').trigger('click')
    await resolving.setProps({ resolving: true })
    expect(resolving.get('[data-testid="confirm-resolution"]').attributes('disabled')).toBeDefined()
    await resolving.get('[data-testid="close-confirmation"]').trigger('click')
    expect(resolving.find('[role="dialog"]').exists()).toBe(true)
    await resolving.setProps({ resolving: false, conflict: true })
    await resolving.get('[data-testid="confirm-resolution"]').trigger('click')
    expect(resolving.emitted('resolve')).toBeUndefined()
  })
})
