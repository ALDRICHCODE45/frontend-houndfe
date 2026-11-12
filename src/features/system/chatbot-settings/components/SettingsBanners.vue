<script setup lang="ts">
/**
 * SettingsBanners — the page-level notices above the sections: read-only, version 0 defaults, the save
 * notices (recompute FAILED / PARTIAL, generic errors, a 400 never names a field), the 409 «otra persona
 * guardó» banner that keeps the draft, and the checklist of fields to fix after a refused save.
 */
import { computed } from 'vue'
import type { EditorNotice } from '../composables/useChatbotSettingsEditor'
import type { SettingsErrors } from '../utils/settingsValidation'
import { errorTarget } from '../utils/settingsErrorTargets'
import { plural } from '../utils/settingsLabels'

const props = withDefaults(defineProps<{
  readonly: boolean
  creating: boolean
  notice: EditorNotice | null
  version: number
  /** Version saved by the other person; `null` = no conflict pending. */
  conflictVersion: number | null
  /** «Ana López guardó cambios a las 10:30»; falls back to the generic line when the view does not know who. */
  conflictHeadline?: string
  errors: SettingsErrors
  showErrors: boolean
}>(), { conflictHeadline: 'Otra persona guardó cambios antes que tú' })
const emit = defineEmits<{
  'close-notice': []
  'retry-save': []
  'open-conflict': []
  goto: [id: string]
}>()

const NOTICES: Record<EditorNotice, { tone: 'warn' | 'info' | 'danger'; icon: string; title: string; text: string }> = {
  failed: {
    tone: 'warn',
    icon: 'i-lucide-triangle-alert',
    title: 'Guardado; los plazos de las solicitudes abiertas se actualizarán más tarde',
    text: 'Tus cambios ya están en la versión {v}. No hace falta guardar otra vez ni reintentar.',
  },
  partial: {
    tone: 'info',
    icon: 'i-lucide-info',
    title: 'Guardado; algunas solicitudes se actualizarán la próxima vez que alguien las toque',
    text: 'Estaban cambiando justo ahora. Los plazos nuevos se aplican solos.',
  },
  validation: {
    tone: 'danger',
    icon: 'i-lucide-circle-alert',
    title: 'El servidor no aceptó algún valor',
    text: 'Tus cambios siguen aquí. Revisa los campos e intenta de nuevo.',
  },
  forbidden: {
    tone: 'danger',
    icon: 'i-lucide-lock',
    title: 'Ya no tienes permiso para guardar',
    text: 'Tus cambios siguen aquí. Pide el permiso «Cambiar ajustes del chatbot» y vuelve a intentarlo.',
  },
  error: {
    tone: 'danger',
    icon: 'i-lucide-circle-alert',
    title: 'No se pudo guardar',
    text: 'Tus cambios siguen aquí y no se perdió nada. Es seguro volver a intentarlo.',
  },
}

const notice = computed(() => (props.notice ? NOTICES[props.notice] : null))
const entries = computed(() => Object.entries(props.errors).map(([key, message]) => ({ ...errorTarget(key), key, message })))
</script>

<template>
  <div class="cbs-banners" data-testid="banners">
    <div v-if="readonly" class="cbs-alert" data-tone="info" role="note" data-testid="readonly-banner">
      <UIcon name="i-lucide-lock" class="cbs-alert__icon" aria-hidden="true" />
      <div>
        <strong>Solo lectura</strong>
        Puedes ver cómo está configurado, pero no cambiarlo. Pide el permiso «Cambiar ajustes del chatbot» a quien
        administra tu rol.
      </div>
    </div>

    <div v-if="creating" class="cbs-alert" data-tone="info" role="note" data-testid="defaults-banner">
      <UIcon name="i-lucide-info" class="cbs-alert__icon" aria-hidden="true" />
      <div>
        <strong>Esta sucursal aún no tiene configuración propia</strong>
        Mostramos los valores recomendados (versión 0).
        <template v-if="!readonly">
          Se vuelven tuyos al presionar «Guardar configuración»; puedes ajustarlos antes.
        </template>
      </div>
    </div>

    <div
      v-if="notice"
      class="cbs-alert"
      :data-tone="notice.tone"
      :role="notice.tone === 'danger' ? 'alert' : 'status'"
      :data-testid="`notice-${props.notice}`"
    >
      <UIcon :name="notice.icon" class="cbs-alert__icon" aria-hidden="true" />
      <div>
        <strong>{{ notice.title }}</strong>
        {{ notice.text.replace('{v}', String(version)) }}
        <div class="cbs-alert__actions">
          <button v-if="notice === NOTICES.error" type="button" class="cbs-btn" data-testid="notice-retry" @click="emit('retry-save')">
            Reintentar
          </button>
          <button type="button" class="cbs-btn cbs-btn--ghost" data-testid="notice-close" @click="emit('close-notice')">
            Entendido
          </button>
        </div>
      </div>
    </div>

    <div v-if="conflictVersion !== null" class="cbs-alert" data-tone="warn" role="alert" data-testid="conflict-banner">
      <UIcon name="i-lucide-triangle-alert" class="cbs-alert__icon" aria-hidden="true" />
      <div>
        <strong>{{ conflictHeadline }}</strong>
        Ya existe la versión {{ conflictVersion }}. Tus cambios siguen aquí; no se ha enviado nada.
        <div class="cbs-alert__actions">
          <button type="button" class="cbs-btn" data-testid="conflict-open" @click="emit('open-conflict')">Ver cambios</button>
        </div>
      </div>
    </div>

    <div v-if="showErrors && entries.length" class="cbs-checklist" role="alert" data-testid="error-checklist">
      <b>{{ plural(entries.length, 'campo por corregir', 'campos por corregir') }} antes de guardar</b>
      <ul>
        <li v-for="entry in entries" :key="entry.key">
          <a :href="`#${entry.id}`" @click.prevent="emit('goto', entry.id)">{{ entry.label }}</a>
          <span>{{ entry.message }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
