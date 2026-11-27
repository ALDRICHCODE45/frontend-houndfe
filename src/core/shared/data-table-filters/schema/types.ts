type FilterKind = 'multi-enum' | 'multi-async' | 'multi-text' | 'numeric-range' | 'date-range'

export interface FilterOption {
  label: string
  value: string
  icon?: string
}

interface IncludeNullConfig {
  param: string
  label: string
}

interface BaseFilterDefinition<Kind extends FilterKind, Value> {
  id: string
  kind: Kind
  label: string
  section?: string
  placeholder?: string
  transform?: {
    toBackend?: (value: Value) => Value
    fromBackend?: (value: Value) => Value
  }
}

export interface MultiEnumFilterDefinition extends BaseFilterDefinition<'multi-enum', string[]> {
  param: string
  options: FilterOption[]
  includeNull?: IncludeNullConfig
  max?: number
  searchable?: boolean
  /**
   * The control of the filters sheet. Unset: toggle chips for a few options (`usesToggleChips`),
   * the searchable dropdown otherwise. `'chips'` / `'select'` force one.
   */
  display?: 'chips' | 'select'
  /** `'single'`: one value at most, set by `filter.singleEnum` / `filter.booleanFlag`. */
  selection?: 'single'
}

export interface MultiAsyncFilterDefinition extends BaseFilterDefinition<'multi-async', string[]> {
  param: string
  options: FilterOption[]
  loading?: boolean
  loadingLabel?: string
  includeNull?: IncludeNullConfig
  max?: number
}

export interface MultiTextFilterDefinition extends BaseFilterDefinition<'multi-text', string[]> {
  param: string
  max?: number
  parse?: { stripPrefix?: string }
}

export interface NumericRangeFilterDefinition extends BaseFilterDefinition<'numeric-range', { min?: number, max?: number }> {
  minParam: string
  maxParam: string
  /** Shown before «mín» / «máx» (`'$'` → «$ mín»); `''` for counts. `filter.numericRange` fills it. */
  unit?: '$' | string
  step?: number
  formatAs?: 'currency' | 'plain'
}

export interface DateRangeFilterDefinition extends BaseFilterDefinition<'date-range', { from?: string, to?: string }> {
  fromParam: string
  toParam: string
  includeNull?: IncludeNullConfig
  presets?: boolean
}

export type FilterDefinition =
  | MultiEnumFilterDefinition
  | MultiAsyncFilterDefinition
  | MultiTextFilterDefinition
  | NumericRangeFilterDefinition
  | DateRangeFilterDefinition

export type FilterState = Record<string, unknown>

export interface ActiveFilterChip {
  filterId: string
  label: string
  displayValue: string
}

export interface FiltersSchema {
  fields: FilterDefinition[]
  byId: Record<string, FilterDefinition>
  defaults(): FilterState
  serialize(state: FilterState): Record<string, string>
  deserialize(query: Record<string, string | string[] | undefined>): FilterState
  canonicalize(state: FilterState): string
  resolveLabel(filterId: string, value: string): string
  isActive(filterId: string, state: FilterState): boolean
  activeChips(state: FilterState): ActiveFilterChip[]
}
