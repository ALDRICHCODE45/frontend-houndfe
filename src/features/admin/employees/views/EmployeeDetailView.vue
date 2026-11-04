<script setup lang="ts">
/**
 * EmployeeDetailView — the Colaborador detail page.
 *
 * Layout: the detail header (status, name, one primary + ⋮ menu), the tab bar
 * and the active panel. Contact, contract and hire date live in their tabs
 * instead of a second sidebar that repeated them.
 *
 * Four states (S10): a skeleton shaped like the page while loading, the shared
 * EmptyState (empty with a way back when the record does not exist, error with
 * Reintentar when the request failed), and the data. On mobile the primary
 * (Editar perfil) lives in the sticky bottom bar.
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

import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { breakpointsTailwind, useBreakpoints, useResizeObserver } from '@vueuse/core'
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
  isNotFound,
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

// ── Mobile: the primary moves to the sticky bottom bar ────────────────────────
const isMobile = useBreakpoints(breakpointsTailwind).smaller('md')

// ── Tab strip: a fade at the end while more tabs wait off-screen ───────────────
const tabsScroll = ref<HTMLElement | null>(null)
const tabsHaveMore = ref(false)

function measureTabs(): void {
  const el = tabsScroll.value
  tabsHaveMore.value = !!el && el.scrollWidth - el.clientWidth - el.scrollLeft > 1
}

useResizeObserver(tabsScroll, measureTabs)
onMounted(measureTabs)
watch(visibleTabs, () => void nextTick(measureTabs))

// A deep link to a tab that sits off-screen scrolls it into view.
watch(
  [tabsScroll, activeTab],
  async ([el]) => {
    if (!el) return
    await nextTick()
    el.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({
      inline: 'center',
      block: 'nearest',
    })
    measureTabs()
  },
  { flush: 'post' },
)

// ── Back navigation ───────────────────────────────────────────────────────────
function goBack(): void {
  void router.push({ name: 'admin-employees-list' })
}
</script>

<template>
  <div
    class="hf-theme hf-ui employees-visual employees-detail mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 px-4 sm:px-6 lg:px-10"
    :class="{ 'pb-24': isMobile && canUpdate && employee }"
  >
    <!-- Loading state: the final shape of the page, never a blank screen -->
    <div
      v-if="isLoading"
      class="flex flex-col gap-6"
      aria-busy="true"
      data-testid="employee-detail-skeleton"
    >
      <span class="sr-only">Cargando</span>
      <div class="flex items-center gap-3" aria-hidden="true">
        <div class="size-11 shrink-0 animate-pulse rounded-lg bg-(--hf-surface-muted)" />
        <div class="flex flex-1 flex-col gap-2">
          <div class="h-5 w-40 animate-pulse rounded bg-(--hf-surface-muted)" />
          <div class="h-6 w-64 max-w-full animate-pulse rounded bg-(--hf-surface-muted)" />
        </div>
      </div>
      <div class="flex gap-4 border-b border-(--hf-border) pb-3" aria-hidden="true">
        <div
          v-for="tab in 4"
          :key="tab"
          class="h-5 w-20 animate-pulse rounded bg-(--hf-surface-muted)"
          data-testid="employee-detail-skeleton-tab"
        />
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-hidden="true">
        <div
          v-for="card in 3"
          :key="card"
          class="flex h-28 flex-col gap-3 rounded-xl border border-(--hf-border) p-4"
          data-testid="employee-detail-skeleton-card"
        >
          <div class="h-4 w-24 animate-pulse rounded bg-(--hf-surface-muted)" />
          <div class="h-7 w-32 animate-pulse rounded bg-(--hf-surface-muted)" />
          <div class="h-4 w-20 animate-pulse rounded bg-(--hf-surface-muted)" />
        </div>
      </div>
      <div
        class="flex h-32 flex-col gap-3 rounded-xl border border-(--hf-border) p-5"
        aria-hidden="true"
      >
        <div class="h-5 w-28 animate-pulse rounded bg-(--hf-surface-muted)" />
        <div class="h-4 w-56 max-w-full animate-pulse rounded bg-(--hf-surface-muted)" />
      </div>
    </div>

    <!-- Not found: an empty state with a way back, never a connection error -->
    <div v-else-if="isNotFound" class="pt-4">
      <EmptyState
        title="No encontramos al colaborador"
        description="Puede que se haya eliminado o que el enlace ya no sirva."
        action-label="Volver a colaboradores"
        action-icon="i-lucide-arrow-left"
        action-test-id="employee-detail-not-found-back"
        @action="goBack"
      />
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
        :mobile="isMobile"
        @back="goBack"
        @edit="openEdit"
        @terminate="openTerminate"
        @reactivate="openReactivate"
      />

      <!-- Tab navigation — horizontal scroll on mobile -->
      <div ref="tabsScroll" class="employees-detail-tabs-scroll" :data-more="tabsHaveMore" @scroll.passive="measureTabs">
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

      <!-- Mobile: the one primary lives in the sticky bottom bar -->
      <div
        v-if="isMobile && canUpdate"
        class="employee-detail-action-bar"
        data-testid="employee-detail-action-bar"
      >
        <UButton
          icon="i-lucide-pencil"
          class="hf-primary-control"
          data-testid="employee-detail-edit"
          @click="openEdit"
        >
          Editar perfil
        </UButton>
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
