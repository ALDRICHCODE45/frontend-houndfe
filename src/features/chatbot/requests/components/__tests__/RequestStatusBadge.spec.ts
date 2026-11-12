import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestStatusBadge from '../RequestStatusBadge.vue'
import { makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'
import type { ChatbotRequestRow } from '../../interfaces/chatbot-request.types'

const ana = { id: 'u-ana', displayName: 'Ana López' }

function mountBadge(row: Partial<ChatbotRequestRow>, props: Record<string, unknown> = {}) {
  return mount(RequestStatusBadge, { props: { row: makeRow(row), ...props } })
}
const badge = (w: ReturnType<typeof mountBadge>) => w.get('.hf-status-badge')

describe('RequestStatusBadge (displayStatus, with «por X»)', () => {
  it('NEW → «Nueva», warning', () => {
    const wrapper = mountBadge({ status: 'NEW', displayStatus: 'NEW' })
    expect(badge(wrapper).text()).toBe('Nueva')
    expect(badge(wrapper).attributes('data-tone')).toBe('warning')
  })

  it('IN_PROGRESS → «En atención · por Ana López», info', () => {
    const wrapper = mountBadge({ status: 'IN_PROGRESS', displayStatus: 'IN_PROGRESS', assignee: ana })
    expect(badge(wrapper).text()).toBe('En atención · por Ana López')
    expect(badge(wrapper).attributes('data-tone')).toBe('info')
  })

  it('IN_PROGRESS without an assignee does not print «por»', () => {
    const wrapper = mountBadge({ status: 'IN_PROGRESS', displayStatus: 'IN_PROGRESS', assignee: null })
    expect(badge(wrapper).text()).toBe('En atención')
  })

  it('EXPIRED → «Vencida · por Ana López», danger and urgent', () => {
    const wrapper = mountBadge({ status: 'IN_PROGRESS', displayStatus: 'EXPIRED', assignee: ana })
    expect(badge(wrapper).text()).toBe('Vencida · por Ana López')
    expect(badge(wrapper).attributes('data-tone')).toBe('danger')
    expect(badge(wrapper).attributes('data-urgent')).toBe('true')
  })

  it('EXPIRED while still NEW (nobody took it) reads «Vencida»', () => {
    const wrapper = mountBadge({ status: 'NEW', displayStatus: 'EXPIRED', assignee: null })
    expect(badge(wrapper).text()).toBe('Vencida')
  })

  it('RESOLVED → «Resuelta», success; CANCELLED → «Cancelada», neutral (no «por»)', () => {
    const resolved = mountBadge({ status: 'RESOLVED', displayStatus: 'RESOLVED', assignee: ana })
    expect(badge(resolved).text()).toBe('Resuelta')
    expect(badge(resolved).attributes('data-tone')).toBe('success')
    const cancelled = mountBadge({ status: 'CANCELLED', displayStatus: 'CANCELLED' })
    expect(badge(cancelled).text()).toBe('Cancelada')
    expect(badge(cancelled).attributes('data-tone')).toBe('neutral')
  })

  it('«por ti» when the assignee is the current user', () => {
    const wrapper = mountBadge(
      { status: 'IN_PROGRESS', displayStatus: 'IN_PROGRESS', assignee: ana },
      { currentUserId: 'u-ana' },
    )
    expect(badge(wrapper).text()).toBe('En atención · por ti')
  })

  it('withAssignee=false drops «por X» (detail header shows the assignee elsewhere)', () => {
    const wrapper = mountBadge(
      { status: 'IN_PROGRESS', displayStatus: 'IN_PROGRESS', assignee: ana },
      { withAssignee: false },
    )
    expect(badge(wrapper).text()).toBe('En atención')
  })

  it('the accessible name carries the state and says urgent in words', () => {
    const wrapper = mountBadge({ status: 'IN_PROGRESS', displayStatus: 'EXPIRED', assignee: ana })
    expect(badge(wrapper).attributes('aria-label')).toBe('Estado: Vencida · por Ana López, urgente')
  })
})
