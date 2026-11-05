<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { CalendarDate } from '@internationalized/date'
import { calendarPartsToDateString, parseMexicoCityCalendarDate } from '@/core/shared/utils/mexicoCityCalendar'
import HfCombobox from '@/core/shared/components/form/HfCombobox.vue'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import HfSegmented from '@/core/shared/components/form/HfSegmented.vue'
import type { EditorialEvidence } from '../../interfaces/editorial-contract-value.types'
import { editorialBulkEvidenceErrors } from '../../utils/editorial-bulk-evidence'
import { EDITORIAL_SOURCES, type EditorialCardSource } from '../../utils/editorial-presentation-card'

/** «Usar una fuente para todos» (S19): one source and date for every known datum without one. The
 * presentation's source only prefills it (the contract has no presentation-level source); with several
 * presentations the user picks which. It hands back a valid source; confirming and saving are the owner's.
 */
const props = defineProps<{
  presentations: readonly { key: string; title: string; source: EditorialCardSource }[]
  /** The presentation that prefills the panel when it opens. */
  initial: string
  /** Readable names of the data that take the source. */
  fields: readonly string[]
  saving?: boolean; disabled?: boolean; error?: string | null
  /** Other edits are not saved yet: the save takes them too. */
  unsaved?: boolean }>()
const emit = defineEmits<{ apply: [evidence: EditorialEvidence] }>()
const open = defineModel<boolean>('open', { required: true })

const sourceItems = [...EDITORIAL_SOURCES.map(entry => ({ label: entry.label, value: entry.code })), { label: 'Otro', value: 'other' }]
const from = shallowRef(props.initial)
const kind = shallowRef<string | null>(null)
const otherText = shallowRef('')
const verifiedOn = shallowRef('')
const tried = shallowRef(false)
const listOpen = shallowRef(false)

function prefill(key: string) {
  const source = props.presentations.find(item => item.key === key)?.source ?? { sourceRef: '', verifiedOn: '' }
  const text = source.sourceRef.trim()
  const named = EDITORIAL_SOURCES.find(entry => entry.label === text)
  kind.value = named ? named.code : text ? 'other' : null
  otherText.value = named ? '' : text
  verifiedOn.value = source.verifiedOn
}
watch(open, value => {
  if (!value) return
  from.value = props.presentations.some(item => item.key === props.initial) ? props.initial : props.presentations[0]?.key ?? props.initial
  prefill(from.value); tried.value = false; listOpen.value = false
}, { immediate: true })
function choose(key: string) { from.value = key; prefill(key) }

const sourceRef = computed(() => (kind.value === 'other' ? otherText.value : EDITORIAL_SOURCES.find(entry => entry.code === kind.value)?.label ?? ''))
const errors = computed(() => (tried.value ? editorialBulkEvidenceErrors({ sourceRef: sourceRef.value, verifiedOn: verifiedOn.value }) : {}))
function picked(code: string | string[] | null) { if (typeof code === 'string') kind.value = code }

// «Revisada el» is the app's calendar field, as on the presentation card.
const dateModel = computed<CalendarDate | undefined>(() => parseMexicoCityCalendarDate(verifiedOn.value) ?? undefined)
const dateOpen = shallowRef(false)
function dateChanged(value: unknown) {
  verifiedOn.value = calendarPartsToDateString(value) ?? ''
  if (verifiedOn.value) dateOpen.value = false
}

const count = computed(() => props.fields.length)
const countText = computed(() => (count.value === 1 ? 'Se aplicará a 1 dato que todavía no tiene fuente.' : `Se aplicará a ${count.value} datos que todavía no tienen fuente.`))
function submit() {
  tried.value = true
  if (props.saving || props.disabled || Object.keys(errors.value).length) return
  emit('apply', { sourceRef: sourceRef.value.trim(), verifiedOn: verifiedOn.value })
}
</script>

<template>
  <USlideover v-model:open="open" side="right" title="Usar una fuente para todos" description="Una sola fuente para los datos que todavía no la tienen."
    :close="{ 'aria-label': 'Cerrar' }" :ui="{ content: 'hf-theme hf-ui hf-form-overlay editorial-portal max-w-md' }">
    <template #body>
      <form class="bulk" novalidate @submit.prevent="submit">
        <div v-if="presentations.length > 1" class="bulk__from">
          <span id="bulk-evidence-from" class="bulk__label">Tomar la fuente de</span>
          <HfSegmented :items="presentations.map(item => ({ label: item.title, value: item.key }))" :model-value="from" labelledby="bulk-evidence-from"
            :columns="Math.min(2, presentations.length)" :disabled="disabled || saving" @update:model-value="choose" />
        </div>

        <div>
          <HfFormField label="Fuente" label-id="bulk-evidence-source" :error="errors.sourceRef">
            <HfCombobox id="bulk-evidence-source-value" :items="sourceItems" :model-value="kind" label="Fuente" :invalid="Boolean(errors.sourceRef)"
              :disabled="disabled || saving" @update:model-value="picked" />
          </HfFormField>
          <input v-if="kind === 'other'" v-model="otherText" class="bulk__input" type="text" maxlength="1000" data-testid="bulk-source-other"
            aria-label="¿Cuál es la fuente?" placeholder="Por ejemplo, catálogo del proveedor" :disabled="disabled || saving">
        </div>
        <HfFormField label="Revisada el" label-id="bulk-evidence-date" :error="errors.verifiedOn">
          <UPopover v-model:open="dateOpen" :content="{ align: 'start', side: 'bottom', sideOffset: 8 }" :ui="{ content: 'hf-theme hf-ui editorial-portal' }">
            <UInputDate class="bulk__date" :model-value="dateModel" :disabled="disabled || saving" aria-labelledby="bulk-evidence-date" @update:model-value="dateChanged" />
            <template #content>
              <UCalendar class="p-2" :model-value="dateModel" :disabled="disabled || saving" @update:model-value="dateChanged" />
            </template>
          </UPopover>
        </HfFormField>

        <div class="bulk__scope">
          <p class="bulk__count" data-testid="bulk-count">{{ countText }}</p>
          <button type="button" class="bulk__toggle" data-testid="bulk-fields-toggle" :aria-expanded="listOpen" aria-controls="bulk-evidence-fields" @click="listOpen = !listOpen">
            {{ listOpen ? 'Ocultar datos' : 'Ver datos' }}
            <UIcon :name="listOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" aria-hidden="true" />
          </button>
          <ul v-show="listOpen" id="bulk-evidence-fields" class="bulk__fields" data-testid="bulk-fields" aria-label="Datos sin fuente">
            <li v-for="(field, index) in fields" :key="index">{{ field }}</li>
          </ul>
          <p class="bulk__note">Los datos que ya tienen fuente, los que no sabes y los que no aplican no cambian.</p>
          <p v-if="unsaved" class="bulk__note">También se guardarán tus otros cambios.</p>
        </div>
        <p v-if="error" role="alert" class="bulk__error">{{ error }}</p>
      </form>
    </template>
    <template #footer>
      <div class="bulk__actions">
        <UButton label="Usar esta fuente" class="hf-primary-control" data-testid="bulk-apply" :loading="saving" :disabled="disabled || saving" @click="submit" />
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.bulk { display: grid; gap: 20px; min-width: 0; color: var(--hf-ink); font-size: 14px; }
.bulk__from { display: grid; gap: 6px; }
.bulk__label { font-size: 13px; font-weight: 500; }
.bulk__input { box-sizing: border-box; width: 100%; height: 44px; margin-top: 8px; padding: 0 12px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control);
  background: var(--hf-field); color: var(--hf-ink); font: inherit; font-size: 14px; }
.bulk__input:hover:not(:disabled) { border-color: var(--hf-field-border); }
.bulk__input:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.bulk__date { width: 100%; }
.bulk__scope { display: grid; gap: 6px; padding-top: 16px; border-top: 1px solid var(--hf-border); }
.bulk__count { margin: 0; font-weight: 600; }
.bulk__toggle { display: inline-flex; align-items: center; gap: 2px; justify-self: start; min-height: 0; padding: 0; border: 0; background: none; color: var(--hf-action);
  font: inherit; font-weight: 600; cursor: pointer; }
.bulk__toggle:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; border-radius: 2px; }
.bulk__fields { display: grid; gap: 4px; margin: 0; padding-left: 20px; list-style: disc; }
.bulk__note { margin: 0; color: var(--hf-muted); font-size: 13px; }
.bulk__error { margin: 0; color: var(--hf-danger); font-weight: 600; }
.bulk__actions { display: flex; justify-content: flex-end; width: 100%; }
@media (min-width: 768px) { .bulk__input { height: 40px; } }
</style>
