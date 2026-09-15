// useUpdateCatalogSettingsMutation.ts — surgical PATCH mutation (WU2C,
// REQ-7 / REQ-18). Accepts `{ tenantId, body }` (body from the WU2B builder;
// the WU2A API boundary enforces the runtime whitelist and parses the response).
// onSuccess invalidates ONLY catalogSettingsQueryKeys.detail(tenantId); NO
// setQueryData (never pre-flips catalogPublished); on failure nothing is
// invalidated and the error propagates so the WU3B form keeps its dirty draft.
// `handleUpdateSuccess` is a pure, deps-injected handler for unit testing.

import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { catalogSettingsQueryKeys } from '@/core/shared/constants/query-keys'
import { catalogSettingsApi } from '../api/catalogSettings.api'
import type { CatalogSettingsPatchBody } from '../interfaces/catalog-settings.types'

export interface UpdateCatalogSettingsVariables {
  tenantId: string
  body: CatalogSettingsPatchBody
}

/** Side-effect collaborators the pure handler delegates to. */
export interface UpdateCatalogSettingsDeps {
  /** Invalidate the tenant-scoped settings detail query. */
  invalidateSettings: (args: { queryKey: readonly unknown[] }) => void
}

/** PURE success handler: invalidates exactly detail(tenantId). No cache-write
 *  hook exists on deps, so an optimistic publication pre-flip is impossible. */
export function handleUpdateSuccess(
  tenantId: string,
  deps: UpdateCatalogSettingsDeps,
): void {
  deps.invalidateSettings({ queryKey: catalogSettingsQueryKeys.detail(tenantId) })
}

export function useUpdateCatalogSettingsMutation() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (variables: UpdateCatalogSettingsVariables) =>
      catalogSettingsApi.patch(variables.tenantId, variables.body),
    onSuccess: (_data, variables) => {
      handleUpdateSuccess(variables.tenantId, {
        invalidateSettings: (args) => queryClient.invalidateQueries(args),
      })
    },
  })

  return mutation
}
