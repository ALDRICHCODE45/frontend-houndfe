import { watch, type Ref } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router'
import type { FilterDefinition } from '@/core/shared/components/data-table-filters/types'

type UseTableFiltersUrlSyncOptions = {
  schema: FilterDefinition[]
  namespace?: string
  routerOptional?: boolean
}

const DEBOUNCE_MS = 100

function toQueryValue(value: unknown): string | null {
  if (value == null || value === '') return null
  if (Array.isArray(value)) {
    const clean = value.filter(item => item != null && item !== '').map(String)
    return clean.length > 0 ? clean.join(',') : null
  }

  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null
  return String(value)
}

function fromQueryValue(value: unknown, kind: FilterDefinition['kind']): unknown {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' || raw.length === 0) return undefined

  if (kind === 'multi-enum' || kind === 'multi-uuid' || kind === 'multi-async') {
    return raw.split(',').filter(Boolean)
  }

  if (kind === 'number-range') {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  if (raw === 'true') return true
  if (raw === 'false') return false
  return raw
}

function withNamespace(key: string, namespace?: string): string {
  return namespace ? `${namespace}_${key}` : key
}

export function useTableFiltersUrlSync<TState extends Record<string, unknown>>(
  state: Ref<TState>,
  options: UseTableFiltersUrlSyncOptions,
) {
  const routerOptional = options.routerOptional ?? true

  let router: ReturnType<typeof useRouter> | null = null
  let route: ReturnType<typeof useRoute> | null = null

  try {
    router = useRouter()
    route = useRoute()
  }
  catch {
    if (!routerOptional) {
      throw new Error('Router is required for useTableFiltersUrlSync')
    }
    return
  }

  if (!router || !route) {
    return
  }

  function hydrateFromQuery(query: LocationQuery) {
    const next = { ...state.value }

    for (const field of options.schema) {
      if (field.kind === 'multi-enum' || field.kind === 'multi-uuid' || field.kind === 'multi-async') {
        const param = withNamespace(field.param, options.namespace)
        const parsed = fromQueryValue(query[param], field.kind)
        next[field.param as keyof TState] = (parsed ?? []) as TState[keyof TState]

        if (field.includeNull) {
          const includeNullParam = withNamespace(field.includeNull.param, options.namespace)
          const includeNull = fromQueryValue(query[includeNullParam], field.kind)
          next[field.includeNull.param as keyof TState] = Boolean(includeNull) as TState[keyof TState]
        }
      }

      if (field.kind === 'number-range') {
        const minParam = withNamespace(field.minParam, options.namespace)
        const maxParam = withNamespace(field.maxParam, options.namespace)
        next[field.minParam as keyof TState] = fromQueryValue(query[minParam], field.kind) as TState[keyof TState]
        next[field.maxParam as keyof TState] = fromQueryValue(query[maxParam], field.kind) as TState[keyof TState]
      }

      if (field.kind === 'date-range') {
        const fromParam = withNamespace(field.fromParam, options.namespace)
        const toParam = withNamespace(field.toParam, options.namespace)
        next[field.fromParam as keyof TState] = fromQueryValue(query[fromParam], field.kind) as TState[keyof TState]
        next[field.toParam as keyof TState] = fromQueryValue(query[toParam], field.kind) as TState[keyof TState]

        if (field.includeNull) {
          const includeNullParam = withNamespace(field.includeNull.param, options.namespace)
          const includeNull = fromQueryValue(query[includeNullParam], field.kind)
          next[field.includeNull.param as keyof TState] = Boolean(includeNull) as TState[keyof TState]
        }
      }
    }

    state.value = next
  }

  function buildFilterQuery(): Record<string, string> {
    const query: Record<string, string> = {}

    for (const field of options.schema) {
      if (field.kind === 'multi-enum' || field.kind === 'multi-uuid' || field.kind === 'multi-async') {
        const value = toQueryValue(state.value[field.param])
        if (value) query[withNamespace(field.param, options.namespace)] = value

        if (field.includeNull) {
          const includeNull = toQueryValue(Boolean(state.value[field.includeNull.param]))
          if (includeNull) query[withNamespace(field.includeNull.param, options.namespace)] = includeNull
        }
      }

      if (field.kind === 'number-range') {
        const min = toQueryValue(state.value[field.minParam])
        const max = toQueryValue(state.value[field.maxParam])
        if (min) query[withNamespace(field.minParam, options.namespace)] = min
        if (max) query[withNamespace(field.maxParam, options.namespace)] = max
      }

      if (field.kind === 'date-range') {
        const from = toQueryValue(state.value[field.fromParam])
        const to = toQueryValue(state.value[field.toParam])
        if (from) query[withNamespace(field.fromParam, options.namespace)] = from
        if (to) query[withNamespace(field.toParam, options.namespace)] = to

        if (field.includeNull) {
          const includeNull = toQueryValue(Boolean(state.value[field.includeNull.param]))
          if (includeNull) query[withNamespace(field.includeNull.param, options.namespace)] = includeNull
        }
      }
    }

    return query
  }

  function filterOwnedKeys() {
    const keys = new Set<string>()
    for (const field of options.schema) {
      if (field.kind === 'multi-enum' || field.kind === 'multi-uuid' || field.kind === 'multi-async') {
        keys.add(withNamespace(field.param, options.namespace))
        if (field.includeNull) keys.add(withNamespace(field.includeNull.param, options.namespace))
      }
      if (field.kind === 'number-range') {
        keys.add(withNamespace(field.minParam, options.namespace))
        keys.add(withNamespace(field.maxParam, options.namespace))
      }
      if (field.kind === 'date-range') {
        keys.add(withNamespace(field.fromParam, options.namespace))
        keys.add(withNamespace(field.toParam, options.namespace))
        if (field.includeNull) keys.add(withNamespace(field.includeNull.param, options.namespace))
      }
    }
    return keys
  }

  const ownedKeys = filterOwnedKeys()
  let isApplyingRoute = false
  let timeout: ReturnType<typeof setTimeout> | null = null

  hydrateFromQuery(route.query)

  watch(
    state,
    () => {
      if (isApplyingRoute) return
      if (timeout) clearTimeout(timeout)

      timeout = setTimeout(() => {
        const preserved = Object.fromEntries(
          Object.entries(route.query).filter(([key]) => !ownedKeys.has(key)),
        )

        const nextQuery: LocationQueryRaw = {
          ...preserved,
          ...buildFilterQuery(),
        }

        router?.replace({ query: nextQuery })
      }, DEBOUNCE_MS)
    },
    { deep: true },
  )

  watch(
    () => route?.query,
    query => {
      if (!query) return
      isApplyingRoute = true
      hydrateFromQuery(query)
      isApplyingRoute = false
    },
    { deep: true },
  )
}
