<script setup lang="ts">
import { computed } from 'vue'
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'
import { saleHoldCardLine } from '../utils/saleHold.utils'
import type { SaleDetail } from '../interfaces/sale.types'

// BE handoff 24 §1–§2, §6: the pay-in-store hold of a bot pickup order. The parent renders it while
// the hold has a line (the live deadline, «Apartado vencido · revisar», or a partly paid hold that
// can still be expired); «Cambiar plazo» needs an editable hold and «Vencer apartado ahora» an
// expirable one, both with `update:Sale` (the parent decides).
const props = withDefaults(defineProps<{ sale: SaleDetail; canEdit: boolean; canExpire?: boolean }>(), {
  canExpire: false,
})
const emit = defineEmits<{ edit: []; expire: [] }>()

const line = computed(() => saleHoldCardLine(props.sale))
</script>

<template>
  <HfSectionCard title="Apartado" data-testid="sale-detail-hold">
    <p class="sale-detail-hold-line" data-testid="sale-detail-hold-line">{{ line }}</p>
    <div v-if="canEdit || canExpire" class="mt-3 flex flex-wrap gap-2">
      <UButton
        v-if="canEdit"
        size="sm"
        color="neutral"
        variant="outline"
        icon="i-lucide-calendar-clock"
        data-testid="sale-detail-hold-edit"
        @click="emit('edit')"
      >
        Cambiar plazo
      </UButton>
      <!-- Destructive-secondary: danger text and icon on an outline, never a red fill. -->
      <UButton
        v-if="canExpire"
        size="sm"
        color="error"
        variant="outline"
        icon="i-lucide-clock-alert"
        data-testid="sale-detail-hold-expire"
        @click="emit('expire')"
      >
        Vencer apartado ahora
      </UButton>
    </div>
  </HfSectionCard>
</template>
