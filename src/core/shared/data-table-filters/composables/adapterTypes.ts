import type { FilterState } from '../schema/types'

export interface FiltersAdapter {
  read(): FilterState
  write(state: FilterState): void
  watch(cb: (state: FilterState) => void): () => void
}
