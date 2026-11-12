<script setup lang="ts">
/**
 * RequestCommandSheet — the shell of a command form: a slideover on desktop and a bottom sheet on
 * mobile (`AppResponsiveDrawer` switches below `lg`). The theme classes travel with the portal.
 */
import AppResponsiveDrawer from '@/core/shared/components/AppResponsiveDrawer.vue'
import '../styles/chatbot-request-commands.css'

defineProps<{ open: boolean; title: string; description?: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
</script>

<template>
  <AppResponsiveDrawer
    :open="open"
    :title="title"
    :description="description"
    close-aria-label="Cerrar formulario"
    :desktop-ui="{ content: 'sm:max-w-md motion-reduce:transition-none' }"
    portal-class="hf-theme hf-ui hf-form-overlay chatbot-request-commands"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="rc-sheet" data-testid="command-sheet">
        <slot />
      </div>
    </template>
  </AppResponsiveDrawer>
</template>
