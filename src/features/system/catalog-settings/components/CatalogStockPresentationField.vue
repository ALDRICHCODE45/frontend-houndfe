<script setup lang="ts">
/**
 * CatalogStockPresentationField — «Stock en el catálogo» (artboard 01, REQ-8).
 *
 * The closed four-mode set as radio cards (board 04 pattern 2): the whole card
 * is the `role="radio"` target, roving tabindex with arrows, Home and End; the
 * chosen card wears `--hf-active-soft`, the `--hf-active` border, a filled
 * round check mark and «Seleccionado», never color alone. Labels, the honest
 * explanation and the preview come from `stockPresentationUi`.
 *
 * «Mostrar cantidad fija» reveals «Cantidad a mostrar» inside its card. The
 * field keeps what the user typed; a non-integer or negative entry emits `NaN`
 * so the draft validation blocks the save, and the error shows under the
 * field. Other modes serialize `customQuantity: null`; 0 is a real quantity.
 * Read-only mode shows only the accepted mode.
 */
import { computed, ref, useId, watch } from 'vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type {
  CatalogStockPresentationDefaultDto,
  OnlineStockPresentationMode,
} from '../interfaces/catalog-settings.types'
import {
  buildStockPresentationModeOptions,
  formatCustomQuantityLabel,
  getStockOverrideInheritanceCopy,
  getStockPresentationCopy,
  resolveStockPresentationPreview,
} from '../utils/stockPresentationUi'
import { isStockQuantity, STOCK_QUANTITY_ERROR } from '../utils/catalogSettingsMappers'

const props = withDefaults(
  defineProps<{
    stockDefault: CatalogStockPresentationDefaultDto
    disabled?: boolean
    readonly?: boolean
  }>(),
  { disabled: false, readonly: false },
)

const emit = defineEmits<{
  (event: 'change', value: CatalogStockPresentationDefaultDto): void
}>()

const headingId = useId()
const quantityId = useId()
const baseId = useId()
const inheritanceLabel = getStockOverrideInheritanceCopy('product').label

const BADGE_TONES: Record<string, 'success' | 'warning' | 'neutral'> = {
  Disponible: 'success',
  'Pocas piezas': 'warning',
}

// What the user typed stays in the field; the draft only follows valid numbers.
const quantityText = ref(
  isStockQuantity(props.stockDefault.customQuantity) ? String(props.stockDefault.customQuantity) : '0',
)
const lastQuantity = ref(
  isStockQuantity(props.stockDefault.customQuantity) ? props.stockDefault.customQuantity : 0,
)

const isCustom = computed(() => props.stockDefault.mode === 'CUSTOM_QUANTITY')
const quantityInvalid = computed(
  () => isCustom.value && !isStockQuantity(props.stockDefault.customQuantity),
)

const cards = computed(() =>
  buildStockPresentationModeOptions()
    .filter((option) => !props.readonly || option.value === props.stockDefault.mode)
    .map((option) => {
      const copy = getStockPresentationCopy(option.value)
      const selected = option.value === props.stockDefault.mode
      const preview =
        option.value === 'CUSTOM_QUANTITY'
          ? selected && !quantityInvalid.value
            ? resolveStockPresentationPreview(option.value, props.stockDefault.customQuantity)
            : selected
              ? '— unidades'
              : resolveStockPresentationPreview(option.value, lastQuantity.value)
          : copy.preview
      return {
        mode: option.value,
        label: copy.label,
        description: copy.description,
        badges: preview.split(' · '),
        selected,
        id: `${baseId}-${option.value.toLowerCase()}`,
      }
    }),
)

watch(
  () => props.stockDefault.customQuantity,
  (quantity) => {
    if (!isStockQuantity(quantity)) return
    lastQuantity.value = quantity
    const typed = quantityText.value.trim()
    if (!/^\d+$/.test(typed) || Number(typed) !== quantity) quantityText.value = String(quantity)
  },
)

function onChoose(mode: OnlineStockPresentationMode) {
  if (props.disabled || mode === props.stockDefault.mode) return
  emit('change', {
    mode,
    customQuantity: mode === 'CUSTOM_QUANTITY' ? lastQuantity.value : null,
  })
}

function onQuantityInput(raw: string | number) {
  quantityText.value = String(raw)
  const typed = quantityText.value.trim()
  emit('change', {
    mode: 'CUSTOM_QUANTITY',
    customQuantity: /^\d+$/.test(typed) ? Number(typed) : Number.NaN,
  })
}

const cardElements = new Map<OnlineStockPresentationMode, HTMLElement>()
function setCardRef(mode: OnlineStockPresentationMode, el: unknown) {
  if (el instanceof HTMLElement) cardElements.set(mode, el)
  else cardElements.delete(mode)
}

const KEY_STEP: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }

function onCardKeydown(event: KeyboardEvent, index: number) {
  const total = cards.value.length
  let next = -1
  if (event.key in KEY_STEP) next = (index + KEY_STEP[event.key]! + total) % total
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = total - 1
  if (next < 0) return
  event.preventDefault()
  const target = cards.value[next]!
  onChoose(target.mode)
  cardElements.get(target.mode)?.focus()
}
</script>

<template>
  <section class="cs-group" :aria-labelledby="headingId" data-testid="stock-card">
    <div class="cs-group-head">
      <div>
        <h2 :id="headingId" class="cs-group-title">Stock en el catálogo</h2>
        <p class="cs-group-desc">
          Cómo se informa la disponibilidad a tus clientes. No cambia las existencias ni las
          validaciones de venta.
        </p>
      </div>
    </div>

    <div
      class="cs-stock-cards"
      :role="props.readonly ? undefined : 'radiogroup'"
      :aria-labelledby="props.readonly ? undefined : headingId"
      data-testid="stock-mode-group"
    >
      <div
        v-for="(card, index) in cards"
        :key="card.mode"
        class="cs-stock-card"
        :data-selected="String(card.selected)"
        :data-testid="props.readonly ? 'stock-default' : 'stock-card-option'"
      >
        <component
          :is="props.readonly ? 'div' : 'button'"
          :ref="(el: unknown) => setCardRef(card.mode, el)"
          :type="props.readonly ? undefined : 'button'"
          :role="props.readonly ? undefined : 'radio'"
          class="cs-stock-main cs-focus"
          :aria-checked="props.readonly ? undefined : card.selected"
          :aria-disabled="!props.readonly && props.disabled ? 'true' : undefined"
          :aria-labelledby="props.readonly ? undefined : `${card.id}-title`"
          :aria-describedby="props.readonly ? undefined : `${card.id}-desc ${card.id}-preview`"
          :tabindex="props.readonly ? undefined : card.selected ? 0 : -1"
          :data-mode="card.mode"
          data-testid="stock-mode-radio"
          @click="props.readonly ? undefined : onChoose(card.mode)"
          @keydown="props.readonly ? undefined : onCardKeydown($event, index)"
        >
          <span class="cs-mark" :data-checked="String(card.selected)" aria-hidden="true">
            <UIcon name="i-lucide-check" class="cs-mark-icon" />
          </span>
          <span class="cs-stock-body">
            <span :id="`${card.id}-title`" class="cs-stock-title">{{ card.label }}</span>
            <span
              :id="`${card.id}-desc`"
              class="cs-stock-desc"
              data-testid="stock-default-description"
            >
              {{ card.description }}
            </span>
            <span :id="`${card.id}-preview`" class="cs-stock-preview" data-testid="stock-mode-preview">
              <span class="sr-only">Vista previa: {{ card.badges.join(', ') }}</span>
              <span class="contents" aria-hidden="true">
                <StatusBadge
                  v-for="badge in card.badges"
                  :key="badge"
                  :label="badge"
                  :tone="BADGE_TONES[badge] ?? 'neutral'"
                  class="hf-figure"
                />
              </span>
            </span>
          </span>
          <span v-if="!props.readonly" class="cs-stock-tag" :class="{ invisible: !card.selected }" aria-hidden="true">
            Seleccionado
          </span>
        </component>

        <div
          v-if="card.mode === 'CUSTOM_QUANTITY' && card.selected"
          class="cs-stock-extra"
          data-testid="stock-quantity"
        >
          <p v-if="props.readonly" class="text-sm text-(--hf-ink)" data-testid="stock-quantity-label">
            {{ formatCustomQuantityLabel(props.stockDefault.customQuantity) }}
          </p>
          <UFormField
            v-else
            label="Cantidad a mostrar"
            :name="quantityId"
            help="Número entero, 0 o más. Se muestra igual en todos los productos."
            :error="quantityInvalid ? STOCK_QUANTITY_ERROR : undefined"
            class="max-w-xs"
          >
            <UInput
              :id="quantityId"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              class="w-full sm:w-40"
              :model-value="quantityText"
              :disabled="props.disabled"
              data-testid="stock-quantity-input"
              @update:model-value="onQuantityInput"
            />
          </UFormField>
        </div>
      </div>
    </div>

    <p v-if="!props.readonly" class="cs-foot-note">
      <UIcon name="i-lucide-info" class="cs-notice-icon" aria-hidden="true" />
      <span>
        Esta es la opción global. Cada producto o variante puede elegir otra; los que tienen
        «{{ inheritanceLabel }}» siguen esta.
      </span>
    </p>
  </section>
</template>
