<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { PromotionType } from '../interfaces/promotion.types'
import {
  PROMOTION_TYPE_CARDS,
  getPromotionCreateRoute,
} from '../utils/promotionTypeCards.utils'

// ── Props & emits ─────────────────────────────────────────────────────────────

const open = defineModel<boolean>('open', { required: true })

/** Optional theme marker forwarded to the teleported dialog content. */
const props = defineProps<{
  portalClass?: string
}>()

const emit = defineEmits<{
  select: [type: PromotionType]
}>()

// ── Router ────────────────────────────────────────────────────────────────────

const router = useRouter()

// ── Handlers ──────────────────────────────────────────────────────────────────

function selectType(type: PromotionType) {
  emit('select', type)
  open.value = false
  router.push(getPromotionCreateRoute(type))
}

defineExpose({ selectType })
</script>

<template>
  <UModal
    v-model:open="open"
    title="Elige el Tipo de Promoción"
    :ui="
      props.portalClass
        ? { width: 'max-w-xl', content: props.portalClass }
        : { width: 'max-w-xl' }
    "
  >
    <template #body>
      <div class="flex flex-col gap-2">
        <button
          v-for="card in PROMOTION_TYPE_CARDS"
          :key="card.type"
          :data-testid="`type-card-${card.type}`"
          type="button"
          class="promotions-type-option group flex cursor-pointer items-center gap-3 rounded-lg border border-default p-3 text-left transition-colors duration-200"
          @click="selectType(card.type)"
        >
          <!-- Icon with a quiet semantic background -->
          <div
            class="promotions-type-icon flex h-9 w-9 shrink-0 items-center justify-center"
          >
            <UIcon :name="card.icon" class="h-4 w-4" />
          </div>

          <!-- Text -->
          <div class="min-w-0 flex-1">
            <p class="font-medium text-highlighted">{{ card.title }}</p>
            <p class="mt-0.5 text-xs text-muted">{{ card.example }}</p>
          </div>

          <!-- Chevron -->
          <UIcon
            name="i-lucide-chevron-right"
            class="promotions-type-chevron h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </button>
      </div>
    </template>
  </UModal>
</template>
