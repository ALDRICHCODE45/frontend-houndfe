<script setup lang="ts">
import SaleDetailTimeline from './SaleDetailTimeline.vue'
import SaleCommentInput from './SaleCommentInput.vue'
import type { SaleTimelineEvent } from '../interfaces/sale.types'

// sale-detail-redesign WU-B: thin UCard wrapper that composes the existing
// Timeline + CommentInput children. No new contracts; pass-through props only
// so the unified HISTORIAL card behaves identically to the previous
// UTabs #comentarios panel.
defineProps<{
  timeline: SaleTimelineEvent[]
  currentUserId?: string | null
  commentsPending?: boolean
  onUpdateComment?: (commentId: string, payload: { body: string }) => Promise<unknown>
  onDeleteComment?: (commentId: string) => Promise<unknown>
  onSubmitComment: (payload: { body: string }) => Promise<unknown>
}>()
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
        <UIcon name="i-lucide-clock" class="size-4" />
        HISTORIAL
      </h3>
    </template>

    <SaleDetailTimeline
      :timeline="timeline"
      :current-user-id="currentUserId"
      :is-pending="commentsPending"
      :on-update-comment="onUpdateComment"
      :on-delete-comment="onDeleteComment"
    />

    <template #footer>
      <SaleCommentInput :is-pending="commentsPending" :on-submit="onSubmitComment" />
    </template>
  </UCard>
</template>
