<script setup lang="ts">
/**
 * SellerSalesReportDrawer.vue — drawer shell for one seller's sales report.
 *
 * It owns only orchestration and layout:
 *   - The committed `AppResponsiveDrawer` provides the responsive shell.
 *   - The report-local `SellerReportDateRangeFilter` provides the window controls,
 *     so the drawer never re-implements boundary editing or preset resolution.
 *     It is local (not the shared analytics filter) because the owner asked for
 *     Nuxt UI date controls instead of native HTML date inputs, and changing the
 *     shared filter would alter shared analytics. The initial window is the
 *     current month resolved once by the committed helper.
 *   - `useSellerSalesReport` owns the request, its guards, and the PDF download
 *     flow, which is why this component only forwards events.
 *
 * Downloading is a footer action, not an automatic side effect: the composable
 * asks the backend for a fresh PDF for the same seller/window, and only then are
 * the bytes handed to the browser. The failure copy sits next to the action that
 * produced it, and a short notice explains that the PDF is an independent,
 * freshly generated snapshot.
 *
 * Sales history redesign T2 (design 01/04): the header names the seller (the
 * backend name once loaded) with its Activo/Inactivo state and the generation
 * instant; the footer carries the row count against the backend cap, the PDF
 * notice (or why the PDF is unavailable) and «Descargar PDF» as the one primary
 * action. The row-limit error's «Cambiar periodo» opens the filter's date fields,
 * and an empty period may jump to «Este mes».
 */
import { computed, ref, shallowRef, useTemplateRef } from 'vue'
import AppResponsiveDrawer from '@/core/shared/components/AppResponsiveDrawer.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import SellerReportDateRangeFilter from './SellerReportDateRangeFilter.vue'
import {
  getMexicoCityRangePreset,
  isValidMexicoCityDateRange,
  type MexicoCityRangePresetId,
} from '@/core/shared/utils/mexicoCityCalendar'
import SellerSalesReportContent from './SellerSalesReportContent.vue'
import { useSellerSalesReport } from '../composables/useSellerSalesReport'
import {
  SELLER_REPORT_TIME_ZONE_LABEL,
  formatSellerReportCount,
  formatSellerReportInstant,
} from '../utils/sellerReportPresentation'
import { SELLER_REPORT_ROW_LIMIT } from '../interfaces/seller-report.types'
import '../../styles/users-visual.css'

interface SellerReportSeller {
  id: string
  name: string
  isActive: boolean
}

const props = defineProps<{
  open: boolean
  /** Tenant identity for cache isolation; never sent to the API. */
  tenantId: string | null
  /** The seller the report belongs to, or `null` when none is selected. */
  seller: SellerReportSeller | null
  /** `read:User` AND `read:Sale` AND `read:Analytics`, decided by the view. */
  canRead: boolean
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const RANGE_VALIDATION_MESSAGE =
  'El rango no es válido: la fecha inicial debe ser anterior a la final y el periodo no puede superar 366 días.'

/**
 * Desktop-only slideover width: roughly 45vw (just under half the viewport), never
 * under 640px — the same panel width as the customer history (sales history
 * redesign T2), so the aligned table keeps its columns without a sideways scroll.
 *
 * `AppResponsiveDrawer` forwards this as the `ui` prop of the desktop
 * `USlideover`, so only the report's desktop presentation changes; the mobile
 * bottom sheet keeps its committed styling. Verified against tailwind-merge v3
 * (the merge used by the shared drawer's `tv`): a plain `w-full max-w-none`
 * replaces the default `w-[calc(100%-2rem)]` / `max-w-md`, and the `sm:` pair
 * then sets the 45vw width on desktop. No `!important` syntax is needed.
 */
const DESKTOP_UI = {
  content: 'w-full max-w-none sm:w-[max(45vw,640px)] sm:max-w-[max(45vw,640px)]',
  body: 'p-0',
  header: 'border-b border-default px-4 py-4',
  footer: 'border-t border-default px-4 pb-4 pt-3',
} as const

/** Initial window: the committed current-month preset, resolved once per mount. */
const initialRange = getMexicoCityRangePreset('thisMonth')
const from = ref(initialRange.from)
const to = ref(initialRange.to)
const activePreset = shallowRef<MexicoCityRangePresetId | null>('thisMonth')

const {
  report,
  isInitialLoading,
  isFetching,
  isError,
  failure,
  errorMessage,
  canDownload,
  isDownloading,
  downloadError,
  retry,
  download,
} = useSellerSalesReport({
  tenantId: () => props.tenantId,
  sellerUserId: () => props.seller?.id ?? null,
  from,
  to,
  open: () => props.open,
  canRead: () => props.canRead,
})

const hasLocalRangeError = computed(() => !isValidMexicoCityDateRange(from.value, to.value))
const validationMessage = computed(() =>
  hasLocalRangeError.value ? RANGE_VALIDATION_MESSAGE : undefined,
)

const drawerDescription = computed(() =>
  props.seller
    ? `Ventas confirmadas y canceladas de ${props.seller.name} en el periodo seleccionado.`
    : 'Ventas confirmadas y canceladas del vendedor en el periodo seleccionado.',
)

const filterRef = useTemplateRef<InstanceType<typeof SellerReportDateRangeFilter>>('filterRef')

/** The backend name once loaded (authoritative), the opened seller's name until then. */
const sellerName = computed(() => report.value?.seller.name ?? props.seller?.name ?? '')
const sellerIsActive = computed(() => props.seller?.isActive ?? true)
const failureKind = computed(() => failure.value?.kind ?? null)

/** Why «Descargar PDF» is unavailable, when it is (design 04 · 8 and 10). */
const pdfHint = computed(() => {
  if (failureKind.value === 'row-limit-exceeded') {
    return `Elige un periodo con menos de ${formatSellerReportCount(SELLER_REPORT_ROW_LIMIT)} ventas para descargar el PDF.`
  }
  if (!report.value && isInitialLoading.value) return 'Disponible cuando cargue el reporte.'
  return null
})

/** Preset intent -> committed helper boundaries; never local date arithmetic. */
function onPreset(id: MexicoCityRangePresetId) {
  const range = getMexicoCityRangePreset(id)
  from.value = range.from
  to.value = range.to
  activePreset.value = id
}

/** A manual edit clears only the preset selection and keeps the exact strings. */
function onFromChange(value: string) {
  from.value = value
  activePreset.value = null
}

function onToChange(value: string) {
  to.value = value
  activePreset.value = null
}

function onRetry() {
  void retry()
}

function onDownload() {
  void download()
}

function onChangePeriod() {
  filterRef.value?.openPeriod()
}

function onWidenPeriod() {
  onPreset('thisMonth')
}
</script>

<template>
  <AppResponsiveDrawer
    :open="open"
    title="Reporte de ventas"
    :description="drawerDescription"
    close-aria-label="Cerrar el reporte de ventas"
    :desktop-ui="DESKTOP_UI"
    portal-class="hf-theme hf-ui hf-form-overlay users-form-portal"
    @update:open="emit('update:open', $event)"
  >
    <template #title>
      <div data-testid="seller-report-header" class="flex min-w-0 items-start gap-3">
        <EntityAvatar
          v-if="sellerName"
          :name="sellerName"
          size="lg"
          class="hidden sm:inline-flex"
          aria-hidden="true"
        />
        <div class="grid min-w-0 gap-0.5">
          <p
            class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-normal text-[var(--hf-muted)]"
          >
            <span>Reporte de ventas</span>
            <span v-if="seller" aria-hidden="true">·</span>
            <StatusBadge
              v-if="seller"
              data-testid="seller-report-seller-state"
              :label="sellerIsActive ? 'Activo' : 'Inactivo'"
              :tone="sellerIsActive ? 'success' : 'neutral'"
            />
          </p>
          <p
            data-testid="seller-report-seller-name"
            class="break-words text-[17px] font-semibold leading-tight tracking-[-0.02em] text-[var(--hf-heading)] sm:text-[22px]"
          >
            {{ sellerName }}
          </p>
          <p
            v-if="report"
            data-testid="seller-report-generated-at"
            class="text-[13px] font-normal text-[var(--hf-muted)]"
          >
            Generado el <span class="hf-figure">{{ formatSellerReportInstant(report.generatedAt) }}</span>
            <span data-testid="seller-report-zone">· {{ SELLER_REPORT_TIME_ZONE_LABEL }}</span>
          </p>
        </div>
      </div>
    </template>

    <template #description>
      <span class="sr-only">{{ drawerDescription }}</span>
    </template>

    <template #body>
      <div class="flex w-full min-w-0 max-w-full flex-col gap-3 overflow-x-hidden p-4">
        <SellerReportDateRangeFilter
          ref="filterRef"
          :from="from"
          :to="to"
          :active-preset="activePreset"
          :loading="isInitialLoading"
          :validation-message="validationMessage"
          @update:from="onFromChange"
          @update:to="onToChange"
          @preset="onPreset"
        />

        <p
          v-if="hasLocalRangeError"
          data-testid="seller-report-invalid-range"
          role="status"
          class="text-sm text-muted"
        >
          Ajusta el periodo para consultar el reporte de ventas.
        </p>

        <SellerSalesReportContent
          :report="report"
          :is-initial-loading="isInitialLoading"
          :is-fetching="isFetching"
          :is-error="isError"
          :error-message="errorMessage"
          :failure-kind="failureKind"
          :seller-is-active="sellerIsActive"
          :can-widen-period="activePreset !== 'thisMonth'"
          @retry="onRetry"
          @change-period="onChangePeriod"
          @widen-period="onWidenPeriod"
        />
      </div>
    </template>

    <template #footer>
      <div
        class="flex min-w-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:p-0"
      >
        <div class="flex min-w-0 flex-col gap-0.5">
          <p
            v-if="report"
            data-testid="seller-report-row-count"
            class="hf-figure text-sm text-[var(--hf-muted)]"
          >
            {{ formatSellerReportCount(report.rowCount) }} de
            {{ formatSellerReportCount(report.rowLimit) }} filas permitidas por periodo
          </p>
          <p
            v-if="downloadError"
            data-testid="seller-report-download-error"
            role="alert"
            class="flex items-start gap-1.5 text-sm font-medium text-error"
          >
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{{ downloadError }}</span>
          </p>
          <p
            v-else-if="pdfHint"
            data-testid="seller-report-pdf-hint"
            class="text-xs text-[var(--hf-muted)]"
          >
            {{ pdfHint }}
          </p>
          <p v-else data-testid="seller-report-pdf-notice" class="text-xs text-muted">
            El PDF se genera en el servidor con una consulta nueva del periodo; puede diferir del
            reporte en pantalla.
          </p>
        </div>
        <UButton
          color="primary"
          icon="i-lucide-download"
          data-testid="seller-report-download"
          class="min-h-11 w-full shrink-0 justify-center sm:w-auto"
          :disabled="!canDownload || isDownloading"
          :loading="isDownloading"
          @click="onDownload"
        >
          {{ isDownloading ? 'Preparando…' : downloadError ? 'Reintentar descarga' : 'Descargar PDF' }}
        </UButton>
      </div>
    </template>
  </AppResponsiveDrawer>
</template>
