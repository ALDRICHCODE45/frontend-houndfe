import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import type { SortingState } from '@tanstack/vue-table'
import {
  CUSTOMERS_DEFAULT_SORTING,
  customersBuiltInViews,
  sanitizeCustomersViewQuery,
  startOfLocalMonthIso,
  useCustomersViews,
} from '../useCustomersViews'

const NOW = new Date(2026, 10, 26, 15, 30) // 26 nov 2026, local time

describe('customersBuiltInViews (S3, artboard 01)', () => {
  it('ships Todos · Con deuda vencida · Inactivos +90 días · Mejores clientes · Nuevos este mes', () => {
    const views = customersBuiltInViews({ canReadSales: true, now: NOW })
    expect(views.map((view) => view.name)).toEqual([
      'Todos',
      'Con deuda vencida',
      'Inactivos +90 días',
      'Mejores clientes',
      'Nuevos este mes',
    ])
    const byId = Object.fromEntries(views.map((view) => [view.id, view]))
    expect(byId.todos!.query).toBeUndefined()
    expect(byId['con-deuda-vencida']!.query).toEqual({ filters: { hasOverdue: 'true' } })
    expect(byId['con-deuda-vencida']!.sorting).toEqual([{ id: 'oldestOverdue', desc: false }])
    expect(byId['inactivos-90']!.query).toEqual({ filters: { noPurchaseMoreThanDays: '90' } })
    expect(byId['mejores-clientes']!.sorting).toEqual([{ id: 'totalSold', desc: true }])
    expect(byId['mejores-clientes']!.query).toBeUndefined()
    expect(byId['nuevos-mes']!.query).toEqual({ filters: { createdFrom: new Date(2026, 10, 1).toISOString() } })
    expect(byId['nuevos-mes']!.sorting).toEqual([{ id: 'createdAt', desc: true }])
  })

  it('without read:Sale keeps only the views that need no money: Todos and Nuevos este mes', () => {
    expect(customersBuiltInViews({ canReadSales: false, now: NOW }).map((view) => view.id)).toEqual([
      'todos',
      'nuevos-mes',
    ])
  })

  it('starts the month at local midnight of the 1st', () => {
    expect(startOfLocalMonthIso(NOW)).toBe(new Date(2026, 10, 1, 0, 0, 0, 0).toISOString())
  })
})

describe('sanitizeCustomersViewQuery', () => {
  const normalize = (raw: Record<string, string>) => {
    const { hasOverdue: _dropped, ...rest } = raw
    return rest
  }

  it('keeps string filters through the schema and drops what the schema does not own', () => {
    expect(sanitizeCustomersViewQuery({ filters: { petSpecies: 'DOG', hasOverdue: 'true', bad: 1 } }, normalize)).toEqual({
      filters: { petSpecies: 'DOG' },
    })
  })

  it('reads anything else as no query', () => {
    expect(sanitizeCustomersViewQuery(null, normalize)).toBeUndefined()
    expect(sanitizeCustomersViewQuery({ filters: 'x' }, normalize)).toBeUndefined()
  })
})

describe('useCustomersViews', () => {
  beforeEach(() => localStorage.clear())

  function setup(canReadSales = true) {
    const filters = ref<Record<string, string>>({})
    const sorting = ref<SortingState>([...CUSTOMERS_DEFAULT_SORTING])
    const layout = {
      order: ref<string[]>([]),
      pinning: ref({ left: [] as string[], right: [] as string[] }),
      sizing: ref({}),
      visibility: ref({}),
      density: ref('comfortable' as const),
    }
    const scope = effectScope()
    const views = scope.run(() =>
      useCustomersViews({
        columnIds: ['name', 'openDebt', 'createdAt', 'actions'],
        layout,
        sorting,
        filters,
        canReadSales,
        normalizeFilters: (raw) => raw,
        now: NOW,
      }),
    )!
    return { views, filters, sorting }
  }

  it('applies a view’s filters and sorting, and marks a filter change as unsaved', async () => {
    const { views, filters, sorting } = setup()
    expect(views.activeId.value).toBe('todos')
    expect(sorting.value).toEqual([{ id: 'name', desc: false }])

    views.select('con-deuda-vencida')
    expect(filters.value).toEqual({ hasOverdue: 'true' })
    expect(sorting.value).toEqual([{ id: 'oldestOverdue', desc: false }])
    expect(views.isDirty.value).toBe(false)

    filters.value = { hasOverdue: 'true', petSpecies: 'DOG' }
    expect(views.isDirty.value).toBe(true)

    views.select('todos')
    expect(filters.value).toEqual({})
  })

  it('stores the views under their own key', () => {
    const { views } = setup()
    views.select('mejores-clientes')
    expect(localStorage.getItem('table-views-pos-customers-list')).toContain('"active":"mejores-clientes"')
  })

  it('hides the money views without read:Sale', () => {
    const { views } = setup(false)
    expect(views.views.value.map((view) => view.id)).toEqual(['todos', 'nuevos-mes'])
  })
})
