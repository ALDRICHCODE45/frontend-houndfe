import type { MultiTextFilterDefinition } from '../types'

function parseCsv(raw: string | string[] | undefined): string[] {
  const list = Array.isArray(raw) ? raw.flatMap(x => x.split(',')) : (raw ? raw.split(',') : [])
  return [...new Set(list.map(item => item.trim()).filter(Boolean))]
}

export const multiTextSerializer = {
  toQuery(value: string[], field: MultiTextFilterDefinition): Record<string, string> {
    return value.length > 0 ? { [field.param]: value.join(',') } : {}
  },
  fromQuery(query: Record<string, string | string[] | undefined>, field: MultiTextFilterDefinition): string[] {
    const stripPrefix = field.parse?.stripPrefix
    const values = parseCsv(query[field.param])
    if (!stripPrefix) return values
    return values.map(v => v.startsWith(stripPrefix) ? v.slice(stripPrefix.length) : v)
  },
  isEmpty(value: string[]): boolean {
    return value.length === 0
  },
}
