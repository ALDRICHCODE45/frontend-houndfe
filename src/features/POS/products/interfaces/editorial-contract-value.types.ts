export type EditorialOwner = 'product' | 'sellable'

export type EditorialEvidence = { sourceRef: string; verifiedOn: string }

export type EditorialKnownPayload =
  | { type: 'text'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'number'; value: number; unit: string | null }
  | { type: 'single'; value: string }
  | { type: 'multi'; value: string[] }
  | { type: 'range'; min: number; max: number; unit: string }

export type EditorialValue = {
  code: string
  owner: EditorialOwner
  variantId: string | null
} & (
  | { state: 'known'; payload: EditorialKnownPayload; evidence: EditorialEvidence | null }
  | { state: 'unknown'; evidence: null }
  | { state: 'not_applicable'; evidence: null }
)
