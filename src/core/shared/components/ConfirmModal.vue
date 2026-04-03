<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    confirmColor?: 'primary' | 'error' | 'warning' | 'success' | 'neutral'
    loading?: boolean
  }>(),
  {
    title: 'Confirmar acción',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    confirmColor: 'primary',
    loading: false,
  },
)

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'confirm'): void
  (event: 'cancel'): void
}>()

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('update:open', false)
  emit('cancel')
}
</script>

<template>
  <UModal
    :open="props.open"
    :title="props.title"
    :dismissible="!props.loading"
    :close="!props.loading"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <p class="text-sm text-muted">{{ props.description }}</p>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          :label="props.cancelLabel"
          color="neutral"
          variant="outline"
          :disabled="props.loading"
          @click="handleCancel"
        />
        <UButton
          :label="props.confirmLabel"
          :color="props.confirmColor"
          :loading="props.loading"
          @click="handleConfirm"
        />
      </div>
    </template>
  </UModal>
</template>
