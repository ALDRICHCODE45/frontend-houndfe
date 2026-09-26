import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ResolvedHumanDecisionCard from '../ResolvedHumanDecisionCard.vue'
import type { ResolvedHumanDecision } from '../../interfaces/human-decision.types'
import { createdAtPresentationLabel } from '../../utils/humanDecisionPresentation'

const decision: ResolvedHumanDecision = {
  id: 'r1',
  type: 'RESTOCK',
  status: 'RESOLVED',
  version: 2,
  allowedActions: [],
  title: 'Reposición solicitada',
  sanitizedSummary: 'Alimento premium',
  createdAt: '2026-04-01T12:00:00Z',
  snapshot: {
    branchId: 'b1',
    branchName: 'Centro',
    productId: 'p1',
    productName: 'Alimento',
    variantId: null,
    sku: 'SKU-1',
    requestedQuantity: 2,
    observedStockAtRequest: null,
    stockObservedAt: null,
  },
  resolution: {
    action: 'PROVIDE_RESTOCK_ESTIMATE',
    restockDays: 5,
    resolvedAt: '2026-05-01T16:00:00Z',
    resolvedBy: { id: 'u1', displayName: 'Ana' },
  },
}

describe('ResolvedHumanDecisionCard', () => {
  it.each([true, false])(
    'shows the actual response and provenance (positive=%s) with only detail access',
    async (positive) => {
      const row: ResolvedHumanDecision = {
        ...decision,
        resolution: positive
          ? decision.resolution
          : {
              action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
              resolvedAt: decision.resolution.resolvedAt,
              resolvedBy: decision.resolution.resolvedBy,
            },
      }
      const wrapper = mount(ResolvedHumanDecisionCard, {
        props: { decision: row },
        global: { stubs: { UButton: { template: '<button><slot /></button>' } } },
      })
      expect(wrapper.text()).toContain(
        positive
          ? 'Reposición estimada en 5 días naturales.'
          : 'Por ahora no tenemos una fecha estimada de reposición.',
      )
      expect(wrapper.get('[data-testid="human-decision-status"]').text()).toBe('Respondida')
      expect(wrapper.text()).toContain('Ana')
      expect(wrapper.text()).toContain('Centro')
      expect(wrapper.text()).toContain('SKU-1')
      expect(wrapper.get('time').attributes('datetime')).toBe(row.resolution.resolvedAt)
      expect(wrapper.get('time').text()).toBe(createdAtPresentationLabel(row.resolution.resolvedAt))
      expect(wrapper.findAll('button')).toHaveLength(1)
      expect(wrapper.get('button').classes()).toContain('min-h-11')
      expect(wrapper.find('input').exists()).toBe(false)
      await wrapper.get('button').trigger('click')
      expect(wrapper.emitted('openDetail')).toEqual([['r1']])
      expect(wrapper.emitted('resolve')).toBeUndefined()
      if (!positive) expect(wrapper.text()).not.toContain('días naturales')
    },
  )
})
