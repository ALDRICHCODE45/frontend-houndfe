<script setup lang="ts">
/**
 * RequestCommandSheet — the shell of a command form: a slideover on desktop and a bottom sheet on
 * mobile (`AppResponsiveDrawer` switches below `lg`). The theme classes travel with the portal.
 */
import { computed } from 'vue'
import AppResponsiveDrawer from '@/core/shared/components/AppResponsiveDrawer.vue'
import '../styles/chatbot-request-commands.css'

const props = defineProps<{
  open: boolean
  title: string
  description?: string
  /** A bottom sheet that takes the height of its content (a short picker), not 90 % of the screen. */
  short?: boolean
}>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const portalClass = computed(
  () => `hf-theme hf-ui hf-form-overlay chatbot-request-commands${props.short ? ' rc-portal--short' : ''}`,
)
</script>

<template>
  <AppResponsiveDrawer
    :open="open"
    :title="title"
    :description="description"
    close-aria-label="Cerrar formulario"
    :desktop-ui="{ content: 'sm:max-w-md motion-reduce:transition-none' }"
    :portal-class="portalClass"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="rc-sheet" data-testid="command-sheet">
        <slot />
      </div>
    </template>
  </AppResponsiveDrawer>
</template>
