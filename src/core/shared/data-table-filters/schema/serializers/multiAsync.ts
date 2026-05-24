import type { MultiAsyncFilterDefinition } from '../types'
import { booleanFlagFromQuery, booleanFlagToQuery } from './booleanFlag'

function parseCsv(raw: string | string[] | undefined): string[] {
  const list = Array.isArray(raw) ? raw.flatMap(x => x.split(',')) : (raw ? raw.split(',') : [])
  return [...new Set(list.map(item => item.trim()).filter(Boolean))]
}

export const multiAsyncSerializer = {
  toQuery(value: string[], field: MultiAsyncFilterDefinition, includeNull?: boolean): Record<string, string> {
    const query: Record<string, string> = {}
    if (value.length > 0) query[field.param] = value.join(',')
    if (field.includeNull) Object.assign(query, booleanFlagToQuery(includeNull, field.includeNull.param))
    return query
  },
  fromQuery(query: Record<string, string | string[] | undefined>, field: MultiAsyncFilterDefinition): { value: string[], includeNull: boolean } {
    return {
      value: parseCsv(query[field.param]),
      includeNull: field.includeNull ? booleanFlagFromQuery(query, field.includeNull.param) : false,
    }
  },
  isEmpty(value: string[]): boolean {
    return value.length === 0
  },
}
