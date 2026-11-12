<script setup lang="ts">
/**
 * RequestCommandNotice — the design's ConflictNotice: what the backend refused, why, and the
 * buttons that follow («Actualizar», «Reintentar», «Entendido»). Text comes from `command-copy`
 * (typed codes), never from the backend message.
 */
import { computed } from 'vue'
import type { CommandNotice, CommandNoticeAction } from '../utils/command-copy'

const props = defineProps<{
  notice: CommandNotice
  /** Buttons to show; defaults to all of the notice's. */
  actions?: CommandNoticeAction[]
}>()
const emit = defineEmits<{ action: [action: CommandNoticeAction] }>()

const LABELS: Record<CommandNoticeAction, string> = {
  refresh: 'Actualizar',
  retry: 'Reintentar',
  dismiss: 'Entendido',
  reconfirm: 'Confirmar con los datos nuevos',
}

const buttons = computed(() => props.actions ?? props.notice.actions)
</script>

<template>
  <div class="rc-notice" role="alert" data-testid="command-notice">
    <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />
    <div>
      <strong data-testid="command-notice-title">{{ notice.title }}</strong>
      <span data-testid="command-notice-detail">{{ notice.detail }}</span>
      <div v-if="buttons.length" class="rc-notice__actions">
        <UButton
          v-for="(action, index) in buttons"
          :key="action"
          :data-testid="`notice-${action}`"
          size="sm"
          color="neutral"
          :variant="index === 0 ? 'solid' : 'outline'"
          :label="LABELS[action]"
          @click="emit('action', action)"
        />
      </div>
      <small class="rc-notice__tech">Detalle técnico: {{ notice.technical }}</small>
    </div>
  </div>
</template>
