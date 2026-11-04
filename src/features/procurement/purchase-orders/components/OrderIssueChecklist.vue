<script setup lang="ts">
import { CHECKLIST_ID, type ChecklistItem } from '../utils/order-checklist'
withDefaults(defineProps<{ items: ChecklistItem[]; dirty: boolean; ready: boolean; compact?: boolean; linkable?: (lineId: string) => boolean }>(), { linkable: () => true })
const emit = defineEmits<{ goto: [lineId: string] }>()
// Each pending family appears once, here, with one link to its first line; fields only flag themselves.
</script>

<template>
  <ul :id="CHECKLIST_ID" class="order-checklist" aria-label="Pendientes para confirmar">
    <li v-for="item in items" :key="item.key" data-state="pending">
      <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />
      <span class="order-check-message">{{ item.message }}<template v-if="item.count > 1"> en {{ item.count }} renglones</template></span>
      <button v-if="item.lineId && linkable(item.lineId)" type="button" class="order-check-link" :aria-label="compact ? (item.productName ? `Ir a ${item.productName}` : 'Ir al renglón') : undefined" @click="emit('goto', item.lineId)">{{ compact ? 'Ver renglón' : item.productName ? `Ir a ${item.productName}` : 'Ir al renglón' }}</button>
    </li>
    <li v-if="dirty" data-state="stale"><UIcon name="i-lucide-save" aria-hidden="true" /><span>Guarda el borrador para validar los cambios</span></li>
    <li v-else-if="!items.length && ready" data-state="ready"><UIcon name="i-lucide-circle-check" aria-hidden="true" /><span>Lista para confirmar</span></li>
    <li v-else-if="!items.length" data-state="blocked"><UIcon name="i-lucide-info" aria-hidden="true" /><span>Todavía no se puede confirmar.</span></li>
  </ul>
</template>
