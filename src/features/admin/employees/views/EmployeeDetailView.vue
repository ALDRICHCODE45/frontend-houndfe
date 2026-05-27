<script setup lang="ts">
/**
 * EmployeeDetailView — WU-06A
 *
 * Employee detail shell page. Layout:
 *   - Left sidebar: EmployeeProfileCard (fixed width on desktop)
 *   - Right content: horizontal tab bar + tab panels
 *
 * Tab bar shows all 8 tabs:
 *   Resumen, Personal, Laboral (real content — WU-06A)
 *   Compensación, Organigrama, Documentos, Ausencias, CV (→ "Próximamente" placeholder)
 *
 * Tab state is driven by ?tab= query param for deep linking.
 * Permission gate: read:Employee (route-level meta.permission).
 *
 * WU-05B slideover + dialogs reused for Editar / Dar de baja / Reactivar.
 *
 * Manager resolution:
 *   Uses useManagerResolution with a computed getter that wraps the
 *   single employee in an array (same pattern as the list — no N+1).
 */

import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useEmployeeDetail } from '../composables/useEmployeeDetail'
import { useManagerResolution } from '../composables/useManagerResolution'
import EmployeeProfileCard from '../components/EmployeeProfileCard.vue'
import ResumenPanel from '../components/ResumenPanel.vue'
import PersonalPanel from '../components/PersonalPanel.vue'
import LaboralPanel from '../components/LaboralPanel.vue'
import EmployeeEditSlideover from '../components/EmployeeEditSlideover.vue'
import TerminateEmployeeDialog from '../components/TerminateEmployeeDialog.vue'
import ReactivateEmployeeDialog from '../components/ReactivateEmployeeDialog.vue'
import type { Employee } from '../interfaces/employee.types'

const authStore = useAuthStore()
const router = useRouter()

const tenantId = computed(() => authStore.currentTenantId)

// ── Detail composable ──────────────────────────────────────────────────────────
const {
  employee,
  isLoading,
  isError,
  activeTab,
  setTab,
  tabs,
  canUpdate,
  canReadSalary,
  initials,
  refetch,
} = useEmployeeDetail()

// ── Manager resolution (reuses batch pattern from list — single employee wrapped in array)
const employeesForManager = computed<Employee[]>(() =>
  employee.value ? [employee.value] : [],
)
const { managerMap, resolveManagerName } = useManagerResolution(
  () => employeesForManager.value,
  () => tenantId.value,
)

const managerDisplay = computed<string>(() =>
  employee.value ? resolveManagerName(employee.value.managerId) : '—',
)

// ── Slideover / dialog state ───────────────────────────────────────────────────
const isEditOpen = ref(false)
const isTerminateOpen = ref(false)
const isReactivateOpen = ref(false)

function openEdit(): void {
  isEditOpen.value = true
}

function openTerminate(): void {
  isTerminateOpen.value = true
}

function openReactivate(): void {
  isReactivateOpen.value = true
}

function onActionSuccess(): void {
  void refetch()
}

// ── Back navigation ───────────────────────────────────────────────────────────
function goBack(): void {
  void router.push({ name: 'admin-employees-list' })
}
</script>

<template>
  <div class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex flex-col gap-6">
      <!-- Back link skeleton -->
      <div class="h-5 w-32 animate-pulse rounded bg-elevated" />

      <!-- Content skeleton: left sidebar + right panels -->
      <div class="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div class="h-96 w-full animate-pulse rounded-xl bg-elevated lg:w-72 lg:shrink-0" />
        <div class="flex flex-1 flex-col gap-4">
          <div class="h-10 animate-pulse rounded-lg bg-elevated" />
          <div class="h-64 animate-pulse rounded-xl bg-elevated" />
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="isError" class="flex flex-col items-center gap-4 py-16 text-center">
      <UIcon name="i-lucide-alert-circle" class="size-12 text-error opacity-70" />
      <div>
        <p class="font-semibold text-highlighted">No se pudo cargar el colaborador</p>
        <p class="text-sm text-muted">Verificá que el ID sea válido o intentá de nuevo.</p>
      </div>
      <div class="flex items-center gap-3">
        <UButton color="neutral" variant="outline" icon="i-lucide-arrow-left" @click="goBack">
          Volver a la lista
        </UButton>
        <UButton icon="i-lucide-refresh-cw" @click="() => refetch()">
          Reintentar
        </UButton>
      </div>
    </div>

    <!-- Detail content -->
    <template v-else-if="employee">
      <!-- Back breadcrumb -->
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="goBack"
        />
        <nav class="flex items-center gap-1.5 text-sm text-muted">
          <RouterLink
            :to="{ name: 'admin-employees-list' }"
            class="hover:text-default hover:underline"
          >
            Colaboradores
          </RouterLink>
          <UIcon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="font-medium text-default">{{ employee.fullName }}</span>
        </nav>
      </div>

      <!-- Two-column layout on large screens -->
      <div class="flex flex-col gap-6 lg:flex-row lg:items-start">

        <!-- Left sidebar: Profile Card -->
        <div class="w-full lg:w-72 lg:shrink-0">
          <EmployeeProfileCard
            :employee="employee"
            :can-update="canUpdate"
            @edit="openEdit"
            @terminate="openTerminate"
            @reactivate="openReactivate"
          />
        </div>

        <!-- Right content: Tab bar + panels -->
        <div class="flex min-w-0 flex-1 flex-col gap-4">
          <!-- Tab navigation — horizontal scroll on mobile -->
          <div class="overflow-x-auto">
            <div class="flex min-w-max gap-1 rounded-xl border border-default bg-elevated/50 p-1">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                :class="[
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                  activeTab === tab.key
                    ? 'bg-white text-primary shadow-sm dark:bg-elevated'
                    : 'text-muted hover:text-default',
                ]"
                :aria-selected="activeTab === tab.key"
                role="tab"
                @click="setTab(tab.key)"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>

          <!-- Tab panels -->
          <div role="tabpanel" :aria-label="`Panel: ${activeTab}`">
            <!-- Resumen -->
            <ResumenPanel
              v-if="activeTab === 'resumen'"
              :employee="employee"
              :manager-display="managerDisplay"
              :can-read-salary="canReadSalary"
            />

            <!-- Personal -->
            <PersonalPanel
              v-else-if="activeTab === 'personal'"
              :employee="employee"
              :can-update="canUpdate"
              @edit="openEdit"
            />

            <!-- Laboral -->
            <LaboralPanel
              v-else-if="activeTab === 'laboral'"
              :employee="employee"
              :manager-display="managerDisplay"
              :manager-id="employee.managerId"
              :can-update="canUpdate"
              @edit="openEdit"
            />

            <!-- Remaining tabs — "Próximamente" placeholder -->
            <div
              v-else
              class="flex flex-col items-center justify-center gap-4 rounded-xl border border-default bg-elevated/30 py-20 text-center"
            >
              <UIcon name="i-lucide-construction" class="size-10 text-muted opacity-60" />
              <div>
                <p class="font-semibold text-highlighted">Próximamente</p>
                <p class="text-sm text-muted">
                  Esta sección estará disponible en una próxima actualización.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- Dialogs & slideoveres — rendered outside the main layout via Teleport inside components -->
  <EmployeeEditSlideover
    v-if="canUpdate"
    v-model:open="isEditOpen"
    :employee="employee ?? null"
    @success="onActionSuccess"
  />

  <TerminateEmployeeDialog
    v-if="canUpdate"
    v-model:open="isTerminateOpen"
    :employee="employee ?? null"
    @success="onActionSuccess"
  />

  <ReactivateEmployeeDialog
    v-if="canUpdate"
    v-model:open="isReactivateOpen"
    :employee="employee ?? null"
    @success="onActionSuccess"
  />
</template>
