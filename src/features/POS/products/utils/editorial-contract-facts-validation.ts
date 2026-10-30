import type { EditorialDeclaration } from '../interfaces/editorial-contract-declaration.types'
import { isFreshEditorialCareCapture } from './editorial-contract-care-validation'
import { decodeEditorialSellableFacts } from './editorial-contract-document'
import { isFreshEditorialEvidence } from './editorial-contract-evidence-validation'
import { snapshotJson } from './editorial-contract-value'

// Scalar strings and finite code unions are established by the primitive reader.
function boundedProse(value: string, max: number): boolean {
  return value.trim().length > 0 && [...value].length <= max
}

function uniqueSubset(values: string[], max: number): boolean {
  return values.length <= max && new Set(values).size === values.length
}

function freshDeclaration(declaration: EditorialDeclaration): boolean {
  if (declaration.state === 'unknown') return true
  if (!boundedProse(declaration.basis, 2000)
    || !isFreshEditorialEvidence(declaration.evidence)) return false
  switch (declaration.key) {
    case 'relevantDimensionCodes':
      return uniqueSubset(declaration.value.codes, 8) && uniqueSubset(declaration.value.toyTypes, 15)
    case 'relevantFitCodes': return uniqueSubset(declaration.value, 3)
    case 'relevantCapacityCodes': return uniqueSubset(declaration.value, 2)
    case 'relevantEquipmentCodes': return uniqueSubset(declaration.value, 5)
    case 'optionalNonpertinenceCodes': return uniqueSubset(declaration.value, 68)
    default: return true
  }
}

/** Fresh capture only; context/family/reference admission and readiness remain separate gates. */
export function isFreshEditorialFactsCapture(raw: unknown): boolean {
  try {
    // Inspect descriptors before accessing even array entries; submitted getters never run.
    const rows = snapshotJson(raw)
    if (!Array.isArray(rows) || rows.length > 200) return false
    const subjects = new Set<string | null>()
    for (const rawRow of rows) {
      const row = decodeEditorialSellableFacts(rawRow)
      if (!row || subjects.has(row.variantId) || !boundedProse(row.presentation, 300)
        || row.declarations.length > 12) return false
      subjects.add(row.variantId)
      const keys = new Set<string>()
      for (const declaration of row.declarations) {
        if (keys.has(declaration.key) || !freshDeclaration(declaration)) return false
        keys.add(declaration.key)
      }
      if (row.careReview !== null && !isFreshEditorialCareCapture(row.careReview)) return false
    }
    return true
  } catch {
    return false
  }
}
