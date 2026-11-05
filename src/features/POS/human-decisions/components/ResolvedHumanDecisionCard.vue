<script setup lang="ts">
/**
 * ResolvedHumanDecisionCard — the mobile form of an answered request: same
 * hierarchy as the pending card, with the recorded response and who gave it
 * in place of the quantity. The whole card opens the detail.
 */
import { computed } from 'vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import type { HumanDecision } from '../interfaces/human-decision.types'
import {
  listDatePresentationLabel,
  productMetaPresentationLabel,
  resolvedResponseLabel,
} from '../utils/humanDecisionPresentation'

const props = defineProps<{ decision: Extract<HumanDecision, { status: 'RESOLVED' }> }>()
const emit = defineEmits<{ openDetail: [decisionId: string] }>()
const productMetaLabel = computed(() => productMetaPresentationLabel(props.decision))

const { rowProps } = useClickableRow<string>((id) => emit('openDetail', id), { focusable: false })
</script>

<template>
  <article
    v-bind="rowProps(decision.id)"
    data-testid="resolved-human-decision-card"
    class="human-decisions-card flex w-full flex-col gap-3 p-4"
  >
    <header class="human-decisions-card-heading">
      <div class="min-w-0 flex-1">
        <button
          type="button"
          class="hf-row-primary text-left"
          data-testid="resolved-human-decision-open-detail"
          @click="emit('openDetail', decision.id)"
        >
          {{ decision.snapshot.productName }}
        </button>
        <span class="hf-row-secondary"> {{ decision.title }} · {{ productMetaLabel }} </span>
      </div>
    </header>
    <StatusBadge
      label="Respondida"
      tone="success"
      class="self-start"
      data-testid="human-decision-status"
    />
    <p class="text-sm text-highlighted">{{ resolvedResponseLabel(decision.resolution) }}</p>
    <footer class="human-decisions-card-footer">
      <span class="min-w-0 truncate">{{ decision.resolution.resolvedBy.displayName }}</span>
      <time :datetime="decision.resolution.resolvedAt">{{
        listDatePresentationLabel(decision.resolution.resolvedAt)
      }}</time>
    </footer>
  </article>
</template>
