import type { InjectionKey } from 'vue'

/**
 * Provided by AppDataTable to the headers it renders. Inside them the header itself is the control
 * (focus, click, Enter/Space, the ⋯ menu), so `SortableHeader` renders a plain label and only tells
 * the table that its column sorts. Returns the function that withdraws the registration.
 */
export interface DataTableHeaderContext {
  registerSortable: (id: string) => () => void
}

export const DATA_TABLE_HEADER: InjectionKey<DataTableHeaderContext> = Symbol('DataTableHeader')
