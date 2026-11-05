<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type { EditorialFactsEditingRow } from '../../utils/editorial-contract-facts-editing'
import { appendEditorialFactsCareRow, removeEditorialFactsCareRow, replaceEditorialFactsCare } from '../../utils/editorial-contract-facts-edits'
import type { PreparedEditorialCareInput } from '../../utils/editorial-contract-care-edits'
import { snapshotJson } from '../../utils/editorial-contract-value'

/** The care review of one presentation, in a right drawer: flat sections, requirements and warnings as
 * compact rows that edit in a small dialog. Controlled: it hands back the whole row; the cards list
 * stamps the card's source as every evidence and Fundamento.
 */
const props = defineProps<{ title: string; row: EditorialFactsEditingRow | null; sourceMissing: boolean; nextId: () => string; disabled?: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ 'update:row': [row: EditorialFactsEditingRow] }>()

type Requirement = PreparedEditorialCareInput['requirements'][number]
type Warning = PreparedEditorialCareInput['warnings'][number]
const states = [{ value: 'omitted', label: 'Sin revisar' }, { value: 'unknown', label: 'No se sabe' }, { value: 'prepared', label: 'Lista' }] as const
const determinations = [{ value: 'identified', label: 'Sí, hay requisitos' }, { value: 'none_applicable', label: 'No exige nada' }] as const
const dispositions = [{ value: 'satisfied', label: 'Cumple', tone: 'success' }, { value: 'not_applicable', label: 'No aplica', tone: 'neutral' },
  { value: 'unresolved', label: 'Por resolver', tone: 'warning' }, { value: 'conflicting', label: 'En conflicto', tone: 'danger' }] as const
const disclosures = [{ value: 'private_only', label: 'Solo interna' }, { value: 'public_required', label: 'Mostrar al público' }, { value: 'unresolved', label: 'Por resolver' }] as const

const review = computed(() => props.row?.careReview ?? { state: 'omitted' as const })
const prepared = computed(() => (review.value.state === 'prepared' ? review.value : null))
const copy = <T,>(value: T): T => snapshotJson(value) as unknown as T

function emitCare(care: PreparedEditorialCareInput) {
  if (props.row && !props.disabled) emit('update:row', { ...copy(props.row), careReview: copy(care) })
}
function patch(part: Partial<PreparedEditorialCareInput>) { if (prepared.value) emitCare({ ...prepared.value, ...part }) }

// Leaving a filled review discards it, so that asks first.
const pendingState = shallowRef<'omitted' | 'unknown' | null>(null)
const askDiscard = computed({ get: () => pendingState.value !== null, set: value => { if (!value) pendingState.value = null } })
function stateChanged(value: 'omitted' | 'unknown' | 'prepared') {
  if (!props.row || props.disabled || value === review.value.state) return
  const current = prepared.value
  const filled = current && (current.intendedUse.trim() || current.determination !== null || current.requirements.length || current.warnings.length)
  if (value !== 'prepared' && filled) { pendingState.value = value; return }
  applyState(value)
}
function applyState(value: 'omitted' | 'unknown' | 'prepared') {
  if (!props.row) return
  const input = value === 'prepared' ? { state: value, jurisdiction: 'México', intendedUse: '', determination: null, evidence: [], basis: '', requirements: [], warnings: [] }
    : { state: value }
  emit('update:row', replaceEditorialFactsCare(props.row, input as PreparedEditorialCareInput, props.nextId))
}
function discardConfirmed() { const value = pendingState.value; pendingState.value = null; if (value) applyState(value) }
function text(part: 'jurisdiction' | 'intendedUse', event: Event) { patch({ [part]: (event.target as HTMLInputElement).value }) }

// One small dialog edits a requirement or a warning; a new one is appended only when saved.
type Editing = { kind: 'requirements'; index: number | null; description: string; disposition: Requirement['disposition'] }
  | { kind: 'warnings'; index: number | null; text: string; disclosure: Warning['disclosure']; requirementKeys: string[] }
// Deep, so the dialog's text fields update what it can save.
const editing = ref<Editing | null>(null)
const editingOpen = computed({ get: () => editing.value !== null, set: value => { if (!value) editing.value = null } })
const canSaveItem = computed(() => {
  const item = editing.value
  if (!item) return false
  return item.kind === 'requirements' ? Boolean(item.description.trim() && item.disposition) : Boolean(item.text.trim() && item.disclosure)
})
function startRequirement(index: number | null) {
  const current = index === null ? null : prepared.value?.requirements[index]
  editing.value = { kind: 'requirements', index, description: current?.description ?? '', disposition: current?.disposition ?? null }
}
function startWarning(index: number | null) {
  const current = index === null ? null : prepared.value?.warnings[index]
  editing.value = { kind: 'warnings', index, text: current?.text ?? '', disclosure: current?.disclosure ?? null, requirementKeys: [...(current?.requirementKeys ?? [])] }
}
function freshKey(prefix: string, taken: readonly string[]) {
  let n = 1
  while (taken.includes(`${prefix}-${n}`)) n++
  return `${prefix}-${n}`
}
function saveItem() {
  const item = editing.value
  if (!item || !canSaveItem.value || !props.row || !prepared.value) return
  editing.value = null
  let row = props.row
  let index = item.index
  if (index === null) {
    row = appendEditorialFactsCareRow(row, item.kind, props.nextId)
    index = (row.careReview as PreparedEditorialCareInput)[item.kind].length - 1
  }
  const next = copy(row), care = next.careReview as PreparedEditorialCareInput
  if (item.kind === 'requirements') {
    const target = care.requirements[index]!
    if (!target.key) target.key = freshKey('requisito', care.requirements.map(entry => entry.key))
    Object.assign(target, { description: item.description.trim(), disposition: item.disposition })
  } else {
    const target = care.warnings[index]!
    if (!target.key) target.key = freshKey('aviso', care.warnings.map(entry => entry.key))
    Object.assign(target, { text: item.text.trim(), disclosure: item.disclosure, requirementKeys: [...item.requirementKeys] })
  }
  emit('update:row', next)
}
function toggleReference(key: string, event: Event) {
  const item = editing.value
  if (item?.kind !== 'warnings') return
  const on = (event.target as HTMLInputElement).checked
  editing.value = { ...item, requirementKeys: on ? [...item.requirementKeys.filter(entry => entry !== key), key] : item.requirementKeys.filter(entry => entry !== key) }
}

const removing = shallowRef<{ kind: 'requirements' | 'warnings'; index: number } | null>(null)
const removingOpen = computed({ get: () => removing.value !== null, set: value => { if (!value) removing.value = null } })
function removeConfirmed() {
  const target = removing.value
  removing.value = null
  if (!target || !props.row || props.disabled) return
  const id = props.row.careRowIds[target.kind][target.index]
  if (id === undefined) return
  const key = target.kind === 'requirements' ? prepared.value?.requirements[target.index]?.key : undefined
  const next = removeEditorialFactsCareRow(props.row, target.kind, id)
  // The modal said so: the warnings that cited the requirement stop citing it.
  if (key !== undefined && next.careReview.state === 'prepared')
    next.careReview.warnings = next.careReview.warnings.map(warning => ({ ...warning, requirementKeys: warning.requirementKeys.filter(entry => entry !== key) }))
  emit('update:row', next)
}
const itemActions: RowAction[] = [{ key: 'edit', label: 'Editar…', icon: 'i-lucide-pencil' }, { key: 'remove', label: 'Quitar…', icon: 'i-lucide-trash-2', destructive: true }]
function itemAction(kind: 'requirements' | 'warnings', index: number, key: string) {
  if (props.disabled) return
  if (key === 'remove') removing.value = { kind, index }
  else if (kind === 'requirements') startRequirement(index)
  else startWarning(index)
}
const dispositionOf = (value: Requirement['disposition']) => dispositions.find(entry => entry.value === value)
const disclosureLabel = (value: Warning['disclosure']) => disclosures.find(entry => entry.value === value)?.label ?? 'Sin decidir'
const requirementLabel = (key: string) => prepared.value?.requirements.find(entry => entry.key === key)?.description || key
</script>

<template>
  <USlideover v-model:open="open" side="right" title="Revisión de cuidado" :description="title" :close="{ 'aria-label': 'Cerrar revisión de cuidado' }"
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay editorial-care-portal w-full max-w-3xl' }">
    <template #body>
      <div class="care">
        <fieldset class="care__group" data-testid="care-group" :disabled="disabled">
          <legend class="care__label">¿Cómo va la revisión?</legend>
          <div class="care__chips">
            <label v-for="entry in states" :key="entry.value" class="care__chip" :data-checked="review.state === entry.value">
              <input type="radio" class="sr-only" name="care-state" :value="entry.value" :checked="review.state === entry.value" @change="stateChanged(entry.value)">
              <UIcon v-if="review.state === entry.value" name="i-lucide-check" class="size-4" aria-hidden="true" />{{ entry.label }}
            </label>
          </div>
        </fieldset>

        <template v-if="prepared">
          <p v-if="sourceMissing" class="care__hint"><UIcon name="i-lucide-circle-alert" class="size-4" aria-hidden="true" />Indica en la tarjeta de dónde sale la información.</p>
          <div class="care__pair">
            <label class="care__field"><span class="care__label">¿Dónde se vende?</span>
              <input class="care__input" type="text" maxlength="200" :value="prepared.jurisdiction" :disabled="disabled" @input="text('jurisdiction', $event)">
            </label>
            <label class="care__field"><span class="care__label">¿Para qué se usa?</span>
              <input class="care__input" type="text" maxlength="1000" data-testid="care-use" placeholder="Baño de perros y gatos con piel sensible"
                :value="prepared.intendedUse" :disabled="disabled" @input="text('intendedUse', $event)">
            </label>
          </div>
          <fieldset class="care__group" data-testid="care-group" :disabled="disabled">
            <legend class="care__label">¿La etiqueta exige algo?</legend>
            <div class="care__chips">
              <label v-for="entry in determinations" :key="entry.value" class="care__chip" :data-checked="prepared.determination === entry.value">
                <input type="radio" class="sr-only" name="care-determination" :value="entry.value" :checked="prepared.determination === entry.value"
                  @change="patch({ determination: entry.value })">
                <UIcon v-if="prepared.determination === entry.value" name="i-lucide-check" class="size-4" aria-hidden="true" />{{ entry.label }}
              </label>
            </div>
          </fieldset>

          <section v-if="prepared.determination === 'identified' || prepared.requirements.length || prepared.warnings.length" class="care__section" aria-labelledby="care-requirements-title">
            <div class="care__section-head">
              <h3 id="care-requirements-title" class="care__title">Requisitos <span class="care__count hf-figure">{{ prepared.requirements.length }}</span></h3>
              <button type="button" class="care__button" :disabled="disabled" @click="startRequirement(null)"><UIcon name="i-lucide-plus" class="size-4" aria-hidden="true" />Agregar requisito</button>
            </div>
            <p v-if="!prepared.requirements.length" class="care__empty">Aún no hay requisitos.</p>
            <ul v-else class="care__list">
              <li v-for="(item, index) in prepared.requirements" :key="row?.careRowIds.requirements[index]" class="care__row" data-testid="care-requirement">
                <span class="care__row-text">{{ item.description || 'Sin descripción' }}</span>
                <StatusBadge :label="dispositionOf(item.disposition)?.label ?? 'Sin decidir'" :tone="dispositionOf(item.disposition)?.tone ?? 'neutral'" aria-prefix="Cumplimiento:" />
                <RowActionsMenu :actions="itemActions" :row-label="`el requisito ${index + 1}`" portal-class="editorial-portal" @select="itemAction('requirements', index, $event)" />
              </li>
            </ul>
          </section>

          <section v-if="prepared.determination === 'identified' || prepared.warnings.length" class="care__section" aria-labelledby="care-warnings-title">
            <div class="care__section-head">
              <h3 id="care-warnings-title" class="care__title">Avisos <span class="care__count hf-figure">{{ prepared.warnings.length }}</span></h3>
              <button type="button" class="care__button" :disabled="disabled" @click="startWarning(null)"><UIcon name="i-lucide-plus" class="size-4" aria-hidden="true" />Agregar aviso</button>
            </div>
            <p v-if="!prepared.warnings.length" class="care__empty">Aún no hay avisos.</p>
            <ul v-else class="care__list">
              <li v-for="(item, index) in prepared.warnings" :key="row?.careRowIds.warnings[index]" class="care__row" data-testid="care-warning">
                <span class="care__row-text">{{ item.text || 'Sin texto' }}
                  <small v-if="item.requirementKeys.length" class="care__refs">Viene de {{ item.requirementKeys.map(requirementLabel).join(', ') }}</small>
                </span>
                <span class="care__disclosure">{{ disclosureLabel(item.disclosure) }}</span>
                <RowActionsMenu :actions="itemActions" :row-label="`el aviso ${index + 1}`" portal-class="editorial-portal" @select="itemAction('warnings', index, $event)" />
              </li>
            </ul>
          </section>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="care__foot"><button type="button" class="hf-primary-control" @click="open = false">Listo</button></div>
    </template>
  </USlideover>

  <UModal v-model:open="editingOpen" :title="editing?.kind === 'warnings' ? (editing.index === null ? 'Nuevo aviso' : 'Editar aviso') : (editing?.index === null ? 'Nuevo requisito' : 'Editar requisito')"
    description="Se guarda con la fuente de la tarjeta." :ui="{ content: 'hf-theme hf-ui' }">
    <template #body>
      <div v-if="editing" class="care">
        <template v-if="editing.kind === 'requirements'">
          <label class="care__field"><span class="care__label">¿Qué pide?</span>
            <textarea v-model="editing.description" class="care__input" rows="3" maxlength="2000" placeholder="Leyenda de uso externo en la etiqueta" />
          </label>
          <fieldset class="care__group" data-testid="care-group">
            <legend class="care__label">¿Cómo se cumple?</legend>
            <div class="care__chips">
              <label v-for="entry in dispositions" :key="entry.value" class="care__chip" :data-checked="editing.disposition === entry.value">
                <input type="radio" class="sr-only" name="care-disposition" :value="entry.value" :checked="editing.disposition === entry.value"
                  @change="editing = { ...editing, disposition: entry.value }">{{ entry.label }}
              </label>
            </div>
          </fieldset>
        </template>
        <template v-else>
          <label class="care__field"><span class="care__label">¿Qué dice el aviso?</span>
            <textarea v-model="editing.text" class="care__input" rows="3" maxlength="4000" placeholder="No ingerir. Manténgase fuera del alcance de los niños." />
          </label>
          <fieldset class="care__group" data-testid="care-group">
            <legend class="care__label">¿Quién lo ve?</legend>
            <div class="care__chips">
              <label v-for="entry in disclosures" :key="entry.value" class="care__chip" :data-checked="editing.disclosure === entry.value">
                <input type="radio" class="sr-only" name="care-disclosure" :value="entry.value" :checked="editing.disclosure === entry.value"
                  @change="editing = { ...editing, disclosure: entry.value }">{{ entry.label }}
              </label>
            </div>
          </fieldset>
          <fieldset v-if="prepared?.requirements.length" class="care__group" data-testid="care-group">
            <legend class="care__label">Viene de</legend>
            <div class="care__chips">
              <label v-for="item in prepared.requirements" :key="item.key" class="care__chip" :data-checked="editing.requirementKeys.includes(item.key)">
                <input type="checkbox" class="sr-only" :checked="editing.requirementKeys.includes(item.key)" @change="toggleReference(item.key, $event)">{{ item.description || item.key }}
              </label>
            </div>
          </fieldset>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="care__foot">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="editing = null" />
        <UButton label="Guardar" :disabled="!canSaveItem" @click="saveItem" />
      </div>
    </template>
  </UModal>

  <ConfirmModal v-model:open="askDiscard" title="¿Descartar la revisión de cuidado?" confirm-label="Descartar revisión" confirm-color="error"
    description="Se quitan los requisitos, los avisos y lo escrito en esta revisión." :ui="{ content: 'hf-theme hf-ui' }" @confirm="discardConfirmed" />
  <ConfirmModal v-model:open="removingOpen" :title="removing?.kind === 'warnings' ? '¿Quitar el aviso?' : '¿Quitar el requisito?'"
    :confirm-label="removing?.kind === 'warnings' ? 'Quitar aviso' : 'Quitar requisito'" confirm-color="error"
    :description="removing?.kind === 'warnings' ? 'El aviso deja de guardarse en esta revisión.' : 'Los avisos que vienen de él dejan de mencionarlo.'"
    :ui="{ content: 'hf-theme hf-ui' }" @confirm="removeConfirmed" />
</template>

<style scoped>
.care { display: grid; gap: 24px; min-width: 0; color: var(--hf-ink); }
.care__group { display: grid; gap: 10px; min-width: 0; margin: 0; padding: 0; border: 0; }
.care__group > legend { margin-bottom: 10px; padding: 0; }
.care__label { color: var(--hf-ink); font-size: 14px; font-weight: 500; }
.care__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.care__chip { position: relative; display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border: 1px solid var(--hf-border); border-radius: 999px; background: var(--hf-surface); font-size: 14px; cursor: pointer; }
.care__chip:hover { background: var(--hf-surface-muted); }
.care__chip:has(input:focus-visible) { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.care__chip[data-checked='true'] { border-color: var(--hf-active); background: var(--hf-active-soft); color: var(--hf-active); font-weight: 600; }
.care__pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.care__field { display: grid; gap: 8px; min-width: 0; }
.care__input { box-sizing: border-box; width: 100%; min-height: var(--hf-control-height); padding: 8px 12px; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; font-size: 14px; }
textarea.care__input { resize: vertical; }
.care__input:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 1px; }
.care__hint { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--hf-warning); font-size: 13px; }
.care__section { display: grid; gap: 4px; padding-top: 20px; border-top: 1px solid var(--hf-border); }
.care__section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; }
.care__title { margin: 0; color: var(--hf-heading); font-size: 15px; font-weight: 600; }
.care__count { margin-left: 6px; color: var(--hf-muted); font-weight: 500; }
.care__button { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); background: var(--hf-surface); color: var(--hf-ink); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; }
.care__button:hover:not(:disabled) { background: var(--hf-surface-muted); }
.care__button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.care__empty { margin: 0; color: var(--hf-muted); font-size: 14px; }
.care__list { margin: 0; padding: 0; list-style: none; }
.care__row { display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 4px 0; border-top: 1px solid var(--hf-border); }
.care__row:first-child { border-top: 0; }
.care__row-text { display: grid; flex: 1 1 0; min-width: 0; font-size: 14px; overflow-wrap: anywhere; }
.care__refs { color: var(--hf-muted); font-size: 13px; }
.care__disclosure { color: var(--hf-muted); font-size: 13px; white-space: nowrap; }
.care__foot { display: flex; justify-content: flex-end; gap: 8px; width: 100%; }
@media (max-width: 767px) { .care__pair { grid-template-columns: 1fr; } .care__row { flex-wrap: wrap; } }
</style>
