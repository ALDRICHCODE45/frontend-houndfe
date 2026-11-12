import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestsListFilters from '../RequestsListFilters.vue'
import { countsFixture } from '../../interfaces/__tests__/chatbot-request.fixture'

function mountFilters(props: Record<string, unknown> = {}) {
  return mount(RequestsListFilters, {
    props: {
      tab: 'open',
      search: '',
      mine: false,
      unassigned: false,
      overdue: false,
      windowClosingSoon: false,
      subtype: null,
      counts: countsFixture,
      ...props,
    },
  })
}

const tabButtons = (w: ReturnType<typeof mountFilters>) => w.findAll('[data-testid="list-tab"]')
const chip = (w: ReturnType<typeof mountFilters>, id: string) => w.get(`[data-testid="chip-${id}"]`)

describe('RequestsListFilters — tabs', () => {
  it('shows the five tabs with the counts of /counts', () => {
    const tabs = tabButtons(mountFilters())
    expect(tabs.map((t) => t.text().replace(/\s+/g, ' '))).toEqual([
      'Abiertas 11',
      'Agendadas 0',
      'Resueltas · 7 días 12',
      'Canceladas · 7 días 5',
      'Historial',
    ])
  })

  it('marks the active tab with aria-pressed', () => {
    const tabs = tabButtons(mountFilters({ tab: 'resolved' }))
    expect(tabs.map((t) => t.attributes('aria-pressed'))).toEqual(['false', 'false', 'true', 'false', 'false'])
  })

  it.each([
    [0, 'open'],
    [1, 'scheduled'],
    [2, 'resolved'],
    [3, 'cancelled'],
    [4, 'history'],
  ])('clicking tab %i emits update:tab %s', async (index, id) => {
    const wrapper = mountFilters({ tab: id === 'open' ? 'resolved' : 'open' })
    await tabButtons(wrapper)[index]!.trigger('click')
    expect(wrapper.emitted('update:tab')).toEqual([[id]])
  })

  it('without counts the tabs still render, with no numbers', () => {
    const tabs = tabButtons(mountFilters({ counts: null }))
    expect(tabs.map((t) => t.text())).toEqual([
      'Abiertas',
      'Agendadas',
      'Resueltas · 7 días',
      'Canceladas · 7 días',
      'Historial',
    ])
  })
})

describe('RequestsListFilters — chips', () => {
  it('shows the four toggle chips with their counts (Sin responsable has none)', () => {
    const wrapper = mountFilters()
    expect(chip(wrapper, 'mine').text().replace(/\s+/g, ' ')).toBe('Mías 2')
    expect(chip(wrapper, 'unassigned').text()).toBe('Sin responsable')
    expect(chip(wrapper, 'overdue').text().replace(/\s+/g, ' ')).toBe('Vencidas 1')
    expect(chip(wrapper, 'windowClosingSoon').text().replace(/\s+/g, ' ')).toBe('Ventana por cerrar 3')
  })

  it('reflects each active chip with aria-pressed', () => {
    const wrapper = mountFilters({ mine: true, windowClosingSoon: true })
    expect(chip(wrapper, 'mine').attributes('aria-pressed')).toBe('true')
    expect(chip(wrapper, 'unassigned').attributes('aria-pressed')).toBe('false')
    expect(chip(wrapper, 'overdue').attributes('aria-pressed')).toBe('false')
    expect(chip(wrapper, 'windowClosingSoon').attributes('aria-pressed')).toBe('true')
  })

  it.each(['mine', 'unassigned', 'overdue', 'windowClosingSoon'])('clicking %s emits toggle-chip', async (id) => {
    const wrapper = mountFilters()
    await chip(wrapper, id).trigger('click')
    expect(wrapper.emitted('toggle-chip')).toEqual([[id]])
  })

  it('has no checkbox anywhere', () => {
    expect(mountFilters().find('input[type="checkbox"], [role="checkbox"]').exists()).toBe(false)
  })
})

describe('RequestsListFilters — search and subtype', () => {
  it('the search box is limited to 100 characters, is labelled and uses the given placeholder', () => {
    const input = mountFilters({ searchPlaceholder: 'Folio o nombre del cliente' }).get('input[type="search"]')
    expect(input.attributes('maxlength')).toBe('100')
    expect(input.attributes('placeholder')).toBe('Folio o nombre del cliente')
    expect(input.attributes('id')).toBeTruthy()
  })

  it('typing emits update:search with the typed text (the view debounces it)', async () => {
    const wrapper = mountFilters()
    await wrapper.get('input[type="search"]').setValue('Ana')
    expect(wrapper.emitted('update:search')).toEqual([['Ana']])
  })

  it('follows the search of the URL (e.g. «Quitar filtros»)', async () => {
    const wrapper = mountFilters({ search: 'Ana' })
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('Ana')
    await wrapper.setProps({ search: '' })
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('')
  })

  it('lists the subtypes (no Descuento) and emits the chosen one, or null for «Todos»', async () => {
    const wrapper = mountFilters()
    const select = wrapper.get('select')
    const labels = select.findAll('option').map((o) => o.text())
    expect(labels[0]).toBe('Tipo · Todos')
    expect(labels).toContain('Reposición')
    expect(labels).toContain('Zona de entrega')
    expect(labels).not.toContain('Descuento')
    await select.setValue('RESTOCK')
    expect(wrapper.emitted('update:subtype')).toEqual([['RESTOCK']])
    await select.setValue('')
    expect(wrapper.emitted('update:subtype')![1]).toEqual([null])
  })

  it('shows the selected subtype', () => {
    expect((mountFilters({ subtype: 'COMPLAINT' }).get('select').element as HTMLSelectElement).value).toBe('COMPLAINT')
  })
})

describe('RequestsListFilters — history tab', () => {
  it('only offers the subtype: the history has no search and no chips', () => {
    const wrapper = mountFilters({ tab: 'history' })
    expect(wrapper.find('input[type="search"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="chip-mine"]').exists()).toBe(false)
    expect(wrapper.find('select').exists()).toBe(true)
  })
})
