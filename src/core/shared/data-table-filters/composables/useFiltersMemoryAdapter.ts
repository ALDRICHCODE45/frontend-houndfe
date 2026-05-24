import { ref, watch } from 'vue'
import type { FiltersSchema, FilterState } from '../schema/types'
import type { FiltersAdapter } from './adapterTypes'

export function useFiltersMemoryAdapter(schema: FiltersSchema, initial: Partial<FilterState> = {}): FiltersAdapter {
  const state = ref<FilterState>({ ...schema.defaults(), ...initial })
  return {
    read() {
      return { ...state.value }
    },
    write(nextState) {
      state.value = { ...nextState }
    },
    watch(cb) {
      const stop = watch(state, value => cb({ ...value }), { deep: true })
      return () => stop()
    },
  }
}
