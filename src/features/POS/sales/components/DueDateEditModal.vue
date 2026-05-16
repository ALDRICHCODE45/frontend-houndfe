<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSaleDueDate } from '../composables/useSaleDueDate'
import { SaleDueDateError } from '../interfaces/sale.types'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'error' | 'success' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const props = defineProps<{
  open: boolean
  saleId: string
  /** Current due date (ISO string) — used to prefill the input */
  currentDueDate: string | null
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
}>()

const toast = useToast()
const { setDueDate, isPending } = useSaleDueDate(() => props.saleId)

// Local input value as YYYY-MM-DD (HTML date input format)
const inputValue = ref('')

function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  // Extract YYYY-MM-DD from ISO timestamp
  return iso.slice(0, 10)
}

function todayISODate(): string {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      inputValue.value = toDateInputValue(props.currentDueDate)
    }
  },
  { immediate: true },
)

const minDate = computed(() => todayISODate())

const isValid = computed(() => {
  if (!inputValue.value) return false
  return inputValue.value >= minDate.value
})

function resolveErrorMessage(error: unknown): string {
  const code = error instanceof SaleDueDateError ? error.code : (error as { code?: string })?.code
  switch (code) {
    case 'INVALID_DUE_DATE':
      return 'La fecha de vencimiento no es válida.'
    case 'SALE_ALREADY_PAID':
      return 'La venta ya está pagada, no se puede modificar el vencimiento.'
    case 'SALE_NOT_FOUND':
      return 'La venta ya no existe.'
    case 'SALE_UPDATE_FORBIDDEN':
      return 'No tenés permisos para modificar esta venta.'
    default:
      return 'No se pudo actualizar el vencimiento.'
  }
}

async function handleSave() {
  if (!isValid.value) return
  try {
    await setDueDate(inputValue.value)
    emit('update:open', false)
  } catch (error) {
    toast.add({
      title: 'Error',
      description: resolveErrorMessage(error),
      color: 'error',
    })
  }
}

async function handleClear() {
  try {
    await setDueDate(null)
    emit('update:open', false)
  } catch (error) {
    toast.add({
      title: 'Error',
      description: resolveErrorMessage(error),
      color: 'error',
    })
  }
}
</script>

<template>
  <UModal :open="open" title="Editar fecha de vencimiento" @update:open="emit('update:open', $event)">
    <template #body>
      <div data-testid="due-date-edit-modal" class="space-y-4">
        <p class="text-sm text-muted">
          Elegí la fecha en la que vence la deuda de esta venta.
        </p>

        <UFormField label="Vence" name="dueDate">
          <UInput
            v-model="inputValue"
            data-testid="due-date-input"
            type="date"
            :min="minDate"
            :disabled="isPending"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton
          v-if="currentDueDate"
          data-testid="due-date-clear"
          color="error"
          variant="ghost"
          :loading="isPending"
          label="Limpiar fecha"
          @click="handleClear"
        />
        <div class="ml-auto flex gap-2">
          <UButton
            color="neutral"
            variant="soft"
            label="Cancelar"
            :disabled="isPending"
            @click="emit('update:open', false)"
          />
          <UButton
            data-testid="due-date-save"
            color="primary"
            :loading="isPending"
            :disabled="!isValid"
            label="Guardar"
            @click="handleSave"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
