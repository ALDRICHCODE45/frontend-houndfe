import type {
  DateRangeFilterDefinition,
  FilterOption,
  MultiAsyncFilterDefinition,
  MultiEnumFilterDefinition,
  MultiTextFilterDefinition,
  NumericRangeFilterDefinition,
} from './types'

type SingleEnumConfig = Omit<MultiEnumFilterDefinition, 'kind' | 'param' | 'transform' | 'includeNull' | 'max' | 'selection'>

interface BooleanFlagConfig {
  id: string
  label: string
  section?: string
  placeholder?: string
  /** Label of `true` (default «Sí»). */
  trueLabel?: string
  /** Label of `false` (default «No»). */
  falseLabel?: string
}

/**
 * One value at most, the last one picked, so a multi-enum control behaves like a single choice:
 * picking «No» after «Sí» switches the filter instead of sending both. Values that are not options
 * (a stale or hand-written URL) are dropped.
 */
function lastKnownValue(options: readonly FilterOption[]) {
  const known = new Set(options.map(option => option.value))
  return (values: string[]): string[] => {
    const valid = values.filter(value => known.has(value))
    return valid.length > 0 ? [valid[valid.length - 1]!] : []
  }
}

function singleEnum(config: SingleEnumConfig): MultiEnumFilterDefinition {
  const keepLast = lastKnownValue(config.options)
  // The state key and the param are the same: defaults() keys multi-value state by `param`.
  // `selection: 'single'` makes the filters sheet render single-select chips (a second click clears).
  return {
    ...config,
    kind: 'multi-enum',
    param: config.id,
    selection: 'single',
    transform: { toBackend: keepLast, fromBackend: keepLast },
  }
}

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
  /**
   * `unit` is shown before «mín» / «máx»: it defaults to «$» for money (`formatAs: 'currency'`) and
   * to none otherwise, the way the active-filter chips already format the range.
   */
  numericRange(config: Omit<NumericRangeFilterDefinition, 'kind'>): NumericRangeFilterDefinition {
    const unit = config.unit ?? (config.formatAs === 'currency' ? '$' : '')
    return { ...config, unit, kind: 'numeric-range' }
  },
  dateRange(config: Omit<DateRangeFilterDefinition, 'kind'>): DateRangeFilterDefinition {
    return { ...config, kind: 'date-range' }
  },
  /** A single choice among a few options (30 / 60 / 90 días): one `param=value`, the last picked. */
  singleEnum,
  /**
   * A yes/no filter (`param=true|false`, nothing when unset) on top of the multi-enum kind, so the
   * filters sheet renders it with the existing control. The param is the id.
   */
  booleanFlag(config: BooleanFlagConfig): MultiEnumFilterDefinition {
    const { trueLabel = 'Sí', falseLabel = 'No', ...rest } = config
    return singleEnum({
      ...rest,
      options: [
        { label: trueLabel, value: 'true' },
        { label: falseLabel, value: 'false' },
      ],
    })
  },
}
