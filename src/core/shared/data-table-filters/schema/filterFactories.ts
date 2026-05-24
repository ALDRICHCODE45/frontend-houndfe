import type {
  DateRangeFilterDefinition,
  MultiAsyncFilterDefinition,
  MultiEnumFilterDefinition,
  MultiTextFilterDefinition,
  NumericRangeFilterDefinition,
} from './types'

export const filter = {
  multiEnum(config: Omit<MultiEnumFilterDefinition, 'kind'>): MultiEnumFilterDefinition {
    return { ...config, kind: 'multi-enum' }
  },
  multiAsync(config: Omit<MultiAsyncFilterDefinition, 'kind'>): MultiAsyncFilterDefinition {
    return { ...config, kind: 'multi-async' }
  },
  multiText(config: Omit<MultiTextFilterDefinition, 'kind'>): MultiTextFilterDefinition {
    return { ...config, kind: 'multi-text' }
  },
  numericRange(config: Omit<NumericRangeFilterDefinition, 'kind'>): NumericRangeFilterDefinition {
    return { ...config, kind: 'numeric-range' }
  },
  dateRange(config: Omit<DateRangeFilterDefinition, 'kind'>): DateRangeFilterDefinition {
    return { ...config, kind: 'date-range' }
  },
}
