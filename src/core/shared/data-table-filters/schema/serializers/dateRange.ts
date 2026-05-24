import { endOfDayUTC } from '@/features/POS/sales/utils/saleDate.utils'
import type { DateRangeFilterDefinition } from '../types'
import { booleanFlagFromQuery, booleanFlagToQuery } from './booleanFlag'

type DateRange = { from?: string, to?: string }

export const dateRangeSerializer = {
  toQuery(value: DateRange, field: DateRangeFilterDefinition, includeNull?: boolean): Record<string, string> {
    const query: Record<string, string> = {}
    if (value.from) query[field.fromParam] = value.from
    if (value.to) query[field.toParam] = endOfDayUTC(value.to)
    if (field.includeNull) Object.assign(query, booleanFlagToQuery(includeNull, field.includeNull.param))
    return query
  },
  fromQuery(query: Record<string, string | string[] | undefined>, field: DateRangeFilterDefinition): { value: DateRange, includeNull: boolean } {
    const pick = (raw: string | string[] | undefined): string | undefined => Array.isArray(raw) ? raw[0] : raw
    return {
      value: {
        from: pick(query[field.fromParam]),
        to: pick(query[field.toParam]),
      },
      includeNull: field.includeNull ? booleanFlagFromQuery(query, field.includeNull.param) : false,
    }
  },
  isEmpty(value: DateRange): boolean {
    return !value.from && !value.to
  },
}
