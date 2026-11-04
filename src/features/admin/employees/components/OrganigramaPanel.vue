<script setup lang="ts">
/**
 * OrganigramaPanel — WU-08
 *
 * Organigrama tab panel for the Employee Detail View.
 *
 * Layout:
 *   1. Manager chain — vertical tree nodes from root → direct manager.
 *      Current employee is shown at the bottom as the focal node.
 *   2. Subordinates list — direct reports only (not recursive).
 *      Empty state shown when 0 reportes directos (valid case).
 *   3. Truncation notice when chain.length === 50 (backend max cap).
 *
 * Four states per section (S10): skeleton while loading, the shared error
 * EmptyState with Reintentar, the shared empty state, and the data. Neutral
 * surfaces: color is reserved for status, so the nodes and chips carry none.
 *
 * CASL gates:
 *   - Both endpoints require read:Employee (standard tier — no salary shown).
 *   - Org chart NEVER shows salary fields.
 */

import { computed } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import type { Employee } from '../interfaces/employee.types'
import {
  useEmployeeSubordinates,
  useEmployeeManagerChain,
  buildManagerChainDisplay,
  buildSubordinateDisplayEntry,
  isChainTruncated,
} from '../composables/useOrganigrama'

// ─── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  employee: Employee
}>()

// ─── Queries ───────────────────────────────────────────────────────────────────

const employeeId = computed(() => props.employee.id)

const {
  data: rawChain,
  isLoading: isChainLoading,
  isError: isChainError,
  refetch: refetchChain,
} = useEmployeeManagerChain(employeeId)

const {
  data: rawSubordinates,
  isLoading: isSubsLoading,
  isError: isSubsError,
  refetch: refetchSubs,
} = useEmployeeSubordinates(employeeId)

// ─── Derived display data ─────────────────────────────────────────────────────

const chainEntries = computed(() =>
  buildManagerChainDisplay(rawChain.value ?? []),
)

const subordinateEntries = computed(() =>
  (rawSubordinates.value ?? []).map(buildSubordinateDisplayEntry),
)

const chainTruncated = computed(() =>
  isChainTruncated(rawChain.value ?? []),
)

/** One muted line under a name: position · department. */
function jobLine(position: string | null | undefined, department: string | null | undefined): string {
  return [position, department].filter((part) => part && part !== '—').join(' · ') || '—'
}
</script>

<template>
  <div class="flex flex-col gap-6">

    <!-- ── Cadena de mando ────────────────────────────────────────────────── -->
    <UCard class="employees-detail-section" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="border-b border-default px-5 py-4">
        <h2 class="text-base font-semibold text-highlighted">Cadena de mando</h2>
      </div>

      <!-- Loading -->
      <div
        v-if="isChainLoading"
        class="flex flex-col gap-3 px-5 py-6"
        aria-busy="true"
        data-testid="organigrama-chain-skeleton"
      >
        <span class="sr-only">Cargando</span>
        <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-(--hf-surface-muted)" aria-hidden="true" />
      </div>

      <!-- Error -->
      <div v-else-if="isChainError" class="p-5" data-testid="organigrama-chain-error">
        <EmptyState
          kind="error"
          title="No se pudo cargar la cadena de mando"
          action-label="Reintentar"
          action-test-id="organigrama-chain-retry"
          @action="() => refetchChain()"
        />
      </div>

      <!-- Chain content (or empty) -->
      <div v-else class="px-5 py-4">

        <!-- Truncation notice — shown when backend returned the max 50 levels -->
        <p
          v-if="chainTruncated"
          class="mb-4 rounded-lg bg-(--hf-warning-soft) px-3 py-2 text-[13px] font-medium text-(--hf-warning)"
          role="status"
        >
          La cadena de mando supera los 50 niveles. Se muestran los primeros 50.
        </p>

        <!-- Empty: no manager chain -->
        <EmptyState
          v-if="chainEntries.length === 0 && !chainTruncated"
          title="Sin jefes registrados"
          icon="i-lucide-user-check"
        />

        <!-- Vertical chain: root at top → direct manager just above the current employee -->
        <div v-else class="flex flex-col gap-0">
          <div
            v-for="(entry, index) in [...chainEntries].reverse()"
            :key="entry.id"
            class="flex items-start gap-3"
          >
            <div class="flex flex-col items-center">
              <div :class="['w-px bg-(--hf-border)', index === 0 ? 'h-0' : 'h-4']" />
              <div class="size-3 rounded-full bg-(--hf-muted)" />
              <div class="min-h-5 w-px flex-1 bg-(--hf-border)" />
            </div>

            <div class="min-w-0 flex-1 pb-2 pt-3">
              <p class="text-sm font-medium text-highlighted">{{ entry.fullName }}</p>
              <p class="text-[13px] text-muted">{{ jobLine(entry.position, entry.department) }}</p>
            </div>
          </div>

          <!-- Current employee — focal node at the bottom of the chain -->
          <div class="flex items-start gap-3">
            <div class="flex flex-col items-center">
              <div class="min-h-5 w-px bg-(--hf-border)" />
              <div class="size-4 rounded-full bg-(--hf-heading)" />
            </div>
            <div class="min-w-0 flex-1 pt-2">
              <p class="text-sm font-semibold text-highlighted">{{ employee.fullName }}</p>
              <p class="text-[13px] text-muted">
                {{ jobLine(employee.currentPosition, employee.currentDepartment) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- ── Reportes directos (subordinados) ──────────────────────────────── -->
    <UCard class="employees-detail-section" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="border-b border-default px-5 py-4">
        <h2 class="text-base font-semibold text-highlighted">
          Reportes directos
          <span v-if="!isSubsLoading && subordinateEntries.length > 0" class="font-normal text-muted">
            · {{ subordinateEntries.length }}
          </span>
        </h2>
      </div>

      <!-- Loading -->
      <div
        v-if="isSubsLoading"
        class="flex flex-col gap-3 px-5 py-6"
        aria-busy="true"
        data-testid="organigrama-subs-skeleton"
      >
        <span class="sr-only">Cargando</span>
        <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-(--hf-surface-muted)" aria-hidden="true" />
      </div>

      <!-- Error -->
      <div v-else-if="isSubsError" class="p-5" data-testid="organigrama-subs-error">
        <EmptyState
          kind="error"
          title="No se pudieron cargar los reportes directos"
          action-label="Reintentar"
          action-test-id="organigrama-subs-retry"
          @action="() => refetchSubs()"
        />
      </div>

      <!-- Empty (valid: 0 direct reports) -->
      <div v-else-if="subordinateEntries.length === 0" class="p-5">
        <EmptyState title="Sin reportes directos" icon="i-lucide-users" />
      </div>

      <!-- Subordinates list -->
      <ul v-else class="divide-y divide-default">
        <li
          v-for="entry in subordinateEntries"
          :key="entry.id"
          class="flex items-center gap-4 px-5 py-3"
        >
          <EntityAvatar :name="entry.fullName" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-highlighted">{{ entry.fullName }}</p>
            <p class="text-[13px] text-muted">{{ jobLine(entry.position, entry.department) }}</p>
          </div>
        </li>
      </ul>
    </UCard>

  </div>
</template>
