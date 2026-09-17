<script setup lang="ts">
/**
 * TenantCatalogSettingsView — routed composition surface at
 * /system/catalog-settings (WU3A base; WU3B layers the editable form).
 *
 * Composition: tenant id from useSafeTenantId, the WU2C read query, the WU3B
 * form composable, the WU2C PATCH mutation, and the candidates composable.
 * States — loading skeleton, GET error with Reintentar (no synthetic
 * defaults), editable form when update:TenantCatalogSettings is held, and the
 * accepted read-only surface (with the locked save-permission notice)
 * otherwise. The ConfirmModal opens ONLY on the publish rising edge; Cancel
 * keeps the dirty draft editable. Toasts: success copy and the WU2B error
 * mapper; no optimistic publication update ever happens.
 *
 * UI redesign (U5): unified large-card shell (ProductsView pattern) — one
 * UCard with #header, card body, and #footer. Header/footer are no longer
 * detached page-level rectangles; footer is no longer viewport-sticky. All
 * composable wiring, data-testid, and state contracts are preserved.
 */
import { computed } from 'vue'
import { useCatalogSettingsQuery } from '../composables/useCatalogSettingsQuery'
import { useCatalogSettingsForm } from '../composables/useCatalogSettingsForm'
import { useCatalogPriceListCandidatesQuery } from '../composables/useCatalogPriceListCandidatesQuery'
import { useUpdateCatalogSettingsMutation } from '../composables/useUpdateCatalogSettingsMutation'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import CatalogSettingsReadView from '../components/CatalogSettingsReadView.vue'
import CatalogSettingsForm from '../components/CatalogSettingsForm.vue'
import { mapCatalogSettingsError } from '../utils/catalogSettingsMappers'
import type { CatalogSettingsResponseDto } from '../interfaces/catalog-settings.types'
import type { CatalogStockPresentationDefaultDto } from '../interfaces/catalog-settings.types'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const tenantId = useSafeTenantId()
const authStore = useAuthStore()
const canUpdate = computed(() => authStore.userCan('update', 'TenantCatalogSettings'))
const canReadGlobalPriceLists = computed(() => authStore.userCan('read', 'GlobalPriceList'))

const query = useCatalogSettingsQuery(tenantId)
const form = useCatalogSettingsForm(tenantId, query.settings)
const candidatesQuery = useCatalogPriceListCandidatesQuery(canUpdate, canReadGlobalPriceLists)
const mutation = useUpdateCatalogSettingsMutation()
const toast = useToast()

// REQ-6A: contexts editing requires settings-update PLUS global-list read;
// publication and stock remain independently available when otherwise valid.
const canEditContexts = computed(() => canUpdate.value && canReadGlobalPriceLists.value)
const acceptedContexts = computed(() => query.settings.value?.priceContexts ?? [])
const formDraft = computed(() => form.draft.value)
const formCanSave = computed(() => form.canSave.value && !mutation.isPending.value)
const saving = computed(() => mutation.isPending.value)

/** Whether the footer should render (not while loading or errored). */
const showFooter = computed(
  () => !query.isLoading.value && !query.isError.value && !!query.settings.value,
)

/** Re-run the read query after a GET failure (any non-2xx, incl. 404). */
function onRetry() {
  void query.refetch()
}

/** Draft intents applied by the form component (single source: the form composable). */
function togglePublish() {
  if (form.draft.value) form.draft.value.catalogPublished = !form.draft.value.catalogPublished
}
function addContext(priceListId: string) {
  if (form.draft.value) {
    form.draft.value.publicPriceListIds = [...form.draft.value.publicPriceListIds, priceListId]
  }
}
function removeContext(priceListId: string) {
  if (!form.draft.value) return
  form.draft.value.publicPriceListIds = form.draft.value.publicPriceListIds.filter(
    (id) => id !== priceListId,
  )
  if (form.draft.value.catalogDefaultPriceListId === priceListId) {
    form.draft.value.catalogDefaultPriceListId = null
  }
  // Design: clearing the last public context also clears publication intent;
  // the atomic clear triple is built by the WU2B mapper at save time (REQ-9).
  if (form.draft.value.publicPriceListIds.length === 0 && form.draft.value.catalogPublished) {
    form.draft.value.catalogPublished = false
  }
}
function setDefault(priceListId: string | null) {
  if (form.draft.value) form.draft.value.catalogDefaultPriceListId = priceListId
}
function onStockChange(value: CatalogStockPresentationDefaultDto) {
  if (form.draft.value) form.draft.value.stockPresentationDefault = value
}

/** Save routing: rising edge opens the confirmation; everything else saves directly. */
function onSave() {
  const route = form.requestSave()
  if (route === 'save') void submit()
}

function onConfirm() {
  form.confirmPublish()
  void submit()
}

/** One whitelisted PATCH; accept the response; surgical success/error toasts. */
async function submit() {
  const body = form.buildSaveBody()
  if (!body) return
  form.beginMutation()
  try {
    const response = (await mutation.mutateAsync({
      tenantId: tenantId.value,
      body,
    })) as CatalogSettingsResponseDto
    form.acceptPatch(response)
    toast.add({ title: 'Configuración de catálogo guardada', color: 'success' })
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status
    toast.add({ title: mapCatalogSettingsError({ status }).toast, color: 'error' })
  } finally {
    form.endMutation()
  }
}
</script>

<template>
  <UCard data-testid="settings-card" class="w-full min-w-0 max-w-full overflow-hidden shadow-sm">
    <template #header>
      <!-- Icon + title + description; no full UPageHeader dependency. -->
      <div class="flex items-center gap-3">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <UIcon name="i-lucide-store" class="size-5 text-primary" />
        </div>
        <div>
          <h1 class="text-lg font-semibold text-default">Configuración del catálogo online</h1>
          <p class="mt-0.5 text-sm text-muted">
            Controla la visibilidad, listas de precios y presentación de stock en el catálogo
            público.
          </p>
        </div>
      </div>
    </template>

    <!-- Card body: loading skeleton, error state, editable form, or read-only view.
         Inner responsive padding matches the Products list pattern. -->
    <div class="px-3 py-3 sm:px-4 sm:py-4">
      <!-- Loading state: skeleton cards matching the three logical sections;
           no enabled controls, no synthetic values. -->
      <template v-if="query.isLoading.value">
        <div
          v-for="i in 3"
          :key="i"
          class="mb-4 rounded-lg border border-default bg-default p-6 last:mb-0"
        >
          <USkeleton class="mb-3 h-5 w-1/3" />
          <USkeleton class="h-4 w-2/3" />
        </div>
      </template>

      <!-- GET error state: explicit retry, never a 404-as-default fallback. -->
      <div
        v-else-if="query.isError.value"
        class="flex flex-col gap-3 rounded-lg border border-error/30 bg-error/5 p-6"
        data-testid="settings-error"
      >
        <p class="text-sm text-error">No se pudo cargar la configuración del catálogo.</p>
        <UButton color="primary" data-testid="retry-button" @click="onRetry"> Reintentar </UButton>
      </div>

      <template v-else-if="query.settings.value">
        <!-- Editable surface (REQ-12: only with update:TenantCatalogSettings). -->
        <CatalogSettingsForm
          v-if="canUpdate && formDraft"
          :draft="formDraft"
          :accepted-contexts="acceptedContexts"
          :candidates="candidatesQuery.candidates.value ?? []"
          :validation-errors="form.validationErrors.value"
          :can-edit-contexts="canEditContexts"
          @toggle-publish="togglePublish"
          @add-context="addContext"
          @remove-context="removeContext"
          @set-default="setDefault"
          @stock-change="onStockChange"
        />

        <!-- Read-only surface with the save-permission notice (REQ-12). -->
        <CatalogSettingsReadView v-else :settings="query.settings.value" />
      </template>
    </div>

    <template #footer>
      <!-- Save/read-only action surface — non-sticky, inside the card.
           Renders only when content is loaded; connects to dirty/loading state
           through the form composable refs. The no-update-permission notice
           appears here so the read-only surface stays focused on its data.
           Responsive: mobile-stacked with full-width button, sm horizontal with auto-width button. -->
      <div
        v-if="showFooter"
        class="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end"
        data-testid="settings-footer"
      >
        <p v-if="!canUpdate" class="text-xs text-warning sm:mr-auto" data-testid="readonly-notice">
          No tienes permisos para guardar cambios
        </p>
        <template v-else>
          <span
            v-if="!formCanSave && !saving"
            class="text-xs text-muted"
            data-testid="no-changes-hint"
          >
            Sin cambios para guardar
          </span>
          <UButton
            color="primary"
            data-testid="footer-save-button"
            class="w-full justify-center sm:w-auto"
            :disabled="!formCanSave"
            :loading="saving"
            @click="onSave"
          >
            Guardar
          </UButton>
        </template>
      </div>
    </template>
  </UCard>

  <!-- REQ-10: rising-edge confirmation only; Cancel keeps the dirty draft. -->
  <ConfirmModal
    v-model:open="form.confirmationOpen.value"
    title="Publicar catálogo online"
    description="El catálogo será visible para clientes públicos. ¿Continuar?"
    confirm-label="Confirmar"
    cancel-label="Cancelar"
    :loading="saving"
    @confirm="onConfirm"
    @cancel="form.cancelPublish()"
    @update:open="
      (open: boolean) => {
        if (!open) form.cancelPublish()
      }
    "
  />
</template>
