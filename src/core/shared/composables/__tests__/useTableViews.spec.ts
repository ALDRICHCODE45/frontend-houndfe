// Premium tables T8 (S6): saved views per table — personal, stored in the browser, with built-ins
// from the screen, «Guardar vista», «Guardar como nueva vista…», rename, delete and «Restablecer».
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import type { SortingState } from '@tanstack/vue-table'
import { useTablePreferences } from '../useTablePreferences'
import { TABLE_VIEW_NAME_MAX, useTableViews, type TableViewDefinition } from '../useTableViews'

type Query = { status: 'all' | 'debt' | 'pending' }

const KEY = 'table-views-sales'
const IDS = ['folio', 'customer', 'status', 'total', 'debt', 'date'] as const
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null')

const BUILT_INS: TableViewDefinition<Query>[] = [
  { id: 'all', name: 'Todas' },
  {
    id: 'debt',
    name: 'Cobranza',
    layout: {
      order: ['folio', 'customer', 'debt', 'status', 'total', 'date'],
      pinning: { left: ['customer', 'debt'], right: [] },
    },
    sorting: [{ id: 'date', desc: false }],
    query: { status: 'debt' },
  },
  { id: 'pending', name: 'Entregas', layout: { order: ['status', 'date'] }, query: { status: 'pending' } },
]

function setup(options: { ids?: readonly string[] } = {}) {
  const prefs = useTablePreferences({ persistKey: 'sales', defaultVisibility: { date: true, total: true } })
  const sorting = ref<SortingState>([{ id: 'date', desc: true }])
  const query = ref<Query>({ status: 'all' })
  const views = useTableViews<Query>({
    persistKey: 'sales',
    builtIns: BUILT_INS,
    columnIds: options.ids ?? IDS,
    defaults: {
      layout: { visibility: { date: true, total: true } },
      sorting: [{ id: 'date', desc: true }],
      query: { status: 'all' },
    },
    layout: {
      order: prefs.columnOrder,
      pinning: prefs.columnPinning,
      sizing: prefs.columnSizing,
      visibility: prefs.columnVisibility,
      density: prefs.density,
    },
    sorting,
    query,
    sanitizeQuery: raw =>
      raw && typeof raw === 'object' && ['all', 'debt', 'pending'].includes((raw as Query).status)
        ? { status: (raw as Query).status }
        : undefined,
  })
  return { prefs, sorting, query, views }
}

beforeEach(() => localStorage.clear())

describe('useTableViews — built-in views', () => {
  it('lists the built-ins in order, the first active and clean', () => {
    const { views } = setup()
    expect(views.views.value.map(view => [view.id, view.name, view.builtIn])).toEqual([
      ['all', 'Todas', true],
      ['debt', 'Cobranza', true],
      ['pending', 'Entregas', true],
    ])
    expect(views.activeId.value).toBe('all')
    expect(views.isDirty.value).toBe(false)
    expect(views.canReset.value).toBe(false)
  })

  it('applies the layout, sorting and query of the view it switches to', () => {
    const { views, prefs, sorting, query } = setup()
    expect(views.select('debt')).toBe(true)

    expect(views.activeId.value).toBe('debt')
    expect(prefs.columnOrder.value).toEqual(['folio', 'customer', 'debt', 'status', 'total', 'date'])
    expect(prefs.columnPinning.value).toEqual({ left: ['customer', 'debt'], right: [] })
    expect(sorting.value).toEqual([{ id: 'date', desc: false }])
    expect(query.value).toEqual({ status: 'debt' })
    expect(views.isDirty.value).toBe(false)
  })

  it('fills what a built-in leaves out from the defaults (Todas = the default layout)', () => {
    const { views, prefs, sorting, query } = setup()
    views.select('debt')
    views.select('all')

    expect(prefs.columnPinning.value).toEqual({ left: [], right: [] })
    expect(prefs.columnVisibility.value).toEqual({ date: true, total: true })
    expect(sorting.value).toEqual([{ id: 'date', desc: true }])
    expect(query.value).toEqual({ status: 'all' })
  })

  it('cannot rename or delete a built-in', () => {
    const { views } = setup()
    expect(views.rename('debt', 'Deudas')).toEqual({ ok: false, error: 'Las vistas incluidas no se pueden renombrar' })
    expect(views.remove('debt')).toBe(false)
    expect(views.views.value).toHaveLength(3)
  })
})

describe('useTableViews — unsaved changes', () => {
  it('marks the active view dirty when the layout, the sorting or the query change', async () => {
    const { views, prefs, sorting, query } = setup()
    prefs.columnSizing.value = { customer: 300 }
    expect(views.isDirty.value).toBe(true)
    expect(views.views.value[0]!.dirty).toBe(true)

    prefs.columnSizing.value = {}
    expect(views.isDirty.value).toBe(false)

    sorting.value = [{ id: 'total', desc: false }]
    expect(views.isDirty.value).toBe(true)
    sorting.value = [{ id: 'date', desc: true }]

    query.value = { status: 'pending' }
    expect(views.isDirty.value).toBe(true)
    query.value = { status: 'all' }

    prefs.density.value = 'compact'
    expect(views.isDirty.value).toBe(true)
    await nextTick()
  })

  it('ignores what does not change the table: a full order equal to the natural one, visible = absent', () => {
    const { views, prefs } = setup()
    prefs.columnOrder.value = [...IDS]
    prefs.columnVisibility.value = { date: true, total: true, folio: true }
    expect(views.isDirty.value).toBe(false)
  })

  it('keeps the unsaved changes of a view while another one is shown', () => {
    const { views, prefs } = setup()
    prefs.columnSizing.value = { customer: 320 }
    views.select('debt')
    expect(prefs.columnSizing.value).toEqual({})
    expect(views.views.value.find(view => view.id === 'all')!.dirty).toBe(true)

    views.select('all')
    expect(prefs.columnSizing.value).toEqual({ customer: 320 })
    expect(views.isDirty.value).toBe(true)
  })

  it('«Restablecer» discards the unsaved changes', () => {
    const { views, prefs, sorting } = setup()
    views.select('debt')
    prefs.columnPinning.value = { left: [], right: [] }
    sorting.value = [{ id: 'total', desc: true }]
    expect(views.canReset.value).toBe(true)

    views.reset()
    expect(prefs.columnPinning.value).toEqual({ left: ['customer', 'debt'], right: [] })
    expect(sorting.value).toEqual([{ id: 'date', desc: false }])
    expect(views.isDirty.value).toBe(false)
    expect(views.canReset.value).toBe(false)
  })
})

describe('useTableViews — saving', () => {
  it('«Guardar vista» saves the changes into a built-in; «Restablecer» returns it to its definition', () => {
    const { views, prefs } = setup()
    views.select('debt')
    prefs.columnSizing.value = { customer: 280 }
    views.save()

    expect(views.isDirty.value).toBe(false)
    expect(views.activeView.value.modified).toBe(true)
    expect(views.canReset.value).toBe(true)

    views.select('all')
    views.select('debt')
    expect(prefs.columnSizing.value).toEqual({ customer: 280 })

    views.reset()
    expect(prefs.columnSizing.value).toEqual({})
    expect(views.activeView.value.modified).toBe(false)
    expect(views.canReset.value).toBe(false)
  })

  it('«Guardar como nueva vista» creates a user view from the current state and activates it', () => {
    const { views, prefs } = setup()
    views.select('debt')
    prefs.columnSizing.value = { customer: 280 }

    const result = views.saveAsNew('  Cobranza semanal ')
    expect(result.ok).toBe(true)
    const created = views.views.value[3]!
    expect(created).toMatchObject({ name: 'Cobranza semanal', builtIn: false, dirty: false })
    expect(views.activeId.value).toBe(created.id)
    expect(created.query).toEqual({ status: 'debt' })

    // The changes moved to the new view: Cobranza is back to its definition.
    views.select('debt')
    expect(prefs.columnSizing.value).toEqual({})
    expect(views.isDirty.value).toBe(false)
  })

  it('validates names: required, at most 40 characters, unique ignoring case', () => {
    const { views } = setup()
    expect(TABLE_VIEW_NAME_MAX).toBe(40)
    expect(views.validateName('   ')).toBe('Escribe un nombre para la vista')
    expect(views.validateName('x'.repeat(41))).toBe('Usa 40 caracteres o menos')
    expect(views.validateName(' cobranza ')).toBe('Ya existe una vista con ese nombre')
    expect(views.validateName('x'.repeat(40))).toBeNull()
    expect(views.saveAsNew('TODAS')).toEqual({ ok: false, error: 'Ya existe una vista con ese nombre' })
    expect(views.views.value).toHaveLength(3)
  })

  it('renames a user view (its own name is not a clash) and rejects a taken name', () => {
    const { views } = setup()
    views.saveAsNew('Mías')
    const id = views.activeId.value
    expect(views.rename(id, 'mías')).toEqual({ ok: true, id })
    expect(views.rename(id, 'Entregas')).toEqual({ ok: false, error: 'Ya existe una vista con ese nombre' })
    expect(views.rename(id, 'Por cobrar hoy')).toEqual({ ok: true, id })
    expect(views.activeView.value.name).toBe('Por cobrar hoy')
  })

  it('deletes a user view and falls back to the first built-in', () => {
    const { views, prefs } = setup()
    views.select('debt')
    views.saveAsNew('Mías')
    const id = views.activeId.value

    expect(views.remove(id)).toBe(true)
    expect(views.views.value.map(view => view.id)).toEqual(['all', 'debt', 'pending'])
    expect(views.activeId.value).toBe('all')
    expect(prefs.columnPinning.value).toEqual({ left: [], right: [] })
  })
})

describe('useTableViews — persistence', () => {
  it('stores the views, the active one and the drafts per table under table-views-<persistKey>', () => {
    const { views, prefs } = setup()
    views.select('debt')
    views.saveAsNew('Mías')
    prefs.density.value = 'compact'

    const data = stored()
    expect(data.version).toBe(1)
    expect(data.active).toBe(views.activeId.value)
    expect(data.views).toEqual([
      expect.objectContaining({ id: views.activeId.value, name: 'Mías' }),
    ])
    expect(data.drafts[views.activeId.value].layout.density).toBe('compact')
  })

  it('reopens on the active view with its sorting and query, and its unsaved changes', () => {
    const first = setup()
    first.views.select('debt')
    first.sorting.value = [{ id: 'total', desc: true }]

    const second = setup()
    expect(second.views.activeId.value).toBe('debt')
    expect(second.query.value).toEqual({ status: 'debt' })
    expect(second.sorting.value).toEqual([{ id: 'total', desc: true }])
    expect(second.views.isDirty.value).toBe(true)
  })

  it('reopens with the saved user views', () => {
    const first = setup()
    first.views.saveAsNew('Mías')
    const second = setup()
    expect(second.views.views.value.map(view => view.name)).toEqual(['Todas', 'Cobranza', 'Entregas', 'Mías'])
    expect(second.views.activeView.value.name).toBe('Mías')
  })

  it('sanitizes stored views against the current columns and drops unreadable entries', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        active: 'gone',
        views: [
          {
            id: 'u1',
            name: 'Vieja',
            state: {
              layout: { order: ['removed', 'total'], pinning: { left: ['removed', 'customer'], right: [] }, sizing: { removed: 90 } },
              sorting: [{ id: 'total', desc: true }, { nope: 1 }],
              query: { status: 'weird' },
            },
          },
          { id: 'all', name: 'Clash with a built-in id', state: {} },
          { id: 'u2', name: 'vieja', state: {} },
          { id: 'u3', name: '', state: {} },
          'garbage',
        ],
        drafts: { u1: 'nope' },
      }),
    )
    const { views } = setup()
    expect(views.views.value.map(view => view.id)).toEqual(['all', 'debt', 'pending', 'u1'])
    expect(views.activeId.value).toBe('all')

    const state = views.stateOf('u1')!
    expect(state.layout.order).toEqual(['total', 'folio', 'customer', 'status', 'debt', 'date'])
    expect(state.layout.pinning).toEqual({ left: ['customer'], right: [] })
    expect(state.layout.sizing).toEqual({})
    expect(state.sorting).toEqual([{ id: 'total', desc: true }])
    expect(state.query).toEqual({ status: 'all' })
  })

  it('starts fresh when the stored data has another version or is not JSON', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 99, active: 'debt', views: [] }))
    expect(setup().views.activeId.value).toBe('all')
    localStorage.setItem(KEY, '{not json')
    expect(setup().views.activeId.value).toBe('all')
  })
})
