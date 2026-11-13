import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestCommandRescheduleForm from '../RequestCommandRescheduleForm.vue'
import type { ChatbotSchedulingSlots } from '../../interfaces/chatbot-request.types'

const TZ = 'America/Mexico_City'
const NOW = new Date('2026-11-13T18:00:00.000Z')

const slots = (overrides: Partial<ChatbotSchedulingSlots> = {}): ChatbotSchedulingSlots => ({
  timeZone: TZ,
  whatsappWindowClosesAt: '2026-11-14T03:10:00.000Z', // in the future of NOW
  slots: [
    { startsAt: '2026-11-14T15:00:00.000Z', withinWindow: true, available: true },
    { startsAt: '2026-11-14T15:30:00.000Z', withinWindow: false, available: true },
  ],
  ...overrides,
})

const STUBS = {
  UIcon: { template: '<span />' },
  UButton: {
    props: ['label', 'disabled', 'loading', 'type'],
    emits: ['click'],
    template:
      '<button :type="type || \'button\'" :disabled="disabled || loading" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
  },
}

const mountForm = (props: Record<string, unknown> = {}) =>
  mount(RequestCommandRescheduleForm, {
    props: { slots: slots(), currentScheduledFor: '2026-11-14T14:00:00.000Z', now: NOW, ...props },
    global: { stubs: STUBS },
  })

const pick = (wrapper: ReturnType<typeof mountForm>, startsAt: string) =>
  wrapper.get(`[data-testid="radio-${startsAt}"]`).trigger('click')
const submit = (wrapper: ReturnType<typeof mountForm>) => wrapper.get('form').trigger('submit')

describe('RequestCommandRescheduleForm', () => {
  it('lists the slots as radio rows in the branch zone (never checkboxes, select or date inputs)', () => {
    const wrapper = mountForm()
    const rows = wrapper.findAll('[role="radio"]')
    expect(rows.map((row) => row.get('b').text())).toEqual(['sáb 14 nov 09:00', 'sáb 14 nov 09:30'])
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('input[type="date"], input[type="datetime-local"], input[type="time"]').exists()).toBe(false)
    expect(wrapper.text()).toContain(TZ)
  })

  it('says what the current time is, so the move is clear', () => {
    expect(mountForm().get('[data-testid="reschedule-current"]').text()).toContain('sáb 14 nov 08:00')
  })

  it('notes the paid template on a slot outside the free 24 h window, and only there', () => {
    const rows = mountForm().findAll('[role="radio"]')
    expect(rows[0]!.text()).not.toContain('plantilla')
    expect(rows[1]!.text()).toContain('Esta hora cuesta una plantilla de WhatsApp')
  })

  it('warns BEFORE confirming that the customer is told when the free window is still open', () => {
    const notice = mountForm().get('[data-testid="reschedule-notice"]')
    expect(notice.attributes('data-expected')).toBe('true')
    expect(notice.text()).toContain('Se avisará al cliente de la nueva hora.')
  })

  it('warns BEFORE confirming that the customer will NOT be told when the window already closed', () => {
    const notice = mountForm({ slots: slots({ whatsappWindowClosesAt: '2026-11-13T10:00:00.000Z' }) }).get(
      '[data-testid="reschedule-notice"]',
    )
    expect(notice.attributes('data-expected')).toBe('false')
    expect(notice.text()).toContain('El cliente no recibirá aviso de la nueva hora')
    expect(notice.text()).toContain('Avísale por otro medio')
  })

  it('does not claim either outcome when the picker did not say when the window closes', () => {
    const notice = mountForm({ slots: slots({ whatsappWindowClosesAt: null }) }).get('[data-testid="reschedule-notice"]')
    expect(notice.attributes('data-expected')).toBe('unknown')
    expect(notice.text()).toContain('solo si su ventana de 24 h sigue abierta')
  })

  it('submits the chosen block start exactly as the picker gave it', async () => {
    const wrapper = mountForm()
    await pick(wrapper, '2026-11-14T15:30:00.000Z')
    await submit(wrapper)
    expect(wrapper.emitted('submit')).toEqual([['2026-11-14T15:30:00.000Z']])
  })

  it('asks to choose a time before submitting, without emitting', async () => {
    const wrapper = mountForm()
    await submit(wrapper)
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text()).toBe('Elige la nueva hora.')
  })

  it('drops a choice that is no longer in the list after a SLOT_UNAVAILABLE swap', async () => {
    const wrapper = mountForm()
    await pick(wrapper, '2026-11-14T15:30:00.000Z')
    await wrapper.setProps({
      slots: slots({ slots: [{ startsAt: '2026-11-14T16:00:00.000Z', withinWindow: true, available: true }] }),
    })
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(1)
    expect(wrapper.findAll('[aria-checked="true"]')).toHaveLength(0)
    await submit(wrapper)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('shows the server field error under the choice', () => {
    const wrapper = mountForm({ serverErrors: { scheduledFor: 'Revisa este campo.' } })
    expect(wrapper.text()).toContain('Revisa este campo.')
  })

  it('has states for loading, a failed or disabled picker (with retry) and an empty list', async () => {
    const loading = mountForm({ slots: null, loading: true })
    expect(loading.find('[data-testid="reschedule-loading"]').exists()).toBe(true)
    expect(loading.get('[data-testid="command-submit"]').attributes('disabled')).toBeDefined()

    const failed = mountForm({ slots: null, loadError: 'El agendado está desactivado en esta sucursal.' })
    expect(failed.get('[data-testid="reschedule-load-failed"]').text()).toContain('El agendado está desactivado')
    await failed.get('[data-testid="reschedule-reload"]').trigger('click')
    expect(failed.emitted('reload')).toHaveLength(1)

    const empty = mountForm({ slots: slots({ slots: [] }) })
    expect(empty.get('[data-testid="reschedule-empty"]').text()).toContain('No hay horarios disponibles')
    expect(empty.get('[data-testid="command-submit"]').attributes('disabled')).toBeDefined()
  })

  it('«Volver» goes back; submit is disabled while pending', async () => {
    const wrapper = mountForm({ pending: true })
    expect(wrapper.get('[data-testid="command-submit"]').attributes('disabled')).toBeDefined()
    const idle = mountForm()
    await idle.get('[data-testid="command-back"]').trigger('click')
    expect(idle.emitted('back')).toHaveLength(1)
  })
})
