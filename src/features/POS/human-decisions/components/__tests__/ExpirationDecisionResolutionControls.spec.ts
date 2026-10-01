import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import ExpirationDecisionResolutionControls from '../ExpirationDecisionResolutionControls.vue'
import { pendingExpiration } from '../../interfaces/__tests__/expirationDecision.fixture'
import type { PendingExpirationDecision } from '../../interfaces/expiration-decision.types'
import type { ExpirationDecisionResolutionInput } from '../../utils/expirationResolutionAttempt'

const UButtonStub = {
  props: ['disabled', 'loading'],
  template: '<button type="button" :disabled="disabled || loading"><slot /></button>',
}
const UTextareaStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `<textarea :value="modelValue" @input="$emit('update:modelValue', $event.target.value)"></textarea>`,
}
const ConfirmModalStub = {
  props: ['open', 'title', 'description', 'loading'],
  emits: ['confirm', 'update:open'],
  template: `<div v-if="open" role="dialog"><p data-testid="confirmation-description">{{ description }}</p><button data-testid="cancel-expiration" :disabled="loading" @click="$emit('update:open', false)">Cancelar</button><button data-testid="confirm-expiration" :disabled="loading" @click="$emit('confirm')">Confirmar</button></div>`,
}

const stubs = { UButton: UButtonStub, UTextarea: UTextareaStub, ConfirmModal: ConfirmModalStub }
function mountControls(
  props: {
    decision?: PendingExpirationDecision
    canUpdate?: boolean
    resolving?: boolean
    conflict?: boolean
  } = {},
) {
  return mount(ExpirationDecisionResolutionControls, {
    props: { decision: pendingExpiration, canUpdate: true, ...props },
    global: { stubs },
  })
}

type Controls = ReturnType<typeof mountControls>
const events = (wrapper: Controls) =>
  wrapper.emitted('resolve') as unknown as ExpirationDecisionResolutionInput[][]
const draft = (wrapper: Controls) => wrapper.get('[data-testid="expiration-text-input"]')
const draftValue = (wrapper: Controls) => (draft(wrapper).element as HTMLTextAreaElement).value
const provideAction = { action: 'PROVIDE_EXPIRATION_TEXT', expectedVersion: 1 } as const
const reportAction = { action: 'REPORT_EXPIRATION_UNAVAILABLE', expectedVersion: 1 } as const

describe('ExpirationDecisionResolutionControls', () => {
  it('requires both update permission and server allowed actions', () => {
    const readOnly = mountControls({ canUpdate: false })
    expect(readOnly.text()).toContain('Solo lectura')
    expect(readOnly.find('[data-testid="provide-expiration-text"]').exists()).toBe(false)
    expect(readOnly.find('[data-testid="report-expiration-unavailable"]').exists()).toBe(false)

    const disallowed = mountControls({ decision: { ...pendingExpiration, allowedActions: [] } })
    expect(disallowed.text()).toContain('No hay acciones disponibles')
    expect(disallowed.find('[data-testid="provide-expiration-text"]').exists()).toBe(false)
    expect(disallowed.find('[data-testid="report-expiration-unavailable"]').exists()).toBe(false)
  })

  it('normalizes reviewed text and emits the exact WU2 input without identity fields', async () => {
    const wrapper = mountControls()
    await draft(wrapper).setValue('  Cafe\u0301 \u00a0 vence  ')
    await wrapper.get('[data-testid="provide-expiration-text"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Café vence')
    await wrapper.get('[data-testid="confirm-expiration"]').trigger('click')
    expect(events(wrapper)).toEqual([[{ ...provideAction, expirationText: 'Café vence' }]])
    expect(events(wrapper)[0]![0]).not.toHaveProperty('resolutionRequestId')
  })

  it.each([
    ['', 'Escribe la información de vencimiento.'],
    ['   \u00a0\u2028 ', 'Escribe la información de vencimiento.'],
    ['a\tb', 'caracteres no permitidos'],
    ['a\u007fb', 'caracteres no permitidos'],
    ['a'.repeat(501), 'no puede superar los 500 caracteres'],
  ])('rejects invalid text (%#) before opening confirmation', async (value, message) => {
    const wrapper = mountControls()
    await draft(wrapper).setValue(value)
    await wrapper.get('[data-testid="provide-expiration-text"]').trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toContain(message)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.emitted('resolve')).toBeUndefined()
  })

  it('accepts raw text longer than 500 that normalizes to the limit, without truncation', async () => {
    const wrapper = mountControls()
    expect(draft(wrapper).attributes('maxlength')).toBeUndefined()
    await draft(wrapper).setValue(`${'a'.repeat(500)}   \u00a0`)
    await wrapper.get('[data-testid="provide-expiration-text"]').trigger('click')
    await wrapper.get('[data-testid="confirm-expiration"]').trigger('click')
    expect(events(wrapper)[0]![0]).toEqual({ ...provideAction, expirationText: 'a'.repeat(500) })
    expect((events(wrapper)[0]![0] as { expirationText: string }).expirationText).toHaveLength(500)
  })

  it('confirms temporary unavailability with exact action/version and omits text', async () => {
    const wrapper = mountControls()
    await wrapper.get('[data-testid="report-expiration-unavailable"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain('no tenemos información de vencimiento')
    await wrapper.get('[data-testid="confirm-expiration"]').trigger('click')
    expect(events(wrapper)).toEqual([[reportAction]])
    expect(events(wrapper)[0]![0]).not.toHaveProperty('expirationText')
  })

  it('renders reviewed text literally and never executes embedded HTML', async () => {
    const raw = '<b>Vence</b><img src=x onerror=alert(1)>'
    const wrapper = mountControls()
    await draft(wrapper).setValue(raw)
    await wrapper.get('[data-testid="provide-expiration-text"]').trigger('click')
    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.get('[data-testid="confirmation-description"]').text()).toContain(raw)
    expect(dialog.find('img').exists()).toBe(false)
    expect(dialog.find('b').exists()).toBe(false)
    await wrapper.get('[data-testid="confirm-expiration"]').trigger('click')
    expect(events(wrapper)[0]![0]).toEqual({ ...provideAction, expirationText: raw })
  })

  it('cancels without emitting, preserves the draft and invalidates on draft change', async () => {
    const wrapper = mountControls()
    await draft(wrapper).setValue('Vence en marzo')
    await wrapper.get('[data-testid="provide-expiration-text"]').trigger('click')
    await wrapper.get('[data-testid="cancel-expiration"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.emitted('resolve')).toBeUndefined()
    expect(draftValue(wrapper)).toBe('Vence en marzo')
    await wrapper.get('[data-testid="provide-expiration-text"]').trigger('click')
    await draft(wrapper).setValue('Vence en abril')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('blocks direct confirm and cancel while resolving, then submits the preserved draft', async () => {
    const wrapper = mountControls()
    await draft(wrapper).setValue('Vence en marzo')
    await wrapper.get('[data-testid="provide-expiration-text"]').trigger('click')
    await wrapper.setProps({ resolving: true })
    const modal = wrapper.getComponent(ConfirmModalStub)
    expect(modal.props('loading')).toBe(true)
    expect(modal.find('[data-testid="confirm-expiration"]').attributes('disabled')).toBeDefined()
    modal.vm.$emit('confirm')
    modal.vm.$emit('update:open', false)
    expect(wrapper.emitted('resolve')).toBeUndefined()
    await wrapper.setProps({ resolving: false })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    modal.vm.$emit('confirm')
    expect(events(wrapper)[0]![0]).toEqual({ ...provideAction, expirationText: 'Vence en marzo' })
  })

  it('revokes a reviewed confirmation when permission or action is lost, and on conflict', async () => {
    const revoked = mountControls()
    await draft(revoked).setValue('Vence en marzo')
    await revoked.get('[data-testid="provide-expiration-text"]').trigger('click')
    await revoked.setProps({ canUpdate: false })
    expect(revoked.find('[role="dialog"]').exists()).toBe(false)
    expect(revoked.text()).toContain('Solo lectura')

    const disallowed = mountControls()
    await disallowed.get('[data-testid="report-expiration-unavailable"]').trigger('click')
    expect(disallowed.find('[role="dialog"]').exists()).toBe(true)
    await disallowed.setProps({ decision: { ...pendingExpiration, allowedActions: [] } })
    expect(disallowed.find('[role="dialog"]').exists()).toBe(false)

    const conflicted = mountControls()
    await conflicted.get('[data-testid="report-expiration-unavailable"]').trigger('click')
    await conflicted.setProps({ conflict: true })
    expect(conflicted.find('[role="dialog"]').exists()).toBe(false)
    expect(conflicted.get('[role="alert"]').text()).toContain('ya fue atendida')
    expect(conflicted.emitted('resolve')).toBeUndefined()
  })

  it('refuses a direct confirm when a nested revoke lands in the same tick', async () => {
    const decision = reactive({ ...pendingExpiration })
    const wrapper = mountControls({ decision })
    await wrapper.get('[data-testid="report-expiration-unavailable"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    decision.allowedActions = []
    wrapper.getComponent(ConfirmModalStub).vm.$emit('confirm')
    expect(wrapper.emitted('resolve')).toBeUndefined()
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('keeps the draft and re-emits identical input when no new decision arrives', async () => {
    const wrapper = mountControls()
    await draft(wrapper).setValue('Vence en marzo')
    await wrapper.get('[data-testid="provide-expiration-text"]').trigger('click')
    await wrapper.get('[data-testid="confirm-expiration"]').trigger('click')
    const input = { ...provideAction, expirationText: 'Vence en marzo' }
    await wrapper.setProps({ resolving: true })
    await wrapper.setProps({ resolving: false })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(draftValue(wrapper)).toBe('Vence en marzo')
    await wrapper.get('[data-testid="provide-expiration-text"]').trigger('click')
    await wrapper.get('[data-testid="confirm-expiration"]').trigger('click')
    expect(events(wrapper)).toEqual([[input], [input]])
  })

  it('resets the draft and confirmation when the decision id or version changes', async () => {
    const wrapper = mountControls()
    await draft(wrapper).setValue('Vence en marzo')
    await wrapper.get('[data-testid="provide-expiration-text"]').trigger('click')
    await wrapper.setProps({ decision: { ...pendingExpiration, id: 'exp-2' } })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(draftValue(wrapper)).toBe('')

    await draft(wrapper).setValue('Vence en abril')
    await wrapper.get('[data-testid="provide-expiration-text"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    const bumped = { ...pendingExpiration, version: 2 } as unknown as PendingExpirationDecision
    await wrapper.setProps({ decision: bumped })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(draftValue(wrapper)).toBe('')
  })

  it('rechecks the reviewed version at confirm and stays silent when it changed', async () => {
    const decision = { ...pendingExpiration }
    const wrapper = mountControls({ decision })
    await wrapper.get('[data-testid="report-expiration-unavailable"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    ;(decision as { version: number }).version = 2
    await wrapper.get('[data-testid="confirm-expiration"]').trigger('click')
    expect(wrapper.emitted('resolve')).toBeUndefined()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})
