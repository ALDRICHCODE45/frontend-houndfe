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
const subtypeSelect = (w: ReturnType<typeof mountFilters>) => w.getComponent({ name: 'Select' })
// Reka mirrors a select into an `aria-hidden`, `tabindex=-1` native <select> (form mirror); it is not a control.
const VISIBLE_SELECT = 'select:not([aria-hidden="true"])'
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
  it('shows the four toggle chips with their counts', () => {
    const wrapper = mountFilters()
    expect(chip(wrapper, 'mine').text().replace(/\s+/g, ' ')).toBe('Mías 2')
    expect(chip(wrapper, 'unassigned').text().replace(/\s+/g, ' ')).toBe('Sin responsable 4')
    expect(chip(wrapper, 'overdue').text().replace(/\s+/g, ' ')).toBe('Vencidas 1')
    expect(chip(wrapper, 'windowClosingSoon').text().replace(/\s+/g, ' ')).toBe('Ventana por cerrar 3')
  })

  it('Sin responsable has no number when the backend sends no counts.unassigned', () => {
    const wrapper = mountFilters({ counts: { ...countsFixture, unassigned: undefined } })
    expect(chip(wrapper, 'unassigned').text()).toBe('Sin responsable')
    expect(chip(wrapper, 'mine').text().replace(/\s+/g, ' ')).toBe('Mías 2')
  })

  it('a zero unassigned count is shown, it is not «absent»', () => {
    const wrapper = mountFilters({ counts: { ...countsFixture, unassigned: 0 } })
    expect(chip(wrapper, 'unassigned').text().replace(/\s+/g, ' ')).toBe('Sin responsable 0')
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
    const select = subtypeSelect(wrapper)
    const items = select.props('items') as Array<{ label: string; value: string }>
    const labels = items.map((o) => o.label)
    expect(labels[0]).toBe('Tipo · Todos')
    expect(labels).toContain('Reposición')
    expect(labels).toContain('Zona de entrega')
    expect(labels).not.toContain('Descuento')
    expect(items.map((o) => o.value)).not.toContain('DISCOUNT')
    select.vm.$emit('update:modelValue', 'RESTOCK')
    expect(wrapper.emitted('update:subtype')).toEqual([['RESTOCK']])
    select.vm.$emit('update:modelValue', items[0]!.value)
    expect(wrapper.emitted('update:subtype')![1]).toEqual([null])
  })

  it('uses the system select, not a native one, and keeps its accessible label', () => {
    const wrapper = mountFilters()
    expect(wrapper.find(VISIBLE_SELECT).exists()).toBe(false)
    const trigger = wrapper.get('[role="combobox"]')
    const label = wrapper.get('.chatbot-subtype label.sr-only')
    expect(label.text()).toBe('Tipo de solicitud')
    expect(label.attributes('for')).toBe(trigger.attributes('id'))
  })

  it('shows the selected subtype, or «Tipo · Todos» with none', () => {
    expect(subtypeSelect(mountFilters({ subtype: 'COMPLAINT' })).props('modelValue')).toBe('COMPLAINT')
    expect(mountFilters({ subtype: 'COMPLAINT' }).get('[role="combobox"]').text()).toBe('Queja')
    expect(mountFilters().get('[role="combobox"]').text()).toBe('Tipo · Todos')
  })
})

describe('RequestsListFilters — history tab', () => {
  it('only offers the subtype: the history has no search and no chips', () => {
    const wrapper = mountFilters({ tab: 'history' })
    expect(wrapper.find('input[type="search"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="chip-mine"]').exists()).toBe(false)
    expect(wrapper.find('[role="combobox"]').exists()).toBe(true)
    expect(wrapper.find(VISIBLE_SELECT).exists()).toBe(false)
  })
})
