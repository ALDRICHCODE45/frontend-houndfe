<script setup lang="ts">
import { computed, useId } from 'vue'
import '../styles/catalog-extras.css'
import type { DisplayAvailability } from '../utils/detail-presentation'

export interface CatalogDetailPresentationOption {
  id: string
  name: string
  price: string | null
  quantity: string | null
  /** «$93.63/kg», only when every presentation shares a content unit. */
  unitPrice?: string | null
  /** «Ahorras 15 % vs 2 kg», only on a bigger presentation that is cheaper per unit. */
  saving?: string | null
  availability: DisplayAvailability | null
}

/**
 * The presentation picker: one native radio group, so arrows, Tab and Space work as in any form.
 * An out-of-stock presentation stays selectable, so its price and characteristics can be read.
 */
const props = defineProps<{ options: CatalogDetailPresentationOption[] }>()
const selectedId = defineModel<string | null>({ required: true })

const groupName = `catalog-presentation-${useId()}`
const hintId = `${groupName}-hint`
const countLabel = computed(() =>
  props.options.length === 1 ? '1 opción' : `${props.options.length} opciones`,
)
</script>

<template>
  <fieldset data-testid="catalog-detail-presentations" class="catalog-pdp-presentations">
    <legend>Presentación</legend>
    <p :id="hintId" class="catalog-pdp-presentations-hint">
      {{ countLabel }}. El precio, la disponibilidad y las características son los de la
      presentación que elijas.
    </p>
    <div
      class="catalog-pdp-presentations-grid"
      :style="{
        '--catalog-pdp-cols': Math.min(options.length, 3),
        '--catalog-pdp-cols-sm': Math.min(options.length, 2),
      }"
      :aria-describedby="hintId"
    >
      <label
        v-for="option in options"
        :key="option.id"
        data-testid="catalog-detail-presentation"
        class="catalog-pdp-presentation"
        :class="{ 'is-out': option.availability?.isOut }"
      >
        <input
          v-model="selectedId"
          class="sr-only"
          type="radio"
          :name="groupName"
          :value="option.id"
        />
        <span class="catalog-pdp-presentation-top">
          <span
            data-testid="catalog-detail-presentation-name"
            class="catalog-pdp-presentation-name"
          >
            {{ option.name }}
          </span>
          <span class="catalog-pdp-presentation-mark" aria-hidden="true">
            <UIcon name="i-lucide-check" class="size-3.5" />
          </span>
        </span>
        <span class="catalog-pdp-presentation-price">
          <b v-if="option.price">{{ option.price }}</b>
          <span v-else class="catalog-pdp-presentation-consult">Consultar precio</span>
          <small
            v-if="option.unitPrice"
            data-testid="catalog-detail-presentation-unit"
            class="catalog-pdp-presentation-unit"
            >{{ option.unitPrice }}</small
          >
        </span>
        <span
          v-if="option.availability"
          class="catalog-pdp-presentation-state"
          :data-tone="option.availability.tone"
        >
          {{ option.availability.label }}
        </span>
        <span v-if="option.quantity" class="catalog-pdp-presentation-quantity">
          {{ option.quantity }}
        </span>
        <span
          v-if="option.saving"
          data-testid="catalog-detail-presentation-saving"
          class="catalog-pdp-presentation-saving"
          ><UIcon name="i-lucide-tag" class="size-3.5 shrink-0" aria-hidden="true" />{{
            option.saving
          }}</span
        >
      </label>
    </div>
  </fieldset>
</template>
