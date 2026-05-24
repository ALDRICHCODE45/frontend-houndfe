import type { NumericRangeFilterDefinition } from '../types'

type NumericRange = { min?: number, max?: number }

export const numericRangeSerializer = {
  toQuery(value: NumericRange, field: NumericRangeFilterDefinition): Record<string, string> {
    const query: Record<string, string> = {}
    if (typeof value.min === 'number' && Number.isFinite(value.min)) query[field.minParam] = String(value.min)
    if (typeof value.max === 'number' && Number.isFinite(value.max)) query[field.maxParam] = String(value.max)
    return query
  },
  fromQuery(query: Record<string, string | string[] | undefined>, field: NumericRangeFilterDefinition): NumericRange {
    const parse = (raw: string | string[] | undefined): number | undefined => {
      const value = Array.isArray(raw) ? raw[0] : raw
      if (!value) return undefined
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : undefined
    }
    return {
      min: parse(query[field.minParam]),
      max: parse(query[field.maxParam]),
    }
  },
  isEmpty(value: NumericRange): boolean {
    return value.min == null && value.max == null
  },
}
