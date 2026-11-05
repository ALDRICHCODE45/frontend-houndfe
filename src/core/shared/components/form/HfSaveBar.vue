<script setup lang="ts">
/**
 * HfSaveBar — The sticky bottom bar of an editable form. State on the left
 * (`aria-live="polite"`), actions on the right:
 *   - clean:   ✓ `Guardado hace 2 min` (muted; the label refreshes every 30s)
 *   - dirty:   ● `3 cambios sin guardar` (amber dot)
 *   - saving:  `Guardando…`, both actions blocked
 *   - error:   the message in `--hf-danger`; Guardar stays available to retry
 * `Descartar` (ghost) shows only with changes; `Guardar` is the single primary,
 * disabled with the shared disabled primary while there is nothing to save.
 * Below md the actions are equal-width columns (Sticky mobile bar).
 * `saveLabel` names the primary when a form says what it does (`Crear producto`).
 *
 * Props: dirtyCount, saving, savedAt (Date | ISO string | epoch ms), error, saveLabel
 * Events: save, discard
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import './hf-form.css'

const props = withDefaults(defineProps<{
  dirtyCount?: number
  saving?: boolean
  savedAt?: Date | string | number | null
  error?: string | null
  saveLabel?: string
}>(), { dirtyCount: 0, savedAt: null, error: null, saveLabel: 'Guardar' })

const emit = defineEmits<{ save: []; discard: [] }>()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 30_000) })
onBeforeUnmount(() => clearInterval(timer))

const dirty = computed(() => props.dirtyCount > 0)
const state = computed(() => {
  if (props.saving) return 'saving'
  if (props.error) return 'error'
  return dirty.value ? 'dirty' : 'saved'
})

const shortDate = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })

function savedLabel(savedAt: Date | string | number | null): string {
  if (savedAt == null) return 'Sin cambios'
  const time = new Date(savedAt).getTime()
  if (Number.isNaN(time)) return 'Sin cambios'
  const minutes = Math.floor(Math.max(0, now.value - time) / 60_000)
  if (minutes < 1) return 'Guardado justo ahora'
  if (minutes < 60) return `Guardado hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Guardado hace ${hours} h`
  return `Guardado el ${shortDate.format(time).replace('.', '')}`
}

const text = computed(() => {
  if (state.value === 'saving') return 'Guardando…'
  if (state.value === 'error') return props.error ?? ''
  if (state.value === 'dirty') return `${props.dirtyCount} ${props.dirtyCount === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}`
  return savedLabel(props.savedAt)
})
</script>

<template>
  <div class="hf-save-bar">
    <p class="hf-save-bar__status" :data-state="state" aria-live="polite">
      <span v-if="state === 'dirty'" class="hf-save-bar__dot" aria-hidden="true" />
      <UIcon v-else-if="state === 'saved' && savedAt != null" name="i-lucide-check" class="hf-save-bar__check" aria-hidden="true" />
      <UIcon v-else-if="state === 'error'" name="i-lucide-circle-alert" class="hf-save-bar__icon" aria-hidden="true" />
      {{ text }}
    </p>
    <div class="hf-save-bar__actions">
      <UButton
        v-if="dirty"
        color="neutral"
        variant="ghost"
        class="hf-save-bar__discard"
        :disabled="saving"
        label="Descartar"
        @click="emit('discard')"
      />
      <UButton
        class="hf-primary-control"
        :disabled="!dirty || saving"
        :aria-busy="saving || undefined"
        :label="saveLabel"
        @click="emit('save')"
      />
    </div>
  </div>
</template>
