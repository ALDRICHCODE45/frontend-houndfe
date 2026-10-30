import type { EditorialEvidence, EditorialKnownPayload, EditorialValue } from '../interfaces/editorial-contract-value.types'
import { decodeEditorialValue } from './editorial-contract-value'
import { isFreshEditorialEvidence } from './editorial-contract-evidence-validation'

export type EditorialPayloadInput =
  | { type: 'text'; value: string }
  | { type: 'boolean'; value: boolean | null }
  | { type: 'single'; value: string | null }
  | { type: 'multi'; value: string[] }
  | { type: 'number'; value: string; unit?: string | null }
  | { type: 'range'; min: string; max: string; unit?: string | null }
export type EditorialAssignmentInput =
  | { state: 'omitted' | 'unknown' | 'not_applicable' }
  | { state: 'known'; payload: EditorialPayloadInput; evidence: EditorialEvidence | null }
export type EditorialAssignmentInputResult =
  | { status: 'complete'; assignment: EditorialValue | null }
  | { status: 'incomplete' }
export type EditorialAssignmentTarget = Pick<EditorialValue, 'code' | 'owner' | 'variantId'>

/** Initialize detached controls from primitive-decoded history, without fresh validation. */
export function toEditorialAssignmentInput(value: EditorialValue | null): EditorialAssignmentInput {
  if (value === null) return { state: 'omitted' }
  if (value.state !== 'known') return { state: value.state }
  const payload = value.payload
  let input: EditorialPayloadInput
  switch (payload.type) {
    case 'number': input = { ...payload, value: String(payload.value) }; break
    case 'range': input = { ...payload, min: String(payload.min), max: String(payload.max) }; break
    case 'multi': input = { ...payload, value: [...payload.value] }; break
    default: input = { ...payload }
  }
  return { state: 'known', payload: input, evidence: value.evidence === null ? null : { ...value.evidence } }
}

function decimal(raw: string): number | null {
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) return null
  const number = Number(raw)
  return Number.isFinite(number) ? number : null
}
function completePayload(input: EditorialPayloadInput): EditorialKnownPayload | null {
  switch (input.type) {
    case 'number': {
      const value = decimal(input.value)
      return value !== null && input.unit !== undefined ? { type: 'number', value, unit: input.unit } : null
    }
    case 'range': {
      const min = decimal(input.min)
      const max = decimal(input.max)
      return min !== null && max !== null && typeof input.unit === 'string'
        ? { type: 'range', min, max, unit: input.unit } : null
    }
    case 'boolean': return input.value === null ? null : { type: 'boolean', value: input.value }
    case 'single': return input.value === null ? null : { type: 'single', value: input.value }
    default: return input
  }
}

/**
 * Control encoding only: complete is NOT fresh admission or permission to save.
 * Parent must retain raw input on every edit, including incomplete results; never
 * keep the previous assignment as a saveable fallback. No local NaN sentinel.
 * Metadata membership, numeric domains/order, NA and conservation remain downstream.
 */
export function resolveEditorialAssignmentInput(target: EditorialAssignmentTarget, input: EditorialAssignmentInput): EditorialAssignmentInputResult {
  if (input.state === 'omitted') return { status: 'complete', assignment: null }
  let raw: unknown
  if (input.state === 'known') {
    const payload = completePayload(input.payload)
    if (payload === null || (input.evidence !== null && !isFreshEditorialEvidence(input.evidence))) return { status: 'incomplete' }
    raw = { ...target, state: 'known', payload, evidence: input.evidence }
  } else raw = { ...target, state: input.state, evidence: null }
  const assignment = decodeEditorialValue(raw)
  return assignment === null ? { status: 'incomplete' } : { status: 'complete', assignment }
}
