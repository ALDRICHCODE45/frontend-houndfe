<script setup lang="ts">
/**
 * PendingApprovalCard — WU-B (REQ-2, REQ-3, REQ-6)
 *
 * Presentational card for a single pending time-off request. Rendered inside
 * AppDataTable's `#cards` slot by `PendingApprovalsView` — the view owns the
 * mutation flow (`useReviewTimeOff`) and dialog state; this card only emits
 * the original request so the parent can route it through the confirmation
 * `UModal`.
 *
 * Visual contract (preserved from the prior inline markup in
 * `PendingApprovalsView`):
 *   - Avatar circle (initials + deterministic palette color)
 *   - Employee name + type badge
 *   - Date range + day count (calendar icon)
 *   - Reason (SICK+null renders italic muted — Tier 3 medical guard)
 *   - Status chip + createdAt label
 *   - Aprobar / Rechazar actions, gated by `canReview`, disabled while
 *     this row is currently being reviewed
 *
 * Data flow contract: every label, color, and visibility flag arrives
 * pre-computed on `data` (via `buildPendingApprovalCardData`); the template
 * is fully declarative. The card itself imports zero formatters.
 */

import type { TimeOffRequest } from '../interfaces/employee.types'
import type { PendingApprovalCardData } from '../composables/usePendingApprovalCard'

defineProps<{
  data: PendingApprovalCardData
  canReview: boolean
  isReviewing: boolean
}>()

const emit = defineEmits<{
  approve: [request: TimeOffRequest]
  reject: [request: TimeOffRequest]
}>()

function onApprove(request: TimeOffRequest): void {
  emit('approve', request)
}

function onReject(request: TimeOffRequest): void {
  emit('reject', request)
}
</script>

<template>
  <div
    class="rounded-lg border border-default bg-elevated/30 p-4 transition-colors hover:bg-elevated/50"
    data-testid="pending-approval-card"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <!-- Request info -->
      <div class="flex flex-col gap-2">
        <!-- Employee identity + type badge -->
        <div class="flex items-center gap-2">
          <div
            class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold shadow-sm"
            :class="data.avatarClass"
            :aria-label="data.employeeName"
            data-testid="pending-approval-card-avatar"
          >
            {{ data.employeeInitials }}
          </div>
          <span class="text-sm font-medium text-highlighted">
            {{ data.employeeName }}
          </span>
          <UBadge
            :color="data.typeColor"
            variant="subtle"
            size="sm"
            data-testid="pending-approval-card-type-badge"
          >
            {{ data.typeLabel }}
          </UBadge>
        </div>

        <!-- Date range + days -->
        <div class="flex items-center gap-2 text-sm">
          <UIcon name="i-lucide-calendar" class="size-4 shrink-0 text-muted" />
          <span class="text-highlighted">{{ data.dateRangeLabel }}</span>
          <span class="text-muted">({{ data.daysLabel }})</span>
        </div>

        <!-- Reason (SICK guard: null = "Motivo médico reservado" per S5) -->
        <div
          v-if="data.showReason"
          class="flex items-start gap-2 text-sm"
          data-testid="pending-approval-card-reason"
        >
          <UIcon name="i-lucide-message-square" class="mt-0.5 size-4 shrink-0 text-muted" />
          <span
            :class="
              data.isMedicalReserved ? 'italic text-muted' : 'text-highlighted'
            "
          >
            {{ data.reasonLabel }}
          </span>
        </div>

        <!-- Status chip -->
        <div class="flex items-center gap-2">
          <UBadge color="warning" variant="soft" size="sm">
            {{ data.statusLabel }}
          </UBadge>
          <span class="text-xs text-muted">
            Solicitada el {{ data.createdAtLabel }}
          </span>
        </div>
      </div>

      <!-- Action buttons (gated by canReview) -->
      <div v-if="canReview" class="flex shrink-0 items-center gap-2">
        <UButton
          icon="i-lucide-x"
          color="error"
          variant="soft"
          size="sm"
          :disabled="isReviewing"
          data-testid="pending-approval-card-reject"
          @click="onReject(data.request)"
        >
          Rechazar
        </UButton>
        <UButton
          icon="i-lucide-check"
          color="success"
          variant="soft"
          size="sm"
          :disabled="isReviewing"
          data-testid="pending-approval-card-approve"
          @click="onApprove(data.request)"
        >
          Aprobar
        </UButton>
      </div>
    </div>
  </div>
</template>