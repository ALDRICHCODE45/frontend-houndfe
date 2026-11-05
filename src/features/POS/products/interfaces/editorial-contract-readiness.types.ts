/** What the backend says is missing to publish the SAVED draft (handoff 05, §2). */
export type EditorialReadinessScope = 'definition' | 'variant' | 'product' | 'care'
export type EditorialReadinessItem = {
  /** Closed set: the backend will not add values. */
  scope: EditorialReadinessScope
  definitionCode: string | null
  variantId: string | null
  sectionCode: string | null
  /** Stable code, an open string: show `message` for any code. */
  problem: string
  /** es-MX copy with «tú»; always shown. */
  message: string
}
export type EditorialReadinessIssues = {
  items: EditorialReadinessItem[]
  /** Definition items per section. */
  bySection: Record<string, number>
}
export type EditorialReadiness = EditorialReadinessIssues & {
  ready: boolean
  cycle: number | null
  draftRevision: number | null
  vocabularyRevision: string
}
