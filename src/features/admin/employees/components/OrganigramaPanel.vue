<script setup lang="ts">
/**
 * OrganigramaPanel — WU-08
 *
 * Organigrama tab panel for the Employee Detail View.
 *
 * Layout (per design brief):
 *   1. Manager chain — vertical tree nodes from direct manager → root (top of org).
 *      Current employee is shown at the bottom as the focal node.
 *   2. Subordinates list — direct reports only (not recursive).
 *      Empty state shown when 0 reportes directos (valid case).
 *   3. Truncation affordance when chain.length === 50 (backend max cap).
 *   4. "Árbol completo" button placeholder (v2 — disabled + tooltip).
 *
 * CASL gates:
 *   - Both endpoints require read:Employee (standard tier — no salary shown).
 *   - Org chart NEVER shows salary fields.
 */

import { computed } from 'vue'
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
} = useEmployeeManagerChain(employeeId)

const {
  data: rawSubordinates,
  isLoading: isSubsLoading,
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
</script>

<template>
  <div class="flex flex-col gap-6">

    <!-- ── Cadena de managers ─────────────────────────────────────────────── -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-default px-5 py-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-git-branch" class="size-4 text-primary" />
          <h3 class="text-sm font-semibold text-highlighted">Cadena de mando</h3>
        </div>
        <!-- "Árbol completo" — v2 placeholder, disabled -->
        <UTooltip text="Disponible en una próxima versión">
          <UButton
            icon="i-lucide-network"
            size="xs"
            variant="outline"
            color="neutral"
            label="Árbol completo"
            disabled
          />
        </UTooltip>
      </div>

      <!-- Loading state -->
      <div v-if="isChainLoading" class="px-5 py-6">
        <div class="flex flex-col gap-3">
          <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-elevated" />
        </div>
      </div>

      <!-- Chain content (or empty) -->
      <div v-else class="px-5 py-4">

        <!-- Truncation affordance — shown when backend returned the max 50 levels -->
        <div
          v-if="chainTruncated"
          class="mb-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          <UIcon name="i-lucide-alert-triangle" class="size-3.5 shrink-0" />
          <span>
            La cadena de mando supera los 50 niveles. Se muestran los primeros 50.
          </span>
        </div>

        <!-- Empty state: no manager chain -->
        <div
          v-if="chainEntries.length === 0 && !chainTruncated"
          class="flex flex-col items-center gap-2 py-8 text-center"
        >
          <UIcon name="i-lucide-user-check" class="size-8 text-muted opacity-40" />
          <p class="text-sm text-muted">
            Este colaborador no tiene managers registrados.
          </p>
        </div>

        <!-- Vertical chain tree: top-down (chain[0] = direct manager → chain[last] = root) -->
        <!-- We reverse the display: root at top → direct manager just above current employee -->
        <div v-else class="flex flex-col gap-0">
          <div
            v-for="(entry, index) in [...chainEntries].reverse()"
            :key="entry.id"
            class="flex items-start gap-3"
          >
            <!-- Connector line + node -->
            <div class="flex flex-col items-center">
              <!-- Top connector (not on first item) -->
              <div
                :class="['w-px bg-border-default', index === 0 ? 'h-0' : 'h-4']"
              />
              <!-- Node dot -->
              <div class="size-3 rounded-full bg-muted ring-2 ring-default" />
              <!-- Bottom connector (always present — links to next / to employee node) -->
              <div class="w-px flex-1 bg-border-default" style="min-height: 20px;" />
            </div>

            <!-- Entry info -->
            <div class="min-w-0 flex-1 pb-2 pt-3">
              <p class="text-sm font-medium text-highlighted">{{ entry.fullName }}</p>
              <p class="text-xs text-muted">{{ entry.position }}</p>
              <span
                v-if="entry.department"
                class="mt-1 inline-block rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
              >
                {{ entry.department }}
              </span>
            </div>
          </div>

          <!-- Current employee — focal node at the bottom of the chain -->
          <div class="flex items-start gap-3">
            <div class="flex flex-col items-center">
              <div class="w-px bg-border-default" style="min-height: 20px;" />
              <div class="size-4 rounded-full bg-primary ring-2 ring-primary/30" />
            </div>
            <div class="min-w-0 flex-1 pt-2">
              <p class="text-sm font-semibold text-primary">{{ employee.fullName }}</p>
              <p class="text-xs text-muted">{{ employee.currentPosition ?? '—' }}</p>
              <span
                v-if="employee.currentDepartment"
                class="mt-1 inline-block rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
              >
                {{ employee.currentDepartment }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- ── Reportes directos (subordinados) ──────────────────────────────── -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-default px-5 py-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-users" class="size-4 text-muted" />
          <h3 class="text-sm font-semibold text-highlighted">Reportes directos</h3>
          <!-- Count badge (only when loaded) -->
          <span
            v-if="!isSubsLoading && subordinateEntries.length > 0"
            class="inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
          >
            {{ subordinateEntries.length }}
          </span>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="isSubsLoading" class="px-5 py-6">
        <div class="flex flex-col gap-3">
          <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-elevated" />
        </div>
      </div>

      <!-- Empty state (valid: 0 direct reports) -->
      <div
        v-else-if="subordinateEntries.length === 0"
        class="flex flex-col items-center gap-2 px-5 py-10 text-center"
      >
        <UIcon name="i-lucide-users" class="size-8 text-muted opacity-40" />
        <p class="text-sm text-muted">Sin reportes directos.</p>
        <p class="text-xs text-muted opacity-70">
          Este colaborador no tiene empleados bajo su supervisión directa.
        </p>
      </div>

      <!-- Subordinates list -->
      <div v-else class="divide-y divide-default">
        <div
          v-for="entry in subordinateEntries"
          :key="entry.id"
          class="flex items-center gap-4 px-5 py-3"
        >
          <!-- Avatar initials -->
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-full bg-elevated text-sm font-semibold text-muted"
          >
            {{ entry.fullName.charAt(0).toUpperCase() }}
          </div>

          <!-- Info -->
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-highlighted">{{ entry.fullName }}</p>
            <p class="text-xs text-muted">{{ entry.position }}</p>
          </div>

          <!-- Department badge -->
          <span
            v-if="entry.department"
            class="shrink-0 rounded-sm bg-elevated px-1.5 py-0.5 text-xs text-muted"
          >
            {{ entry.department }}
          </span>
        </div>
      </div>
    </UCard>

  </div>
</template>
