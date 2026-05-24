import { computed, getCurrentInstance, toValue, watch, type MaybeRefOrGetter } from 'vue'
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

export function useFiltersUrlAdapter(schemaInput: MaybeRefOrGetter<FiltersSchema>, options?: { namespace?: string }): FiltersAdapter {
  const schema = computed(() => toValue(schemaInput))
  const ns = options?.namespace
  const prefix = (key: string) => ns ? `${ns}_${key}` : key
  const unprefix = (key: string) => ns ? key.replace(`${ns}_`, '') : key
  let lastWrittenCanonical = ''
  const internalState: FilterState = schema.value.defaults()

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
      return schema.value.deserialize(query)
    },
    write(state) {
      const serialized = schema.value.serialize(state)
      const owned = new Set(Array.from(ownedParams(schema.value.fields), prefix))
      const preserved = Object.fromEntries(Object.entries(route.query).filter(([key]) => !owned.has(key)))
      const next = Object.fromEntries(Object.entries(serialized).map(([k, v]) => [prefix(k), v]))
      lastWrittenCanonical = schema.value.canonicalize(state)
      router.replace({ query: { ...preserved, ...next } })
    },
    watch(cb) {
      const stop = watch(() => route.query, () => {
        const nextState = this.read()
        const canonical = schema.value.canonicalize(nextState)
        if (canonical === lastWrittenCanonical) return
        cb(nextState)
      }, { deep: true })
      return () => stop()
    },
  }
}
