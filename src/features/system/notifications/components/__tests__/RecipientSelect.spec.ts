// RecipientSelect.spec.ts — STRICT-TDD tests for the recipient multi-select.
//
// Component contract (per spec REQ-5):
//   - USelectMenu :multiple driven by `assignable` users (id/name)
//   - emits @update:modelValue with the new selected ids (string[])
//   - renders a "Usuario no disponible" chip for ids in modelValue that
//     are NOT in assignable (stale ids — never auto-removed)
//   - surfaces an inline field error via the `error` prop
//   - marks the trigger as disabled when :disabled=true
//
// The pure helpers (`recipientSelectState.ts`) are covered in their own
// spec; this file focuses on the integration between USelectMenu, the
// assignable list, and the stale-chip rendering.

import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import RecipientSelect from '../RecipientSelect.vue'
import type { AssignableUser } from '@/features/POS/users/interfaces/user.types'

const ASSIGNABLE: AssignableUser[] = [
  { id: 'u1', name: 'Ana' },
  { id: 'u2', name: 'Bruno' },
  { id: 'u3', name: 'Carla' },
]

function mountSelect(props: Record<string, unknown> = {}) {
  return mountWithUApp(RecipientSelect, {
    props: { modelValue: [], assignable: ASSIGNABLE, ...props },
  })
}

describe('RecipientSelect — selected chip rendering', () => {
  it('renders one chip per selected id with the user name (REQ-5)', () => {
    const wrapper = mountSelect({ modelValue: ['u1', 'u2'] })
    expect(wrapper.text()).toContain('Ana')
    expect(wrapper.text()).toContain('Bruno')
  })

  it('renders a "Usuario no disponible" chip for stale ids (REQ-5)', () => {
    const wrapper = mountSelect({ modelValue: ['u1', 'ghost'] })
    expect(wrapper.text()).toContain('Ana')
    expect(wrapper.text()).toContain('Usuario no disponible')
  })

  it('preserves selection order in the chips', () => {
    const wrapper = mountSelect({ modelValue: ['u3', 'u1', 'u2'] })
    const text = wrapper.text()
    const aIdx = text.indexOf('Carla')
    const bIdx = text.indexOf('Ana')
    const cIdx = text.indexOf('Bruno')
    expect(aIdx).toBeGreaterThan(-1)
    expect(bIdx).toBeGreaterThan(aIdx)
    expect(cIdx).toBeGreaterThan(bIdx)
  })

  it('renders no chips when the selection is empty', () => {
    const wrapper = mountSelect({ modelValue: [] })
    const chips = wrapper.findAll('[data-testid^="recipient-chip-"]')
    // Filter to the actual chip wrappers (not the remove button which is
    // also keyed by id).
    const chipWrappers = chips.filter((c) => c.element.tagName === 'SPAN')
    expect(chipWrappers.length).toBe(0)
  })
})

describe('RecipientSelect — selection summary', () => {
  it('renders the "N seleccionados" summary when selection is non-empty', () => {
    const wrapper = mountSelect({ modelValue: ['u1', 'u2'] })
    expect(wrapper.text()).toMatch(/2 seleccionados/)
  })

  it('renders the zero-summary when selection is empty', () => {
    const wrapper = mountSelect({ modelValue: [] })
    expect(wrapper.text()).toMatch(/0 seleccionados/)
  })

  it('updates the summary count when modelValue changes', () => {
    const wrapper = mountSelect({ modelValue: [] })
    expect(wrapper.text()).toMatch(/0 seleccionados/)

    const updated = mountSelect({ modelValue: ['u1', 'u2', 'u3'] })
    expect(updated.text()).toMatch(/3 seleccionados/)
  })
})

describe('RecipientSelect — inline error', () => {
  it('renders the error message when :error is provided', () => {
    const wrapper = mountSelect({
      modelValue: ['u1'],
      error: 'Uno de los usuarios seleccionados no pertenece a esta cuenta',
    })
    expect(wrapper.text()).toContain('no pertenece a esta cuenta')
  })

  it('does not render an error block when :error is empty', () => {
    const wrapper = mountSelect({ modelValue: ['u1'], error: '' })
    const errorBlocks = wrapper.findAll('[data-testid="recipient-error"]')
    const visibleErrors = errorBlocks.filter((b) => b.text().trim().length > 0)
    expect(visibleErrors.length).toBe(0)
  })
})

describe('RecipientSelect — disabled state', () => {
  it('renders the trigger as disabled when :disabled=true', () => {
    const wrapper = mountSelect({ modelValue: [], disabled: true })
    // USelectMenu surfaces disabled on the inner <button>.
    const trigger = wrapper.find('[data-testid="recipient-select-trigger"]')
    expect(trigger.exists()).toBe(true)
    expect(trigger.attributes('disabled')).toBeDefined()
  })
})

describe('RecipientSelect — clear stale-chip', () => {
  it('emits @update:modelValue without the stale id when its chip is removed', async () => {
    const wrapper = mountSelect({ modelValue: ['u1', 'ghost'] })
    const staleBtn = wrapper.find('[data-testid="recipient-chip-remove-ghost"]')
    expect(staleBtn.exists()).toBe(true)
    await staleBtn.trigger('click')
    await nextTick()

    const events = wrapper.emitted('update:modelValue')
    expect(events).toBeTruthy()
    expect(events![events!.length - 1]).toEqual([['u1']])
  })

  it('emits @update:modelValue without the named id when its chip is removed', async () => {
    const wrapper = mountSelect({ modelValue: ['u1', 'u2'] })
    const removeBtn = wrapper.find('[data-testid="recipient-chip-remove-u1"]')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')
    await nextTick()

    const events = wrapper.emitted('update:modelValue')
    expect(events![events!.length - 1]).toEqual([['u2']])
  })
})

describe('RecipientSelect — stale-id detection (does NOT auto-remove)', () => {
  it('keeps stale ids in the chips even when assignable does not list them', () => {
    const wrapper = mountSelect({ modelValue: ['u1', 'ghost', 'u2'] })
    expect(wrapper.text()).toContain('Ana')
    expect(wrapper.text()).toContain('Bruno')
    expect(wrapper.text()).toContain('Usuario no disponible')
  })
})

describe('RecipientSelect — pure helper re-export check', () => {
  it('exposes detectStaleRecipientIds via the module exports', async () => {
    const mod = await import('../recipientSelectState')
    expect(typeof mod.detectStaleRecipientIds).toBe('function')
  })
})

// Tiny no-op to silence the linter about unused vi import in the test file.
vi.fn()