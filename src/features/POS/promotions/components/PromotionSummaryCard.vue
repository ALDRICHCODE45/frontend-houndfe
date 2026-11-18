<script setup lang="ts">
import { computed } from 'vue'
import type { PromotionFormState } from '../interfaces/promotion.types'
import { buildPromotionSummaryBullets } from '../utils/promotionSummary.utils'
import { getTypeConfig } from '../utils/promotionStatusConfig.utils'
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    formState: PromotionFormState
    /** Names of the chosen price lists, in pick order (the form owns the lookup). */
    priceListNames?: readonly string[]
  }>(),
  { priceListNames: () => [] },
)

/** Names shown before the rest collapses into «y N más». */
const PRICE_LIST_NAMES_SHOWN = 3

// ── Computed summary ──────────────────────────────────────────────────────────

/** T8 D10: the price-list condition, which the shared bullet builder omits. */
const priceListBullet = computed(() => {
  const count = props.formState.hasPriceLists ? props.formState.priceListIds.length : 0
  if (count === 0) return null
  // T1/S1: name the lists once every chosen one resolved; until then, the count.
  const names = props.priceListNames
  if (names.length === count) {
    const shown = names.slice(0, PRICE_LIST_NAMES_SHOWN).join(', ')
    const rest = count - PRICE_LIST_NAMES_SHOWN
    return rest > 0 ? `Solo con: ${shown} y ${rest} más` : `Solo con: ${shown}`
  }
  return count === 1 ? 'Solo con 1 lista de precio' : `Solo con ${count} listas de precio`
})

const bullets = computed(() => {
  const list = buildPromotionSummaryBullets(props.formState)
  return priceListBullet.value ? [...list, priceListBullet.value] : list
})

const typeConfig = computed(() => getTypeConfig(props.formState.type))
</script>

<template>
  <!-- T6d/S2: a design-system section card (§Section card); the type icon is its meta.
       Sticky only as the lg rail; below lg it follows the form (T8 D5). -->
  <HfSectionCard title="Resumen" class="promotions-summary lg:sticky lg:top-6" data-testid="summary-card">
    <template #meta>
      <span class="promotions-accent-icon promotions-summary-icon" aria-hidden="true">
        <UIcon :name="typeConfig.icon" class="h-4 w-4" />
      </span>
    </template>

    <ul v-if="bullets.length > 0" data-testid="summary-list" class="promotions-summary-list">
      <li v-for="(bullet, idx) in bullets" :key="idx" class="promotions-summary-item">
        <UIcon name="i-lucide-check" class="promotions-summary-check" aria-hidden="true" />
        <span>{{ bullet }}</span>
      </li>
    </ul>

    <p v-else class="promotions-summary-empty">Completa el formulario para ver el resumen.</p>
  </HfSectionCard>
</template>
