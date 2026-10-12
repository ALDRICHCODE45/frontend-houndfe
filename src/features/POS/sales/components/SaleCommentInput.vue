<script setup lang="ts">
import { ref } from 'vue'
import SaleCommentSlideover from './SaleCommentSlideover.vue'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const props = defineProps<{
  isPending?: boolean
  /**
   * Optional teleport boundary marker forwarded to the owned comment
   * slideover. Absent by default, which preserves the previous `ui` value.
   */
  portalClass?: string
  onSubmit: (payload: { body: string }) => Promise<unknown>
}>()

const toast = useToast()
const open = ref(false)

function openInput() {
  open.value = true
}

async function handleSubmit(payload: { body: string }) {
  try {
    await props.onSubmit(payload)
    open.value = false
  } catch {
    toast.add({ title: 'Error', description: 'No se pudo guardar el comentario', color: 'error' })
  }
}
</script>

<template>
  <div class="mt-3" data-testid="sale-comment-input">
    <UButton
      variant="soft"
      size="sm"
      icon="i-lucide-message-circle-plus"
      data-testid="comment-open"
      class="!bg-coco-gold-500/15 !text-coco-gold-800 dark:!text-coco-gold-300 hover:!bg-coco-gold-500/25"
      @click="openInput"
    >
      Agregar comentario
    </UButton>

    <SaleCommentSlideover
      v-model:open="open"
      :is-pending="isPending"
      :portal-class="portalClass"
      @submit="handleSubmit"
    />
  </div>
</template>
