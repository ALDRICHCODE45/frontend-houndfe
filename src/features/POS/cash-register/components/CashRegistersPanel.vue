<script setup lang="ts">
/**
 * Cash registers list + create / activate.
 *
 * Presentational: the parent owns the query and the commands. Loading, error,
 * empty and access states are explicit; "Abrir caja" is offered only for an
 * active register and only when the identity may open sessions. A register that
 * cannot be opened has no name button and no whole-row click.
 */
import { computed, ref, useTemplateRef } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import type { TableColumn } from '@/core/shared/types/table.types'
import type { CashRegister } from '../interfaces/cash.types'

const props = withDefaults(
  defineProps<{
    registers: CashRegister[]
    selectedRegisterId?: string | null
    loading?: boolean
    error?: boolean
    errorMessage?: string
    canCreate?: boolean
    canUpdate?: boolean
    canOpen?: boolean
    creating?: boolean
    updating?: boolean
  }>(),
  {
    selectedRegisterId: null,
    loading: false,
    error: false,
    errorMessage: 'No se pudieron cargar las cajas. Reintenta.',
    canCreate: false,
    canUpdate: false,
    canOpen: false,
    creating: false,
    updating: false,
  },
)

const emit = defineEmits<{
  select: [registerId: string]
  create: [name: string]
  update: [id: string, payload: { name?: string; isActive?: boolean }]
  refresh: []
}>()

const columns: TableColumn<CashRegister, unknown>[] = [
  { id: 'name', header: 'Caja', enableSorting: false },
  { id: 'status', header: 'Estado', enableSorting: false },
  {
    id: 'actions',
    header: 'Acciones',
    enableSorting: false,
    meta: { class: { th: 'w-16', td: 'w-16 text-right' } },
  },
]

const root = useTemplateRef<HTMLElement>('root')
const newName = ref('')
const formError = ref<string | null>(null)

const data = computed(() => [...props.registers])
const emptyState = computed(() => ({
  title: 'Aún no hay cajas',
  description: 'Crea la primera para operar.',
  ...(props.canCreate ? { actionLabel: 'Crear caja' } : {}),
}))

const isSelected = (register: CashRegister) => props.selectedRegisterId === register.id
const isOpenable = (register: CashRegister) => props.canOpen && register.isActive
const statusOf = (register: CashRegister) => ({
  label: register.isActive ? 'Activa' : 'Inactiva',
  tone: register.isActive ? ('success' as const) : ('neutral' as const),
})

function actionsFor(register: CashRegister): RowAction[] {
  return [
    ...(isOpenable(register) && !isSelected(register)
      ? [{ key: 'open', label: 'Abrir caja', icon: 'i-lucide-door-open' }]
      : []),
    ...(props.canUpdate
      ? [
          {
            key: 'toggle',
            label: register.isActive ? 'Desactivar' : 'Activar',
            icon: register.isActive ? 'i-lucide-power-off' : 'i-lucide-power',
            disabled: props.updating,
          },
        ]
      : []),
  ]
}

function open(register: CashRegister) {
  if (isOpenable(register) && !isSelected(register)) emit('select', register.id)
}

function onAction(key: string, register: CashRegister) {
  if (key === 'open') open(register)
  else if (key === 'toggle') emit('update', register.id, { isActive: !register.isActive })
}

function focusCreate() {
  root.value?.querySelector<HTMLInputElement>('[data-testid="cash-register-name-input"]')?.focus()
}

function submitCreate() {
  const name = newName.value.trim()
  if (!name) {
    formError.value = 'Ingresa un nombre para la caja.'
    return
  }
  formError.value = null
  emit('create', name)
  newName.value = ''
}

const { rowProps } = useClickableRow<CashRegister>(open, { focusable: false })
</script>

<template>
  <section ref="root" class="cash-list-section" data-testid="cash-registers-panel">
    <header class="cash-list-header">
      <h2 class="cash-list-title">Cajas</h2>
    </header>

    <AppDataTable
      :show-toolbar="false"
      :columns="columns"
      :data="data"
      :loading="loading"
      :error="error"
      :error-message="errorMessage"
      :empty-state="emptyState"
      :row-open="canOpen ? open : undefined"
      display-mode="auto"
      mobile-render="cards"
      class="hf-data-table"
      @refresh="emit('refresh')"
      @empty-action="focusCreate"
    >
      <template #name-cell="{ row }">
        <button
          v-if="isOpenable(row.original)"
          type="button"
          class="hf-row-primary cash-row-link"
          :data-testid="`cash-register-open-${row.original.id}`"
          @click="open(row.original)"
        >
          {{ row.original.name }}
        </button>
        <span v-else class="hf-row-primary cash-row-link" data-testid="cash-register-name">{{
          row.original.name
        }}</span>
        <span v-if="isSelected(row.original)" class="hf-row-secondary">Seleccionada</span>
      </template>
      <template #status-cell="{ row }">
        <StatusBadge
          v-bind="statusOf(row.original)"
          :data-testid="`cash-register-status-${row.original.id}`"
        />
      </template>
      <template #actions-header><span class="sr-only">Acciones</span></template>
      <template #actions-cell="{ row }">
        <RowActionsMenu
          :actions="actionsFor(row.original)"
          :row-label="row.original.name"
          @select="onAction($event, row.original)"
        />
      </template>

      <template #mobile-card="{ row }">
        <article v-bind="rowProps(row)" class="cash-card">
          <div class="cash-card-heading">
            <div class="cash-card-title">
              <button
                v-if="isOpenable(row)"
                type="button"
                class="hf-row-primary cash-row-link"
                :data-testid="`cash-register-open-${row.id}`"
                @click="open(row)"
              >
                {{ row.name }}
              </button>
              <span v-else class="hf-row-primary cash-row-link" data-testid="cash-register-name">{{
                row.name
              }}</span>
              <span v-if="isSelected(row)" class="hf-row-secondary">Seleccionada</span>
            </div>
            <RowActionsMenu
              class="cash-card-menu"
              :actions="actionsFor(row)"
              :row-label="row.name"
              @select="onAction($event, row)"
            />
          </div>
          <div class="cash-card-meta">
            <StatusBadge
              v-bind="statusOf(row)"
              :data-testid="`cash-register-status-${row.id}`"
            />
          </div>
        </article>
      </template>
    </AppDataTable>

    <form
      v-if="canCreate"
      class="flex flex-wrap items-end gap-2"
      data-testid="cash-register-create-form"
      @submit.prevent="submitCreate"
    >
      <UFormField label="Nombre de la nueva caja" class="min-w-56 flex-1">
        <UInput
          v-model="newName"
          class="w-full"
          placeholder="Caja principal"
          data-testid="cash-register-name-input"
        />
      </UFormField>
      <UButton
        type="submit"
        color="neutral"
        variant="outline"
        class="min-h-11"
        :loading="creating"
        data-testid="cash-register-create-submit"
      >
        Crear caja
      </UButton>
      <p v-if="formError" class="w-full text-xs text-error" data-testid="cash-register-form-error">
        {{ formError }}
      </p>
    </form>
  </section>
</template>
