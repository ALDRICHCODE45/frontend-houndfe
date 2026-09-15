// useCatalogSettingsForm.ts — WU3B editable settings lifecycle (REQ-6 / REQ-7 /
// REQ-9 / REQ-10). Owns the three snapshots: `draft` (editable intent),
// `pristine` (last accepted editable snapshot), and `accepted` (server state).
// Hydration derives from priceContexts ONLY at controlled boundaries; a refetch
// never overwrites a dirty or mutation-pending draft (lifecycle 2); a
// successful PATCH is accepted directly from its response, not the submitted
// body (lifecycle 3); a tenant-id change clears every snapshot (lifecycle 5).
// No cache write happens here — the mutation composable owns invalidation only.

import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type {
  CatalogSettingsDraft,
  CatalogSettingsPatchBody,
  CatalogSettingsResponseDto,
} from '../interfaces/catalog-settings.types'
import {
  fromCatalogSettingsResponse,
  isCatalogSettingsDirty,
  isPublishRisingEdge,
  toPatchCatalogSettingsBody,
  validateCatalogSettingsDraft,
} from '../utils/catalogSettingsMappers'

export type SaveRoute = 'confirm' | 'save'

export interface CatalogSettingsFormApi {
  accepted: Ref<CatalogSettingsResponseDto | null>
  pristine: Ref<CatalogSettingsDraft | null>
  draft: Ref<CatalogSettingsDraft | null>
  isDirty: ComputedRef<boolean>
  validationErrors: ComputedRef<string[]>
  isRisingEdge: ComputedRef<boolean>
  canSave: ComputedRef<boolean>
  confirmationOpen: Ref<boolean>
  requestSave: () => SaveRoute | null
  confirmPublish: () => SaveRoute
  cancelPublish: () => void
  buildSaveBody: () => CatalogSettingsPatchBody | null
  acceptPatch: (response: CatalogSettingsResponseDto) => void
  beginMutation: () => void
  endMutation: () => void
}

export function useCatalogSettingsForm(
  tenantId: Ref<string>,
  settings: Ref<CatalogSettingsResponseDto | undefined>,
): CatalogSettingsFormApi {
  const accepted = ref<CatalogSettingsResponseDto | null>(null)
  const pristine = ref<CatalogSettingsDraft | null>(null)
  const draft = ref<CatalogSettingsDraft | null>(null)
  const mutationPending = ref(false)
  const confirmationOpen = ref(false)

  const isDirty = computed(
    () =>
      pristine.value !== null &&
      draft.value !== null &&
      isCatalogSettingsDirty(draft.value, pristine.value),
  )

  /** Hydrate from the accepted response; defer while dirty or pending (lifecycle 2/4). */
  watch(
    settings,
    (next) => {
      if (mutationPending.value || isDirty.value) return
      if (next) acceptResponse(next)
    },
    { immediate: true },
  )

  // Tenant-id switch clears all snapshots BEFORE any new hydration (lifecycle 5).
  watch(tenantId, () => {
    accepted.value = null
    pristine.value = null
    draft.value = null
    confirmationOpen.value = false
  })

  const validationErrors = computed(() =>
    draft.value ? validateCatalogSettingsDraft(draft.value) : [],
  )
  const isRisingEdge = computed(
    () =>
      pristine.value !== null &&
      draft.value !== null &&
      isPublishRisingEdge(pristine.value, draft.value),
  )
  const canSave = computed(
    () =>
      draft.value !== null &&
      isDirty.value &&
      validationErrors.value.length === 0 &&
      !mutationPending.value,
  )

  function acceptResponse(response: CatalogSettingsResponseDto): void {
    accepted.value = response
    pristine.value = fromCatalogSettingsResponse(response)
    draft.value = { ...pristine.value }
  }

  /** Save gate: invalid / pristine / pending drafts issue nothing (REQ-7, REQ-12). */
  function requestSave(): SaveRoute | null {
    if (!canSave.value) return null
    if (isRisingEdge.value) {
      // REQ-10: rising edge opens the confirmation modal; no PATCH yet.
      confirmationOpen.value = true
      return 'confirm'
    }
    return 'save'
  }

  function confirmPublish(): SaveRoute {
    confirmationOpen.value = false
    return 'save'
  }

  /** REQ-10: Cancel sends no PATCH and keeps the dirty draft editable. */
  function cancelPublish(): void {
    confirmationOpen.value = false
  }

  function buildSaveBody(): CatalogSettingsPatchBody | null {
    if (!draft.value || !pristine.value) return null
    return toPatchCatalogSettingsBody(draft.value, pristine.value)
  }

  function beginMutation(): void {
    mutationPending.value = true
  }

  function endMutation(): void {
    mutationPending.value = false
  }

  /** Lifecycle 3: accept the PATCH response directly (never the submitted body). */
  function acceptPatch(response: CatalogSettingsResponseDto): void {
    acceptResponse(response)
    confirmationOpen.value = false
  }

  return {
    accepted,
    pristine,
    draft,
    isDirty,
    validationErrors,
    isRisingEdge,
    canSave,
    confirmationOpen,
    requestSave,
    confirmPublish,
    cancelPublish,
    buildSaveBody,
    acceptPatch,
    beginMutation,
    endMutation,
  }
}
