<script setup lang="ts">
import { computed } from 'vue'
import type { PromotionFormState } from '../interfaces/promotion.types'
import { buildPromotionSummaryBullets } from '../utils/promotionSummary.utils'
import { getTypeConfig } from '../utils/promotionStatusConfig.utils'
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  formState: PromotionFormState
}>()

// ── Computed summary ──────────────────────────────────────────────────────────

const bullets = computed(() => buildPromotionSummaryBullets(props.formState))

const typeConfig = computed(() => getTypeConfig(props.formState.type))
</script>

<template>
  <!-- T6d/S2: a design-system section card (§Section card); the type icon is its meta. -->
  <HfSectionCard title="Resumen" class="promotions-summary sticky top-6" data-testid="summary-card">
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
