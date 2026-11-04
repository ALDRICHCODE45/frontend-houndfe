<script setup lang="ts">
/**
 * EmployeeDetailView — the Colaborador detail page.
 *
 * Layout: the detail header (status, name, one primary + ⋮ menu), the tab bar
 * and the active panel. Contact, contract and hire date live in their tabs
 * instead of a second sidebar that repeated them.
 *
 * Four states (S10): a skeleton shaped like the page while loading, the shared
 * EmptyState error with Reintentar, and the data.
 *
 * Tab state is driven by ?tab= query param for deep linking; only the tabs the
 * role can read are shown. Permission gate: read:Employee (route-level
 * meta.permission). The WU-05B slideover + dialogs serve Editar / Dar de baja /
 * Reactivar.
 *
 * Manager resolution:
 *   Uses useManagerResolution with a computed getter that wraps the
 *   single employee in an array (same pattern as the list — no N+1).
 */

import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import {
  useEmployeeDetail,
  filterVisibleTabs,
  resolveActiveTabWithFallback,
} from '../composables/useEmployeeDetail'
import { useManagerResolution } from '../composables/useManagerResolution'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import EmployeeDetailHeader from '../components/EmployeeDetailHeader.vue'
import ResumenPanel from '../components/ResumenPanel.vue'
import PersonalPanel from '../components/PersonalPanel.vue'
import LaboralPanel from '../components/LaboralPanel.vue'
import EmployeeEditSlideover from '../components/EmployeeEditSlideover.vue'
import TerminateEmployeeDialog from '../components/TerminateEmployeeDialog.vue'
import ReactivateEmployeeDialog from '../components/ReactivateEmployeeDialog.vue'
import CompensacionPanel from '../components/CompensacionPanel.vue'
import DocumentosPanel from '../components/DocumentosPanel.vue'
import OrganigramaPanel from '../components/OrganigramaPanel.vue'
import CvPanel from '../components/CvPanel.vue'
import AusenciasPanel from '../components/AusenciasPanel.vue'
import EmergencyContactsPanel from '../components/EmergencyContactsPanel.vue'
import type { Employee } from '../interfaces/employee.types'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'
import '../styles/employees-visual.css'

const authStore = useAuthStore()
const router = useRouter()

const tenantId = computed(() => authStore.currentTenantId)

// ── Detail composable ──────────────────────────────────────────────────────────
const {
  employee,
  isLoading,
  isError,
  activeTab: rawActiveTab,
  setTab,
  tabs,
  canUpdate,
  canReadSalary,
  refetch,
} = useEmployeeDetail()

// ── WU-12A: Compute which tabs are visible for this user ──────────────────────
const visibleTabs = computed(() =>
  filterVisibleTabs(tabs, (action, subject) =>
    authStore.userCan(action as AppAction, subject as AppSubject),
  ),
)

// When the URL points to a now-hidden tab (e.g. ?tab=compensacion but salary revoked),
// resolve gracefully to 'resumen' instead of showing an empty panel.
const activeTab = computed(() =>
  resolveActiveTabWithFallback(rawActiveTab.value, visibleTabs.value),
)

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

/** Full manager info for detail panels (position, department, email) */
const managerInfo = computed(() => {
  if (!employee.value?.managerId) return null
  return managerMap.value.get(employee.value.managerId) ?? null
})

// ── Additional CASL guards (WU-07) ────────────────────────────────────────────
const canCreateSalary = computed(() => authStore.userCan('create', 'EmployeeSalary'))

// ── Additional CASL guards (WU-09) ────────────────────────────────────────────
const canCreateDocument = computed(() => authStore.userCan('create', 'EmployeeDocument'))
const canDeleteDocument = computed(() => authStore.userCan('delete', 'EmployeeDocument'))

// ── Additional CASL guards (WU-10) ────────────────────────────────────────────
const canCreateTimeOff = computed(() => authStore.userCan('create', 'EmployeeTimeOff'))
const canUpdateTimeOff = computed(() => authStore.userCan('update', 'EmployeeTimeOff'))

// ── Additional CASL guards (WU-11) ────────────────────────────────────────────
const canCreateEmergencyContact = computed(() =>
  authStore.userCan('create', 'EmployeeEmergencyContact'),
)
const canUpdateEmergencyContact = computed(() =>
  authStore.userCan('update', 'EmployeeEmergencyContact'),
)
const canDeleteEmergencyContact = computed(() =>
  authStore.userCan('delete', 'EmployeeEmergencyContact'),
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

const activeTabLabel = computed(
  () => visibleTabs.value.find((tab) => tab.key === activeTab.value)?.label ?? '',
)

// ── Back navigation ───────────────────────────────────────────────────────────
function goBack(): void {
  void router.push({ name: 'admin-employees-list' })
}
</script>

<template>
  <div class="hf-theme hf-ui employees-visual employees-detail mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 px-4 sm:px-6 lg:px-10">
    <!-- Loading state: the final shape of the page, never a blank screen -->
    <div
      v-if="isLoading"
      class="flex flex-col gap-6"
      aria-busy="true"
      data-testid="employee-detail-skeleton"
    >
      <span class="sr-only">Cargando</span>
      <div class="flex items-center gap-3" aria-hidden="true">
        <div class="size-11 animate-pulse rounded-lg bg-(--hf-surface-muted)" />
        <div class="flex flex-1 flex-col gap-2">
          <div class="h-5 w-40 animate-pulse rounded bg-(--hf-surface-muted)" />
          <div class="h-6 w-64 max-w-full animate-pulse rounded bg-(--hf-surface-muted)" />
        </div>
      </div>
      <div class="h-10 w-full animate-pulse rounded-lg bg-(--hf-surface-muted)" aria-hidden="true" />
      <div class="h-64 w-full animate-pulse rounded-xl bg-(--hf-surface-muted)" aria-hidden="true" />
    </div>

    <!-- Error state -->
    <div v-else-if="isError" class="flex flex-col gap-4 pt-4">
      <div>
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          data-testid="employee-detail-error-back"
          @click="goBack"
        >
          Colaboradores
        </UButton>
      </div>
      <EmptyState
        kind="error"
        title="No se pudo cargar el colaborador"
        description="Revisa tu conexión e inténtalo de nuevo."
        action-label="Reintentar"
        action-test-id="employee-detail-retry"
        @action="() => refetch()"
      />
    </div>

    <!-- Detail content -->
    <template v-else-if="employee">
      <EmployeeDetailHeader
        :employee="employee"
        :can-update="canUpdate"
        @back="goBack"
        @edit="openEdit"
        @terminate="openTerminate"
        @reactivate="openReactivate"
      />

      <!-- Tab navigation — horizontal scroll on mobile -->
      <div class="employees-detail-tabs-scroll">
        <div class="employees-detail-tabs" role="tablist" aria-label="Secciones del colaborador">
          <button
            v-for="tab in visibleTabs"
            :key="tab.key"
            type="button"
            class="employees-detail-tab"
            :aria-selected="activeTab === tab.key"
            role="tab"
            @click="setTab(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Tab panels -->
      <div class="min-w-0" role="tabpanel" :aria-label="activeTabLabel">
        <!-- Resumen -->
        <ResumenPanel
          v-if="activeTab === 'resumen'"
          :employee="employee"
          :manager-display="managerDisplay"
          :manager-info="managerInfo"
          :can-read-salary="canReadSalary"
        />

        <!-- Personal + Emergency Contacts — WU-11 -->
        <template v-else-if="activeTab === 'personal'">
          <div class="flex flex-col gap-6">
            <PersonalPanel :employee="employee" />
            <EmergencyContactsPanel
              :employee="employee"
              :can-create="canCreateEmergencyContact"
              :can-update="canUpdateEmergencyContact"
              :can-delete="canDeleteEmergencyContact"
            />
          </div>
        </template>

        <!-- Laboral -->
        <LaboralPanel
          v-else-if="activeTab === 'laboral'"
          :employee="employee"
          :manager-display="managerDisplay"
          :manager-id="employee.managerId"
        />

        <!-- Compensación — WU-07 -->
        <CompensacionPanel
          v-else-if="activeTab === 'compensacion'"
          :employee="employee"
          :can-read-salary="canReadSalary"
          :can-create-salary="canCreateSalary"
          :can-update="canUpdate"
        />

        <!-- Organigrama — WU-08 -->
        <OrganigramaPanel
          v-else-if="activeTab === 'organigrama'"
          :employee="employee"
        />

        <!-- CV — WU-08 -->
        <CvPanel
          v-else-if="activeTab === 'cv'"
          :employee="employee"
          :can-update="canUpdate"
          @cv-updated="onActionSuccess"
        />

        <!-- Documentos — WU-09 -->
        <DocumentosPanel
          v-else-if="activeTab === 'documentos'"
          :employee="employee"
          :can-create="canCreateDocument"
          :can-delete="canDeleteDocument"
        />

        <!-- Ausencias — WU-10 -->
        <AusenciasPanel
          v-else-if="activeTab === 'ausencias'"
          :employee="employee"
          :can-create="canCreateTimeOff"
          :can-update="canUpdateTimeOff"
        />
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
