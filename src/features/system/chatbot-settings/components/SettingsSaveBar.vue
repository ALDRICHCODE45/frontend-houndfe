<script setup lang="ts">
/**
 * SettingsSaveBar — the sticky save bar (design 01): clean («Todo guardado · Versión N»), dirty (count and
 * the first changed items), invalid (fields to fix), saving, and version 0 («Sin guardar todavía»). The
 * primary is the only action that sends; «Descartar cambios» shows only with changes. Not rendered without
 * `update:ChatbotSettings` (read-only view).
 */
import { computed } from 'vue'
import type { DiffItem } from '../utils/settingsDraft'
import { plural } from '../utils/settingsLabels'

const props = defineProps<{
  items: DiffItem[]
  creating: boolean
  saving: boolean
  /** A save just succeeded and nothing changed since. */
  saved: boolean
  version: number
  errorCount: number
  showErrors: boolean
}>()
const emit = defineEmits<{ save: []; discard: [] }>()

const state = computed(() => {
  if (props.saving) return 'saving'
  if (props.showErrors && props.errorCount) return 'invalid'
  if (props.items.length) return 'dirty'
  if (props.creating) return 'creating'
  return 'clean'
})
const visible = computed(() => state.value !== 'clean' || props.saved)
const summary = computed(() => {
  const first = props.items.slice(0, 3).map((i) => i.label).join(', ')
  return props.items.length > 3 ? `${first} y ${props.items.length - 3} más` : first
})
</script>

<template>
  <div v-if="visible" class="cbs-savebar" role="region" aria-label="Guardar cambios" :data-state="state" data-testid="save-bar">
    <span class="cbs-savebar__text" aria-live="polite">
      <template v-if="state === 'saving'">
        <b>Guardando…</b>
        <small>Después se recalculan las solicitudes abiertas.</small>
      </template>
      <template v-else-if="state === 'invalid'">
        <b>{{ plural(errorCount, 'campo por corregir', 'campos por corregir') }}</b>
        <small>Revisa la lista de arriba para poder guardar.</small>
      </template>
      <template v-else-if="state === 'dirty'">
        <b data-testid="dirty-count">{{ plural(items.length, 'cambio sin guardar', 'cambios sin guardar') }}</b>
        <small>{{ summary }}. Al guardar se recalculan los plazos de las solicitudes abiertas.</small>
      </template>
      <template v-else-if="state === 'creating'">
        <b>Sin guardar todavía</b>
        <small>Estos son los valores recomendados; guárdalos para tener configuración propia.</small>
      </template>
      <template v-else>
        <b>Todo guardado</b>
        <small>Versión {{ version }}</small>
      </template>
    </span>
    <span class="cbs-grow" />
    <template v-if="state !== 'clean'">
      <button
        v-if="items.length"
        type="button"
        class="cbs-btn cbs-btn--ghost"
        :disabled="saving"
        data-testid="discard"
        @click="emit('discard')"
      >
        Descartar cambios
      </button>
      <button type="button" class="cbs-btn cbs-btn--primary" :disabled="saving" data-testid="save" @click="emit('save')">
        {{ saving ? 'Guardando' : creating && !items.length ? 'Guardar configuración' : 'Guardar cambios' }}
      </button>
    </template>
  </div>
</template>
