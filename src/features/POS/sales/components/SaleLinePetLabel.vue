<script setup lang="ts">
import { computed } from 'vue'
import type { SaleLinePet } from '../interfaces/sale.types'
import { saleLinePetLabel } from '../utils/saleLinePet.utils'

// Handoff 27 §6: «Para: <nombre>» from the line snapshot, with an «archivada» hint.
const props = defineProps<{ pet: SaleLinePet }>()

const label = computed(() => saleLinePetLabel(props.pet))
</script>

<template>
  <p data-testid="sale-line-pet" class="flex items-center gap-1 truncate text-xs text-muted">
    <UIcon name="i-lucide-paw-print" class="size-3.5 shrink-0" aria-hidden="true" />
    <span class="truncate">{{ label }}</span>
    <span v-if="pet.status === 'ARCHIVED'"> (archivada)</span>
  </p>
</template>
