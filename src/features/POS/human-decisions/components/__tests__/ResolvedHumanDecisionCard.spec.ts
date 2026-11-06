import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ResolvedHumanDecisionCard from '../ResolvedHumanDecisionCard.vue'
import type { ResolvedHumanDecision } from '../../interfaces/human-decision.types'
import { listDatePresentationLabel } from '../../utils/humanDecisionPresentation'

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
      const wrapper = mount(ResolvedHumanDecisionCard, { props: { decision: row } })
      expect(wrapper.text()).toContain(
        positive
          ? 'Reposición estimada en 5 días naturales.'
          : 'Por ahora no tenemos una fecha estimada de reposición.',
      )
      const badge = wrapper.get('[data-testid="human-decision-status"]')
      expect(badge.text()).toBe('Respondida')
      expect(badge.attributes('data-tone')).toBe('success')
      expect(wrapper.text()).toContain('Ana')
      // Every row belongs to the current branch, so the card does not repeat it.
      expect(wrapper.text()).not.toContain('Centro')
      expect(wrapper.text()).toContain('SKU-1')
      expect(wrapper.get('.hf-row-primary').text()).toBe('Alimento')
      expect(wrapper.get('.hf-row-secondary').text()).toContain('Reposición solicitada')
      expect(badge.classes()).toContain('self-start')
      expect(wrapper.text()).not.toContain('r1')
      expect(wrapper.get('time').attributes('datetime')).toBe(row.resolution.resolvedAt)
      expect(wrapper.get('time').text()).toBe(listDatePresentationLabel(row.resolution.resolvedAt))
      // The name button is the only control: a ⋮ holding just "Ver respuesta" would repeat the card click.
      expect(wrapper.findAll('button')).toHaveLength(1)
      const open = wrapper.get('[data-testid="resolved-human-decision-open-detail"]')
      expect(open.classes()).toContain('hf-row-primary')
      expect(wrapper.find('button[aria-haspopup="menu"]').exists()).toBe(false)
      expect(wrapper.find('input').exists()).toBe(false)
      await open.trigger('click')
      expect(wrapper.emitted('openDetail')).toEqual([['r1']])
      expect(wrapper.emitted('resolve')).toBeUndefined()
      if (!positive) expect(wrapper.text()).not.toContain('días naturales')
    },
  )
})
