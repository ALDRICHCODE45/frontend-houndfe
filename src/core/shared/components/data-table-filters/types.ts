export type FilterOption = {
  label: string
  value: string
}

export type FilterKind = 'multi-enum' | 'multi-uuid' | 'multi-async' | 'number-range' | 'date-range'

type BaseFilterDefinition = {
  id: string
  label: string
}

export type MultiEnumFilterDefinition = BaseFilterDefinition & {
  kind: 'multi-enum'
  param: string
  options: FilterOption[]
  placeholder?: string
  max?: number
  includeNull?: {
    param: string
    label: string
  }
}

export type MultiUuidFilterDefinition = BaseFilterDefinition & {
  kind: 'multi-uuid' | 'multi-async'
  param: string
  options: FilterOption[]
  placeholder?: string
  max?: number
  includeNull?: {
    param: string
    label: string
  }
}

export type NumberRangeFilterDefinition = BaseFilterDefinition & {
  kind: 'number-range'
  minParam: string
  maxParam: string
  unit?: string
}

export type DateRangeFilterDefinition = BaseFilterDefinition & {
  kind: 'date-range'
  fromParam: string
  toParam: string
  includeNull?: {
    param: string
    label: string
  }
}

export type FilterDefinition =
  | MultiEnumFilterDefinition
  | MultiUuidFilterDefinition
  | NumberRangeFilterDefinition
  | DateRangeFilterDefinition

export type FilterState = Record<string, unknown>

export type FilterFieldError = {
  filterId: string
  message: string
}
