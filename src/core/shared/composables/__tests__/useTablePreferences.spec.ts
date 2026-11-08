// Premium tables T3: the versioned table layout persisted per persistKey.
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useTablePreferences } from '../useTablePreferences'

const KEY = 'table-preferences-sales'
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null')

beforeEach(() => localStorage.clear())

describe('useTablePreferences — versioned layout', () => {
  it('starts from the defaults with the comfortable density (64px rows)', () => {
    const prefs = useTablePreferences({ persistKey: 'sales' })
    expect(prefs.layout.value).toEqual({
      version: 1,
      order: [],
      pinning: { left: [], right: [] },
      sizing: {},
      visibility: {},
      density: 'comfortable',
    })
  })

  it('persists order, pinning, sizing, visibility and density and reads them back', async () => {
    const first = useTablePreferences({ persistKey: 'sales' })
    first.columnOrder.value = ['total', 'name']
    first.columnPinning.value = { left: ['name'], right: [] }
    first.columnSizing.value = { name: 300 }
    first.columnVisibility.value = { total: false }
    first.density.value = 'compact'
    await nextTick()

    expect(stored()).toEqual({
      version: 1,
      order: ['total', 'name'],
      pinning: { left: ['name'], right: [] },
      sizing: { name: 300 },
      visibility: { total: false },
      density: 'compact',
    })

    const second = useTablePreferences({ persistKey: 'sales' })
    expect(second.layout.value).toEqual(stored())
  })

  it('migrates the old { pinning, visibility } shape', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ pinning: { left: ['name'], right: ['actions'] }, visibility: { sku: false } }),
    )
    const prefs = useTablePreferences({ persistKey: 'sales' })
    expect(prefs.layout.value).toEqual({
      version: 1,
      order: [],
      pinning: { left: ['name'], right: ['actions'] },
      sizing: {},
      visibility: { sku: false },
      density: 'comfortable',
    })
  })

  it('falls back to the defaults on unreadable storage', () => {
    localStorage.setItem(KEY, '{not json')
    const prefs = useTablePreferences({
      persistKey: 'sales',
      defaultPinning: { left: [], right: ['actions'] },
    })
    expect(prefs.columnPinning.value).toEqual({ left: [], right: ['actions'] })
    expect(prefs.density.value).toBe('comfortable')
  })

  it('drops columns that no longer exist and appends new ones', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        order: ['gone', 'total', 'name'],
        pinning: { left: ['gone', 'name'], right: [] },
        sizing: { gone: 200, total: 180 },
        visibility: { gone: false, total: false },
        density: 'normal',
      }),
    )
    const prefs = useTablePreferences({ persistKey: 'sales', columnIds: ['name', 'total', 'date'] })
    expect(prefs.layout.value).toEqual({
      version: 1,
      order: ['total', 'name', 'date'],
      pinning: { left: ['name'], right: [] },
      sizing: { total: 180 },
      visibility: { total: false },
      density: 'normal',
    })

    prefs.reconcile(['name', 'date', 'margin'])
    expect(prefs.columnOrder.value).toEqual(['name', 'date', 'margin'])
    expect(prefs.columnSizing.value).toEqual({})
  })

  it('locks the selection column left and the actions column right in every setter', () => {
    const prefs = useTablePreferences({
      persistKey: 'sales',
      columnIds: ['select', 'name', 'total', 'actions'],
    })
    expect(prefs.columnPinning.value).toEqual({ left: ['select'], right: ['actions'] })

    prefs.columnPinning.value = { left: ['actions', 'name'], right: ['select'] }
    expect(prefs.columnPinning.value).toEqual({ left: ['select', 'name'], right: ['actions'] })

    prefs.columnPinning.value = { left: [], right: [] }
    expect(prefs.columnPinning.value).toEqual({ left: ['select'], right: ['actions'] })

    prefs.columnOrder.value = ['actions', 'total', 'select', 'name']
    expect(prefs.columnOrder.value).toEqual(['select', 'total', 'name', 'actions'])

    prefs.columnSizing.value = { select: 90, actions: 120, name: 260 }
    expect(prefs.columnSizing.value).toEqual({ name: 260 })
  })

  it('accepts the Spanish acciones id as the actions column', () => {
    const prefs = useTablePreferences({ persistKey: 'sales', columnIds: ['name', 'acciones'] })
    prefs.columnPinning.value = { left: ['acciones'], right: [] }
    expect(prefs.columnPinning.value).toEqual({ left: [], right: ['acciones'] })
  })

  it('ignores an unknown density', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, density: 'huge' }))
    expect(useTablePreferences({ persistKey: 'sales' }).density.value).toBe('comfortable')
  })

  it('reset() restores the defaults and forgets the stored layout', async () => {
    const prefs = useTablePreferences({
      persistKey: 'sales',
      defaultPinning: { left: [], right: ['actions'] },
    })
    prefs.columnSizing.value = { name: 300 }
    prefs.density.value = 'compact'
    await nextTick()
    expect(stored()).not.toBeNull()

    prefs.reset()
    await nextTick()
    expect(prefs.layout.value).toEqual({
      version: 1,
      order: [],
      pinning: { left: [], right: ['actions'] },
      sizing: {},
      visibility: {},
      density: 'comfortable',
    })
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('keeps resetPreferences for existing callers', () => {
    const prefs = useTablePreferences({ persistKey: 'sales' })
    expect(prefs.resetPreferences).toBe(prefs.reset)
  })
})
