<script setup lang="ts">
/**
 * BrowserNotificationsRow — «Avisos del navegador»: the permission of THIS device, read from the
 * browser (owner decision: it is not a server preference and never goes to the API).
 *
 * granted     «Activados en este dispositivo»
 * denied      «Bloqueados en el navegador» + how to unblock (the page cannot ask again)
 * default     «Sin decidir» + the «Permitir avisos» button (emits `request`, a user gesture)
 * unsupported «Este navegador no admite avisos»
 */
import { computed } from 'vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type { BrowserNotificationState } from '../interfaces/profile.types'

const props = defineProps<{ state: BrowserNotificationState }>()

const emit = defineEmits<{ request: [] }>()

interface StateCopy {
  badge: string
  tone: 'success' | 'danger' | 'neutral'
  text: string
}

const COPY: Record<BrowserNotificationState, StateCopy> = {
  granted: {
    badge: 'Activados en este dispositivo',
    tone: 'success',
    text: 'Verás una notificación del sistema cuando llegue un aviso con la pestaña oculta.',
  },
  denied: {
    badge: 'Bloqueados en el navegador',
    tone: 'danger',
    text: 'Este navegador bloqueó los avisos. La campana sigue avisando.',
  },
  default: {
    badge: 'Sin decidir',
    tone: 'neutral',
    text: 'El navegador te pedirá permiso. Solo se usa con la pestaña oculta.',
  },
  unsupported: {
    badge: 'No disponible',
    tone: 'neutral',
    text: 'Este navegador no admite avisos. La campana sigue avisando.',
  },
}

const copy = computed(() => COPY[props.state])
</script>

<template>
  <div class="pf-extra" data-testid="browser-row">
    <span class="pf-text pf-text--grow">
      <span class="pf-title">Avisos del navegador</span>
      <span class="pf-desc">
        Solo en este dispositivo. {{ copy.text }}
      </span>
      <span
        v-if="state === 'denied'"
        class="pf-help"
        data-testid="browser-unblock"
      >
        Para desbloquearlos, toca el candado junto a la dirección de la página, abre «Configuración
        del sitio» y cambia «Notificaciones» a «Permitir». Después vuelve a esta pestaña.
      </span>
    </span>
    <StatusBadge :label="copy.badge" :tone="copy.tone" aria-prefix="Avisos del navegador:" />
    <UButton
      v-if="state === 'default'"
      label="Permitir avisos"
      size="sm"
      color="neutral"
      variant="outline"
      data-testid="browser-request"
      @click="emit('request')"
    />
  </div>
</template>
