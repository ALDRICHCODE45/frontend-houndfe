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
      color="primary"
      size="sm"
      icon="i-lucide-message-circle-plus"
      data-testid="comment-open"
      @click="openInput"
    >
      Agregar comentario
    </UButton>

    <SaleCommentSlideover v-model:open="open" :is-pending="isPending" @submit="handleSubmit" />
  </div>
</template>
