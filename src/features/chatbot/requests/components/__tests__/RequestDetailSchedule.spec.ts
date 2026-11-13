import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestDetailSchedule from '../RequestDetailSchedule.vue'
import { DETAIL_STUBS, makeDetail } from '../../utils/detail-fixture'
import type { ChatbotRequestDetail } from '../../interfaces/chatbot-request.types'

const TZ = 'America/Mexico_City'
const NOW = new Date('2026-11-11T17:05:00.000Z') // Wed 11 nov, 11:05 in Mexico City

const mountSchedule = (overrides: Partial<ChatbotRequestDetail> = {}) =>
  mount(RequestDetailSchedule, {
    props: { request: makeDetail(overrides), timeZone: TZ, now: NOW },
    global: { stubs: DETAIL_STUBS },
  })

describe('RequestDetailSchedule — scheduled conversations (handoff 21 §6.1)', () => {
  it('renders nothing for a request that was never scheduled', () => {
    expect(mountSchedule().find('[data-testid="schedule-block"]').exists()).toBe(false)
  })

  it('renders nothing for a closed request, even if it kept its scheduledFor', () => {
    const wrapper = mountSchedule({
      status: 'CANCELLED',
      displayStatus: 'CANCELLED',
      scheduledFor: '2026-11-14T16:00:00.000Z',
      needsReschedule: true,
    })
    expect(wrapper.find('[data-testid="schedule-block"]').exists()).toBe(false)
  })

  it('shows «Agendada para …» in the zone given and the paid-template badge when it applies', () => {
    const wrapper = mountSchedule({ scheduledFor: '2026-11-14T16:00:00.000Z', requiresTemplateAtStart: true })
    expect(wrapper.get('[data-testid="schedule-chip"]').text()).toBe('Agendada para sáb 14 nov 10:00')
    expect(wrapper.get('[data-testid="schedule-template"]').text()).toBe('Plantilla de pago al iniciar')
    expect(wrapper.find('[data-testid="reschedule-banner"]').exists()).toBe(false)
  })

  it('no template badge when the time is inside the free window', () => {
    const wrapper = mountSchedule({ scheduledFor: '2026-11-14T16:00:00.000Z', requiresTemplateAtStart: false })
    expect(wrapper.find('[data-testid="schedule-template"]').exists()).toBe(false)
  })

  it('needsReschedule explains why: closed day or changed hours, and that nobody told the customer', () => {
    const wrapper = mountSchedule({ scheduledFor: '2026-11-14T16:00:00.000Z', needsReschedule: true })
    const banner = wrapper.get('[data-testid="reschedule-banner"]')
    expect(banner.attributes('role')).toBe('alert')
    expect(banner.text()).toContain('Por reagendar')
    expect(banner.text()).toContain('cerró ese día o cambió el horario')
    expect(banner.text()).toContain('Nadie avisó al cliente')
  })

  it('T12: CLOSED_DATE names the cause — the day was closed in the branch settings', () => {
    const wrapper = mountSchedule({
      scheduledFor: '2026-11-14T16:00:00.000Z',
      needsReschedule: true,
      needsRescheduleReason: 'CLOSED_DATE',
    })
    const text = wrapper.get('[data-testid="reschedule-banner"]').text()
    expect(text).toContain('Por reagendar')
    expect(text).toContain('cerrado en la configuración de la sucursal')
    expect(text).not.toContain('cambió el horario')
    expect(text).toContain('Nadie avisó al cliente')
  })

  it('T12: HOURS_CHANGED names the cause — the branch hours changed', () => {
    const wrapper = mountSchedule({
      scheduledFor: '2026-11-14T16:00:00.000Z',
      needsReschedule: true,
      needsRescheduleReason: 'HOURS_CHANGED',
    })
    const text = wrapper.get('[data-testid="reschedule-banner"]').text()
    expect(text).toContain('Cambió el horario de la sucursal')
    expect(text).not.toContain('cerrado en la configuración')
    expect(text).toContain('Nadie avisó al cliente')
  })

  it('T12: a null reason (flagged before the field existed) keeps the generic copy', () => {
    const wrapper = mountSchedule({
      scheduledFor: '2026-11-14T16:00:00.000Z',
      needsReschedule: true,
      needsRescheduleReason: null,
    })
    expect(wrapper.get('[data-testid="reschedule-banner"]').text()).toContain('cerró ese día o cambió el horario')
  })

  it('«Reagendar» in the banner emits RESCHEDULE only when the server allows it', async () => {
    const allowed = mountSchedule({
      scheduledFor: '2026-11-14T16:00:00.000Z',
      needsReschedule: true,
      allowedActions: ['RESCHEDULE', 'CANCEL'],
    })
    await allowed.get('[data-testid="reschedule-banner-action"]').trigger('click')
    expect(allowed.emitted('action')).toEqual([['RESCHEDULE']])

    const denied = mountSchedule({
      scheduledFor: '2026-11-14T16:00:00.000Z',
      needsReschedule: true,
      allowedActions: [],
    })
    expect(denied.find('[data-testid="reschedule-banner-action"]').exists()).toBe(false)
    expect(denied.get('[data-testid="reschedule-banner"]').text()).toContain('Por reagendar')
  })
})
