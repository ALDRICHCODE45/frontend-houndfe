import type { EditorialDefinition } from '../interfaces/editorial-contract-definition.types'
import type { EditorialValue } from '../interfaces/editorial-contract-value.types'
import { toEditorialAssignmentInput, type EditorialAssignmentInput } from './editorial-contract-assignment-input'

function unitText(definition: EditorialDefinition | undefined, unit: string | null | undefined): string {
  if (unit === null || unit === undefined) return ''
  const found = definition && (definition.type === 'number' || definition.type === 'range')
    ? definition.units.find(item => item.code === unit) : undefined
  return found?.label ?? unit
}

function optionText(definition: EditorialDefinition | undefined, code: string): string {
  const options = definition && (definition.type === 'single' || definition.type === 'multi') ? definition.options : []
  return options.find(item => item.code === code)?.label ?? code
}

/** The words a person reads for a cell: option and unit labels instead of codes. */
export function editorialInputText(input: EditorialAssignmentInput, definition: EditorialDefinition | undefined): string {
  if (input.state !== 'known') return input.state === 'omitted' ? 'Sin dato' : input.state === 'unknown' ? 'Desconocido' : 'No aplica'
  const payload = input.payload
  const spaced = (...parts: string[]) => parts.filter(Boolean).join(' ')
  switch (payload.type) {
    case 'text': return payload.value
    case 'boolean': return payload.value === null ? '' : payload.value ? 'Sí' : 'No'
    case 'single': return payload.value === null ? '' : optionText(definition, payload.value)
    case 'multi': return payload.value.length ? payload.value.map(code => optionText(definition, code)).join(', ') : 'Ninguno'
    case 'number': return spaced(payload.value, unitText(definition, payload.unit))
    case 'range': return spaced(`${payload.min}–${payload.max}`, unitText(definition, payload.unit))
  }
}

export function editorialValueText(value: EditorialValue, definition: EditorialDefinition | undefined): string {
  return editorialInputText(toEditorialAssignmentInput(value), definition)
}
