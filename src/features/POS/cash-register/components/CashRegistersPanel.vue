<script setup lang="ts">
/**
 * Cash registers list + create / activate.
 *
 * Presentational: the parent owns the query and the commands. Loading, error,
 * empty and access states are all explicit; the "Abrir caja" action is offered
 * only for an active register and only when the identity may open sessions.
 */
import { computed, ref } from 'vue'
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

const newName = ref('')
const formError = ref<string | null>(null)

const showEmpty = computed(() => !props.loading && !props.error && props.registers.length === 0)

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

function toggleActive(register: CashRegister) {
  emit('update', register.id, { isActive: !register.isActive })
}
</script>

<template>
  <section class="cash-panel" data-testid="cash-registers-panel">
    <header class="cash-panel-header">
      <span class="cash-icon-tile" aria-hidden="true">
        <UIcon name="i-lucide-store" />
      </span>
      <div class="cash-panel-header-text">
        <h2 class="cash-panel-title">Cajas</h2>
        <p class="cash-panel-subtitle">Elige una caja activa para abrir su sesión de caja.</p>
      </div>
      <div class="cash-panel-header-actions">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="cash-control"
          data-testid="cash-registers-refresh"
          @click="emit('refresh')"
        >
          Actualizar
        </UButton>
      </div>
    </header>

    <div class="cash-panel-body">
      <div v-if="loading" aria-busy="true" data-testid="cash-registers-loading">
        <USkeleton class="h-12 w-full" />
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        title="No se pudieron cargar las cajas"
        :description="errorMessage"
        data-testid="cash-registers-error"
      />

      <p v-else-if="showEmpty" class="text-sm text-muted" data-testid="cash-registers-empty">
        No hay cajas registradas todavía. Crea la primera para operar.
      </p>

      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="register in registers"
          :key="register.id"
          class="flex flex-wrap items-center gap-3 rounded-lg border p-3"
          :class="
            selectedRegisterId === register.id ? 'border-primary/40 bg-primary/5' : 'border-default'
          "
          :data-testid="`cash-register-item-${register.id}`"
        >
          <span
            class="cash-icon-tile flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted ring-1 ring-default"
          >
            <UIcon name="i-lucide-store" aria-hidden="true" class="size-5" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3
                class="truncate text-sm font-semibold text-highlighted"
                data-testid="cash-register-name"
              >
                {{ register.name }}
              </h3>
              <UBadge
                v-if="selectedRegisterId === register.id"
                color="primary"
                variant="subtle"
                size="sm"
                data-testid="cash-register-selected"
              >
                Seleccionada
              </UBadge>
            </div>
            <p class="mt-0.5 text-xs text-muted">
              <span data-testid="cash-register-active-state">
                {{ register.isActive ? 'Activa' : 'Inactiva' }}
              </span>
              <span aria-hidden="true"> · </span>
              <span>{{
                register.isActive ? 'Lista para abrir sesión' : 'No admite apertura'
              }}</span>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="canOpen"
              type="button"
              color="primary"
              class="cash-control min-h-11"
              :disabled="!register.isActive || selectedRegisterId === register.id"
              :data-testid="`cash-register-open-${register.id}`"
              @click="emit('select', register.id)"
            >
              {{ selectedRegisterId === register.id ? 'Caja seleccionada' : 'Abrir caja' }}
            </UButton>
            <UButton
              v-if="canUpdate"
              type="button"
              color="neutral"
              variant="outline"
              class="cash-control min-h-11"
              :loading="updating"
              :data-testid="`cash-register-toggle-${register.id}`"
              @click="toggleActive(register)"
            >
              {{ register.isActive ? 'Desactivar' : 'Activar' }}
            </UButton>
          </div>
        </li>
      </ul>

      <form
        v-if="canCreate"
        class="flex flex-wrap items-end gap-2 border-t border-default pt-4"
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
          class="min-h-11"
          :loading="creating"
          data-testid="cash-register-create-submit"
        >
          Crear caja
        </UButton>
        <p v-if="formError" class="text-xs text-error" data-testid="cash-register-form-error">
          {{ formError }}
        </p>
      </form>

      <p v-else class="text-xs text-muted" data-testid="cash-registers-create-forbidden">
        No tienes permiso para crear cajas.
      </p>
    </div>
  </section>
</template>
