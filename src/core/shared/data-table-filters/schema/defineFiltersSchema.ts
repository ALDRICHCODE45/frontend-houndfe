import { dateRangeSerializer } from './serializers/dateRange'
import { multiAsyncSerializer } from './serializers/multiAsync'
import { multiEnumSerializer } from './serializers/multiEnum'
import { multiTextSerializer } from './serializers/multiText'
import { numericRangeSerializer } from './serializers/numericRange'
import type { ActiveFilterChip, FilterDefinition, FilterState, FiltersSchema } from './types'

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function defineFiltersSchema(fields: FilterDefinition[]): FiltersSchema {
  const byId = Object.fromEntries(fields.map(field => [field.id, field]))

  return {
    fields,
    byId,
    defaults() {
      const state: FilterState = {}
      for (const field of fields) {
        if (field.kind === 'multi-enum' || field.kind === 'multi-async' || field.kind === 'multi-text') state[field.param] = []
        if (field.kind === 'numeric-range') state[field.id] = { min: undefined, max: undefined }
        if (field.kind === 'date-range') state[field.id] = { from: undefined, to: undefined }
        if ('includeNull' in field && field.includeNull) state[field.includeNull.param] = false
      }
      return state
    },
    serialize(state) {
      const query: Record<string, string> = {}
      for (const field of fields) {
        if (field.kind === 'multi-enum') {
          const raw = (state[field.id] as string[] | undefined) ?? []
          const value = field.transform?.toBackend ? field.transform.toBackend(raw) : raw
          Object.assign(query, multiEnumSerializer.toQuery(value, field, state[field.includeNull?.param ?? ''] as boolean | undefined))
        }
        if (field.kind === 'multi-async') {
          const raw = (state[field.id] as string[] | undefined) ?? []
          const value = field.transform?.toBackend ? field.transform.toBackend(raw) : raw
          Object.assign(query, multiAsyncSerializer.toQuery(value, field, state[field.includeNull?.param ?? ''] as boolean | undefined))
        }
        if (field.kind === 'multi-text') {
          const raw = (state[field.id] as string[] | undefined) ?? []
          const value = field.transform?.toBackend ? field.transform.toBackend(raw) : raw
          Object.assign(query, multiTextSerializer.toQuery(value, field))
        }
        if (field.kind === 'numeric-range') {
          const raw = (state[field.id] as { min?: number, max?: number } | undefined) ?? {}
          const value = field.transform?.toBackend ? field.transform.toBackend(raw) : raw
          Object.assign(query, numericRangeSerializer.toQuery(value, field))
        }
        if (field.kind === 'date-range') {
          const raw = (state[field.id] as { from?: string, to?: string } | undefined) ?? {}
          const value = field.transform?.toBackend ? field.transform.toBackend(raw) : raw
          Object.assign(query, dateRangeSerializer.toQuery(value, field, state[field.includeNull?.param ?? ''] as boolean | undefined))
        }
      }
      return query
    },
    deserialize(query) {
      const state: FilterState = this.defaults()
      for (const field of fields) {
        if (field.kind === 'multi-enum') {
          const parsed = multiEnumSerializer.fromQuery(query, field)
          state[field.id] = field.transform?.fromBackend ? field.transform.fromBackend(parsed.value) : parsed.value
          if (field.includeNull) state[field.includeNull.param] = parsed.includeNull
        }
        if (field.kind === 'multi-async') {
          const parsed = multiAsyncSerializer.fromQuery(query, field)
          state[field.id] = field.transform?.fromBackend ? field.transform.fromBackend(parsed.value) : parsed.value
          if (field.includeNull) state[field.includeNull.param] = parsed.includeNull
        }
        if (field.kind === 'multi-text') {
          const parsed = multiTextSerializer.fromQuery(query, field)
          state[field.id] = field.transform?.fromBackend ? field.transform.fromBackend(parsed) : parsed
        }
        if (field.kind === 'numeric-range') {
          const parsed = numericRangeSerializer.fromQuery(query, field)
          state[field.id] = field.transform?.fromBackend ? field.transform.fromBackend(parsed) : parsed
        }
        if (field.kind === 'date-range') {
          const parsed = dateRangeSerializer.fromQuery(query, field)
          state[field.id] = field.transform?.fromBackend ? field.transform.fromBackend(parsed.value) : parsed.value
          if (field.includeNull) state[field.includeNull.param] = parsed.includeNull
        }
      }
      return state
    },
    canonicalize(state) {
      const active: Record<string, unknown> = {}
      for (const field of fields) {
        if (this.isActive(field.id, state)) {
          active[field.id] = state[field.id]
          if ('includeNull' in field && field.includeNull && state[field.includeNull.param] === true) {
            active[field.includeNull.param] = true
          }
        }
      }
      return stable(active)
    },
    resolveLabel(filterId, value) {
      const field = byId[filterId]
      if (!field) return value
      if (field.kind === 'multi-enum' || field.kind === 'multi-async') return field.options.find(opt => opt.value === value)?.label ?? value
      return value
    },
    isActive(filterId, state) {
      const field = byId[filterId]
      if (!field) return false
      if (field.kind === 'multi-enum' || field.kind === 'multi-async' || field.kind === 'multi-text') {
        const values = state[field.id] as string[] | undefined
        const includeNull = 'includeNull' in field && field.includeNull ? state[field.includeNull.param] === true : false
        return (values?.length ?? 0) > 0 || includeNull
      }
      if (field.kind === 'numeric-range') {
        const value = state[field.id] as { min?: number, max?: number } | undefined
        return typeof value?.min === 'number' || typeof value?.max === 'number'
      }
      const value = state[field.id] as { from?: string, to?: string } | undefined
      const includeNull = field.includeNull ? state[field.includeNull.param] === true : false
      return Boolean(value?.from || value?.to || includeNull)
    },
    activeChips(state) {
      const chips: ActiveFilterChip[] = []
      for (const field of fields) {
        if (!this.isActive(field.id, state)) continue
        if (field.kind === 'multi-enum' || field.kind === 'multi-async' || field.kind === 'multi-text') {
          const values = (state[field.id] as string[] | undefined) ?? []
          let displayValue = ''
          if (values.length <= 1) displayValue = values[0] ? this.resolveLabel(field.id, values[0]) : 'Incluye nulos'
          else if (values.length <= 3) displayValue = values.map(v => this.resolveLabel(field.id, v)).join(', ')
          else displayValue = `${values.length} seleccionados`
          if (displayValue === '' && 'includeNull' in field && field.includeNull && state[field.includeNull.param] === true) {
            displayValue = 'Incluye nulos'
          }
          chips.push({ filterId: field.id, label: field.label, displayValue })
          continue
        }
        if (field.kind === 'numeric-range') {
          const value = (state[field.id] as { min?: number, max?: number } | undefined) ?? {}
          chips.push({ filterId: field.id, label: field.label, displayValue: `${value.min ?? '—'} - ${value.max ?? '—'}` })
          continue
        }
        const value = (state[field.id] as { from?: string, to?: string } | undefined) ?? {}
        chips.push({ filterId: field.id, label: field.label, displayValue: `${value.from ?? '—'} - ${value.to ?? '—'}` })
      }
      return chips
    },
  }
}
