<script setup lang="ts">
/**
 * HumanDecisionCard — the mobile form of a pending request (Mobile cards
 * rules): title as the primary text, the product as the secondary line, the status badge, and a separated footer with the
 * quantity and the short date. The whole card opens the detail.
 */
import { computed } from 'vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import type { HumanDecision } from '../interfaces/human-decision.types'
import {
  listDatePresentationLabel,
  presentPendingHumanDecision,
} from '../utils/humanDecisionPresentation'

const props = defineProps<{ decision: Extract<HumanDecision, { status: 'PENDING' }> }>()
const emit = defineEmits<{ openDetail: [decisionId: string] }>()
const presentation = computed(() => presentPendingHumanDecision(props.decision))

const { rowProps } = useClickableRow<string>((id) => emit('openDetail', id), { focusable: false })
</script>

<template>
  <article
    v-bind="rowProps(decision.id)"
    data-testid="human-decision-card"
    class="human-decisions-card flex w-full flex-col gap-3 p-4"
  >
    <header class="human-decisions-card-heading">
      <div class="min-w-0 flex-1">
        <button
          type="button"
          class="hf-row-primary text-left"
          data-testid="human-decision-open-detail"
          @click="emit('openDetail', decision.id)"
        >
          {{ decision.title }}
        </button>
        <span class="hf-row-secondary">
          {{ presentation.productLabel }} · {{ presentation.productMetaLabel }}
        </span>
      </div>
    </header>
    <StatusBadge label="Pendiente" tone="warning" data-testid="human-decision-status" />
    <footer class="human-decisions-card-footer">
      <span class="min-w-0 truncate">
        <template v-if="presentation.requestedQuantityLabel">
          <span class="hf-figure">{{ presentation.requestedQuantityLabel }}</span> ·
        </template>
        {{ presentation.branchLabel }}
      </span>
      <span>{{ listDatePresentationLabel(decision.createdAt) }}</span>
    </footer>
  </article>
</template>
