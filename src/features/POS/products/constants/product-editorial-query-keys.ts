export interface EditorialQueryScope {
  tenantId: string
  // Caller-owned authenticated identity/session generation, never an access token.
  authScope: string
}

const scopeKey = ({ tenantId, authScope }: EditorialQueryScope) =>
  ['product-editorial', tenantId, authScope] as const

export const editorialQueryKeys = {
  state: (scope: EditorialQueryScope, productId: string) =>
    [...scopeKey(scope), 'state', productId] as const,
  context: (scope: EditorialQueryScope, productId: string) =>
    [...scopeKey(scope), 'context', productId] as const,
  vocabulary: (scope: EditorialQueryScope) => [...scopeKey(scope), 'vocabulary'] as const,
}
