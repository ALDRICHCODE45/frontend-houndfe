<script setup lang="ts">
import { computed, ref } from 'vue'

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
const isOpen = ref(false)
const body = ref('')

const canSubmit = computed(() => !props.isPending && body.value.trim().length > 0)

function openInput() {
  isOpen.value = true
}

function cancelInput() {
  isOpen.value = false
  body.value = ''
}

async function submit() {
  if (!canSubmit.value) return
  try {
    await props.onSubmit({ body: body.value.trim() })
    cancelInput()
  } catch {
    toast.add({ title: 'Error', description: 'No se pudo guardar el comentario', color: 'error' })
  }
}
</script>

<template>
  <div class="mt-3" data-testid="sale-comment-input">
    <UButton v-if="!isOpen" variant="ghost" size="sm" data-testid="comment-open" @click="openInput">
      Agregar comentario
    </UButton>

    <div v-else class="space-y-2" data-testid="comment-form">
      <UTextarea v-model="body" data-testid="comment-body" />
      <div class="flex gap-2">
        <UButton variant="ghost" size="sm" data-testid="comment-cancel" @click="cancelInput">Cancelar</UButton>
        <UButton size="sm" :disabled="!canSubmit" data-testid="comment-submit" @click="submit">Enviar</UButton>
      </div>
    </div>
  </div>
</template>
