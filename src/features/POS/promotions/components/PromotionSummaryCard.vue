<script setup lang="ts">
import { computed } from 'vue'
import type { PromotionFormState } from '../interfaces/promotion.types'
import { buildPromotionSummaryBullets } from '../utils/promotionSummary.utils'
import { getTypeConfig } from '../utils/promotionStatusConfig.utils'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  formState: PromotionFormState
}>()

// ── Computed summary ──────────────────────────────────────────────────────────

const bullets = computed(() => buildPromotionSummaryBullets(props.formState))

const typeConfig = computed(() => getTypeConfig(props.formState.type))
</script>

<template>
  <UCard class="sticky top-6">
    <template #header>
      <div class="flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <UIcon :name="typeConfig.icon" class="h-4 w-4" />
        </div>
        <h3 class="font-semibold text-highlighted">Resumen</h3>
      </div>
    </template>

    <div v-if="bullets.length > 0">
      <ul data-testid="summary-list" class="space-y-2">
        <li
          v-for="(bullet, idx) in bullets"
          :key="idx"
          class="flex items-start gap-2 text-sm text-muted"
        >
          <UIcon
            name="i-lucide-check"
            class="mt-0.5 h-4 w-4 shrink-0 text-primary-500"
          />
          <span>{{ bullet }}</span>
        </li>
      </ul>
    </div>

    <p
      v-else
      class="text-sm text-dimmed italic"
    >
      Completa el formulario para ver el resumen.
    </p>
  </UCard>
</template>
