import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestsListHeader from '../RequestsListHeader.vue'
import RequestsListLegend from '../RequestsListLegend.vue'
import RequestsListPausedBanner from '../RequestsListPausedBanner.vue'
import RequestsListSkeleton from '../RequestsListSkeleton.vue'
import { countsFixture } from '../../interfaces/__tests__/chatbot-request.fixture'

describe('RequestsListHeader', () => {
  it('shows the title, the open count and the counts line of /counts', () => {
    const wrapper = mount(RequestsListHeader, { props: { counts: countsFixture } })
    expect(wrapper.get('h1').text()).toBe('Solicitudes')
    expect(wrapper.get('[data-testid="open-count"]').text()).toBe('11 abiertas')
    expect(wrapper.get('[data-testid="counts-line"]').text()).toContain('7 nuevas · 4 en atención · 1 vencida')
  })

  it('singular open count and plural overdue', () => {
    const wrapper = mount(RequestsListHeader, {
      props: { counts: { ...countsFixture, new: 1, inProgress: 0, overdue: 3 } },
    })
    expect(wrapper.get('[data-testid="open-count"]').text()).toBe('1 abierta')
    expect(wrapper.get('[data-testid="counts-line"]').text()).toContain('1 nueva · 0 en atención · 3 vencidas')
  })

  it('without counts it keeps the title and says nothing about numbers', () => {
    const wrapper = mount(RequestsListHeader, { props: { counts: null } })
    expect(wrapper.get('h1').text()).toBe('Solicitudes')
    expect(wrapper.find('[data-testid="open-count"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="counts-line"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Solicitudes del chatbot que necesitan a una persona')
  })
})

describe('RequestsListPausedBanner', () => {
  const NOW = new Date('2026-11-11T17:05:00.000Z')

  it('says the deadlines are paused and when they resume (slaResumesAt)', () => {
    const wrapper = mount(RequestsListPausedBanner, {
      props: { resumesAt: '2026-11-12T15:00:00.000Z', now: NOW, timeZone: 'America/Mexico_City' },
    })
    const banner = wrapper.get('[data-testid="paused-banner"]')
    expect(banner.attributes('role')).toBe('status')
    expect(banner.text()).toContain('Fuera de horario de atención')
    expect(banner.text()).toContain('se reanudan mañana 9:00')
    expect(banner.text()).toContain('siguen marcadas como vencidas')
  })

  it('without a resume time it still says they are paused, with no invented time', () => {
    const wrapper = mount(RequestsListPausedBanner, { props: { resumesAt: null } })
    expect(wrapper.text()).toContain('Los tiempos límite están en pausa')
    expect(wrapper.text()).not.toContain('se reanudan')
  })
})

describe('RequestsListLegend — backend levels, not the design thresholds', () => {
  it('names OK, HALF, ESCALATION and OVERDUE with the backend wording', () => {
    const wrapper = mount(RequestsListLegend)
    const items = wrapper.findAll('[data-testid="legend-item"]')
    const byLevel = Object.fromEntries(items.map((i) => [i.attributes('data-level'), i]))
    expect(byLevel.OK!.text()).toContain('A tiempo')
    expect(byLevel.OK!.attributes('data-tone')).toBe('ok')
    expect(byLevel.HALF!.text()).toContain('Pasó la mitad del tiempo')
    expect(byLevel.HALF!.attributes('data-tone')).toBe('warn')
    expect(byLevel.ESCALATION!.text()).toContain('Cerca de vencer')
    expect(byLevel.ESCALATION!.attributes('data-tone')).toBe('bad')
    expect(byLevel.OVERDUE!.text()).toContain('Vencida')
    expect(byLevel.OVERDUE!.attributes('data-tone')).toBe('bad')
  })

  it('also explains paused and scheduled', () => {
    const text = mount(RequestsListLegend).text()
    expect(text).toContain('En pausa')
    expect(text).toContain('Agendada')
  })

  it('never copies the design percentages', () => {
    const text = mount(RequestsListLegend).text()
    expect(text).not.toMatch(/50\s?%|10\s?%|Más de la mitad|Menos de la mitad/)
  })
})

describe('RequestsListSkeleton', () => {
  it('announces loading and keeps the final space with placeholder rows', () => {
    const wrapper = mount(RequestsListSkeleton, { props: { layout: 'table' } })
    expect(wrapper.get('[data-testid="list-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('Cargando solicitudes')
    expect(wrapper.findAll('[data-testid="skeleton-row"]').length).toBeGreaterThanOrEqual(5)
  })

  it('uses card-shaped placeholders on mobile', () => {
    const wrapper = mount(RequestsListSkeleton, { props: { layout: 'cards' } })
    expect(wrapper.findAll('[data-testid="skeleton-card"]').length).toBeGreaterThanOrEqual(3)
  })
})
