<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type {
  PromotionFormState,
  PromotionMethod,
  PromotionResponse,
  PromotionTargetType,
  PromotionType,
} from '../interfaces/promotion.types'
import { promotionFormSchema } from '../interfaces/promotion.schema'
import {
  BUY_X_GET_Y_PRESETS,
  DISCOUNT_PERCENT_OPTIONS,
  DISCOUNT_TYPE_OPTIONS,
  getInitialState,
  promotionToFormState,
  type FormFieldError,
} from '../composables/usePromotionForm'
import { usePromotionTargetNames } from '../composables/usePromotionTargetNames'
import { usePromotionBotEligibility } from '../composables/usePromotionBotEligibility'
import { getTypeConfig } from '../utils/promotionStatusConfig.utils'
import { computeOverlappingTargets } from '../utils/advancedTargets.utils'
import {
  DISCOUNT_TYPE,
  PROMOTION_METHOD,
  PROMOTION_TYPE,
  TARGET_SIDE,
} from '../constants/promotion.constants'

import PromotionConditionsSection from './PromotionConditionsSection.vue'
import PromotionTargetItemsSection from './PromotionTargetItemsSection.vue'
import PromotionSummaryCard from './PromotionSummaryCard.vue'
import PromotionCapacityField from './PromotionCapacityField.vue'
import HfMoneyInput from '@/core/shared/components/form/HfMoneyInput.vue'
import { parseDecimalInput } from '@/core/shared/utils/money-input.utils'

// ── Props & emits ─────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    type: PromotionType
    mode: 'create' | 'edit'
    initialData?: PromotionResponse | null
    loading?: boolean
    formId?: string
    apiErrors?: FormFieldError[]
  }>(),
  {
    initialData: null,
    loading: false,
    formId: undefined,
    apiErrors: () => [],
  },
)

const emit = defineEmits<{
  submit: [state: PromotionFormState]
  cancel: []
  errorsCleared: []
}>()

// ── Form state ────────────────────────────────────────────────────────────────

const formState = reactive<PromotionFormState>(
  props.initialData ? promotionToFormState(props.initialData) : getInitialState(props.type),
)
const {
  evaluation: botEligibility,
  notice: botEligibilityNotice,
  loadFailed: botEligibilityFailed,
  retry: retryBotEligibility,
} = usePromotionBotEligibility(formState)
function onRetryBotEligibility(): void {
  void retryBotEligibility()
}

// ── Edit-mode name resolution ─────────────────────────────────────────────────
//
// `promotionToFormState` is a PURE function — it hydrates target entries with
// `name: ''` because it has no access to the catalog APIs. In edit mode we
// cross-reference the existing categories/brands/products catalogs to fill in
// the friendly name so the selected-item chips don't fall back to the raw UUID.
// The form renders immediately with the (empty-name) chips and the names
// populate progressively once the catalogs resolve.
const { resolveTargetNames } = usePromotionTargetNames()

async function resolveAndApplyNames() {
  if (props.mode !== 'edit') return
  if (formState.targetItems.length > 0 && formState.targetItems.some((i) => !i.name)) {
    formState.targetItems = await resolveTargetNames(formState.appliesTo, formState.targetItems)
  }
  if (formState.type === PROMOTION_TYPE.ADVANCED) {
    if (formState.buyTargetItems.length > 0 && formState.buyTargetItems.some((i) => !i.name)) {
      formState.buyTargetItems = await resolveTargetNames(
        formState.buyTargetType,
        formState.buyTargetItems,
      )
    }
    if (formState.getTargetItems.length > 0 && formState.getTargetItems.some((i) => !i.name)) {
      formState.getTargetItems = await resolveTargetNames(
        formState.getTargetType,
        formState.getTargetItems,
      )
    }
  }
}

// Fire-and-forget: form already rendered with empty names — names populate
// once the catalog resolves. We deliberately do NOT await this in setup so
// the form mounts synchronously.
void resolveAndApplyNames()

// Sync when initialData changes (edit mode load)
watch(
  () => props.initialData,
  (data) => {
    if (data) {
      Object.assign(formState, promotionToFormState(data))
      void resolveAndApplyNames()
    }
  },
)

// Clear API errors when user modifies the form
watch(
  () => ({ ...formState }),
  () => {
    if (props.apiErrors && props.apiErrors.length > 0) {
      emit('errorsCleared')
    }
  },
  { deep: true },
)

// ── Type config ───────────────────────────────────────────────────────────────

const typeConfig = getTypeConfig(props.type)

// ── Method handler ────────────────────────────────────────────────────────────

function selectMethod(method: PromotionMethod) {
  formState.method = method
}

// ── BUY_X_GET_Y preset handler ────────────────────────────────────────────────

function applyPreset(preset: (typeof BUY_X_GET_Y_PRESETS)[number]) {
  formState.buyQuantity = preset.buyQuantity
  formState.getQuantity = preset.getQuantity
  formState.getDiscountPercent = preset.getDiscountPercent
}

// ── Target type handlers ──────────────────────────────────────────────────────

function onAppliesToChange(type: PromotionTargetType) {
  formState.appliesTo = type
  formState.targetItems = []
}

function onBuyTargetTypeChange(type: PromotionTargetType) {
  formState.buyTargetType = type
  formState.buyTargetItems = []
}

function onGetTargetTypeChange(type: PromotionTargetType) {
  formState.getTargetType = type
  formState.getTargetItems = []
}

// ── Conditions update ─────────────────────────────────────────────────────────

function onConditionsUpdate(updated: PromotionFormState) {
  Object.assign(formState, updated)
}

// ── Submit ────────────────────────────────────────────────────────────────────

// ── Typed amounts (T22/S18) ──────────────────────────────────────────────────
//
// Money is typed in HfMoneyInput (exact cents, one app-wide rule: `70,55` is
// 70.55). The form state keeps its pesos contract (`toCreatePayload` scales it
// back), and pesos made from integer cents always scale back to the same cents.
// A percent is typed as text and read with the same comma rule.

const isFixedDiscount = computed(() => formState.discountType === DISCOUNT_TYPE.FIXED)

function pesosToCentsModel(pesos: number): number | null {
  return pesos ? Math.round(pesos * 100) : null
}

const discountValueCents = computed<number | null>({
  get: () => pesosToCentsModel(formState.discountValue),
  set: (cents) => {
    formState.discountValue = cents == null ? 0 : cents / 100
  },
})

const minPurchaseCents = computed<number | null>({
  get: () => pesosToCentsModel(formState.minPurchaseAmountCents),
  set: (cents) => {
    formState.minPurchaseAmountCents = cents == null ? 0 : cents / 100
  },
})

const amountErrors = reactive({
  discountMoney: null as string | null,
  discountPercent: null as string | null,
  minPurchase: null as string | null,
})

// A hidden money field remounts clean (from the model), so its last parse
// error must not outlive it and block the submit with no message.
watch(isFixedDiscount, () => {
  amountErrors.discountMoney = null
})
watch(
  () => formState.hasMinPurchase,
  () => {
    amountErrors.minPurchase = null
  },
)

const percentText = ref('')
watch(
  () => formState.discountValue,
  (value) => {
    const typed = parseDecimalInput(percentText.value, { maxFractionDigits: 2 })
    if ('text' in typed ? Number(typed.text) === value : !value && percentText.value.trim() === '') return
    percentText.value = value ? String(value) : ''
    amountErrors.discountPercent = null
  },
  { immediate: true },
)

function onPercentText(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value)
  percentText.value = text
  if (text.trim() === '') {
    amountErrors.discountPercent = null
    formState.discountValue = 0
    return
  }
  const parsed = parseDecimalInput(text, { maxFractionDigits: 2 })
  if ('text' in parsed) {
    amountErrors.discountPercent = null
    formState.discountValue = Number(parsed.text)
  } else {
    amountErrors.discountPercent = parsed.error
  }
}

const hasAmountErrors = computed(() => {
  const discountTyped =
    formState.type === PROMOTION_TYPE.PRODUCT_DISCOUNT || formState.type === PROMOTION_TYPE.ORDER_DISCOUNT
  if (!discountTyped) return false
  if (isFixedDiscount.value ? amountErrors.discountMoney : amountErrors.discountPercent) return true
  return formState.type === PROMOTION_TYPE.ORDER_DISCOUNT && formState.hasMinPurchase && Boolean(amountErrors.minPurchase)
})

function onSubmit() {
  if (hasAmountErrors.value) return
  emit('submit', { ...formState })
}

// ── ADVANCED: non-blocking BUY∩GET overlap warning ─────────────────────────────
// Spec (Delta 1 / REQ: Client-Side Disjoint BUY∩GET Validation): warn the user
// BEFORE submit when the same {targetType, targetId} appears on both sides.
// Submit is NOT blocked — backend `advanced_overlapping_targets` is the
// authoritative gate. The warning uses a PURE wrapper helper + computed (NOT
// zod superRefine, which would block submit). The wrapper is shared with
// `usePromotionForm` so the rendered path and the composable test path are
// the same single source of truth.
const overlappingTargets = computed(() =>
  computeOverlappingTargets(
    formState.type,
    formState.buyTargetType || '',
    formState.buyTargetItems,
    formState.getTargetType || '',
    formState.getTargetItems,
  ),
)

const overlapTitle = computed(() =>
  overlappingTargets.value.length === 1
    ? '1 objetivo en común'
    : `${overlappingTargets.value.length} objetivos en común`,
)
</script>

<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <!-- ── Main form ──────────────────────────────────────────────────────── -->
    <div class="flex flex-col gap-6 lg:col-span-2">
      <UForm
        :id="formId"
        :state="formState"
        :schema="promotionFormSchema"
        :errors="apiErrors"
        class="flex flex-col gap-6"
        @submit="onSubmit"
      >
        <!-- ── Card 1: Promoción (shared) ──────────────────────────────── -->
        <UCard class="promotions-form-section">
          <template #header>
            <div class="flex items-center gap-3">
              <div
                data-testid="type-badge"
                class="promotions-type-badge flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
              >
                <UIcon :name="typeConfig.icon" class="h-4 w-4" />
                {{ typeConfig.label }}
              </div>
            </div>
          </template>

          <div class="flex flex-col gap-5">
            <!-- Title -->
            <UFormField label="Nombre de la promoción" name="title" required class="w-full">
              <UInput
                v-model="formState.title"
                class="w-full"
                size="lg"
                :placeholder="
                  type === PROMOTION_TYPE.PRODUCT_DISCOUNT
                    ? 'Ej.: 30% off en zapatos de temporada'
                    : type === PROMOTION_TYPE.ORDER_DISCOUNT
                      ? 'Ej.: 10% en compras mayores a $1,000'
                      : type === PROMOTION_TYPE.BUY_X_GET_Y
                        ? 'Ej.: 2x1 en playeras seleccionadas'
                        : 'Ej.: Compra short → Gorra gratis'
                "
                maxlength="500"
                data-testid="title-input"
                @blur="formState.title = formState.title.trim()"
              />
            </UFormField>

            <!-- Method selector — read-only in edit mode -->
            <div>
              <p class="mb-2 text-sm font-medium text-toned">Cómo se aplica</p>
              <!-- Edit mode: show read-only badge -->
              <div
                v-if="mode === 'edit'"
                data-testid="method-readonly"
                class="inline-flex items-center gap-2 rounded-xl border border-default bg-elevated/50 px-4 py-3"
              >
                <UIcon
                  :name="
                    formState.method === PROMOTION_METHOD.AUTOMATIC
                      ? 'i-lucide-cpu'
                      : 'i-lucide-hand'
                  "
                  class="h-4 w-4 text-toned"
                />
                <span class="text-sm font-medium text-highlighted">
                  {{
                    formState.method === PROMOTION_METHOD.AUTOMATIC
                      ? 'Aplicar automáticamente'
                      : 'Manualmente'
                  }}
                </span>
                <span class="ml-1 text-xs text-muted">(no editable)</span>
              </div>
              <!-- Create mode: interactive cards -->
              <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  v-for="m in [PROMOTION_METHOD.AUTOMATIC, PROMOTION_METHOD.MANUAL] as const"
                  :key="m"
                  type="button"
                  :data-testid="`method-card-${m}`"
                  class="promotions-choice flex cursor-pointer flex-col gap-1 rounded-xl border p-4 text-left transition-colors duration-200"
                  :class="formState.method === m ? 'promotions-choice-selected' : 'border-default'"
                  @click="selectMethod(m)"
                >
                  <div class="flex items-center gap-2">
                    <UIcon
                      :name="m === PROMOTION_METHOD.AUTOMATIC ? 'i-lucide-cpu' : 'i-lucide-hand'"
                      class="h-4 w-4 text-toned"
                    />
                    <span class="text-sm font-medium text-highlighted">
                      {{
                        m === PROMOTION_METHOD.AUTOMATIC ? 'Aplicar automáticamente' : 'Manualmente'
                      }}
                    </span>
                  </div>
                  <p class="text-xs text-muted">
                    {{
                      m === PROMOTION_METHOD.AUTOMATIC
                        ? 'Se aplicará si se cumplen las condiciones'
                        : 'Tú eliges si deseas aplicar el descuento'
                    }}
                  </p>
                </button>
              </div>
            </div>

            <div class="promotions-availability-fields">
              <!-- Capacity editor (PCA-1) — shared across every promotion type -->
              <PromotionCapacityField
                v-model="formState.capacityMode"
                :max-product-units="formState.maxProductUnits"
                :consumed-product-units="formState.consumedProductUnits"
                :remaining-product-units="formState.remainingProductUnits"
                :editing="mode === 'edit'"
                @update:max-product-units="formState.maxProductUnits = $event"
              />
              <UFormField name="botEligible" :description="botEligibilityFailed ? undefined : botEligibility.reason">
                <USwitch
                  v-model="formState.botEligible"
                  label="Disponible para el chatbot (WhatsApp)"
                  :disabled="!botEligibility.supported"
                />
                <div
                  v-if="botEligibilityFailed"
                  role="alert"
                  class="promotions-inline-error"
                  data-testid="bot-eligibility-error"
                >
                  <span>{{ botEligibility.reason }}</span>
                  <button
                    type="button"
                    class="promotions-inline-retry"
                    data-testid="bot-eligibility-retry"
                    @click="onRetryBotEligibility"
                  >
                    Reintentar
                  </button>
                </div>
                <p v-if="botEligibilityNotice" role="status" class="promotions-bot-notice">
                  {{ botEligibilityNotice }}
                </p>
              </UFormField>
            </div>
          </div>
        </UCard>

        <!-- ── Card 2: PRODUCT_DISCOUNT ───────────────────────────────── -->
        <UCard
          v-if="type === PROMOTION_TYPE.PRODUCT_DISCOUNT"
          class="promotions-form-section"
          data-testid="product-discount-section"
        >
          <template #header>
            <h3 class="font-semibold text-highlighted">Valor del descuento</h3>
          </template>

          <div class="flex flex-col gap-5">
            <!-- Discount type + value -->
            <div class="flex gap-3">
              <UFormField label="Tipo" name="discountType" class="flex-1">
                <USelect
                  v-model="formState.discountType"
                  :items="DISCOUNT_TYPE_OPTIONS"
                  value-key="value"
                  label-key="label"
                  placeholder="Seleccionar..."
                  :ui="{ content: 'hf-theme hf-ui hf-form-overlay promotions-form-portal' }"
                />
              </UFormField>
              <UFormField
                label="Valor"
                name="discountValue"
                class="flex-1"
                :error="(!isFixedDiscount && amountErrors.discountPercent) || undefined"
              >
                <HfMoneyInput
                  v-if="isFixedDiscount"
                  id="promotion-discount-value"
                  v-model="discountValueCents"
                  data-testid="promotion-discount-value"
                  :min-cents="1"
                  placeholder="Ej.: 150"
                  size="lg"
                  @validation="amountErrors.discountMoney = $event"
                />
                <UInput
                  v-else
                  :model-value="percentText"
                  data-testid="promotion-discount-value"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  placeholder="1-100"
                  size="lg"
                  @update:model-value="onPercentText"
                >
                  <template #trailing>
                    <span class="text-dimmed text-sm">%</span>
                  </template>
                </UInput>
              </UFormField>
            </div>

            <!-- Target items -->
            <div>
              <p class="mb-2 text-sm font-medium text-toned">Aplica a</p>
              <PromotionTargetItemsSection
                :target-type="formState.appliesTo as PromotionTargetType"
                :selected-items="formState.targetItems"
                :allow-variants="true"
                :side="TARGET_SIDE.DEFAULT"
                @update:target-type="onAppliesToChange"
                @update:selected-items="formState.targetItems = $event"
              />
            </div>
          </div>
        </UCard>

        <!-- ── Card 2: ORDER_DISCOUNT ─────────────────────────────────── -->
        <UCard
          v-else-if="type === PROMOTION_TYPE.ORDER_DISCOUNT"
          class="promotions-form-section"
          data-testid="order-discount-section"
        >
          <template #header>
            <h3 class="font-semibold text-highlighted">Valor del descuento</h3>
          </template>

          <div class="flex flex-col gap-5">
            <!-- Discount type + value -->
            <div class="flex gap-3">
              <UFormField label="Tipo" name="discountType" class="flex-1">
                <USelect
                  v-model="formState.discountType"
                  :items="DISCOUNT_TYPE_OPTIONS"
                  value-key="value"
                  label-key="label"
                  placeholder="Seleccionar..."
                  :ui="{ content: 'hf-theme hf-ui hf-form-overlay promotions-form-portal' }"
                />
              </UFormField>
              <UFormField
                label="Valor"
                name="discountValue"
                class="flex-1"
                :error="(!isFixedDiscount && amountErrors.discountPercent) || undefined"
              >
                <HfMoneyInput
                  v-if="isFixedDiscount"
                  id="promotion-discount-value"
                  v-model="discountValueCents"
                  data-testid="promotion-discount-value"
                  :min-cents="1"
                  placeholder="Ej.: 150"
                  size="lg"
                  @validation="amountErrors.discountMoney = $event"
                />
                <UInput
                  v-else
                  :model-value="percentText"
                  data-testid="promotion-discount-value"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  placeholder="1-100"
                  size="lg"
                  @update:model-value="onPercentText"
                >
                  <template #trailing>
                    <span class="text-dimmed text-sm">%</span>
                  </template>
                </UInput>
              </UFormField>
            </div>

            <!-- Min purchase toggle -->
            <div>
              <UCheckbox v-model="formState.hasMinPurchase" label="Añadir monto mínimo de compra" />
              <div v-if="formState.hasMinPurchase" class="mt-3 pl-6">
                <UFormField label="Monto mínimo ($)" name="minPurchaseAmountCents">
                  <HfMoneyInput
                    id="promotion-min-purchase"
                    v-model="minPurchaseCents"
                    data-testid="promotion-min-purchase"
                    placeholder="Ej.: 1000"
                    size="lg"
                    @validation="amountErrors.minPurchase = $event"
                  />
                </UFormField>
              </div>
            </div>
          </div>
        </UCard>

        <!-- ── Card 2: BUY_X_GET_Y ───────────────────────────────────── -->
        <UCard
          v-else-if="type === PROMOTION_TYPE.BUY_X_GET_Y"
          class="promotions-form-section"
          data-testid="buy-x-get-y-section"
        >
          <template #header>
            <h3 class="font-semibold text-highlighted">Tipo de promoción</h3>
          </template>

          <div class="flex flex-col gap-5">
            <!-- Presets -->
            <div>
              <p class="mb-2 text-sm font-medium text-toned">Combinaciones rápidas</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="preset in BUY_X_GET_Y_PRESETS"
                  :key="preset.label"
                  type="button"
                  :data-testid="`preset-${preset.label.replace(/\s+/g, '').toLowerCase()}`"
                  class="promotions-preset cursor-pointer rounded-lg border border-default px-3 py-1.5 text-sm text-highlighted transition-colors duration-200"
                  @click="applyPreset(preset)"
                >
                  {{ preset.label }}
                </button>
              </div>
            </div>

            <!-- Quantities -->
            <div class="grid grid-cols-3 gap-4">
              <UFormField label="Compra" name="buyQuantity">
                <UInputNumber v-model="formState.buyQuantity" :min="1" placeholder="2" size="lg" />
              </UFormField>
              <UFormField label="Lleva" name="getQuantity">
                <UInputNumber v-model="formState.getQuantity" :min="1" placeholder="1" size="lg" />
              </UFormField>
              <UFormField label="Descuento obtiene" name="getDiscountPercent">
                <USelect
                  :model-value="formState.getDiscountPercent"
                  :items="DISCOUNT_PERCENT_OPTIONS"
                  value-key="value"
                  label-key="label"
                  size="lg"
                  class="w-full"
                  :ui="{ content: 'hf-theme hf-ui hf-form-overlay promotions-form-portal' }"
                  @update:model-value="formState.getDiscountPercent = Number($event)"
                />
              </UFormField>
            </div>

            <!-- Target items -->
            <div>
              <p class="mb-2 text-sm font-medium text-toned">Aplica a</p>
              <PromotionTargetItemsSection
                :target-type="formState.appliesTo as PromotionTargetType"
                :selected-items="formState.targetItems"
                :allow-variants="true"
                :side="TARGET_SIDE.DEFAULT"
                @update:target-type="onAppliesToChange"
                @update:selected-items="formState.targetItems = $event"
              />
            </div>
          </div>
        </UCard>

        <!-- ── Card 2: ADVANCED ───────────────────────────────────────── -->
        <UCard
          v-else-if="type === PROMOTION_TYPE.ADVANCED"
          class="promotions-form-section"
          data-testid="advanced-section"
        >
          <template #header>
            <h3 class="font-semibold text-highlighted">Condiciones</h3>
          </template>

          <div class="grid gap-6 lg:grid-cols-2">
            <!-- BUY side -->
            <div class="flex flex-col gap-4">
              <p class="font-medium text-highlighted">Si el cliente compra</p>
              <UFormField label="Cantidad" name="buyQuantity">
                <UInputNumber v-model="formState.buyQuantity" :min="1" placeholder="2" size="lg" />
              </UFormField>
              <PromotionTargetItemsSection
                :target-type="formState.buyTargetType as PromotionTargetType"
                :selected-items="formState.buyTargetItems"
                :allow-variants="true"
                :side="TARGET_SIDE.BUY"
                label="Elementos de cualquiera de los siguientes"
                @update:target-type="onBuyTargetTypeChange"
                @update:selected-items="formState.buyTargetItems = $event"
              />
            </div>

            <!-- GET side -->
            <div class="flex flex-col gap-4">
              <p class="font-medium text-highlighted">El cliente obtiene</p>
              <div class="grid grid-cols-2 gap-3">
                <UFormField label="Cantidad" name="getQuantity">
                  <UInputNumber
                    v-model="formState.getQuantity"
                    :min="1"
                    placeholder="1"
                    size="lg"
                  />
                </UFormField>
                <UFormField label="Descuento" name="getDiscountPercent">
                  <USelect
                    :model-value="formState.getDiscountPercent"
                    :items="DISCOUNT_PERCENT_OPTIONS"
                    value-key="value"
                    label-key="label"
                    size="lg"
                    class="w-full"
                    :ui="{ content: 'hf-theme hf-ui hf-form-overlay promotions-form-portal' }"
                    @update:model-value="formState.getDiscountPercent = Number($event)"
                  />
                </UFormField>
              </div>
              <PromotionTargetItemsSection
                :target-type="formState.getTargetType as PromotionTargetType"
                :selected-items="formState.getTargetItems"
                :allow-variants="true"
                :side="TARGET_SIDE.GET"
                label="De cualquiera de los siguientes"
                @update:target-type="onGetTargetTypeChange"
                @update:selected-items="formState.getTargetItems = $event"
              />
            </div>
          </div>

          <!-- ── Non-blocking overlap warning (advanced-promotion-type WU-A) ──
               Spec: surface a non-blocking UI hint when BUY and GET share a
               target. Submit is NOT blocked — backend
               `advanced_overlapping_targets` is the authoritative gate. The
               warning uses the PURE `findOverlappingTargets` helper + a
               `computed`, NOT zod `superRefine` (which would block submit). -->
          <UAlert
            v-if="overlappingTargets.length > 0"
            color="warning"
            icon="i-lucide-triangle-alert"
            data-testid="overlap-alert"
            class="mt-4"
            :title="overlapTitle"
            description="Los objetivos de compra y obtención no pueden superponerse. El backend rechazará la promoción si los mismos productos aparecen en ambos lados."
          />
        </UCard>

        <!-- ── Conditions section ──────────────────────────────────────── -->
        <PromotionConditionsSection
          :model-value="formState"
          :mode="mode"
          @update:model-value="onConditionsUpdate"
        />

        <!-- ── Action buttons ─────────────────────────────────────────── -->
        <!-- Hosted by a workspace that supplies `formId`, the header owns the
             one primary action, so the footer is omitted. -->
        <div v-if="!formId" class="flex justify-end gap-3">
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            data-testid="cancel-btn"
            @click="emit('cancel')"
          >
            Cancelar
          </UButton>
          <UButton
            type="submit"
            :loading="loading"
            color="primary"
            class="hf-primary-control"
            data-testid="submit-btn"
          >
            {{ mode === 'create' ? 'Crear promoción' : 'Guardar cambios' }}
          </UButton>
        </div>
      </UForm>
    </div>

    <!-- ── Summary sidebar ───────────────────────────────────────────────── -->
    <div class="hidden lg:block">
      <PromotionSummaryCard :form-state="formState" />
    </div>
  </div>
</template>
