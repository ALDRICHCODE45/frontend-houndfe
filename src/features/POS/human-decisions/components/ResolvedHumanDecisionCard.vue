<script setup lang="ts">
import { computed } from 'vue'
import type { HumanDecision } from '../interfaces/human-decision.types'
import {
  branchPresentationLabel,
  createdAtPresentationLabel,
  productMetaPresentationLabel,
  resolvedResponseLabel,
} from '../utils/humanDecisionPresentation'

const props = defineProps<{ decision: Extract<HumanDecision, { status: 'RESOLVED' }> }>()
const emit = defineEmits<{ openDetail: [decisionId: string] }>()
const productMetaLabel = computed(() => productMetaPresentationLabel(props.decision))
</script>

<template>
  <article
    data-testid="resolved-human-decision-card"
    class="flex w-full flex-col gap-3 rounded-xl border border-default bg-default p-4"
  >
    <header class="space-y-1">
      <UBadge color="success" variant="subtle" data-testid="human-decision-status"
        >Respondida</UBadge
      >
      <h3 class="text-base font-semibold text-highlighted">{{ decision.title }}</h3>
      <p class="text-sm text-muted">{{ decision.snapshot.productName }} · {{ productMetaLabel }}</p>
      <p class="text-xs text-muted">{{ branchPresentationLabel(decision.snapshot.branchName) }}</p>
    </header>
    <dl class="space-y-3 text-sm">
      <div>
        <dt class="text-xs text-muted">Respuesta</dt>
        <dd class="text-highlighted">{{ resolvedResponseLabel(decision.resolution) }}</dd>
      </div>
      <div>
        <dt class="text-xs text-muted">Respondida por</dt>
        <dd>{{ decision.resolution.resolvedBy.displayName }}</dd>
      </div>
      <div>
        <dt class="text-xs text-muted">Respondida el</dt>
        <dd>
          <time :datetime="decision.resolution.resolvedAt">{{
            createdAtPresentationLabel(decision.resolution.resolvedAt)
          }}</time>
        </dd>
      </div>
    </dl>
    <UButton
      type="button"
      data-testid="resolved-human-decision-open-detail"
      color="neutral"
      variant="outline"
      block
      class="min-h-11 w-full justify-center"
      :aria-label="`Abrir respuesta: ${decision.title}`"
      @click="emit('openDetail', decision.id)"
      >Ver detalle</UButton
    >
  </article>
</template>
