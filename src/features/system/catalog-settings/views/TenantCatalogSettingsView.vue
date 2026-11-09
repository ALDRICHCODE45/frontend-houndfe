<script setup lang="ts">
/**
 * TenantCatalogSettingsView — routed surface at /system/catalog-settings,
 * laid out after artboard design/catalog-settings/01-ajustes-en-filas.html:
 * page header, then a centred ~880px column with «Publicación», «Precios que
 * ve el público» and «Stock en el catálogo» as surfaces of rows, and a sticky
 * save bar at the bottom of the column.
 *
 * Composition: tenant id from useSafeTenantId, the read query, the form
 * composable (single draft owner), the PATCH mutation and the candidates
 * query. States — loading skeleton in the screen's shape, GET error with
 * Reintentar (no synthetic defaults), the editable form when
 * update:TenantCatalogSettings is held, and the accepted read-only rows
 * otherwise. The ConfirmModal opens ONLY on a rising edge: publishing, or
 * turning «Mostrar solo productos con ficha publicada» on (C3.3, the go-live
 * checklist of handoff 07 §9). Both in one save ask once, with the publish
 * consequence first and the checklist after it. Cancel keeps the dirty draft. Toasts: success copy and the error mapper; no
 * optimistic publication update ever happens.
 *
 * Default-list rules (artboard decision, S4): turning a list public when there
 * is no public default makes it the default; turning the default off moves the
 * default to the first other public list and shows a notice with «Deshacer»;
 * clearing the last public list also clears publication intent (REQ-9).
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { useCatalogSettingsQuery } from '../composables/useCatalogSettingsQuery'
import { useCatalogSettingsForm } from '../composables/useCatalogSettingsForm'
import { useCatalogPriceListCandidatesQuery } from '../composables/useCatalogPriceListCandidatesQuery'
import { useUpdateCatalogSettingsMutation } from '../composables/useUpdateCatalogSettingsMutation'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import CatalogSettingsReadView from '../components/CatalogSettingsReadView.vue'
import CatalogSettingsForm from '../components/CatalogSettingsForm.vue'
import CatalogSaveBar from '../components/CatalogSaveBar.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import {
  mapCatalogSettingsError,
  mapCatalogSettingsWarning,
  STOCK_QUANTITY_ERROR,
} from '../utils/catalogSettingsMappers'
import type {
  CatalogDefaultMove,
  CatalogSettingsResponseDto,
  CatalogStockPresentationDefaultDto,
} from '../interfaces/catalog-settings.types'
import '../styles/catalog-settings-visual.css'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const SAVED_CUE_MS = 2200

/** Handoff 07 §9 «Antes de encender el interruptor», the items the tenant acts on. */
const PUBLISHED_ONLY_CHECKLIST = [
  'Publica primero las fichas de los productos que deben seguir en línea; los demás dejarán de verse.',
  'Vuelve a publicar las fichas guardadas antes de la versión actual: no cuentan como publicadas.',
  'Si agregaste variantes después de publicar, vuelve a publicar: hasta entonces no se ven.',
  'La búsqueda solo encontrará el título y la descripción publicados.',
  'El cambio puede tardar hasta 60 segundos en verse en el catálogo público.',
]
const PUBLISH_CONSEQUENCE = 'El catálogo será visible para clientes públicos.'

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
const candidates = computed(() => candidatesQuery.candidates.value ?? [])
const formDraft = computed(() => form.draft.value)
const saving = computed(() => mutation.isPending.value)
const formCanSave = computed(() => form.canSave.value && !saving.value)
const isDirty = computed(() => form.isDirty.value)

const acceptedWarnings = computed(() =>
  (query.settings.value?.warnings ?? [])
    .map((code) => mapCatalogSettingsWarning(code))
    .filter((copy): copy is string => copy !== null),
)
const updatedAt = computed(
  () => form.accepted.value?.updatedAt ?? query.settings.value?.updatedAt ?? '',
)
/** One confirmation for the rising edges of this save. */
const confirmCopy = computed(() => {
  const publishedOnly = form.isPublishedOnlyRisingEdge.value
  if (!publishedOnly) {
    return {
      title: 'Publicar catálogo online',
      description: `${PUBLISH_CONSEQUENCE} ¿Continuar?`,
      confirmLabel: 'Confirmar',
      items: undefined,
    }
  }
  const alsoPublish = form.isRisingEdge.value
  const lines = alsoPublish
    ? [PUBLISH_CONSEQUENCE, ...PUBLISHED_ONLY_CHECKLIST]
    : PUBLISHED_ONLY_CHECKLIST
  return {
    title: alsoPublish
      ? 'Antes de publicar y encender el interruptor'
      : 'Antes de encender el interruptor',
    description: lines.join(' '),
    confirmLabel: alsoPublish
      ? 'Publicar y mostrar solo fichas publicadas'
      : 'Mostrar solo fichas publicadas',
    items: lines.map((title, index) => ({ id: `check-${index}`, title })),
  }
})

const saveHint = computed(() => {
  const errors = form.validationErrors.value
  if (errors.length === 0) return null
  return errors.includes(STOCK_QUANTITY_ERROR) ? 'revisa la cantidad' : 'revisa los avisos'
})

/** Save bar «Guardado» cue for a moment after a successful save. */
const justSaved = ref(false)
let savedTimer: ReturnType<typeof setTimeout> | undefined
function flashSaved() {
  justSaved.value = true
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => {
    justSaved.value = false
  }, SAVED_CUE_MS)
}
onBeforeUnmount(() => clearTimeout(savedTimer))

/** The default moved because its list stopped being public; «Deshacer» restores the snapshot. */
const defaultMove = ref<
  (CatalogDefaultMove & { previous: { ids: string[]; defaultId: string | null; published: boolean } }) | null
>(null)

function nameOf(priceListId: string): string {
  return (
    candidates.value.find((candidate) => candidate.id === priceListId)?.name ??
    acceptedContexts.value.find((context) => context.priceListId === priceListId)?.name ??
    'Lista sin nombre'
  )
}

/** Re-run the read query after a GET failure (any non-2xx, incl. 404). */
function onRetry() {
  void query.refetch()
}

/** Draft intents applied by the form component (single source: the form composable). */
function togglePublish() {
  if (form.draft.value) form.draft.value.catalogPublished = !form.draft.value.catalogPublished
}
function togglePublishedOnly() {
  const draft = form.draft.value
  if (draft) draft.catalogRequiresPublishedEditorial = !draft.catalogRequiresPublishedEditorial
}
function addContext(priceListId: string) {
  const draft = form.draft.value
  if (!draft) return
  defaultMove.value = null
  draft.publicPriceListIds = [...draft.publicPriceListIds, priceListId]
  const defaultId = draft.catalogDefaultPriceListId
  if (!defaultId || !draft.publicPriceListIds.includes(defaultId)) {
    draft.catalogDefaultPriceListId = priceListId
  }
}
function removeContext(priceListId: string) {
  const draft = form.draft.value
  if (!draft) return
  defaultMove.value = null
  const previous = {
    ids: [...draft.publicPriceListIds],
    defaultId: draft.catalogDefaultPriceListId,
    published: draft.catalogPublished,
  }
  draft.publicPriceListIds = draft.publicPriceListIds.filter((id) => id !== priceListId)
  if (draft.catalogDefaultPriceListId === priceListId) {
    const next = draft.publicPriceListIds[0] ?? null
    draft.catalogDefaultPriceListId = next
    if (next) defaultMove.value = { fromName: nameOf(priceListId), toName: nameOf(next), previous }
  }
  // Clearing the last public context also clears publication intent; the
  // atomic clear triple is built by the mapper at save time (REQ-9).
  if (draft.publicPriceListIds.length === 0 && draft.catalogPublished) {
    draft.catalogPublished = false
  }
}
function undoDefaultMove() {
  const draft = form.draft.value
  const move = defaultMove.value
  if (!draft || !move) return
  draft.publicPriceListIds = [...move.previous.ids]
  draft.catalogDefaultPriceListId = move.previous.defaultId
  draft.catalogPublished = move.previous.published
  defaultMove.value = null
}
function setDefault(priceListId: string | null) {
  if (!form.draft.value) return
  defaultMove.value = null
  form.draft.value.catalogDefaultPriceListId = priceListId
}
function onStockChange(value: CatalogStockPresentationDefaultDto) {
  if (form.draft.value) form.draft.value.stockPresentationDefault = value
}
function onDiscard() {
  defaultMove.value = null
  form.discard()
}
function onRetryCandidates() {
  void candidatesQuery.refetch()
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
    defaultMove.value = null
    flashSaved()
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
  <div class="hf-theme hf-ui catalog-settings-visual cs-page mx-auto flex w-full min-w-0 flex-col">
    <!-- Canonical page header (design-system §4): title plus one short subtitle. -->
    <header class="hf-page-header">
      <h1 class="hf-page-title">Catálogo online</h1>
      <p class="hf-page-subtitle">
        Decide si tus clientes ven el catálogo, con qué precios y cómo se muestra el stock.
      </p>
    </header>

    <!-- Loading state in the screen's shape: three sections of rows, no controls. -->
    <div
      v-if="query.isLoading.value"
      data-testid="settings-loading"
      role="status"
      aria-busy="true"
      class="flex flex-col gap-8"
    >
      <span class="sr-only">Cargando la configuración del catálogo…</span>
      <div
        v-for="rows in [1, 3, 4]"
        :key="rows"
        data-skeleton="section"
        class="cs-group animate-pulse"
        aria-hidden="true"
      >
        <span class="settings-skeleton-bar h-4 w-44" />
        <div class="cs-surface">
          <div v-for="n in rows" :key="n" data-skeleton="row" class="cs-price-row">
            <span class="flex flex-col gap-2">
              <span class="settings-skeleton-bar h-4 w-32" />
              <span class="settings-skeleton-bar h-3 w-56 max-w-full" />
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- GET error state: explicit retry, never a 404-as-default fallback. -->
    <EmptyState
      v-else-if="query.isError.value"
      data-testid="settings-error"
      kind="error"
      title="No se pudo cargar la configuración del catálogo"
      action-label="Reintentar"
      action-test-id="retry-button"
      @action="onRetry"
    />

    <template v-else-if="query.settings.value">
      <!-- Editable surface (REQ-12: only with update:TenantCatalogSettings). -->
      <template v-if="canUpdate && formDraft">
        <CatalogSettingsForm
          :draft="formDraft"
          :accepted-contexts="acceptedContexts"
          :candidates="candidates"
          :candidates-loading="candidatesQuery.isLoading.value"
          :candidates-error="candidatesQuery.isError.value"
          :validation-errors="form.validationErrors.value"
          :can-edit-contexts="canEditContexts"
          :effective-publication="query.settings.value.effectivePublication"
          :warnings="acceptedWarnings"
          :dirty="isDirty"
          :default-move="defaultMove"
          @toggle-publish="togglePublish"
          @toggle-published-only="togglePublishedOnly"
          @add-context="addContext"
          @remove-context="removeContext"
          @set-default="setDefault"
          @stock-change="onStockChange"
          @undo-default-move="undoDefaultMove"
          @retry-candidates="onRetryCandidates"
        />

        <CatalogSaveBar
          :dirty="isDirty"
          :can-save="formCanSave"
          :saving="saving"
          :saved="justSaved"
          :hint="saveHint"
          :updated-at="updatedAt"
          @save="onSave"
          @discard="onDiscard"
        />
      </template>

      <!-- Read-only rows with the save-permission notice (REQ-12). -->
      <template v-else>
        <CatalogSettingsReadView :settings="query.settings.value" />
        <p class="cs-foot-note" data-testid="readonly-notice">
          <UIcon name="i-lucide-lock" class="cs-notice-icon" aria-hidden="true" />
          <span>
            No tienes permisos para guardar cambios ·
            <span class="hf-figure" data-testid="updated-at">
              Actualizado {{ formatShortDateTime(updatedAt) }}
            </span>
          </span>
        </p>
      </template>
    </template>

    <!-- REQ-10 / C3.3: rising-edge confirmation only; Cancel keeps the dirty draft. -->
    <ConfirmModal
      v-model:open="form.confirmationOpen.value"
      :title="confirmCopy.title"
      :description="confirmCopy.description"
      :items="confirmCopy.items"
      :confirm-label="confirmCopy.confirmLabel"
      cancel-label="Cancelar"
      :loading="saving"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay' }"
      @confirm="onConfirm"
      @cancel="form.cancelPublish()"
      @update:open="
        (open: boolean) => {
          if (!open) form.cancelPublish()
        }
      "
    />
  </div>
</template>
