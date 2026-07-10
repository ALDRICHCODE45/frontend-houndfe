<script setup lang="ts">
/**
 * PromocionesDisponiblesAccordion — promotions-in-sale C.3
 *
 * Presentational accordion that lists the promotions a seller may
 * manually apply to the active draft. Data + mutations live in
 * `useApplicablePromotions` (list query) and `useSalesDrafts`
 * (`applyManualPromotion` / `removeManualPromotion`); this component
 * only owns the UI.
 *
 * Why this exists as a separate component (vs inline in ActiveSalePanel):
 *   - keeps ActiveSalePanel focused on cart totals + item rows + customer,
 *     not on promotion opt-in controls.
 *   - lets us TDD the apply/remove wiring in isolation, with no Vue
 *     Query / composable plumbing in the test.
 *
 * Contract:
 *   - Props ↓
 *       promotions:   ApplicablePromotion[] (required)
 *       loading?:     boolean                 (default false)
 *       appliedIds?:  string[]                (default [])
 *   - Events ↑
 *       apply:        [promotionId: string]
 *       remove:       [promotionId: string]
 *
 * Empty-state contract (spec §4):
 *   When `promotions.length === 0`, the component renders NOTHING.
 *   The parent (ActiveSalePanel) ALSO guards with `v-if` — both layers
 *   hide the section so the seller's cart chrome stays clean when no
 *   promo applies.
 *
 * Loading affordance:
 *   When `loading` is true AND there are promotions to render, a single
 *   skeleton (`data-testid="promociones-loading"`) replaces the row list
 *   so the seller sees "something is happening" without flashing stale
 *   rows.
 *
 * Why UAccordion:
 *   Matches the rest of the repo's collapsible patterns (ActionsAccordion,
 *   notifications). Single-item, default-open so the rows render on first
 *   paint. The trailing slot adds a count badge next to the chevron.
 */
import { computed } from 'vue'
import type { ApplicablePromotion } from '../interfaces/sale.types'

const ACCORDION_VALUE = 'promociones'

const props = withDefaults(
  defineProps<{
    promotions: ApplicablePromotion[]
    loading?: boolean
    appliedIds?: string[]
  }>(),
  {
    loading: false,
    appliedIds: () => [] as string[],
  },
)

const emit = defineEmits<{
  apply: [promotionId: string]
  remove: [promotionId: string]
}>()

// Single-item model so UAccordion renders one trigger + one body slot.
// The body slot receives the full promotion list.
const accordionItems = computed(() => [
  {
    value: ACCORDION_VALUE,
    label: 'Promociones disponibles',
    count: props.promotions.length,
  },
])

// Set lookup for applied-id membership — O(1) per row, scales linearly.
const appliedSet = computed(() => new Set(props.appliedIds))

function isApplied(promotionId: string): boolean {
  return appliedSet.value.has(promotionId)
}

function handleApply(promotionId: string) {
  emit('apply', promotionId)
}

function handleRemove(promotionId: string) {
  emit('remove', promotionId)
}
</script>

<template>
  <UAccordion
    v-if="promotions.length > 0"
    :items="accordionItems"
    type="single"
    collapsible
    :default-value="[ACCORDION_VALUE]"
    :unmount-on-hide="false"
    data-testid="promociones-disponibles-accordion"
    :ui="{
      root: 'border-t border-default',
      item: 'border-b border-default last:border-b-0',
      header: 'flex',
      trigger:
        'group flex items-center justify-between gap-2 w-full px-4 py-2.5 text-sm font-medium cursor-pointer hover:bg-elevated/40 transition-colors',
      content:
        'data-[state=open]:animate-[accordion-down_200ms_ease-out] data-[state=closed]:animate-[accordion-up_200ms_ease-out] data-[state=closed]:overflow-hidden',
      body: 'pb-2',
      label: 'text-start',
    }"
  >
    <!--
      Right of the trigger: count badge + chevron. The `trailing` slot
      REPLACES the default chevron, so we re-render it here to keep the
      familiar disclosure affordance.
    -->
    <template #trailing="{ item }">
      <div class="flex items-center gap-2 ml-auto shrink-0">
        <span
          data-testid="promociones-count"
          class="text-xs font-medium text-muted tabular-nums"
        >{{ item.count }}</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-4 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </div>
    </template>

    <template #body>
      <div data-testid="promociones-body" class="px-4 pb-2">
        <!-- Loading affordance (replaces rows). -->
        <div
          v-if="loading"
          data-testid="promociones-loading"
          class="flex flex-col gap-2 py-1"
        >
          <USkeleton class="h-6 w-full rounded" />
          <USkeleton class="h-6 w-5/6 rounded" />
        </div>

        <!-- Row list. -->
        <div v-else class="flex flex-col">
          <div
            v-for="promo in promotions"
            :key="promo.id"
            :data-testid="`promo-row-${promo.id}`"
            class="flex items-center justify-between gap-2 py-1.5"
          >
            <span
              :data-testid="`promo-title-${promo.id}`"
              class="text-sm truncate flex-1 min-w-0"
            >{{ promo.title }}</span>

            <UButton
              v-if="!isApplied(promo.id)"
              :data-testid="`promo-apply-${promo.id}`"
              size="xs"
              color="primary"
              variant="solid"
              label="Aplicar"
              @click="handleApply(promo.id)"
            />
            <UButton
              v-else
              :data-testid="`promo-remove-${promo.id}`"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              :aria-label="`Quitar ${promo.title}`"
              @click="handleRemove(promo.id)"
            />
          </div>
        </div>
      </div>
    </template>
  </UAccordion>
</template>