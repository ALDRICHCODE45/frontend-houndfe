<script setup lang="ts">
/**
 * CustomerCollectionSlideover — «Cobrar todo» for one customer (handoff 30 §9).
 *
 * The tenders reuse the counter/debt charge pieces (method tiles incl. catalog methods, 1-5
 * entries, optional reference ≤ 120 on non-cash tenders) and the cash session follows the debt
 * payment rule: one own OPEN session is used as is, several need an explicit choice, none blocks.
 * Here the session is required for every collection (Q7), not only for cash.
 *
 * The flow (live preview, confirm gate, idempotency, 409 / IN_FLIGHT / 422) lives in
 * `useCustomerCollection`; this sheet only renders it. Success shows the result and the
 * «Comprobante de cobro» downloads.
 */
import { computed, ref, watch } from 'vue'
import type { PaymentEntry } from '@/features/POS/sales/interfaces/sale.types'
import { PAYMENT_METHOD } from '@/features/POS/sales/constants/sale.constants'
import {
  MAX_PAYMENT_ENTRIES,
  addEntry,
  normalizeReferenceInput,
  paidSum,
  removeEntry,
  updateEntry,
  validateEntry,
} from '@/features/POS/sales/utils/paymentEntries.utils'
import {
  buildMergedMethodOptions,
  findEntryIndex,
  getMethodCount,
  paymentEntryKey,
  paymentMethodTileKey,
  resolveEntryDisplay,
  type PaymentMethodTile,
} from '@/features/POS/sales/utils/paymentMethodTile.utils'
import { useSalePaymentMethods } from '@/features/POS/sales/composables/useSalePaymentMethods'
import { useCashRegisterNames } from '@/features/POS/sales/composables/useCashRegisterNames'
import CashSaleSessionPicker from '@/features/POS/sales/components/CashSaleSessionPicker.vue'
import { useCashSaleSession } from '@/features/POS/cash-register/composables/useCashSaleSession'
import { useCashAccess } from '@/features/POS/cash-register/composables/useCashAccess'
import { PAYMENT_METHOD_CATEGORY_ICONS } from '@/core/shared/constants/payment-method-category'
import HfMoneyInput from '@/core/shared/components/form/HfMoneyInput.vue'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import { useCustomerCollection } from '../collection/useCustomerCollection'
import { useCollectionReceiptDownload } from '../collection/useCollectionReceiptDownload'
import type { CollectionTender } from '../collection/collection.types'
import CustomerCollectionSaleList from './CustomerCollectionSaleList.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    customerId: string
    customerName: string
    portalClass?: string
  }>(),
  { portalClass: 'hf-theme hf-ui hf-form-overlay' },
)

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const REFERENCE_MAX_LENGTH = 120
const CAJA_PATH = '/pos/caja'
const CATALOG_CODES: ReadonlySet<string> = new Set([
  'PAYMENT_METHOD_NOT_FOUND',
  'INACTIVE_PAYMENT_METHOD',
])

const entries = ref<PaymentEntry[]>([])
const amountTextErrors = ref<Record<string, string>>({})

const { data: projection, refetch: refetchMethods } = useSalePaymentMethods()
const methodOptions = computed<PaymentMethodTile[]>(() =>
  buildMergedMethodOptions(projection.value ?? []),
)

const cashSaleSession = useCashSaleSession()
const cashAccess = useCashAccess()
const registerNames = useCashRegisterNames()
const canOpenCashSession = computed(() => cashAccess.canOpenSession.value)
const openCashSessions = computed(() => cashSaleSession.availableSessions.value)
const needsCashSessionPick = computed(() => openCashSessions.value.length > 1)
const cashSessionId = computed<string | null>(() => {
  const sessions = openCashSessions.value
  if (sessions.length === 1) return sessions[0]!.id
  if (sessions.length > 1 && cashSaleSession.isSelectionEligible.value)
    return cashSaleSession.selectedId.value
  return null
})
const cashSessionLoading = computed(() => cashSaleSession.isFetching.value)
const cashSessionLoadFailed = computed(
  () => !cashSessionLoading.value && cashSaleSession.isError.value,
)
const cashSessionMissing = computed(
  () =>
    !cashSessionLoading.value &&
    !cashSaleSession.isError.value &&
    openCashSessions.value.length === 0,
)

const collection = useCustomerCollection({
  customerId: () => props.customerId,
  open: () => props.open,
  cashSessionId: () => cashSessionId.value,
})
const { preview, previewLoading, previewError, result, isSubmitting, applyError, notice } =
  collection

const receipt = useCollectionReceiptDownload(() => result.value?.collectionId)

const debtCents = computed(() => preview.value?.debtCents ?? 0)
const tenderedCents = computed(() => paidSum(entries.value))
const entryErrors = computed(() => entries.value.map((entry) => validateEntry(entry)))
const hasAmountTextErrors = computed(() =>
  entries.value.some((entry) => amountTextErrors.value[paymentEntryKey(entry)]),
)
const canAddEntry = computed(() => entries.value.length < MAX_PAYMENT_ENTRIES)
const canConfirm = computed(() => collection.canConfirm.value && !hasAmountTextErrors.value)
const confirmLabel = computed(() => `Cobrar ${formatCentsMXN(preview.value?.appliedCents ?? 0)}`)

const slideoverUi = computed(() => ({
  content: `sm:max-w-lg ${props.portalClass}`.trim(),
  body: 'p-0 flex flex-col h-full',
}))

function toTender(entry: PaymentEntry): CollectionTender {
  const tender: CollectionTender = { method: entry.method, amountCents: entry.amountCents }
  if (entry.paymentMethodId !== undefined) tender.paymentMethodId = entry.paymentMethodId
  const reference = normalizeReferenceInput(entry.reference ?? undefined)
  if (typeof reference === 'string') tender.reference = reference.slice(0, REFERENCE_MAX_LENGTH)
  return tender
}

watch(
  entries,
  (current) => {
    const live = new Set(current.map(paymentEntryKey))
    const kept = Object.fromEntries(
      Object.entries(amountTextErrors.value).filter(([key]) => live.has(key)),
    )
    if (Object.keys(kept).length !== Object.keys(amountTextErrors.value).length)
      amountTextErrors.value = kept
    collection.setPayments(current.map(toTender))
  },
  { deep: true },
)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    // The composable previews without tenders on open; only a reopened sheet has entries to drop.
    if (entries.value.length > 0) entries.value = []
    amountTextErrors.value = {}
    cashSaleSession.clearSelection()
    // Fresh own/OPEN sessions each time the sheet opens (a till may have opened meanwhile).
    void cashSaleSession.refetch()
  },
  { immediate: true },
)

watch(
  () => applyError.value?.code ?? previewError.value?.code ?? null,
  (code) => {
    if (!code) return
    if (code.startsWith('CASH_')) void cashSaleSession.refetch()
    if (CATALOG_CODES.has(code)) {
      void refetchMethods()
      entries.value = entries.value.filter((entry) => entry.paymentMethodId === undefined)
    }
  },
)

function handleMethodToggle(tile: PaymentMethodTile) {
  const index = findEntryIndex(entries.value, tile)
  entries.value =
    index >= 0
      ? removeEntry(entries.value, index)
      : addEntry(entries.value, tile.value, debtCents.value, tile.paymentMethodId)
}

function handleAmountChange(index: number, amountCents: number | null) {
  entries.value = updateEntry(entries.value, index, { amountCents: Math.max(0, amountCents ?? 0) })
}

function handleAmountValidation(entry: PaymentEntry, error: string | null) {
  const { [paymentEntryKey(entry)]: _previous, ...rest } = amountTextErrors.value
  void _previous
  amountTextErrors.value = error ? { ...rest, [paymentEntryKey(entry)]: error } : rest
}

function handleReferenceChange(index: number, reference: string) {
  entries.value = updateEntry(entries.value, index, { reference })
}

async function handleConfirm() {
  if (!canConfirm.value) return
  // Several sessions: the explicit choice is revalidated live right before the money moves.
  if (needsCashSessionPick.value && !cashSaleSession.revalidateSelection()) return
  await collection.confirm()
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <USlideover
    :open="open"
    title="Cobrar todo"
    :description="`Cobro de la deuda de ${customerName}`"
    inset
    :dismissible="!isSubmitting"
    :ui="slideoverUi"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="flex h-full max-h-[100dvh] min-w-0 flex-col">
        <div class="shrink-0 space-y-3 border-b border-default px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-lg font-semibold text-(--hf-heading)">
                {{ result ? 'Cobro registrado' : 'Cobrar todo' }}
              </p>
              <p
                data-testid="collection-customer"
                class="break-words text-[13px] text-(--hf-muted)"
              >
                {{ customerName }}
              </p>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="min-h-11 min-w-11 justify-center"
              aria-label="Cerrar cobro"
              :disabled="isSubmitting"
              @click="close"
            />
          </div>
          <div
            v-if="!result"
            class="rounded-xl border border-default bg-(--hf-surface-muted) px-5 py-3 text-center"
          >
            <p class="text-[13px] font-semibold text-(--hf-muted)">Deuda total</p>
            <p
              data-testid="collection-total-debt"
              class="hf-figure mt-1 text-3xl font-semibold text-(--hf-heading)"
            >
              <USkeleton v-if="!preview" class="mx-auto h-8 w-32 !rounded" />
              <template v-else>{{ formatCentsMXN(preview.debtCents) }}</template>
            </p>
          </div>
        </div>

        <!-- Success -->
        <div
          v-if="result"
          data-testid="collection-result"
          class="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-5 py-4"
        >
          <p
            role="status"
            class="flex items-center gap-2 text-sm font-semibold text-(--hf-success)"
          >
            <UIcon name="i-lucide-circle-check" class="size-5" aria-hidden="true" />
            Se abonaron {{ formatCentsMXN(result.appliedCents) }}
          </p>
          <CustomerCollectionSaleList
            :sales="result.sales"
            caption="Ventas abonadas en este cobro"
          />
          <dl class="grid gap-2 rounded-xl border border-default bg-elevated px-4 py-3 text-sm">
            <div class="flex items-center justify-between gap-2">
              <dt>Recibido</dt>
              <dd class="hf-figure font-semibold">{{ formatCentsMXN(result.tenderedCents) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-2">
              <dt>Cambio</dt>
              <dd data-testid="collection-result-change" class="hf-figure font-semibold">
                {{ formatCentsMXN(result.changeDueCents) }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-2">
              <dt>Deuda restante del cliente</dt>
              <dd data-testid="collection-result-remaining" class="hf-figure font-semibold">
                {{
                  result.remainingCustomerDebtCents === null
                    ? 'No disponible'
                    : formatCentsMXN(result.remainingCustomerDebtCents)
                }}
              </dd>
            </div>
          </dl>
          <div class="grid gap-2 sm:grid-cols-2">
            <UButton
              data-testid="collection-receipt-ticket"
              color="neutral"
              variant="outline"
              icon="i-lucide-printer"
              class="min-h-11 justify-center"
              :loading="receipt.downloading.value === 'ticket'"
              :disabled="receipt.downloading.value !== null"
              @click="receipt.download('ticket')"
            >
              Imprimir comprobante
            </UButton>
            <UButton
              data-testid="collection-receipt-a4"
              color="neutral"
              variant="outline"
              icon="i-lucide-file-down"
              class="min-h-11 justify-center"
              :loading="receipt.downloading.value === 'a4'"
              :disabled="receipt.downloading.value !== null"
              @click="receipt.download('a4')"
            >
              Descargar A4
            </UButton>
          </div>
          <p v-if="receipt.error.value" role="alert" class="text-sm text-(--hf-danger)">
            {{ receipt.error.value }}
          </p>
        </div>

        <!-- Form -->
        <div v-else class="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-5 py-4">
          <UAlert
            v-if="notice"
            data-testid="collection-notice"
            color="warning"
            variant="subtle"
            icon="i-lucide-refresh-cw"
            :description="notice"
            role="status"
          />
          <UAlert
            v-if="applyError"
            data-testid="collection-apply-error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :description="applyError.message"
            role="alert"
          />

          <section class="space-y-2" aria-labelledby="collection-sales-title">
            <p id="collection-sales-title" class="text-sm font-semibold text-highlighted">
              Ventas con deuda · vencimiento más viejo primero
            </p>
            <div v-if="!preview && previewLoading" class="grid gap-2" aria-hidden="true">
              <USkeleton v-for="index in 3" :key="index" class="h-20 w-full !rounded-xl" />
            </div>
            <CustomerCollectionSaleList
              v-else-if="preview"
              :sales="preview.sales"
              caption="Ventas con deuda, en el orden en que se abonan"
            />
          </section>

          <USeparator />

          <section class="space-y-3">
            <p class="text-sm font-semibold text-highlighted">Métodos de pago</p>
            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="option in methodOptions"
                :key="paymentMethodTileKey(option)"
                :data-testid="
                  option.kind === 'custom'
                    ? `collection-method-custom-${option.paymentMethodId}`
                    : `collection-method-${option.value}`
                "
                :aria-pressed="getMethodCount(entries, option) > 0"
                type="button"
                class="relative min-h-11 rounded-xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
                :class="
                  getMethodCount(entries, option) > 0
                    ? 'border-(--hf-action) bg-(--hf-active-soft)'
                    : 'border-default bg-elevated hover:border-(--hf-action) hover:bg-(--hf-active-soft)'
                "
                :disabled="
                  (getMethodCount(entries, option) === 0 && !canAddEntry) ||
                  isSubmitting ||
                  !preview
                "
                @click="handleMethodToggle(option)"
              >
                <UIcon
                  :name="option.icon"
                  class="mb-1 size-5 text-(--hf-action)"
                  aria-hidden="true"
                />
                <p class="text-sm font-semibold text-highlighted">{{ option.label }}</p>
                <p
                  v-if="option.kind === 'custom' && (option.subtitle?.trim() ?? '') !== ''"
                  class="text-xs text-muted"
                >
                  {{ option.subtitle }}
                </p>
              </button>
            </div>
            <p v-if="!canAddEntry" class="text-xs text-(--hf-warning)">
              Máximo {{ MAX_PAYMENT_ENTRIES }} pagos
            </p>

            <div
              v-for="(entry, index) in entries"
              :key="paymentEntryKey(entry)"
              :data-testid="`collection-entry-${index}`"
              class="space-y-3 rounded-xl border border-default bg-default px-3 py-3"
            >
              <div class="flex items-center gap-3">
                <UIcon
                  :name="PAYMENT_METHOD_CATEGORY_ICONS[entry.method]"
                  class="size-4 shrink-0 text-(--hf-action)"
                  aria-hidden="true"
                />
                <p class="min-w-0 flex-1 text-sm font-semibold text-highlighted">
                  {{ resolveEntryDisplay(entry, methodOptions).label }}
                </p>
                <UButton
                  :aria-label="`Quitar pago ${index + 1}`"
                  type="button"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  class="min-h-11 min-w-11 justify-center"
                  :disabled="isSubmitting"
                  @click="entries = removeEntry(entries, index)"
                />
              </div>
              <UFormField label="Monto" :error="entryErrors[index]?.amountCents">
                <HfMoneyInput
                  :id="`collection-amount-${index}`"
                  :data-testid="`collection-amount-${index}`"
                  :model-value="entry.amountCents"
                  :disabled="isSubmitting"
                  class="w-full"
                  @update:model-value="handleAmountChange(index, $event)"
                  @validation="handleAmountValidation(entry, $event)"
                />
              </UFormField>
              <UFormField v-if="entry.method !== PAYMENT_METHOD.CASH" label="Referencia (opcional)">
                <UInput
                  :data-testid="`collection-reference-${index}`"
                  :model-value="entry.reference ?? ''"
                  :maxlength="REFERENCE_MAX_LENGTH"
                  placeholder="Ej: VOUCHER-123"
                  :disabled="isSubmitting"
                  class="w-full"
                  @update:model-value="handleReferenceChange(index, String($event ?? ''))"
                />
              </UFormField>
            </div>
          </section>

          <section class="space-y-2" data-testid="collection-session" aria-label="Caja del cobro">
            <p class="text-sm font-semibold text-highlighted">Caja</p>
            <p
              v-if="cashSessionLoading && openCashSessions.length === 0"
              class="text-xs text-muted"
            >
              Buscando tu caja abierta…
            </p>
            <p v-else-if="cashSessionLoadFailed" class="text-sm text-(--hf-danger)" role="alert">
              No se pudo revisar tu caja, así que no puedes cobrar por ahora.
            </p>
            <div
              v-else-if="cashSessionMissing"
              data-testid="collection-session-missing"
              class="space-y-2 rounded-xl border border-default bg-elevated px-4 py-3"
              role="alert"
            >
              <p v-if="canOpenCashSession" class="text-sm font-semibold text-(--hf-warning)">
                Abre tu caja para cobrar: todo cobro entra a una caja abierta.
              </p>
              <p v-else class="text-sm font-semibold text-(--hf-warning)">
                No puedes abrir caja. Pide a un cajero con caja abierta que haga el cobro.
              </p>
              <UButton
                v-if="canOpenCashSession"
                :to="CAJA_PATH"
                color="neutral"
                variant="soft"
                icon="i-lucide-wallet"
                class="min-h-11"
              >
                Ir a Caja
              </UButton>
            </div>
            <template v-else-if="needsCashSessionPick">
              <CashSaleSessionPicker
                :sessions="openCashSessions"
                :selected-id="cashSaleSession.selectedId.value"
                :is-selection-eligible="cashSaleSession.isSelectionEligible.value"
                :is-fetching="cashSaleSession.isFetching.value"
                :is-error="cashSaleSession.isError.value"
                :page="cashSaleSession.page.value"
                :page-count="cashSaleSession.pageCount.value"
                :total="cashSaleSession.total.value"
                :portal-class="portalClass"
                :register-names="registerNames"
                :allow-unbound="false"
                @update:selected-id="cashSaleSession.selectSession($event)"
                @update:page="cashSaleSession.setPage($event)"
              />
              <p v-if="cashSessionId === null" class="text-xs text-muted">
                Elige la caja donde entra el cobro.
              </p>
            </template>
          </section>
        </div>

        <!-- Footer -->
        <div class="shrink-0 space-y-3 border-t border-default bg-default px-5 py-4">
          <template v-if="!result">
            <dl
              class="grid gap-1.5 rounded-xl border border-default bg-elevated px-4 py-3 text-sm"
              aria-live="polite"
            >
              <div class="flex items-center justify-between gap-2">
                <dt>Recibido</dt>
                <dd class="hf-figure font-semibold">{{ formatCentsMXN(tenderedCents) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-2">
                <dt>Cambio</dt>
                <dd data-testid="collection-change" class="hf-figure font-semibold">
                  {{ formatCentsMXN(preview?.changeDueCents ?? 0) }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-2">
                <dt>Queda debiendo</dt>
                <dd
                  data-testid="collection-remaining"
                  class="hf-figure font-semibold text-(--hf-warning)"
                >
                  {{ formatCentsMXN(preview?.remainingCustomerDebtCents ?? 0) }}
                </dd>
              </div>
            </dl>
            <p v-if="previewLoading && preview" class="text-xs text-muted" role="status">
              Calculando…
            </p>
            <div v-if="previewError" class="flex items-start justify-between gap-2">
              <p
                data-testid="collection-preview-error"
                role="alert"
                class="text-sm text-(--hf-danger)"
              >
                {{ previewError.message }}
              </p>
              <UButton
                v-if="previewError.network || previewError.code === 'UNKNOWN'"
                color="neutral"
                variant="outline"
                size="sm"
                class="min-h-11 shrink-0"
                @click="collection.refreshPreview()"
              >
                Reintentar
              </UButton>
            </div>
            <div class="flex flex-wrap justify-end gap-2">
              <UButton
                color="neutral"
                variant="soft"
                class="min-h-11"
                :disabled="isSubmitting"
                @click="close"
              >
                Cancelar
              </UButton>
              <UButton
                data-testid="collection-confirm"
                class="hf-primary-control min-h-11 justify-center"
                :loading="isSubmitting"
                :disabled="!canConfirm"
                @click="handleConfirm"
              >
                {{ confirmLabel }}
              </UButton>
            </div>
          </template>
          <div v-else class="flex justify-end">
            <UButton
              data-testid="collection-done"
              class="hf-primary-control min-h-11 justify-center"
              @click="close"
            >
              Listo
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
