<script setup lang="ts">
import { formatCentsMXN } from '../utils/currency.utils'

const props = defineProps<{
  open: boolean
  folio: string
  totalCents: number
  paidCents: number
  changeDueCents?: number
  confirmedAt: string
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
}>()

function formatDate(value: string): string {
  return new Date(value).toLocaleString('es-MX')
}
</script>

<template>
  <UModal
    :open="open"
    title="Cobro confirmado"
    description="La venta fue registrada correctamente."
    :ui="{ content: 'sm:max-w-md' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex items-center gap-3 rounded-2xl border border-success/20 bg-success/10 p-4">
          <span class="flex h-11 w-11 items-center justify-center rounded-full bg-success text-white">
            <UIcon name="i-lucide-check" class="h-6 w-6" />
          </span>
          <div>
            <p class="text-sm text-muted">Folio</p>
            <p class="text-lg font-bold text-highlighted">{{ folio }}</p>
          </div>
        </div>

        <dl class="space-y-2 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-muted">Total</dt>
            <dd class="font-semibold tabular-nums text-highlighted">{{ formatCentsMXN(totalCents) }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted">Pagado</dt>
            <dd class="font-semibold tabular-nums text-highlighted">{{ formatCentsMXN(paidCents) }}</dd>
          </div>
          <div v-if="(changeDueCents ?? 0) > 0" class="flex justify-between gap-4">
            <dt class="text-muted">Cambio</dt>
            <dd class="font-semibold tabular-nums text-primary">{{ formatCentsMXN(changeDueCents ?? 0) }}</dd>
          </div>
        </dl>

        <p class="text-xs text-muted">Confirmado: {{ formatDate(confirmedAt) }}</p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton color="primary" @click="emit('update:open', false)">Cerrar</UButton>
      </div>
    </template>
  </UModal>
</template>
