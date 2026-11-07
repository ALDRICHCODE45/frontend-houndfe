/**
 * Premium tables T8 (S6): the saved-views bar above a table — a tablist of views (a «Vista: …»
 * select below md), «Cambios sin guardar», «Restablecer», «Guardar vista» (into the view or as a new
 * named one), rename and delete for the user's views, and the announcements.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import type { SortingState } from '@tanstack/vue-table'
import DataTableViews from '../DataTableViews.vue'
import { useTablePreferences } from '../../../composables/useTablePreferences'
import { useTableViews } from '../../../composables/useTableViews'

const isMobile = ref(false)
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isMobile }) }
})

const confirmMock = vi.fn(async (_options: unknown) => true)
vi.mock('../../../composables/useConfirm', () => ({ useConfirm: () => ({ confirm: confirmMock }) }))

type MenuItem = { label: string; disabled?: boolean; color?: string; onSelect?: (event: Event) => void }

const MenuProbe = defineComponent({
  name: 'MenuProbe',
  props: ['items', 'content', 'ui', 'modal'],
  template: '<div data-testid="menu-probe"><slot /></div>',
})
const ModalProbe = defineComponent({
  name: 'ModalProbe',
  props: ['open', 'title', 'description', 'ui'],
  emits: ['update:open'],
  template: `<div v-if="open" role="dialog" data-testid="modal-probe" :data-title="title">
    <slot name="body" /><slot name="footer" />
  </div>`,
})
const SelectProbe = defineComponent({
  name: 'SelectProbe',
  props: ['modelValue', 'items', 'ui'],
  emits: ['update:modelValue'],
  template: '<div data-testid="select-probe" :data-value="modelValue"><slot name="leading" /></div>',
})

function setupViews() {
  const prefs = useTablePreferences({ persistKey: 'sales' })
  const sorting = ref<SortingState>([{ id: 'date', desc: true }])
  const views = useTableViews({
    persistKey: 'sales',
    columnIds: ['folio', 'customer', 'debt', 'date'],
    builtIns: [
      { id: 'all', name: 'Todas' },
      { id: 'debt', name: 'Cobranza', layout: { pinning: { left: ['customer'], right: [] } } },
      { id: 'pending', name: 'Entregas', layout: { order: ['date'] } },
    ],
    defaults: { sorting: [{ id: 'date', desc: true }] },
    layout: {
      order: prefs.columnOrder,
      pinning: prefs.columnPinning,
      sizing: prefs.columnSizing,
      visibility: prefs.columnVisibility,
      density: prefs.density,
    },
    sorting,
  })
  return { prefs, sorting, views }
}

function mountBar(props: Record<string, unknown> = {}) {
  const ctx = setupViews()
  const wrapper = mount(DataTableViews, {
    props: { views: ctx.views, ...props },
    attachTo: document.body,
    global: {
      stubs: {
        UDropdownMenu: MenuProbe,
        DropdownMenu: MenuProbe,
        UModal: ModalProbe,
        Modal: ModalProbe,
        USelect: SelectProbe,
        Select: SelectProbe,
      },
    },
  })
  return { ...ctx, wrapper }
}

type Wrapper = ReturnType<typeof mountBar>['wrapper']
const tabs = (wrapper: Wrapper) => wrapper.findAll('[role="tab"]')
const tab = (wrapper: Wrapper, id: string) => wrapper.get(`[data-testid="table-views-tab-${id}"]`)
const announced = (wrapper: Wrapper) => wrapper.get('[data-testid="table-views-announcer"]').text()
const menuItems = (wrapper: Wrapper, testid: string): MenuItem[] => {
  const probe = wrapper.findAllComponents(MenuProbe).find(menu => menu.find(`[data-testid="${testid}"]`).exists())
  return ((probe?.props('items') ?? []) as MenuItem[][]).flat()
}
const item = (wrapper: Wrapper, testid: string, label: string) => {
  const found = menuItems(wrapper, testid).find(entry => entry.label === label)
  if (!found) throw new Error(`No menu item «${label}» in ${testid}`)
  return found
}

beforeEach(() => {
  localStorage.clear()
  isMobile.value = false
  confirmMock.mockClear()
  confirmMock.mockResolvedValue(true)
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('DataTableViews — tablist', () => {
  it('renders one tab per view in a labelled tablist, the active one selected and focusable', () => {
    const { wrapper } = mountBar({ controls: 'sales-panel', tabIdPrefix: 'sales-views' })
    const list = wrapper.get('[role="tablist"]')
    expect(list.attributes('aria-label')).toBe('Vistas guardadas')
    expect(tabs(wrapper).map(t => t.text())).toEqual(['Todas', 'Cobranza', 'Entregas'])
    expect(tabs(wrapper).map(t => t.attributes('aria-selected'))).toEqual(['true', 'false', 'false'])
    expect(tabs(wrapper).map(t => t.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
    expect(tab(wrapper, 'all').attributes('id')).toBe('sales-views-tab-all')
    expect(tab(wrapper, 'all').attributes('aria-controls')).toBe('sales-panel')
  })

  it('shows the counts of each view beside its name', () => {
    const { wrapper } = mountBar({ counts: { all: 50, debt: '3', pending: undefined } })
    expect(tab(wrapper, 'all').find('.hf-views__count').text()).toBe('50')
    expect(tab(wrapper, 'debt').find('.hf-views__count').text()).toBe('3')
    expect(tab(wrapper, 'pending').find('.hf-views__count').exists()).toBe(false)
  })

  it('switches the view on click and announces it', async () => {
    const { wrapper, views, prefs } = mountBar()
    await tab(wrapper, 'debt').trigger('click')
    expect(views.activeId.value).toBe('debt')
    expect(prefs.columnPinning.value.left).toEqual(['customer'])
    expect(tab(wrapper, 'debt').attributes('aria-selected')).toBe('true')
    expect(announced(wrapper)).toBe('Vista Cobranza')
  })

  it('moves with the arrows, Home and End (roving tabindex), selecting and focusing the tab', async () => {
    const { wrapper, views } = mountBar()
    const list = wrapper.get('[role="tablist"]')
    ;(tab(wrapper, 'all').element as HTMLElement).focus()

    await list.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(views.activeId.value).toBe('debt')
    expect(document.activeElement).toBe(tab(wrapper, 'debt').element)
    expect(tab(wrapper, 'debt').attributes('tabindex')).toBe('0')
    expect(tab(wrapper, 'all').attributes('tabindex')).toBe('-1')

    await list.trigger('keydown', { key: 'End' })
    await nextTick()
    expect(views.activeId.value).toBe('pending')
    await list.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(views.activeId.value).toBe('all')
    await list.trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    expect(views.activeId.value).toBe('pending')
    await list.trigger('keydown', { key: 'Home' })
    await nextTick()
    expect(views.activeId.value).toBe('all')
    expect(document.activeElement).toBe(tab(wrapper, 'all').element)
  })
})

describe('DataTableViews — unsaved changes and Restablecer', () => {
  it('shows «Cambios sin guardar» with a dot on the tab and accessible text, and enables Restablecer', async () => {
    const { wrapper, prefs } = mountBar()
    expect(wrapper.find('[data-testid="table-views-unsaved"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="table-views-reset"]').attributes('disabled')).toBeDefined()

    prefs.columnSizing.value = { customer: 300 }
    await nextTick()

    expect(wrapper.get('[data-testid="table-views-unsaved"]').text()).toContain('Cambios sin guardar')
    expect(tab(wrapper, 'all').find('.hf-views__dot').exists()).toBe(true)
    expect(tab(wrapper, 'all').text()).toContain('(cambios sin guardar)')
    expect(wrapper.get('[data-testid="table-views-reset"]').attributes('disabled')).toBeUndefined()
  })

  it('announces a dirty view when switching back to it', async () => {
    const { wrapper, prefs } = mountBar()
    prefs.columnSizing.value = { customer: 300 }
    await tab(wrapper, 'debt').trigger('click')
    await tab(wrapper, 'all').trigger('click')
    expect(announced(wrapper)).toBe('Vista Todas, con cambios sin guardar')
  })

  it('«Restablecer» discards the changes and says so', async () => {
    const { wrapper, prefs } = mountBar()
    prefs.columnSizing.value = { customer: 300 }
    await nextTick()
    await wrapper.get('[data-testid="table-views-reset"]').trigger('click')
    expect(prefs.columnSizing.value).toEqual({})
    expect(announced(wrapper)).toBe('Cambios descartados. Vista Todas como estaba guardada')
  })
})

describe('DataTableViews — Guardar vista', () => {
  it('saves into the active view (disabled while there is nothing to save)', async () => {
    const { wrapper, views, prefs } = mountBar()
    expect(item(wrapper, 'table-views-save', 'Guardar cambios en «Todas»').disabled).toBe(true)

    prefs.columnSizing.value = { customer: 300 }
    await nextTick()
    const save = item(wrapper, 'table-views-save', 'Guardar cambios en «Todas»')
    expect(save.disabled).toBe(false)
    save.onSelect!(new Event('select'))
    await nextTick()

    expect(views.isDirty.value).toBe(false)
    expect(announced(wrapper)).toBe('Vista Todas guardada')
  })

  it('creates a new named view from a dialog, focuses its tab and announces it', async () => {
    const { wrapper, views } = mountBar()
    item(wrapper, 'table-views-save', 'Guardar como nueva vista…').onSelect!(new Event('select'))
    await nextTick()

    const dialog = wrapper.get('[data-testid="modal-probe"]')
    expect(dialog.attributes('data-title')).toBe('Guardar como nueva vista')
    const input = wrapper.get('[data-testid="table-views-name-input"]')
    expect(input.attributes('maxlength')).toBe('40')
    await input.setValue('Mis deudas')
    await wrapper.get('[data-testid="table-views-name-form"]').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal-probe"]').exists()).toBe(false)
    expect(views.activeView.value.name).toBe('Mis deudas')
    expect(tabs(wrapper).map(t => t.text())).toEqual(['Todas', 'Cobranza', 'Entregas', 'Mis deudas'])
    expect(document.activeElement).toBe(tab(wrapper, views.activeId.value).element)
    expect(announced(wrapper)).toBe('Vista Mis deudas creada')
  })

  it('keeps the dialog open with an error linked to the field for an empty or taken name', async () => {
    const { wrapper, views } = mountBar()
    item(wrapper, 'table-views-save', 'Guardar como nueva vista…').onSelect!(new Event('select'))
    await nextTick()

    const input = wrapper.get('[data-testid="table-views-name-input"]')
    await input.setValue('cobranza')
    await wrapper.get('[data-testid="table-views-name-form"]').trigger('submit')

    const error = wrapper.get('[data-testid="table-views-name-error"]')
    expect(error.text()).toBe('Ya existe una vista con ese nombre')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toContain(error.attributes('id'))
    expect(views.views.value).toHaveLength(3)

    await input.setValue('  ')
    await wrapper.get('[data-testid="table-views-name-form"]').trigger('submit')
    expect(wrapper.get('[data-testid="table-views-name-error"]').text()).toBe('Escribe un nombre para la vista')
  })
})

describe('DataTableViews — rename and delete (user views only)', () => {
  it('offers no rename or delete on a built-in view', () => {
    const { wrapper } = mountBar()
    expect(wrapper.find('[data-testid="table-views-options"]').exists()).toBe(false)
  })

  it('renames the active user view through the dialog', async () => {
    const { wrapper, views } = mountBar()
    views.saveAsNew('Mías')
    await nextTick()

    item(wrapper, 'table-views-options', 'Renombrar vista…').onSelect!(new Event('select'))
    await nextTick()
    expect(wrapper.get('[data-testid="modal-probe"]').attributes('data-title')).toBe('Renombrar vista')
    const input = wrapper.get('[data-testid="table-views-name-input"]')
    expect((input.element as HTMLInputElement).value).toBe('Mías')
    await input.setValue('Por cobrar')
    await wrapper.get('[data-testid="table-views-name-form"]').trigger('submit')
    await flushPromises()

    expect(views.activeView.value.name).toBe('Por cobrar')
    expect(announced(wrapper)).toBe('Vista Mías renombrada a Por cobrar')
  })

  it('deletes the active user view after confirming', async () => {
    const { wrapper, views } = mountBar()
    views.saveAsNew('Mías')
    await nextTick()

    item(wrapper, 'table-views-options', 'Eliminar vista…').onSelect!(new Event('select'))
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Eliminar vista', tone: 'danger' }))
    expect(views.views.value).toHaveLength(3)
    expect(views.activeId.value).toBe('all')
    expect(announced(wrapper)).toBe('Vista Mías eliminada')
  })

  it('keeps the view when the confirmation is cancelled', async () => {
    confirmMock.mockResolvedValue(false)
    const { wrapper, views } = mountBar()
    views.saveAsNew('Mías')
    await nextTick()

    item(wrapper, 'table-views-options', 'Eliminar vista…').onSelect!(new Event('select'))
    await flushPromises()
    expect(views.views.value).toHaveLength(4)
  })
})

describe('DataTableViews — mobile', () => {
  it('replaces the tabs with a compact «Vista:» select that switches the view', async () => {
    isMobile.value = true
    const { wrapper, views } = mountBar({ counts: { debt: 3 } })
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)

    const select = wrapper.getComponent(SelectProbe)
    expect(select.text()).toContain('Vista:')
    expect(select.props('modelValue')).toBe('all')
    expect((select.props('items') as { label: string; value: string }[]).map(entry => entry.label)).toEqual([
      'Todas',
      'Cobranza (3)',
      'Entregas',
    ])

    select.vm.$emit('update:modelValue', 'debt')
    await nextTick()
    expect(views.activeId.value).toBe('debt')
    expect(announced(wrapper)).toBe('Vista Cobranza')
  })
})
