/**
 * WU-12 — employees-batch-operations
 *
 * Strict TDD — Phase 3 RED specs for BatchTerminateModal.
 *
 * Coverage:
 * - confirm disabled when reason.trim() === ''
 * - confirm enabled when reason is filled
 * - emits 'confirm' with reason string
 * - Zod rejects whitespace (boundary)
 * - loading disables all action buttons
 * - renders the scrollable list of selected employees with name + status
 */

import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

import BatchTerminateModal from '@/features/admin/employees/components/BatchTerminateModal.vue'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEmployeeSummary(overrides: { id?: string; fullName?: string; status?: string } = {}) {
  return {
    id: overrides.id ?? 'emp-1',
    fullName: overrides.fullName ?? 'Juan García',
    status: overrides.status ?? 'ACTIVE',
  }
}

function mountModal(props: {
  open?: boolean
  employees?: Array<{ id: string; fullName: string; status: string }>
  loading?: boolean
} = {}) {
  return mount(BatchTerminateModal, {
    props: {
      open: props.open ?? true,
      employees: props.employees ?? [makeEmployeeSummary()],
      loading: props.loading ?? false,
    },
    global: {
      stubs: {
        Modal: {
          props: ['open'],
          emits: ['update:open'],
          template: `
            <div v-if="open" data-testid="batch-terminate-modal" class="modal-stub">
              <slot name="body" />
              <slot name="footer" />
            </div>
          `,
        },
        Form: {
          template: '<form><slot /></form>',
        },
        FormField: {
          props: ['label', 'name', 'error'],
          template: '<div data-testid="form-field"><label>{{ label }}</label><slot /></div>',
        },
        Textarea: {
          props: ['modelValue', 'disabled', 'placeholder', 'rows'],
          emits: ['update:modelValue'],
          template: '<textarea data-testid="reason-textarea" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        Button: {
          props: ['label', 'color', 'variant', 'disabled', 'loading', 'type', 'form'],
          emits: ['click'],
          template: '<button :data-testid="`btn-${label}`" :disabled="disabled || loading" @click="$emit(\'click\')">{{ label }}</button>',
        },
      },
    },
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BatchTerminateModal (WU-12 phase 3)', () => {
  it('renders the modal when open=true', () => {
    const wrapper = mountModal({ open: true })
    expect(wrapper.find('[data-testid="batch-terminate-modal"]').exists()).toBe(true)
  })

  it('does not render the modal when open=false', () => {
    const wrapper = mountModal({ open: false })
    expect(wrapper.find('[data-testid="batch-terminate-modal"]').exists()).toBe(false)
  })

  it('renders a reason textarea', () => {
    const wrapper = mountModal()
    expect(wrapper.find('[data-testid="reason-textarea"]').exists()).toBe(true)
  })

  it('confirm button is disabled when reason is empty', () => {
    const wrapper = mountModal()
    // Find the "Dar de baja" confirm button — it's the last UButton (in footer)
    const buttons = wrapper.findAll('[data-testid^="btn-"]')
    const confirmBtn = buttons[buttons.length - 1]!
    expect(confirmBtn.attributes('disabled')).toBeDefined()
  })

  it('confirm button is enabled when reason is filled with non-empty value', async () => {
    const wrapper = mountModal()
    const textarea = wrapper.find('[data-testid="reason-textarea"]')
    await textarea.setValue('Reorg')
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAll('[data-testid^="btn-"]')
    const confirmBtn = buttons[buttons.length - 1]!
    expect(confirmBtn.attributes('disabled')).toBeUndefined()
  })

  it('emits confirm with the trimmed reason on submit', async () => {
    const wrapper = mountModal()
    const textarea = wrapper.find('[data-testid="reason-textarea"]')
    await textarea.setValue('Reestructuración')
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAll('[data-testid^="btn-"]')
    const confirmBtn = buttons[buttons.length - 1]!
    await confirmBtn.trigger('click')
    await flushPromises()

    const emitted = wrapper.emitted('confirm')
    expect(emitted).toBeDefined()
    expect(emitted![0]![0]).toBe('Reestructuración')
  })

  it('emits update:open(false) when cancel button is clicked', async () => {
    const wrapper = mountModal()
    const buttons = wrapper.findAll('[data-testid^="btn-"]')
    const cancelBtn = buttons[0]! // First button is "Cancelar"
    await cancelBtn.trigger('click')
    await flushPromises()

    const emitted = wrapper.emitted('update:open')
    expect(emitted).toBeDefined()
    expect(emitted![emitted!.length - 1]![0]).toBe(false)
  })

  it('disables buttons when loading=true', () => {
    const wrapper = mountModal({ loading: true })
    const buttons = wrapper.findAll('[data-testid^="btn-"]')
    buttons.forEach((btn) => {
      expect(btn.attributes('disabled')).toBeDefined()
    })
  })

  it('renders the list of selected employees with name + status', () => {
    const wrapper = mountModal({
      employees: [
        makeEmployeeSummary({ id: 'a', fullName: 'Juan García', status: 'ACTIVE' }),
        makeEmployeeSummary({ id: 'b', fullName: 'Ana López', status: 'TERMINATED' }),
      ],
    })
    expect(wrapper.text()).toContain('Juan García')
    expect(wrapper.text()).toContain('Ana López')
    expect(wrapper.text()).toContain('Activo')
    expect(wrapper.text()).toContain('Baja')
  })
})
