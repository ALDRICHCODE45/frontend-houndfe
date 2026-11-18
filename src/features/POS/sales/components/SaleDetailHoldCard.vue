<script setup lang="ts">
import { computed } from 'vue'
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'
import { saleHoldLine } from '../utils/saleHold.utils'
import type { SaleDetail } from '../interfaces/sale.types'

// BE handoff 24 §1–§2: the live pay-in-store hold of a bot pickup order. The parent renders it
// only while `isSaleHoldLive`; «Cambiar plazo» needs `update:Sale` (the parent decides).
const props = defineProps<{ sale: SaleDetail; canEdit: boolean }>()
const emit = defineEmits<{ edit: [] }>()

const line = computed(() => saleHoldLine(props.sale))
</script>

<template>
  <HfSectionCard title="Apartado" data-testid="sale-detail-hold">
    <p class="sale-detail-hold-line" data-testid="sale-detail-hold-line">{{ line }}</p>
    <UButton
      v-if="canEdit"
      class="mt-3"
      size="sm"
      color="neutral"
      variant="outline"
      icon="i-lucide-calendar-clock"
      data-testid="sale-detail-hold-edit"
      @click="emit('edit')"
    >
      Cambiar plazo
    </UButton>
  </HfSectionCard>
</template>
