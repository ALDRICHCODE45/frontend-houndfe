<script setup lang="ts">
/**
 * RequestLiveTemplateSheet — the confirmation before the paid template is sent (handoff 20 §3c,
 * design 04 frame 6): a slideover on desktop, a bottom sheet on mobile. It repeats the cost text
 * of the branch settings and says what happens next; only «Enviar plantilla» sends.
 */
import RequestCommandSheet from './RequestCommandSheet.vue'

defineProps<{
  open: boolean
  /** `templateCostText` of the settings, as written. */
  costText: string
  busy?: boolean
  /** Sending again after a template that failed. */
  retry?: boolean
}>()
const emit = defineEmits<{ 'update:open': [value: boolean]; confirm: [] }>()
</script>

<template>
  <RequestCommandSheet
    :open="open"
    short
    title="¿Enviar plantilla al cliente?"
    description="La ventana de 24 h está cerrada"
    @update:open="emit('update:open', $event)"
  >
    <div class="rc-form lc-tpl" data-testid="template-sheet">
      <p class="rc-lead">
        Vas a enviarle al cliente una <b>plantilla aprobada de WhatsApp</b>, porque la ventana de 24 h está cerrada.
      </p>
      <dl class="lc-tpl__facts">
        <dt>Costo</dt>
        <dd data-testid="template-confirm-cost">{{ costText }}</dd>
        <dt>Cuántas</dt>
        <dd>Una sola por ventana cerrada.</dd>
      </dl>
      <p v-if="retry" class="rc-help">Reintentar crea un envío nuevo: vuelve a aplicar el costo.</p>
      <div class="rd-alert rd-alert--info" role="note">
        <UIcon name="i-lucide-info" aria-hidden="true" />
        <div>
          <strong>Qué pasa después</strong>
          No podrás escribirle hasta que responda. Cuando lo haga, la ventana se abre y el cuadro de mensaje vuelve a
          funcionar.
        </div>
      </div>
      <div class="lc-tpl__foot">
        <UButton
          color="neutral"
          variant="ghost"
          label="Cancelar"
          data-testid="template-cancel"
          @click="emit('update:open', false)"
        />
        <UButton
          color="primary"
          icon="i-lucide-receipt-text"
          label="Enviar plantilla"
          :loading="busy"
          :disabled="busy"
          data-testid="template-confirm"
          @click="emit('confirm')"
        />
      </div>
    </div>
  </RequestCommandSheet>
</template>
