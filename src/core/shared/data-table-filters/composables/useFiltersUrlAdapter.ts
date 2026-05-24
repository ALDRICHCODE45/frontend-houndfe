import { getCurrentInstance, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FiltersSchema, FilterDefinition, FilterState } from '../schema/types'
import type { FiltersAdapter } from './adapterTypes'

function ownedParams(fields: FilterDefinition[]): Set<string> {
  const keys = new Set<string>()
  for (const field of fields) {
    if (field.kind === 'multi-enum' || field.kind === 'multi-async' || field.kind === 'multi-text') keys.add(field.param)
    if (field.kind === 'numeric-range') {
      keys.add(field.minParam)
      keys.add(field.maxParam)
    }
    if (field.kind === 'date-range') {
      keys.add(field.fromParam)
      keys.add(field.toParam)
    }
    if ('includeNull' in field && field.includeNull) keys.add(field.includeNull.param)
  }
  return keys
}

export function useFiltersUrlAdapter(schema: FiltersSchema, options?: { namespace?: string }): FiltersAdapter {
  const ns = options?.namespace
  const prefix = (key: string) => ns ? `${ns}_${key}` : key
  const unprefix = (key: string) => ns ? key.replace(`${ns}_`, '') : key
  const owned = new Set(Array.from(ownedParams(schema.fields), prefix))
  let lastWrittenCanonical = ''
  const internalState: FilterState = schema.defaults()

  if (!getCurrentInstance()) {
    return {
      read: () => ({ ...internalState }),
      write: (state) => Object.assign(internalState, state),
      watch: () => () => {},
    }
  }

  let route
  let router
  try {
    route = useRoute()
    router = useRouter()
  }
  catch {
    return {
      read: () => ({ ...internalState }),
      write: (state) => Object.assign(internalState, state),
      watch: () => () => {},
    }
  }

  return {
    read() {
      const query = Object.fromEntries(Object.entries(route.query).map(([k, v]) => [unprefix(k), v as string | string[] | undefined]))
      return schema.deserialize(query)
    },
    write(state) {
      const serialized = schema.serialize(state)
      const preserved = Object.fromEntries(Object.entries(route.query).filter(([key]) => !owned.has(key)))
      const next = Object.fromEntries(Object.entries(serialized).map(([k, v]) => [prefix(k), v]))
      lastWrittenCanonical = schema.canonicalize(state)
      router.replace({ query: { ...preserved, ...next } })
    },
    watch(cb) {
      const stop = watch(() => route.query, () => {
        const nextState = this.read()
        const canonical = schema.canonicalize(nextState)
        if (canonical === lastWrittenCanonical) return
        cb(nextState)
      }, { deep: true })
      return () => stop()
    },
  }
}
