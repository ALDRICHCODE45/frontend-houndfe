// ActionsAccordion.spec.ts — STRICT-TDD tests for the module-grouped
// action accordion.
//
// UAccordion has NO in-repo precedent. This spec doubles as the FIRST
// contact contract — the smoke render test must pass even before any of
// the toggle / disable behavior is implemented.
//
// Note on querying: Nuxt UI's USwitch is not registered with the name
// "USwitch" in the test wrapper, so we query the *wrapper divs* rendered
// by ActionRow.vue via `[data-testid^="action-row-"]`. The switch's
// `disabled` and `checked` states are exposed as data attributes on those
// wrappers so tests can assert without binding to USwitch internals.

import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import ActionsAccordion from '../ActionsAccordion.vue'
import { ACTION_REGISTRY } from '../../registry/action-registry'

function mountAccordion(props: Record<string, unknown> = {}) {
  return mountWithUApp(ActionsAccordion, {
    props: {
      modelValue: [],
      masterEnabled: true,
      ...props,
    },
  })
}

/** Find the action row wrapper for a specific action key. */
function findActionRow(wrapper: ReturnType<typeof mountAccordion>, key: string) {
  const slug = key.toLowerCase().replace(/_/g, '-')
  return wrapper.find(`[data-testid="action-row-${slug}"]`)
}

describe('ActionsAccordion — smoke render (first UAccordion contact)', () => {
  beforeEach(() => {
    // Sanity: registry has at least one module + one action so the smoke
    // assertion is meaningful. (No expects here — kept as a no-op so the
    // block is purely a setup hook.)
    void ACTION_REGISTRY
  })

  it('registry has at least one module + one action (precondition for smoke)', () => {
    expect(ACTION_REGISTRY.length).toBeGreaterThan(0)
    expect(ACTION_REGISTRY[0]!.actions.length).toBeGreaterThan(0)
  })

  it('renders a module item for every entry in ACTION_REGISTRY', () => {
    const wrapper = mountAccordion()
    for (const module of ACTION_REGISTRY) {
      expect(wrapper.text()).toContain(module.moduleLabel)
    }
  })

  it('renders an action row for every action in every module', () => {
    const wrapper = mountAccordion()
    for (const module of ACTION_REGISTRY) {
      for (const action of module.actions) {
        const row = findActionRow(wrapper, action.key)
        expect(row.exists()).toBe(true)
        expect(row.text()).toContain(action.label)
      }
    }
  })

  it('renders the per-module count "0/1" when no actions are enabled', () => {
    const wrapper = mountAccordion({ modelValue: [] })
    expect(wrapper.text()).toContain('0/1')
  })
})

describe('ActionsAccordion — masterEnabled OFF greys action rows', () => {
  it('marks every action row as disabled when masterEnabled=false', () => {
    const wrapper = mountAccordion({ masterEnabled: false, modelValue: [] })
    for (const module of ACTION_REGISTRY) {
      for (const action of module.actions) {
        const row = findActionRow(wrapper, action.key)
        expect(row.attributes('data-disabled')).toBe('true')
      }
    }
  })

  it('marks every action row as enabled when masterEnabled=true', () => {
    const wrapper = mountAccordion({ masterEnabled: true, modelValue: [] })
    for (const module of ACTION_REGISTRY) {
      for (const action of module.actions) {
        const row = findActionRow(wrapper, action.key)
        expect(row.attributes('data-disabled')).toBe('false')
      }
    }
  })
})

describe('ActionsAccordion — toggle wiring', () => {
  it('reflects modelValue membership in the row checked state', () => {
    const wrapper = mountAccordion({ modelValue: ['LOW_STOCK'] })
    const row = findActionRow(wrapper, 'LOW_STOCK')
    expect(row.exists()).toBe(true)
    expect(row.attributes('data-checked')).toBe('true')
  })

  it('reflects unchecked state for rows not in modelValue', () => {
    const wrapper = mountAccordion({ modelValue: [] })
    const row = findActionRow(wrapper, 'LOW_STOCK')
    expect(row.attributes('data-checked')).toBe('false')
  })

  it('emits @update:modelValue with the toggled key when a row is flipped ON', async () => {
    const wrapper = mountAccordion({ modelValue: [] })
    const row = findActionRow(wrapper, 'LOW_STOCK')

    // Find the inner USwitch button (role=switch, data-state).
    const innerButton = row.find('button[role="switch"]')
    expect(innerButton.exists()).toBe(true)
    await innerButton.trigger('click')
    await nextTick()

    const events = wrapper.emitted('update:modelValue')
    expect(events).toBeTruthy()
    expect(events![events!.length - 1]).toEqual([['LOW_STOCK']])
  })

  it('emits @update:modelValue without the toggled key when a row is flipped OFF', async () => {
    const wrapper = mountAccordion({ modelValue: ['LOW_STOCK'] })
    const row = findActionRow(wrapper, 'LOW_STOCK')

    const innerButton = row.find('button[role="switch"]')
    await innerButton.trigger('click')
    await nextTick()

    const events = wrapper.emitted('update:modelValue')
    expect(events![events!.length - 1]).toEqual([[]])
  })

  it('updates the per-module count when modelValue changes', async () => {
    const empty = mountAccordion({ modelValue: [] })
    expect(empty.text()).toContain('0/1')

    const enabled = mountAccordion({ modelValue: ['LOW_STOCK'] })
    await nextTick()
    expect(enabled.text()).toContain('1/1')
  })

  it('does not mutate the parent modelValue array directly (parent owns reactivity)', async () => {
    const initial = ['LOW_STOCK']
    const wrapper = mountAccordion({ modelValue: initial })
    const row = findActionRow(wrapper, 'LOW_STOCK')
    const innerButton = row.find('button[role="switch"]')

    await innerButton.trigger('click')
    await nextTick()

    // Parent array stays untouched — only the emitted event carries the new value.
    expect(initial).toEqual(['LOW_STOCK'])
  })
})