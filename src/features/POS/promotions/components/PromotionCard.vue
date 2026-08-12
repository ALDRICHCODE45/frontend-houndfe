<script setup lang="ts">
/**
 * PromotionCard — single-card view for a Promotion row.
 *
 * Mirrors the EmployeeCard pattern (article + EntityAvatar + title + chip
 * row + dashed divider + 2-col body) but exposes only the fields the
 * promotions list cares about: title, status, type, method, startDate,
 * createdAt. Cards do NOT render a kebab or checkbox — clicks navigate to
 * the detail route and table-level actions stay in the table view.
 */

import { computed } from 'vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import { formatPromotionDate } from '../utils/promotionDate.utils'
import {
  getMethodConfig,
  getStatusConfig,
  getTypeConfig,
} from '../utils/promotionStatusConfig.utils'
import type { PromotionResponse } from '../interfaces/promotion.types'

const props = defineProps<{
  promotion: PromotionResponse
}>()

const emit = defineEmits<{
  click: [promotion: PromotionResponse]
}>()

const statusConfig = computed(() => getStatusConfig(props.promotion.status))
const typeConfig = computed(() => getTypeConfig(props.promotion.type))
const methodConfig = computed(() => getMethodConfig(props.promotion.method))

const startDateLabel = computed(() => formatPromotionDate(props.promotion.startDate))
const createdAtLabel = computed(() => formatPromotionDate(props.promotion.createdAt))
</script>

<template>
  <article
    class="group relative flex cursor-pointer flex-col rounded-xl border border-default bg-default px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    @click="emit('click', promotion)"
  >
    <div class="flex items-start gap-3">
      <EntityAvatar
        :name="promotion.title"
        :seed="promotion.id"
        size="lg"
      />

      <div class="min-w-0 flex-1 space-y-1">
        <p class="line-clamp-2 text-sm font-semibold leading-tight text-highlighted">
          {{ promotion.title }}
        </p>
        <StatusDotBadge
          :tone="statusConfig.tone"
          :label="statusConfig.label"
          compact
        />
      </div>
    </div>

    <div class="mt-3 flex min-h-6 flex-wrap items-center gap-1.5">
      <AppBadge
        :tone="typeConfig.tone"
        :icon="typeConfig.icon"
        :label="typeConfig.label"
      />
      <AppBadge
        :tone="methodConfig.tone"
        :label="methodConfig.label"
        variant="outline"
      />
    </div>

    <div class="my-3 border-t border-dashed border-default" />

    <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <div class="min-w-0">
        <p class="text-muted">Inicio</p>
        <p class="mt-1 truncate font-medium text-default">{{ startDateLabel }}</p>
      </div>
      <div class="min-w-0 text-right">
        <p class="text-muted">Creada</p>
        <p class="mt-1 truncate font-semibold text-default">{{ createdAtLabel }}</p>
      </div>
    </div>
  </article>
</template>