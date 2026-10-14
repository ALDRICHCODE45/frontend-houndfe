<script setup lang="ts">
/** DeliveryRouteCardGrid — bounded grid of DeliveryRouteCard with loading and empty states. */
import type { DeliveryRouteResponseDto } from '../interfaces/delivery-route.types'
import type { DeliveryRouteRowActionItem } from '../utils/delivery-route-actions.utils'
import DeliveryRouteCard from './DeliveryRouteCard.vue'

defineProps<{
  routes: DeliveryRouteResponseDto[]
  loading?: boolean
  empty: string
  getActions: (route: DeliveryRouteResponseDto) => DeliveryRouteRowActionItem[][]
  portalClass?: string
}>()

const emit = defineEmits<{
  open: [routeId: string]
}>()
</script>

<template>
  <div
    v-if="loading"
    class="delivery-routes-card-grid"
    data-testid="delivery-route-card-grid-loading"
  >
    <div v-for="i in 6" :key="i" class="delivery-routes-card h-48 animate-pulse" />
  </div>
  <div
    v-else-if="routes.length === 0"
    class="delivery-routes-empty flex flex-col items-center justify-center gap-3 py-16 text-center"
    data-testid="delivery-route-card-grid-empty"
  >
    <UIcon name="i-lucide-route" class="size-8" />
    <p class="text-sm">{{ empty }}</p>
  </div>
  <div v-else class="delivery-routes-card-grid" data-testid="delivery-route-card-grid">
    <DeliveryRouteCard
      v-for="route in routes"
      :key="route.id"
      :route="route"
      :actions="getActions(route)"
      :portal-class="portalClass"
      @open="emit('open', $event)"
    />
  </div>
</template>
