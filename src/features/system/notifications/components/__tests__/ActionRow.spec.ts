// ActionRow.spec.ts — STRICT-TDD tests for the single-action card row.
//
// These tests cover the NEW surface introduced with the card layout
// (description rendering) AND re-prove the existing structural contract
// that the ActionsAccordion spec also relies on:
//
//   - `data-testid="action-row-<slug>"` wrapper
//   - `data-checked` / `data-disabled` reflect state
//   - USwitch click emits @toggle with the toggled key
//
// The description element is queried via a stable `data-testid` (not by
// classes) so the assertions survive any future class refactor.

import { describe, it, expect } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import ActionRow from '../ActionRow.vue'
import type { ActionDescriptor } from '../../interfaces/notification-config.types'

const withDescription: ActionDescriptor = {
  key: 'LOW_STOCK',
  label: 'Bajo inventario',
  description:
    'Envía un correo cuando un producto cae por debajo de su inventario mínimo.',
}

const withoutDescription: ActionDescriptor = {
  key: 'LOW_STOCK',
  label: 'Bajo inventario',
}

describe('ActionRow — description rendering', () => {
  it('renders the description text when descriptor.description is present', () => {
    const wrapper = mountWithUApp(ActionRow, {
      props: { action: withDescription, modelValue: [] },
    })
    const desc = wrapper.find('[data-testid="action-description"]')
    expect(desc.exists()).toBe(true)
    expect(desc.text()).toBe(withDescription.description)
  })

  it('does NOT render the description element when descriptor.description is absent', () => {
    const wrapper = mountWithUApp(ActionRow, {
      props: { action: withoutDescription, modelValue: [] },
    })
    expect(wrapper.find('[data-testid="action-description"]').exists()).toBe(false)
  })

  it('still renders the action label whether or not a description is present', () => {
    const withDesc = mountWithUApp(ActionRow, {
      props: { action: withDescription, modelValue: [] },
    })
    const withoutDesc = mountWithUApp(ActionRow, {
      props: { action: withoutDescription, modelValue: [] },
    })
    expect(withDesc.text()).toContain('Bajo inventario')
    expect(withoutDesc.text()).toContain('Bajo inventario')
  })
})

describe('ActionRow — accessible name wiring', () => {
  it('exposes a stable id on the label element and points the switch at it via aria-labelledby', () => {
    const wrapper = mountWithUApp(ActionRow, {
      props: { action: withDescription, modelValue: [] },
    })
    const label = wrapper.find('[id="action-label-low-stock"]')
    expect(label.exists()).toBe(true)
    expect(label.text()).toBe('Bajo inventario')

    const switchBtn = wrapper.find('button[role="switch"]')
    expect(switchBtn.attributes('aria-labelledby')).toBe('action-label-low-stock')
  })

  it('also associates the description via aria-describedby when one is present', () => {
    const wrapper = mountWithUApp(ActionRow, {
      props: { action: withDescription, modelValue: [] },
    })
    const desc = wrapper.find('[data-testid="action-description"]')
    expect(desc.attributes('id')).toBe('action-description-low-stock')

    const switchBtn = wrapper.find('button[role="switch"]')
    expect(switchBtn.attributes('aria-describedby')).toBe('action-description-low-stock')
  })

  it('does NOT add aria-describedby when the action has no description', () => {
    const wrapper = mountWithUApp(ActionRow, {
      props: { action: withoutDescription, modelValue: [] },
    })
    const switchBtn = wrapper.find('button[role="switch"]')
    expect(switchBtn.attributes('aria-labelledby')).toBe('action-label-low-stock')
    expect(switchBtn.attributes('aria-describedby')).toBeUndefined()
  })
})

describe('ActionRow — structural contract preserved after redesign', () => {
  it('keeps the action-row-<slug> data-testid on the wrapper', () => {
    const wrapper = mountWithUApp(ActionRow, {
      props: { action: withDescription, modelValue: [] },
    })
    expect(wrapper.find('[data-testid="action-row-low-stock"]').exists()).toBe(true)
  })

  it('reflects modelValue membership via data-checked', () => {
    const on = mountWithUApp(ActionRow, {
      props: { action: withDescription, modelValue: ['LOW_STOCK'] },
    })
    expect(on.find('[data-testid="action-row-low-stock"]').attributes('data-checked')).toBe('true')

    const off = mountWithUApp(ActionRow, {
      props: { action: withDescription, modelValue: [] },
    })
    expect(off.find('[data-testid="action-row-low-stock"]').attributes('data-checked')).toBe('false')
  })

  it('reflects the disabled prop via data-disabled', () => {
    const wrapper = mountWithUApp(ActionRow, {
      props: { action: withDescription, modelValue: [], disabled: true },
    })
    expect(wrapper.find('[data-testid="action-row-low-stock"]').attributes('data-disabled')).toBe('true')
  })

  it('emits @toggle with the toggled key when USwitch is clicked', async () => {
    const wrapper = mountWithUApp(ActionRow, {
      props: { action: withDescription, modelValue: [] },
    })
    const switchBtn = wrapper.find('button[role="switch"]')
    expect(switchBtn.exists()).toBe(true)
    await switchBtn.trigger('click')
    const events = wrapper.emitted('toggle')
    expect(events).toBeTruthy()
    expect(events![0]).toEqual([['LOW_STOCK']])
  })
})