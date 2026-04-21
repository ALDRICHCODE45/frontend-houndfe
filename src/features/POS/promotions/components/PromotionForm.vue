<script setup lang="ts">
import { reactive, watch } from 'vue'
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
  DISCOUNT_TYPE_OPTIONS,
  getInitialState,
  promotionToFormState,
  type FormFieldError,
} from '../composables/usePromotionForm'
import { getTypeConfig } from '../utils/promotionStatusConfig.utils'

// ── Discount percent select options ───────────────────────────────────────────
const DISCOUNT_PERCENT_OPTIONS = [
  { label: 'Gratis', value: 0 },
  ...Array.from({ length: 19 }, (_, i) => {
    const pct = (i + 1) * 5
    return { label: `${pct}% OFF`, value: pct }
  }),
]
import PromotionConditionsSection from './PromotionConditionsSection.vue'
import PromotionTargetItemsSection from './PromotionTargetItemsSection.vue'
import PromotionSummaryCard from './PromotionSummaryCard.vue'

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

// Sync when initialData changes (edit mode load)
watch(
  () => props.initialData,
  (data) => {
    if (data) {
      Object.assign(formState, promotionToFormState(data))
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

function onSubmit() {
  emit('submit', { ...formState })
}
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
        <UCard>
          <template #header>
            <div class="flex items-center gap-3">
              <div
                data-testid="type-badge"
                class="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary"
              >
                <UIcon :name="typeConfig.icon" class="h-4 w-4" />
                {{ typeConfig.label }}
              </div>
            </div>
          </template>

          <div class="flex flex-col gap-5">
            <!-- Title -->
            <UFormField label="Nombre de la Promoción" name="title" required class="w-full">
              <UInput
                v-model="formState.title"
                class="w-full"
                size="lg"
                :placeholder="
                  type === 'PRODUCT_DISCOUNT'
                    ? 'Ej.: 30% off en zapatos de temporada'
                    : type === 'ORDER_DISCOUNT'
                      ? 'Ej.: 10% en compras mayores a $1,000'
                      : type === 'BUY_X_GET_Y'
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
              <p class="mb-2 text-sm font-medium text-toned">
                Cómo se Aplica
              </p>
              <!-- Edit mode: show read-only badge -->
              <div
                v-if="mode === 'edit'"
                data-testid="method-readonly"
                class="inline-flex items-center gap-2 rounded-xl border border-default bg-elevated/50 px-4 py-3"
              >
                <UIcon
                  :name="formState.method === 'AUTOMATIC' ? 'i-lucide-cpu' : 'i-lucide-hand'"
                  class="h-4 w-4 text-toned"
                />
                <span class="text-sm font-medium text-highlighted">
                  {{ formState.method === 'AUTOMATIC' ? 'Aplicar automáticamente' : 'Manualmente' }}
                </span>
                <span class="ml-1 text-xs text-muted">(no editable)</span>
              </div>
              <!-- Create mode: interactive cards -->
              <div v-else class="grid grid-cols-2 gap-3">
                <button
                  v-for="m in ['AUTOMATIC', 'MANUAL'] as const"
                  :key="m"
                  type="button"
                  :data-testid="`method-card-${m}`"
                  class="flex cursor-pointer flex-col gap-1 rounded-xl border p-4 text-left transition-all duration-200"
                  :class="
                    formState.method === m
                      ? 'border-primary bg-primary/15 ring-1 ring-primary/35'
                      : 'border-default bg-elevated/20 hover:border-primary/40 hover:bg-elevated/60'
                  "
                  @click="selectMethod(m)"
                >
                  <div class="flex items-center gap-2">
                    <UIcon
                      :name="m === 'AUTOMATIC' ? 'i-lucide-cpu' : 'i-lucide-hand'"
                      class="h-4 w-4 text-toned"
                    />
                    <span class="text-sm font-medium text-highlighted">
                      {{ m === 'AUTOMATIC' ? 'Aplicar automáticamente' : 'Manualmente' }}
                    </span>
                  </div>
                  <p class="text-xs text-muted">
                    {{
                      m === 'AUTOMATIC'
                        ? 'Se aplicará si se cumplen las condiciones'
                        : 'Tú eliges si deseas aplicar el descuento'
                    }}
                  </p>
                </button>
              </div>
            </div>
          </div>
        </UCard>

        <!-- ── Card 2: PRODUCT_DISCOUNT ───────────────────────────────── -->
        <UCard v-if="type === 'PRODUCT_DISCOUNT'" data-testid="product-discount-section">
          <template #header>
            <h3 class="font-semibold text-highlighted">Valor del Descuento</h3>
          </template>

          <div class="flex flex-col gap-5">
            <!-- Discount type + value -->
            <div class="flex gap-3">
              <UFormField label="Tipo" name="discountType" class="w-44 shrink-0">
                <USelect
                  v-model="formState.discountType"
                  :items="DISCOUNT_TYPE_OPTIONS"
                  value-key="value"
                  label-key="label"
                  placeholder="Seleccionar..."
                />
              </UFormField>
              <UFormField label="Valor" name="discountValue" class="flex-1">
                <UInputNumber
                  v-model="formState.discountValue"
                  :min="formState.discountType === 'PERCENTAGE' ? 1 : 1"
                  :max="formState.discountType === 'PERCENTAGE' ? 100 : undefined"
                  :placeholder="formState.discountType === 'PERCENTAGE' ? '1-100' : 'Centavos'"
                  size="lg"
                >
                  <template #trailing>
                    <span class="text-dimmed text-sm">
                      {{ formState.discountType === 'PERCENTAGE' ? '%' : '$' }}
                    </span>
                  </template>
                </UInputNumber>
              </UFormField>
            </div>

            <!-- Target items -->
            <div>
              <p class="mb-2 text-sm font-medium text-toned">Aplica a</p>
              <PromotionTargetItemsSection
                :target-type="(formState.appliesTo as PromotionTargetType) || 'PRODUCTS'"
                :selected-items="formState.targetItems"
                side="DEFAULT"
                @update:target-type="onAppliesToChange"
                @update:selected-items="formState.targetItems = $event"
              />
            </div>
          </div>
        </UCard>

        <!-- ── Card 2: ORDER_DISCOUNT ─────────────────────────────────── -->
        <UCard v-else-if="type === 'ORDER_DISCOUNT'" data-testid="order-discount-section">
          <template #header>
            <h3 class="font-semibold text-highlighted">Valor del Descuento</h3>
          </template>

          <div class="flex flex-col gap-5">
            <!-- Discount type + value -->
            <div class="flex gap-3">
              <UFormField label="Tipo" name="discountType" class="w-44 shrink-0">
                <USelect
                  v-model="formState.discountType"
                  :items="DISCOUNT_TYPE_OPTIONS"
                  value-key="value"
                  label-key="label"
                  placeholder="Seleccionar..."
                />
              </UFormField>
              <UFormField label="Valor" name="discountValue" class="flex-1">
                <UInputNumber
                  v-model="formState.discountValue"
                  :min="formState.discountType === 'PERCENTAGE' ? 1 : 1"
                  :max="formState.discountType === 'PERCENTAGE' ? 100 : undefined"
                  :placeholder="formState.discountType === 'PERCENTAGE' ? '1-100' : 'Centavos'"
                  size="lg"
                />
              </UFormField>
            </div>

            <!-- Min purchase toggle -->
            <div>
              <UCheckbox v-model="formState.hasMinPurchase" label="Añadir monto mínimo de compra" />
              <div v-if="formState.hasMinPurchase" class="mt-3 pl-6">
                <UFormField label="Monto mínimo (centavos)" name="minPurchaseAmountCents">
                  <UInputNumber
                    v-model="formState.minPurchaseAmountCents"
                    :min="0"
                    placeholder="Ej.: 100000 = $1,000"
                    size="lg"
                  />
                </UFormField>
              </div>
            </div>
          </div>
        </UCard>

        <!-- ── Card 2: BUY_X_GET_Y ───────────────────────────────────── -->
        <UCard v-else-if="type === 'BUY_X_GET_Y'" data-testid="buy-x-get-y-section">
          <template #header>
            <h3 class="font-semibold text-highlighted">Tipo de Promoción</h3>
          </template>

          <div class="flex flex-col gap-5">
            <!-- Presets -->
            <div>
              <p class="mb-2 text-sm font-medium text-toned">
                Presets rápidos
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="preset in BUY_X_GET_Y_PRESETS"
                  :key="preset.label"
                  type="button"
                  :data-testid="`preset-${preset.label.replace(/\s+/g, '').toLowerCase()}`"
                  class="cursor-pointer rounded-lg border border-default px-3 py-1.5 text-sm text-highlighted transition-colors duration-200 hover:border-primary/40 hover:bg-primary/10"
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
                  @update:model-value="formState.getDiscountPercent = Number($event)"
                />
              </UFormField>
            </div>

            <!-- Target items -->
            <div>
              <p class="mb-2 text-sm font-medium text-toned">Aplica a</p>
              <PromotionTargetItemsSection
                :target-type="(formState.appliesTo as PromotionTargetType) || 'PRODUCTS'"
                :selected-items="formState.targetItems"
                side="DEFAULT"
                @update:target-type="onAppliesToChange"
                @update:selected-items="formState.targetItems = $event"
              />
            </div>
          </div>
        </UCard>

        <!-- ── Card 2: ADVANCED ───────────────────────────────────────── -->
        <UCard v-else-if="type === 'ADVANCED'" data-testid="advanced-section">
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
                :target-type="(formState.buyTargetType as PromotionTargetType) || 'PRODUCTS'"
                :selected-items="formState.buyTargetItems"
                side="BUY"
                label="Items de cualquiera de los siguientes"
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
                    @update:model-value="formState.getDiscountPercent = Number($event)"
                  />
                </UFormField>
              </div>
              <PromotionTargetItemsSection
                :target-type="(formState.getTargetType as PromotionTargetType) || 'PRODUCTS'"
                :selected-items="formState.getTargetItems"
                side="GET"
                label="De cualquiera de los siguientes"
                @update:target-type="onGetTargetTypeChange"
                @update:selected-items="formState.getTargetItems = $event"
              />
            </div>
          </div>
        </UCard>

        <!-- ── Conditions section ──────────────────────────────────────── -->
        <PromotionConditionsSection
          :model-value="formState"
          :mode="mode"
          @update:model-value="onConditionsUpdate"
        />

        <!-- ── Action buttons ─────────────────────────────────────────── -->
        <div class="flex justify-end gap-3">
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            data-testid="cancel-btn"
            @click="emit('cancel')"
          >
            Cancelar
          </UButton>
          <UButton type="submit" :loading="loading" data-testid="submit-btn">
            {{ mode === 'create' ? 'Crear Promoción' : 'Guardar Cambios' }}
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
