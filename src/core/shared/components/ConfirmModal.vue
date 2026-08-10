<script setup lang="ts">
export interface ConfirmModalItem {
  id: string
  title: string
  status?: string
}

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    confirmColor?: 'primary' | 'error' | 'warning' | 'success' | 'neutral'
    loading?: boolean
    /**
     * Optional list of items to confirm against (e.g. promotions to delete).
     * When provided AND non-empty, the modal renders a scrollable ordered
     * list of titles INSTEAD of the description paragraph. The description
     * stays REQUIRED so the 26 existing callers stay green with ZERO changes.
     */
    items?: ConfirmModalItem[]
  }>(),
  {
    title: 'Confirmar acción',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    confirmColor: 'primary',
    loading: false,
    items: undefined,
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
      <ul
        v-if="props.items && props.items.length > 0"
        class="max-h-60 overflow-y-auto"
        data-testid="confirm-items-list"
      >
        <li
          v-for="item in props.items"
          :key="item.id"
          class="flex items-center justify-between gap-2 py-1 text-sm"
          data-testid="confirm-item-row"
        >
          <span data-testid="confirm-item-title">{{ item.title }}</span>
          <span
            v-if="item.status"
            class="text-xs text-muted"
            data-testid="confirm-item-status"
          >
            {{ item.status }}
          </span>
        </li>
      </ul>
      <p v-else class="text-sm text-muted" data-testid="confirm-description">
        {{ props.description }}
      </p>
    </template>

    <template #footer>
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <UButton
          :label="props.cancelLabel"
          color="neutral"
          variant="outline"
          :disabled="props.loading"
          class="w-full sm:w-auto"
          @click="handleCancel"
        />
        <UButton
          :label="props.confirmLabel"
          :color="props.confirmColor"
          :loading="props.loading"
          class="w-full sm:w-auto"
          @click="handleConfirm"
        />
      </div>
    </template>
  </UModal>
</template>