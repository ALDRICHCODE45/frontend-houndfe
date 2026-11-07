import { computed, ref, toValue, watch, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
} from '@tanstack/vue-table'
import {
  normalizeTableLayout,
  type TableDensity,
  type TableLayout,
  type TableLayoutDefaults,
} from '../components/DataTable/tableLayout'

/**
 * Saved views of one table (premium tables S6): personal, stored in this browser under
 * `table-views-<persistKey>`. A view is a name plus a snapshot of the table's layout and, when the
 * screen hands them over, its sorting and its own query state (a status tab, for example).
 */
export const TABLE_VIEWS_VERSION = 1
export const TABLE_VIEW_NAME_MAX = 40

export type TableViewLayout = Omit<TableLayout, 'version'>

export interface TableViewState<Q> {
  layout: TableViewLayout
  sorting: SortingState
  query: Q | undefined
}

/** A view the screen ships («Todas», «Cobranza»…): it cannot be renamed or deleted. */
export interface TableViewDefinition<Q> {
  id: string
  name: string
  /** What the view changes; the rest comes from `defaults`. */
  layout?: TableLayoutDefaults
  sorting?: SortingState
  query?: Q
}

export interface TableViewItem<Q> {
  id: string
  name: string
  builtIn: boolean
  /** The table differs from what the view saved (shown as «Cambios sin guardar»). */
  dirty: boolean
  /** A built-in whose saved state is no longer its definition. */
  modified: boolean
  /** The saved query state, e.g. to count its rows. */
  query: Q | undefined
}

export type TableViewNameResult = { ok: true; id: string } | { ok: false; error: string }

export interface UseTableViewsOptions<Q> {
  persistKey: string
  /** At least one; the first is the default view. */
  builtIns: readonly TableViewDefinition<Q>[]
  /** The table's column ids: stored views are sanitized against them. */
  columnIds: MaybeRefOrGetter<readonly string[]>
  defaults?: { layout?: TableLayoutDefaults; sorting?: SortingState; query?: Q }
  /** The table's live layout (the refs bound to AppDataTable's layout v-models). */
  layout: {
    order: Ref<ColumnOrderState>
    pinning: Ref<ColumnPinningState>
    sizing: Ref<ColumnSizingState>
    visibility: Ref<VisibilityState>
    density: Ref<TableDensity>
  }
  sorting?: Ref<SortingState>
  query?: Ref<Q>
  /** Reads a stored query back; `undefined` falls back to the default query. */
  sanitizeQuery?: (raw: unknown) => Q | undefined
}

export interface TableViewsController<Q = unknown> {
  views: ComputedRef<TableViewItem<Q>[]>
  activeId: ComputedRef<string>
  activeView: ComputedRef<TableViewItem<Q>>
  isDirty: ComputedRef<boolean>
  /** «Restablecer» has something to do: unsaved changes, or a built-in saved away from its definition. */
  canReset: ComputedRef<boolean>
  select: (id: string) => boolean
  /** Saves the table into the active view. */
  save: () => void
  saveAsNew: (name: string) => TableViewNameResult
  rename: (id: string, name: string) => TableViewNameResult
  remove: (id: string) => boolean
  /** Discards the unsaved changes; a built-in also returns to its definition. */
  reset: () => void
  /** The error for a name, or `null` when it can be used (`exceptId` may keep its own name). */
  validateName: (name: string, exceptId?: string) => string | null
  /** The saved state of a view. */
  stateOf: (id: string) => TableViewState<Q> | undefined
}

interface StoredUserView<Q> {
  id: string
  name: string
  state: TableViewState<Q>
}

interface ViewsStore<Q> {
  version: typeof TABLE_VIEWS_VERSION
  active: string
  views: StoredUserView<Q>[]
  /** Saved states of built-ins that no longer match their definition. */
  builtIns: Record<string, TableViewState<Q>>
  /** Unsaved changes per view, kept while another view is shown and across reloads. */
  drafts: Record<string, TableViewState<Q>>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const clone = <V>(value: V): V => (value === undefined ? value : JSON.parse(JSON.stringify(value)))

/** JSON with sorted object keys, so equal states compare equal whatever their key order. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .filter(key => value[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

function sanitizeSorting(raw: unknown): SortingState | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw
    .filter((entry): entry is { id: string; desc?: unknown } => isRecord(entry) && typeof entry.id === 'string')
    .map(entry => ({ id: entry.id, desc: entry.desc === true }))
}

const normalizeName = (name: string) => name.trim().toLocaleLowerCase('es')

export function useTableViews<Q = unknown>(options: UseTableViewsOptions<Q>): TableViewsController<Q> {
  const storageKey = `table-views-${options.persistKey}`
  const builtIns = options.builtIns
  if (builtIns.length === 0) throw new Error('useTableViews needs at least one built-in view')
  const builtInIds = new Set(builtIns.map(view => view.id))
  const ids = () => {
    const list = toValue(options.columnIds)
    return list.length > 0 ? list : undefined
  }
  const baseLayout = options.defaults?.layout ?? {}
  const baseSorting = options.defaults?.sorting ?? []
  const baseQuery = options.defaults?.query

  function toLayout(raw: unknown, defaults: TableLayoutDefaults = baseLayout): TableViewLayout {
    const { version: _version, ...layout } = normalizeTableLayout(raw, defaults, ids())
    return layout
  }

  function sanitizeState(raw: unknown): TableViewState<Q> {
    const source = isRecord(raw) ? raw : {}
    const query = options.sanitizeQuery
      ? options.sanitizeQuery(source.query)
      : isRecord(source.query) ? (source.query as Q) : undefined
    return {
      layout: toLayout(source.layout),
      sorting: sanitizeSorting(source.sorting) ?? clone(baseSorting),
      query: query === undefined ? clone(baseQuery) : clone(query),
    }
  }

  function definitionState(view: TableViewDefinition<Q>): TableViewState<Q> {
    return {
      layout: toLayout(undefined, { ...baseLayout, ...view.layout }),
      sorting: clone(view.sorting ?? baseSorting),
      query: clone(view.query ?? baseQuery),
    }
  }

  // ── Comparing states: only what changes the table counts ────────────────────
  function canonical(state: TableViewState<Q>): string {
    const columns = ids() ?? [
      ...new Set([...state.layout.order, ...Object.keys(state.layout.visibility)]),
    ]
    const layout = toLayout(state.layout)
    const pinned = new Set([...(layout.pinning.left ?? []), ...(layout.pinning.right ?? [])])
    return stableJson({
      // Pinned columns keep their place in the order without showing it.
      order: layout.order.filter(id => !pinned.has(id)),
      pinning: layout.pinning,
      sizing: layout.sizing,
      // An absent entry is a visible column.
      visibility: columns.map(id => layout.visibility[id] !== false),
      density: layout.density,
      sorting: options.sorting ? state.sorting.map(sort => [sort.id, !!sort.desc]) : null,
      query: options.query ? (state.query ?? null) : null,
    })
  }

  // ── Storage ────────────────────────────────────────────────────────────────
  function readStore(): ViewsStore<Q> {
    let raw: unknown
    if (typeof window !== 'undefined') {
      try {
        const text = localStorage.getItem(storageKey)
        raw = text ? JSON.parse(text) : undefined
      } catch {
        raw = undefined
      }
    }
    const source = isRecord(raw) && raw.version === TABLE_VIEWS_VERSION ? raw : {}

    const views: StoredUserView<Q>[] = []
    const taken = new Set(builtIns.map(view => normalizeName(view.name)))
    for (const entry of Array.isArray(source.views) ? source.views : []) {
      if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.name !== 'string') continue
      const name = entry.name.trim().slice(0, TABLE_VIEW_NAME_MAX)
      if (!entry.id || builtInIds.has(entry.id) || views.some(view => view.id === entry.id)) continue
      if (!name || taken.has(normalizeName(name))) continue
      taken.add(normalizeName(name))
      views.push({ id: entry.id, name, state: sanitizeState(entry.state) })
    }
    const known = (id: string) => builtInIds.has(id) || views.some(view => view.id === id)

    const states = (value: unknown, keep: (id: string) => boolean) => {
      const result: Record<string, TableViewState<Q>> = {}
      if (!isRecord(value)) return result
      for (const [id, state] of Object.entries(value)) {
        if (keep(id) && isRecord(state)) result[id] = sanitizeState(state)
      }
      return result
    }

    const active = typeof source.active === 'string' && known(source.active) ? source.active : builtIns[0]!.id
    return {
      version: TABLE_VIEWS_VERSION,
      active,
      views,
      builtIns: states(source.builtIns, id => builtInIds.has(id)),
      drafts: states(source.drafts, known),
    }
  }

  const store = ref(readStore()) as Ref<ViewsStore<Q>>

  function persist() {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(storageKey, JSON.stringify(store.value))
    } catch {
      // Storage full or unavailable
    }
  }

  // ── Live state of the table ────────────────────────────────────────────────
  function liveState(): TableViewState<Q> {
    return {
      layout: {
        order: clone(options.layout.order.value),
        pinning: clone(options.layout.pinning.value),
        sizing: clone(options.layout.sizing.value),
        visibility: clone(options.layout.visibility.value),
        density: options.layout.density.value,
      },
      sorting: clone(options.sorting?.value ?? baseSorting),
      query: clone(options.query?.value ?? baseQuery),
    }
  }

  function apply(state: TableViewState<Q>, parts: { layout: boolean } = { layout: true }) {
    if (parts.layout) {
      options.layout.order.value = clone(state.layout.order)
      options.layout.pinning.value = clone(state.layout.pinning)
      options.layout.sizing.value = clone(state.layout.sizing)
      options.layout.visibility.value = clone(state.layout.visibility)
      options.layout.density.value = state.layout.density
    }
    if (options.sorting) options.sorting.value = clone(state.sorting)
    if (options.query && state.query !== undefined) options.query.value = clone(state.query)
  }

  function savedState(id: string): TableViewState<Q> | undefined {
    const builtIn = builtIns.find(view => view.id === id)
    if (builtIn) return store.value.builtIns[id] ?? definitionState(builtIn)
    return store.value.views.find(view => view.id === id)?.state
  }

  const liveCanonical = computed(() => canonical(liveState()))
  const savedCanonical = computed(() => {
    const saved = savedState(store.value.active)
    return saved ? canonical(saved) : ''
  })
  const isDirty = computed(() => liveCanonical.value !== savedCanonical.value)

  // The active view's unsaved changes follow the table, so they survive a reload or a switch.
  let applying = false
  function syncDraft() {
    if (applying) return
    const drafts = { ...store.value.drafts }
    if (isDirty.value) drafts[store.value.active] = liveState()
    else delete drafts[store.value.active]
    if (stableJson(drafts) === stableJson(store.value.drafts)) return
    store.value = { ...store.value, drafts }
    persist()
  }
  watch(liveCanonical, syncDraft, { flush: 'sync' })

  function show(state: TableViewState<Q>, parts?: { layout: boolean }) {
    applying = true
    try {
      apply(state, parts)
    } finally {
      applying = false
    }
  }

  // Reopen on the active view: the layout is already the table's own (persisted with it); the
  // sorting and the query are not persisted elsewhere, so they come from the view.
  const opening = store.value.drafts[store.value.active] ?? savedState(store.value.active)
  if (opening) show(opening, { layout: false })

  // ── Views ──────────────────────────────────────────────────────────────────
  const views = computed<TableViewItem<Q>[]>(() => {
    const drafts = store.value.drafts
    const active = store.value.active
    const dirtyOf = (id: string) => (id === active ? isDirty.value : id in drafts)
    return [
      ...builtIns.map(view => ({
        id: view.id,
        name: view.name,
        builtIn: true,
        dirty: dirtyOf(view.id),
        modified:
          view.id in store.value.builtIns &&
          canonical(store.value.builtIns[view.id]!) !== canonical(definitionState(view)),
        query: savedState(view.id)!.query,
      })),
      ...store.value.views.map(view => ({
        id: view.id,
        name: view.name,
        builtIn: false,
        dirty: dirtyOf(view.id),
        modified: false,
        query: view.state.query,
      })),
    ]
  })
  const activeId = computed(() => store.value.active)
  const activeView = computed(() => views.value.find(view => view.id === store.value.active) ?? views.value[0]!)
  const canReset = computed(() => isDirty.value || activeView.value.modified)

  function select(id: string): boolean {
    if (id === store.value.active) return false
    const target = savedState(id)
    if (!target) return false
    syncDraft()
    store.value = { ...store.value, active: id }
    show(store.value.drafts[id] ?? target)
    persist()
    return true
  }

  function save() {
    const id = store.value.active
    const state = liveState()
    const drafts = { ...store.value.drafts }
    delete drafts[id]
    const builtIn = builtIns.find(view => view.id === id)
    if (builtIn) {
      const saved = { ...store.value.builtIns }
      if (canonical(state) === canonical(definitionState(builtIn))) delete saved[id]
      else saved[id] = state
      store.value = { ...store.value, builtIns: saved, drafts }
    } else {
      store.value = {
        ...store.value,
        drafts,
        views: store.value.views.map(view => (view.id === id ? { ...view, state } : view)),
      }
    }
    persist()
  }

  function validateName(name: string, exceptId?: string): string | null {
    const trimmed = name.trim()
    if (!trimmed) return 'Escribe un nombre para la vista'
    if (trimmed.length > TABLE_VIEW_NAME_MAX) return `Usa ${TABLE_VIEW_NAME_MAX} caracteres o menos`
    const key = normalizeName(trimmed)
    const taken = views.value.some(view => view.id !== exceptId && normalizeName(view.name) === key)
    return taken ? 'Ya existe una vista con ese nombre' : null
  }

  function newId() {
    let id: string
    do id = `v-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    while (savedState(id))
    return id
  }

  function saveAsNew(name: string): TableViewNameResult {
    const error = validateName(name)
    if (error) return { ok: false, error }
    const id = newId()
    // The unsaved changes move to the new view: the view they were made on keeps its saved state.
    const drafts = { ...store.value.drafts }
    delete drafts[store.value.active]
    store.value = {
      ...store.value,
      active: id,
      drafts,
      views: [...store.value.views, { id, name: name.trim(), state: liveState() }],
    }
    persist()
    return { ok: true, id }
  }

  function rename(id: string, name: string): TableViewNameResult {
    if (builtInIds.has(id)) return { ok: false, error: 'Las vistas incluidas no se pueden renombrar' }
    if (!store.value.views.some(view => view.id === id)) return { ok: false, error: 'La vista no existe' }
    const error = validateName(name, id)
    if (error) return { ok: false, error }
    store.value = {
      ...store.value,
      views: store.value.views.map(view => (view.id === id ? { ...view, name: name.trim() } : view)),
    }
    persist()
    return { ok: true, id }
  }

  function remove(id: string): boolean {
    if (builtInIds.has(id) || !store.value.views.some(view => view.id === id)) return false
    const wasActive = store.value.active === id
    const drafts = { ...store.value.drafts }
    delete drafts[id]
    const fallback = builtIns[0]!.id
    store.value = {
      ...store.value,
      active: wasActive ? fallback : store.value.active,
      drafts,
      views: store.value.views.filter(view => view.id !== id),
    }
    if (wasActive) show(store.value.drafts[fallback] ?? savedState(fallback)!)
    persist()
    return true
  }

  function reset() {
    const id = store.value.active
    const drafts = { ...store.value.drafts }
    delete drafts[id]
    const saved = { ...store.value.builtIns }
    delete saved[id]
    store.value = { ...store.value, drafts, builtIns: saved }
    show(savedState(id)!)
    persist()
  }

  return {
    views,
    activeId,
    activeView,
    isDirty,
    canReset,
    select,
    save,
    saveAsNew,
    rename,
    remove,
    reset,
    validateName,
    stateOf: id => clone(savedState(id)),
  }
}
