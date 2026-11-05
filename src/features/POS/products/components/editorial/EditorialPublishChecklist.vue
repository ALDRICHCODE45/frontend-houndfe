<script lang="ts">
import type { EditorialReadinessItem } from '../../interfaces/editorial-contract-readiness.types'
import { editorialReadinessFieldKey } from '../../utils/editorial-contract-readiness'

export const EDITORIAL_PUBLISH_CHECKLIST_ID = 'editorial-publish-checklist'
export type EditorialChecklistEntry = { key: string; item: EditorialReadinessItem
  /** The field the item is about, when it is on the page: the link says «Ir a {label}». */
  label: string | null }
/** One issue family: every entry with the same `problem` and `message`, in the order received. */
type EditorialChecklistGroup = { key: string; problem: string; message: string; entries: EditorialChecklistEntry[] }

/** Something is wrong with the value itself: these block before «where the datum comes from». */
const BLOCKING_PROBLEMS = new Set(['REQUIRED_MISSING', 'INVALID_VALUE', 'UNRESOLVED', 'NA_NOT_ALLOWED', 'NOT_APPLICABLE_VALUE',
  'MAGNITUDE_MISMATCH', 'TOY_TYPES_MISMATCH', 'ARCHIVED_OPTION', 'FACTS_CONFLICT', 'DRAFT_INVALID'])
const rank = (problem: string) => (BLOCKING_PROBLEMS.has(problem) ? 0 : problem === 'EVIDENCE_REQUIRED' ? 1 : 2)

/** Groups by issue family (problem plus message); blocking problems first, then evidence, then the rest. Stable. */
function groupChecklistEntries(entries: readonly EditorialChecklistEntry[]): EditorialChecklistGroup[] {
  const groups = new Map<string, EditorialChecklistGroup>()
  for (const entry of entries) {
    const key = `${entry.item.problem}\u0000${entry.item.message}`
    const group = groups.get(key) ?? { key, problem: entry.item.problem, message: entry.item.message, entries: [] }
    group.entries.push(entry)
    groups.set(key, group)
  }
  return [...groups.values()].map((group, index) => ({ group, index }))
    .sort((a, b) => rank(a.group.problem) - rank(b.group.problem) || a.index - b.index).map(({ group }) => group)
}

/** A field is a datum of one presentation; items without a datum (product, care) count once each. */
function countChecklistFields(entries: readonly EditorialChecklistEntry[]): number {
  return new Set(entries.map(({ key, item }) => editorialReadinessFieldKey(item, key))).size
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'

/** Issue checklist (design-system.md) of what the backend says is missing to publish the SAVED draft.
 * Each issue family once: a family of one item links to its field, a larger one reads «{message} · N campos»
 * and discloses the links. With unsaved edits it says the list is from the last save, since readiness never sees the buffer.
 */
const props = defineProps<{ entries: readonly EditorialChecklistEntry[]; stale: boolean
  /** The editor has known data without a source: the evidence family offers one source for all of them. */
  bulkEvidence?: boolean }>()
const emit = defineEmits<{ goto: [item: EditorialReadinessItem]; 'bulk-evidence': [] }>()

const groups = computed(() => groupChecklistEntries(props.entries))
const fieldCount = computed(() => countChecklistFields(props.entries))
const open = ref(new Set<string>())
function toggle(key: string) {
  const next = new Set(open.value)
  if (!next.delete(key)) next.add(key)
  open.value = next
}
const linkedOf = (group: EditorialChecklistGroup) => group.entries.filter(entry => entry.label)
const fieldsId = (index: number) => `${EDITORIAL_PUBLISH_CHECKLIST_ID}-fields-${index}`
</script>

<template>
  <div :id="EDITORIAL_PUBLISH_CHECKLIST_ID" class="publish-checklist" data-testid="publish-checklist">
    <p class="publish-checklist__head" data-testid="publish-checklist-head">
      Para publicar, resuelve: <span class="publish-checklist__count">{{ fieldCount }} {{ fieldCount === 1 ? 'campo' : 'campos' }}</span>
    </p>
    <p v-if="stale" class="publish-checklist__stale">
      <UIcon name="i-lucide-save" aria-hidden="true" />Según lo último que guardaste
    </p>
    <ul aria-label="Pendientes para publicar">
      <li v-for="(group, index) in groups" :key="group.key" :data-problem="group.problem">
        <UIcon name="i-lucide-triangle-alert" class="publish-checklist__icon" aria-hidden="true" />
        <span class="publish-checklist__message">{{ group.message }}<template v-if="group.entries.length > 1"> · {{ group.entries.length }} campos</template></span>
        <template v-if="group.entries.length === 1">
          <button v-if="group.entries[0]!.label" type="button" class="publish-checklist__link" @click="emit('goto', group.entries[0]!.item)">Ir a {{ group.entries[0]!.label }}</button>
        </template>
        <template v-else-if="linkedOf(group).length">
          <button type="button" class="publish-checklist__toggle" :aria-expanded="open.has(group.key)" :aria-controls="fieldsId(index)"
            data-testid="publish-checklist-toggle" @click="toggle(group.key)">
            {{ open.has(group.key) ? 'Ocultar' : 'Ver campos' }}
            <UIcon :name="open.has(group.key) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" aria-hidden="true" />
          </button>
          <ul v-show="open.has(group.key)" :id="fieldsId(index)" class="publish-checklist__fields" :aria-label="`Campos: ${group.message}`">
            <li v-for="entry in linkedOf(group)" :key="entry.key">
              <button type="button" class="publish-checklist__link" @click="emit('goto', entry.item)">Ir a {{ entry.label }}</button>
            </li>
          </ul>
        </template>
        <button v-if="bulkEvidence && group.problem === 'EVIDENCE_REQUIRED'" type="button" class="publish-checklist__bulk" data-testid="publish-checklist-bulk"
          @click="emit('bulk-evidence')">Usar una fuente para todos</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.publish-checklist { display: grid; gap: 8px; padding: 12px 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface-muted); font-size: 13px; }
.publish-checklist__head { margin: 0; color: var(--hf-text); font-weight: 600; }
.publish-checklist__count { color: var(--hf-warning); }
.publish-checklist ul { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.publish-checklist li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; min-width: 0; color: var(--hf-warning); font-weight: 600; }
.publish-checklist__icon { flex-shrink: 0; width: 16px; height: 16px; }
.publish-checklist__message { min-width: 0; overflow-wrap: anywhere; }
.publish-checklist__stale { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--hf-muted); font-weight: 600; }
.publish-checklist__link,
.publish-checklist__toggle { min-height: 0; padding: 0; border: 0; background: none; color: var(--hf-action); font: inherit; font-weight: 600; cursor: pointer; }
.publish-checklist__link { margin-left: 4px; text-decoration: underline; text-underline-offset: 2px; }
.publish-checklist__toggle { display: inline-flex; align-items: center; gap: 2px; margin-left: 4px; }
.publish-checklist__bulk { min-height: 0; margin-left: auto; padding: 2px 8px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control);
  background: var(--hf-surface); color: var(--hf-action); font: inherit; font-weight: 600; cursor: pointer; }
.publish-checklist__link:focus-visible,
.publish-checklist__bulk:focus-visible,
.publish-checklist__toggle:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; border-radius: 2px; }
.publish-checklist ul.publish-checklist__fields { display: flex; flex-wrap: wrap; gap: 4px 12px; flex-basis: 100%; padding-left: 22px; }
.publish-checklist__fields .publish-checklist__link { margin-left: 0; }
</style>
