<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    isPending?: boolean
  }>(),
  {
    isPending: false,
  },
)

const emit = defineEmits<{
  'update:open': [open: boolean]
  submit: [{ body: string }]
}>()

const body = ref('')
const textareaRef = ref<{ focus?: () => void; $el?: HTMLElement } | HTMLTextAreaElement | null>(null)

const canSubmit = computed(() => body.value.trim().length > 0 && !props.isPending)

watch(
  () => props.open,
  async (next) => {
    if (next) {
      body.value = ''
      await nextTick()
      const target = textareaRef.value
      if (target instanceof HTMLTextAreaElement) {
        target.focus()
        return
      }

      if (typeof target?.focus === 'function') {
        target.focus()
        return
      }

      const nestedTextarea = target?.$el?.querySelector('textarea')
      if (nestedTextarea instanceof HTMLTextAreaElement) {
        nestedTextarea.focus()
      }
    }
  },
)

function close() {
  emit('update:open', false)
}

function submit() {
  const trimmedBody = body.value.trim()
  if (!trimmedBody || props.isPending) return

  emit('submit', { body: trimmedBody })
  body.value = ''
  emit('update:open', false)
}
</script>

<template>
  <USlideover :open="open" side="right" inset @update:open="emit('update:open', $event)">
    <template #content>
      <div class="flex h-full flex-col" data-testid="comment-form">
        <div class="border-b border-default px-5 py-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-lg font-semibold">Agregar comentario</p>
            </div>
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="close" />
          </div>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <UTextarea
            ref="textareaRef"
            v-model="body"
            data-testid="comment-body"
            :rows="6"
            autoresize
            autofocus
          />
        </div>

        <div class="flex justify-end gap-2 border-t border-default px-5 py-4">
          <UButton variant="ghost" data-testid="comment-cancel" @click="close">Cancelar</UButton>
          <UButton
            data-testid="comment-submit"
            :disabled="!canSubmit"
            :loading="isPending"
            @click="submit"
          >
            Guardar
          </UButton>
        </div>
      </div>
    </template>
  </USlideover>
</template>
