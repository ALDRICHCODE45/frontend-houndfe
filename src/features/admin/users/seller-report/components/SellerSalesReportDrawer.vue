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
 *   - `useSellerSalesReport` owns the request, its guards, and the print flow,
 *     which is why this component only forwards events.
 *
 * Printing is a footer action, not an automatic side effect: the composable
 * refetches a fresh snapshot, and only then is a document handed to the print
 * dialog. The failure copy sits next to the action that produced it.
 */
import { computed, ref, shallowRef } from 'vue'
import AppResponsiveDrawer from '@/core/shared/components/AppResponsiveDrawer.vue'
import SellerReportDateRangeFilter from './SellerReportDateRangeFilter.vue'
import {
  getMexicoCityRangePreset,
  isValidMexicoCityDateRange,
  type MexicoCityRangePresetId,
} from '@/core/shared/utils/mexicoCityCalendar'
import SellerSalesReportContent from './SellerSalesReportContent.vue'
import { useSellerSalesReport } from '../composables/useSellerSalesReport'

export interface SellerReportSeller {
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
 * Desktop-only slideover width: roughly 45vw (just under half the viewport).
 *
 * `AppResponsiveDrawer` forwards this as the `ui` prop of the desktop
 * `USlideover`, so only the report's desktop presentation changes; the mobile
 * bottom sheet keeps its committed styling. Verified against tailwind-merge v3
 * (the merge used by the shared drawer's `tv`): a plain `w-full max-w-none`
 * replaces the default `w-[calc(100%-2rem)]` / `max-w-md`, and the `sm:` pair
 * then sets the 45vw width on desktop. No `!important` syntax is needed.
 */
const DESKTOP_UI = { content: 'w-full max-w-none sm:w-[45vw] sm:max-w-[45vw]' } as const

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
  errorMessage,
  canPrint,
  isPrinting,
  printError,
  retry,
  print,
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

function onPrint() {
  void print()
}
</script>

<template>
  <AppResponsiveDrawer
    :open="open"
    title="Reporte de ventas"
    :description="drawerDescription"
    close-aria-label="Cerrar el reporte de ventas"
    :desktop-ui="DESKTOP_UI"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="flex w-full min-w-0 flex-col gap-4 px-4 py-4">
        <SellerReportDateRangeFilter
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
          :seller-is-active="seller?.isActive ?? true"
          @retry="onRetry"
        />
      </div>
    </template>

    <template #footer>
      <div
        class="flex min-w-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p
          v-if="printError"
          data-testid="seller-report-print-error"
          role="alert"
          class="text-sm text-error"
        >
          {{ printError }}
        </p>
        <UButton
          color="primary"
          data-testid="seller-report-print"
          class="min-h-11 w-full justify-center sm:w-auto"
          :disabled="!canPrint || isPrinting"
          :loading="isPrinting"
          @click="onPrint"
        >
          {{ isPrinting ? 'Preparando…' : 'Imprimir' }}
        </UButton>
      </div>
    </template>
  </AppResponsiveDrawer>
</template>
