<script setup lang="ts">
import { computed } from 'vue'
import type { PendingHumanDecision } from '../interfaces/human-decision.types'
import { presentPendingHumanDecision } from '../utils/humanDecisionPresentation'

const props = defineProps<{ decision: PendingHumanDecision }>()
const emit = defineEmits<{ openDetail: [decisionId: string] }>()
const presentation = computed(() => presentPendingHumanDecision(props.decision))
</script>

<template>
  <article
    data-testid="human-decision-card"
    class="flex w-full flex-col gap-3 rounded-xl border border-default bg-default p-4"
  >
    <header class="space-y-1">
      <UBadge color="warning" variant="subtle" data-testid="human-decision-status"
        >Pendiente</UBadge
      >
      <h2 class="text-base font-semibold text-highlighted">{{ decision.title }}</h2>
      <p class="text-sm text-muted">{{ decision.sanitizedSummary }}</p>
    </header>
    <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <div class="col-span-2 min-w-0">
        <dt class="text-muted">Producto</dt>
        <dd class="mt-0.5 min-w-0">
          <p class="truncate font-medium text-default">{{ presentation.productLabel }}</p>
          <p class="truncate text-muted">
            {{ presentation.skuLabel }} · {{ presentation.variantLabel }}
          </p>
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-muted">Sucursal</dt>
        <dd class="mt-0.5 truncate text-default">{{ presentation.branchLabel }}</dd>
      </div>
      <div class="min-w-0">
        <dt class="text-muted">Solicitado</dt>
        <dd class="mt-0.5 truncate text-default">{{ presentation.requestedQuantityLabel }}</dd>
      </div>
      <div class="min-w-0">
        <dt class="text-muted">Creada</dt>
        <dd class="mt-0.5 truncate text-default">{{ presentation.createdAtLabel }}</dd>
      </div>
    </dl>
    <UButton
      type="button"
      color="primary"
      variant="solid"
      block
      data-testid="human-decision-open-detail"
      class="min-h-11 w-full justify-center"
      :aria-label="`Abrir detalle: ${decision.title}`"
      @click="emit('openDetail', decision.id)"
    >
      Ver detalle
    </UButton>
  </article>
</template>
