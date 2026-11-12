import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SlaIndicator from '../SlaIndicator.vue'
import { makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'
import type { ChatbotRequestRow } from '../../interfaces/chatbot-request.types'

const NOW = new Date('2026-11-11T17:05:00.000Z') // Wed 11 nov, 11:05 in Mexico City
const TZ = 'America/Mexico_City'

function mountSla(row: Partial<ChatbotRequestRow>) {
  return mount(SlaIndicator, { props: { row: makeRow(row), now: NOW, timeZone: TZ } })
}
const root = (w: ReturnType<typeof mountSla>) => w.get('[data-testid="sla-indicator"]')

describe('SlaIndicator — the backend slaLevel, never a computed threshold', () => {
  it.each([
    ['OK', 'ok', 'A tiempo'],
    ['HALF', 'warn', 'Pasó la mitad del tiempo'],
    ['ESCALATION', 'bad', 'Cerca de vencer'],
  ] as const)('%s → tone %s and the label «%s»', (slaLevel, tone, label) => {
    const wrapper = mountSla({ slaLevel })
    expect(root(wrapper).attributes('data-tone')).toBe(tone)
    expect(root(wrapper).attributes('data-level')).toBe(slaLevel)
    expect(root(wrapper).text()).toContain(label)
  })

  it('does not look at the deadlines: the same level reads the same whatever the dates', () => {
    const far = mountSla({ slaLevel: 'HALF', claimDeadlineAt: '2030-01-01T00:00:00.000Z' })
    const past = mountSla({ slaLevel: 'HALF', claimDeadlineAt: '2000-01-01T00:00:00.000Z' })
    expect(root(far).text()).toBe(root(past).text())
    expect(root(far).attributes('data-tone')).toBe('warn')
  })

  it('OVERDUE is red with the «Vencida» chip text', () => {
    const wrapper = mountSla({ slaLevel: 'OVERDUE', status: 'IN_PROGRESS', displayStatus: 'EXPIRED' })
    expect(root(wrapper).attributes('data-tone')).toBe('bad')
    expect(root(wrapper).text()).toContain('Vencida')
  })

  it('ESCALATION is red but is not the «Vencida» chip', () => {
    expect(root(mountSla({ slaLevel: 'ESCALATION' })).text()).not.toContain('Vencida')
  })

  it('null level and no deadline shows «Sin límite», muted', () => {
    const wrapper = mountSla({ slaLevel: null, claimDeadlineAt: null })
    expect(root(wrapper).attributes('data-tone')).toBe('none')
    expect(root(wrapper).text()).toContain('Sin límite')
  })

  it('a closed request shows no light', () => {
    for (const status of ['RESOLVED', 'CANCELLED'] as const) {
      const wrapper = mountSla({ status, displayStatus: status, slaLevel: null })
      expect(root(wrapper).attributes('data-tone')).toBe('closed')
      expect(root(wrapper).text()).toBe('—')
    }
  })

  it('paused: shows «se reanuda …» with slaResumesAt and keeps the level it was given', () => {
    const wrapper = mountSla({
      slaLevel: 'HALF',
      slaPaused: true,
      slaResumesAt: '2026-11-12T15:00:00.000Z',
    })
    expect(root(wrapper).attributes('data-tone')).toBe('pause')
    expect(root(wrapper).attributes('data-level')).toBe('HALF')
    expect(root(wrapper).text()).toContain('En pausa')
    expect(root(wrapper).text()).toContain('se reanuda mañana 9:00')
  })

  it('paused without slaResumesAt does not print a broken sentence', () => {
    const wrapper = mountSla({ slaLevel: 'OK', slaPaused: true, slaResumesAt: null })
    expect(root(wrapper).text()).toContain('En pausa')
    expect(root(wrapper).text()).not.toContain('se reanuda')
    expect(root(wrapper).text()).not.toContain('null')
  })

  it('overdue while paused stays red and adds the resume line', () => {
    const wrapper = mountSla({
      slaLevel: 'OVERDUE',
      status: 'IN_PROGRESS',
      slaPaused: true,
      slaResumesAt: '2026-11-12T15:00:00.000Z',
    })
    expect(root(wrapper).attributes('data-tone')).toBe('bad')
    expect(root(wrapper).text()).toContain('Vencida')
    expect(root(wrapper).text()).toContain('se reanuda mañana 9:00')
  })

  it('scheduled (future scheduledFor): «Agendada · mar 10:30», with the template hint', () => {
    const inWindow = mountSla({ slaLevel: 'OK', scheduledFor: '2026-11-17T16:30:00.000Z' })
    expect(root(inWindow).attributes('data-tone')).toBe('sched')
    expect(root(inWindow).text()).toContain('Agendada · mar 10:30')
    expect(root(inWindow).text()).toContain('Dentro de la ventana gratis')

    const needsTemplate = mountSla({
      slaLevel: 'OK',
      scheduledFor: '2026-11-17T16:30:00.000Z',
      requiresTemplateAtStart: true,
    })
    expect(root(needsTemplate).text()).toContain('Fuera de la ventana de 24 h: se usa plantilla')
  })

  it('scheduled whose time already arrived follows the level again', () => {
    const wrapper = mountSla({ slaLevel: 'HALF', scheduledFor: '2026-11-11T16:00:00.000Z' })
    expect(root(wrapper).attributes('data-tone')).toBe('warn')
    expect(root(wrapper).text()).not.toContain('Agendada')
  })

  it('an overdue scheduled request is overdue, not scheduled', () => {
    const wrapper = mountSla({ slaLevel: 'OVERDUE', scheduledFor: '2026-11-17T16:30:00.000Z' })
    expect(root(wrapper).attributes('data-tone')).toBe('bad')
    expect(root(wrapper).text()).not.toContain('Agendada')
  })

  it('compact hides the second line but keeps the tone and the first', () => {
    const wrapper = mount(SlaIndicator, {
      props: {
        row: makeRow({ slaLevel: 'OK', slaPaused: true, slaResumesAt: '2026-11-12T15:00:00.000Z' }),
        now: NOW,
        timeZone: TZ,
        compact: true,
      },
    })
    expect(root(wrapper).text()).toContain('En pausa')
    expect(root(wrapper).text()).not.toContain('se reanuda')
  })

  it('says it in words, not only in color (accessible name)', () => {
    const wrapper = mountSla({ slaLevel: 'ESCALATION' })
    expect(root(wrapper).attributes('aria-label')).toContain('Cerca de vencer')
  })
})
