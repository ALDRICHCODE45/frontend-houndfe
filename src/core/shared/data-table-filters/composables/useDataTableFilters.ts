import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { watchDebounced } from '@vueuse/core'
import type { FiltersAdapter } from './adapterTypes'
import type { ActiveFilterChip, FilterState, FiltersSchema } from '../schema/types'

export function useDataTableFilters(
  schemaInput: MaybeRefOrGetter<FiltersSchema>,
  adapter: FiltersAdapter,
  options?: { debounceMs?: number },
) {
  const debounceMs = options?.debounceMs ?? 250
  const schema = computed(() => toValue(schemaInput))
  const state = ref<FilterState>({ ...schema.value.defaults(), ...adapter.read() })
  let lastWrittenCanonical = schema.value.canonicalize(state.value)

  watchDebounced(state, value => {
    const canonical = schema.value.canonicalize(value)
    if (canonical === lastWrittenCanonical) return
    lastWrittenCanonical = canonical
    adapter.write(value)
  }, { deep: true, debounce: debounceMs })

  const stopAdapterWatch = adapter.watch((next) => {
    const nextMerged = { ...schema.value.defaults(), ...next }
    const nextCanonical = schema.value.canonicalize(nextMerged)
    const currentCanonical = schema.value.canonicalize(state.value)
    if (nextCanonical === currentCanonical) return
    state.value = nextMerged
  })

  watch(schema, next => {
    state.value = { ...next.defaults(), ...state.value }
  })

  function clearAll() {
    const next = schema.value.defaults()
    state.value = next
    lastWrittenCanonical = schema.value.canonicalize(next)
    adapter.write(next)
  }

  function clearFilter(id: string) {
    const field = schema.value.byId[id]
    if (!field) return
    const defaults = schema.value.defaults()
    state.value[id] = defaults[id]
    if ('includeNull' in field && field.includeNull) state.value[field.includeNull.param] = false
  }

  function setFieldValue(id: string, value: unknown) {
    state.value[id] = value
  }

  function setIncludeNullValue(id: string, value: boolean) {
    const field = schema.value.byId[id]
    if (!field || !('includeNull' in field) || !field.includeNull) return
    state.value[field.includeNull.param] = value
  }

  function getValue(id: string) {
    return state.value[id]
  }

  function getIncludeNull(id: string): boolean {
    const field = schema.value.byId[id]
    if (!field || !('includeNull' in field) || !field.includeNull) return false
    return state.value[field.includeNull.param] === true
  }

  const activeChips = computed<ActiveFilterChip[]>(() => schema.value.activeChips(state.value))
  const activeCount = computed(() => schema.value.fields.filter(field => schema.value.isActive(field.id, state.value)).length)
  const serializedState = computed(() => schema.value.canonicalize(state.value))
  const backendParams = computed(() => schema.value.serialize(state.value))

  return {
    state,
    activeChips,
    activeCount,
    serializedState,
    backendParams,
    clearAll,
    clearFilter,
    setFieldValue,
    setIncludeNullValue,
    getValue,
    getIncludeNull,
    stopAdapterWatch,
  }
}
