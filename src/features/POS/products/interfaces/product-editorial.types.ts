export type EditorialOwner = 'product' | 'sellable'
export type EditorialValueType = 'text' | 'boolean' | 'number' | 'single' | 'multi'

type EditorialAssignment = {
  code: string
  owner: EditorialOwner
  variantId: string | null
}

export type EditorialValue = EditorialAssignment & (
  | { type: 'text'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'number'; value: number; unit: string | null }
  | { type: 'single'; value: string }
  | { type: 'multi'; value: string[] }
)

export interface EditorialDocument {
  commercialTitle: string | null
  description: string | null
  mediaRefs: string[]
  familyCode: string | null
  values: EditorialValue[]
}

// Stored history is untrusted, not a fresh-save document. Decode each document
// independently so an unreadable draft cannot erase readable Published history.
export interface EditorialState {
  cycle: number | null
  draft: {
    revision: number
    basePublishedRevision: number | null
    document: unknown
  } | null
  published: { revision: number; document: unknown } | null
}

export interface EditorialArchivedOptionWarning {
  code: 'ARCHIVED_OPTION'
  familyId: string
  definitionId: string
  owner: EditorialOwner
  variantId: string | null
  optionCode: string
}
export type EditorialWriteResponse = EditorialState & {
  warnings?: EditorialArchivedOptionWarning[]
}
export interface EditorialInitializeRequest { expectedCycle: number | null }
export interface EditorialSaveRequest {
  expectedCycle: number
  expectedRevision: number
  document: EditorialDocument
}

export interface EditorialBinding {
  definitionId: string
  definitionCode: string
  owner: EditorialOwner
  sortOrder: number
}
export interface EditorialFamily {
  id: string
  code: string
  label: string
  bindings: EditorialBinding[]
}
export interface EditorialOption {
  code: string
  label: string
  archived: boolean
  sortOrder: number
}
export interface EditorialUnit {
  code: string | null
  label: string | null
  sortOrder: number
}

type EditorialDefinitionBase = { id: string; code: string; label: string }
export type EditorialDefinition = EditorialDefinitionBase & (
  | { type: 'text' | 'boolean'; units?: never; options?: never }
  | { type: 'number'; units: EditorialUnit[]; options?: never }
  | { type: 'single' | 'multi'; options: EditorialOption[]; units?: never }
)
// Complete server-ordered qualification snapshot; never infer from assignments/flags.
export interface EditorialContext {
  variants: Array<{ id: string; name: string }>
}

export interface EditorialVocabulary {
  families: EditorialFamily[]
  definitions: EditorialDefinition[]
}

export type EditorialErrorEnvelope = {
  [S in 400 | 401 | 403 | 404 | 409 | 500]: {
    statusCode: S
    error: {
      400: 'MALFORMED'; 401: 'UNAUTHORIZED'; 403: 'FORBIDDEN'
      404: 'NOT_FOUND'; 409: 'CONFLICT'; 500: 'INTERNAL_ERROR'
    }[S]
  }
}[400 | 401 | 403 | 404 | 409 | 500]
