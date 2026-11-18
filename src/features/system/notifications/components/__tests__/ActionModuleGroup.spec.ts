// ActionModuleGroup.spec.ts — one registry module: a label column (icon,
// name, «Activar todas» only with ≥ 2 actions) beside its switch rows.

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import ActionModuleGroup from '../ActionModuleGroup.vue'
import { ACTION_REGISTRY } from '../../registry/action-registry'

const promotions = ACTION_REGISTRY.find((m) => m.moduleKey === 'promotions')!
const pos = ACTION_REGISTRY.find((m) => m.moduleKey === 'pos')!

function mountGroup(props: Record<string, unknown> = {}) {
  return mountWithUApp(ActionModuleGroup, {
    props: { module: promotions, modelValue: [], masterEnabled: true, ...props },
  })
}

const all = (wrapper: ReturnType<typeof mountGroup>) =>
  wrapper.find('[data-testid="module-all-promotions"]')

describe('ActionModuleGroup — structure', () => {
  it('is a group labelled by the module heading with one switch row per action', () => {
    const wrapper = mountGroup()
    const group = wrapper.get('[role="group"]')
    const heading = wrapper.get(`[id="${group.attributes('aria-labelledby')}"]`)
    expect(heading.element.tagName).toBe('H3')
    expect(heading.text()).toBe('Promociones')
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(promotions.actions.length)
  })

  it('has no «Activar todas» on a single-action module', () => {
    const wrapper = mountGroup({ module: pos })
    expect(wrapper.find('[aria-pressed]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Activar todas')
  })
})

describe('ActionModuleGroup — «Activar todas» (≥ 2 actions)', () => {
  it('is aria-pressed false / mixed / true with the count in its name', () => {
    expect(all(mountGroup()).attributes('aria-pressed')).toBe('false')
    const mixed = all(mountGroup({ modelValue: ['PROMOTION_EXPIRING'] }))
    expect(mixed.attributes('aria-pressed')).toBe('mixed')
    expect(mixed.attributes('aria-label')).toBe(
      'Todas las acciones de Promociones, 1 de 2 activadas',
    )
    expect(mixed.text()).toContain('Activar todas')
    const full = all(mountGroup({ modelValue: ['PROMOTION_EXPIRING', 'PROMOTION_NEAR_CAPACITY'] }))
    expect(full.attributes('aria-pressed')).toBe('true')
    expect(full.text()).toContain('Desactivar todas')
  })

  it('turns every module action on from mixed, keeping other modules', async () => {
    const wrapper = mountGroup({ modelValue: ['LOW_STOCK', 'PROMOTION_EXPIRING'] })
    await all(wrapper).trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      ['LOW_STOCK', 'PROMOTION_EXPIRING', 'PROMOTION_NEAR_CAPACITY'],
    ])
  })

  it('turns every module action off when all are on', async () => {
    const wrapper = mountGroup({
      modelValue: ['PROMOTION_EXPIRING', 'LOW_STOCK', 'PROMOTION_NEAR_CAPACITY'],
    })
    await all(wrapper).trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['LOW_STOCK']])
  })

  it('is aria-disabled and silent while the master is off', async () => {
    const wrapper = mountGroup({ masterEnabled: false })
    expect(all(wrapper).attributes('aria-disabled')).toBe('true')
    await all(wrapper).trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('forwards a single row toggle', async () => {
    const wrapper = mountGroup({ modelValue: [] })
    await wrapper.get('[data-testid="action-row-promotion-near-capacity"] [role="switch"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['PROMOTION_NEAR_CAPACITY']])
  })
})
