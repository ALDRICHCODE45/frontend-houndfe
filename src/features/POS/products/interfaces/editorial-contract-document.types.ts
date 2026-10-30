import type { EditorialCareReview } from './editorial-contract-care.types'
import type { EditorialDeclaration } from './editorial-contract-declaration.types'
import type { EditorialValue } from './editorial-contract-value.types'

export type EditorialSellableFacts = {
  variantId: string | null
  presentation: string
  declarations: EditorialDeclaration[]
  careReview: EditorialCareReview | null
}

export type EditorialContractDocument = {
  schemaVersion: 2
  commercialTitle: string | null
  description: string | null
  mediaRefs: string[]
  familyCode: string | null
  values: EditorialValue[]
  facts: EditorialSellableFacts[]
}
