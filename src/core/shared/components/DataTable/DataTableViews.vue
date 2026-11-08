<script setup lang="ts" generic="Q">
import { computed, nextTick, ref, useId } from 'vue'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import type { DropdownMenuItem } from '@nuxt/ui'
import { useConfirm } from '../../composables/useConfirm'
import { TABLE_VIEW_NAME_MAX, type TableViewsController } from '../../composables/useTableViews'

/**
 * Saved views of a table as tabs (premium tables S6, artboard 02): a tablist above the toolbar
 * (a «Vista: …» select below md), «Cambios sin guardar», «Restablecer», «Guardar vista» and, for the
 * user's own views, rename and delete. The views live in `useTableViews`; this bar only drives them.
 */
const props = withDefaults(
  defineProps<{
    views: TableViewsController<Q>
    /** Count shown beside each view's name, by view id (nothing for `undefined`). */
    counts?: Record<string, string | number | undefined>
    /** Id of the tabpanel the tabs control (the table region). */
    controls?: string
    /** Tab ids are `<prefix>-tab-<view id>`, so the panel can be labelled by the active tab. */
    tabIdPrefix?: string
    label?: string
    /** Theme boundary for the menus and the dialog rendered outside the app root. */
    portalClass?: string
  }>(),
  {
    counts: undefined,
    controls: undefined,
    tabIdPrefix: 'table-view',
    label: 'Vistas guardadas',
    portalClass: undefined,
  },
)

const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md')

const items = computed(() => props.views.views.value)
const active = computed(() => props.views.activeView.value)
const isDirty = computed(() => props.views.isDirty.value)
const canReset = computed(() => props.views.canReset.value)

const tabId = (id: string) => `${props.tabIdPrefix}-tab-${id}`
const countOf = (id: string) => {
  const value = props.counts?.[id]
  return value === undefined || value === null || value === '' ? undefined : String(value)
}
const contentClass = computed(() =>
  [...new Set(['hf-theme', 'hf-ui', ...(props.portalClass?.split(/\s+/) ?? [])])].filter(Boolean).join(' '),
)

// One polite live region; the key re-renders the text so a repeated message is read again.
const announcement = ref('')
const announcementKey = ref(0)
function announce(text: string) {
  announcement.value = text
  announcementKey.value += 1
}

// ── Switching views ─────────────────────────────────────────────────────────
const tabsEl = ref<HTMLElement | null>(null)
function focusTab(id: string) {
  void nextTick(() => {
    const tabs = Array.from(tabsEl.value?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])
    tabs.find(tab => tab.dataset.viewId === id)?.focus()
  })
}

function selectView(id: string) {
  if (!props.views.select(id)) return
  const view = active.value
  announce(`Vista ${view.name}${view.dirty ? ', con cambios sin guardar' : ''}`)
}

function onTabsKeydown(event: KeyboardEvent) {
  const list = items.value
  const index = list.findIndex(view => view.id === active.value.id)
  let next: number | undefined
  if (event.key === 'ArrowRight') next = (index + 1) % list.length
  else if (event.key === 'ArrowLeft') next = (index - 1 + list.length) % list.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = list.length - 1
  if (next === undefined) return
  event.preventDefault()
  const target = list[next]!
  selectView(target.id)
  focusTab(target.id)
}

const selectItems = computed(() =>
  items.value.map(view => {
    const count = countOf(view.id)
    return { label: count ? `${view.name} (${count})` : view.name, value: view.id }
  }),
)

// ── Restablecer and Guardar vista ───────────────────────────────────────────
const resetLabel = computed(() =>
  active.value.modified
    ? `Restablecer la vista ${active.value.name} a como venía`
    : 'Restablecer: descartar los cambios sin guardar de la vista',
)
function resetView() {
  const view = active.value
  const restoresDefinition = view.modified
  props.views.reset()
  announce(restoresDefinition ? `Vista ${view.name} restablecida` : `Cambios descartados. Vista ${view.name} como estaba guardada`)
}

function saveView() {
  props.views.save()
  announce(`Vista ${active.value.name} guardada`)
}

const saveItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: `Guardar cambios en «${active.value.name}»`,
      icon: 'i-lucide-save',
      disabled: !isDirty.value,
      onSelect: saveView,
    },
    { label: 'Guardar como nueva vista…', icon: 'i-lucide-copy-plus', onSelect: () => openNameDialog('create') },
  ],
])

const optionsItems = computed<DropdownMenuItem[][]>(() => [
  [{ label: 'Renombrar vista…', icon: 'i-lucide-pencil', onSelect: () => openNameDialog('rename') }],
  [{ label: 'Eliminar vista…', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => void deleteView() }],
])

// ── Name dialog: new view or rename ─────────────────────────────────────────
const dialogMode = ref<'create' | 'rename' | null>(null)
const dialogOpen = computed({
  get: () => dialogMode.value !== null,
  set: open => {
    if (!open) dialogMode.value = null
  },
})
const nameValue = ref('')
const nameError = ref<string | null>(null)
const fieldId = useId()
const errorId = `${fieldId}-error`
const hintId = `${fieldId}-hint`
let renamingId: string | undefined

function openNameDialog(mode: 'create' | 'rename') {
  renamingId = mode === 'rename' ? active.value.id : undefined
  nameValue.value = mode === 'rename' ? active.value.name : ''
  nameError.value = null
  dialogMode.value = mode
}

let focusAfterClose: string | undefined
function onDialogAfterLeave() {
  if (focusAfterClose) focusTab(focusAfterClose)
  focusAfterClose = undefined
}

function submitName() {
  if (dialogMode.value === 'create') {
    const result = props.views.saveAsNew(nameValue.value)
    if (!result.ok) {
      nameError.value = result.error
      return
    }
    announce(`Vista ${active.value.name} creada`)
    focusAfterClose = result.id
  } else if (dialogMode.value === 'rename' && renamingId) {
    const before = items.value.find(view => view.id === renamingId)?.name ?? ''
    const result = props.views.rename(renamingId, nameValue.value)
    if (!result.ok) {
      nameError.value = result.error
      return
    }
    announce(`Vista ${before} renombrada a ${active.value.name}`)
    focusAfterClose = result.id
  }
  dialogMode.value = null
  if (focusAfterClose) focusTab(focusAfterClose)
}

// ── Delete ──────────────────────────────────────────────────────────────────
const { confirm } = useConfirm()
async function deleteView() {
  const view = active.value
  if (view.builtIn) return
  const ok = await confirm({
    title: 'Eliminar vista',
    description: `Se eliminará la vista «${view.name}». La tabla no cambia de datos; solo se olvida esta vista.`,
    confirmLabel: 'Eliminar vista',
    tone: 'danger',
  })
  if (!ok || !props.views.remove(view.id)) return
  announce(`Vista ${view.name} eliminada`)
  focusTab(active.value.id)
}
</script>

<template>
  <div class="hf-views" data-testid="table-views">
    <div
      v-if="!isMobile"
      ref="tabsEl"
      role="tablist"
      :aria-label="props.label"
      class="hf-views__tabs"
      @keydown="onTabsKeydown"
    >
      <button
        v-for="view in items"
        :id="tabId(view.id)"
        :key="view.id"
        type="button"
        role="tab"
        class="hf-views__tab"
        :aria-selected="view.id === active.id ? 'true' : 'false'"
        :aria-controls="props.controls"
        :tabindex="view.id === active.id ? 0 : -1"
        :data-view-id="view.id"
        :data-testid="`table-views-tab-${view.id}`"
        @click="selectView(view.id)"
      >
        <span class="hf-views__name">{{ view.name }}</span>
        <span v-if="countOf(view.id)" class="hf-views__count">{{ countOf(view.id) }}</span>
        <template v-if="view.dirty">
          <span class="hf-views__dot" aria-hidden="true" />
          <span class="sr-only"> (cambios sin guardar)</span>
        </template>
      </button>
    </div>

    <USelect
      v-else
      :model-value="active.id"
      :items="selectItems"
      aria-label="Vista"
      class="hf-views__select"
      :ui="{ content: contentClass }"
      data-testid="table-views-select"
      @update:model-value="selectView($event as string)"
    >
      <template #leading>
        <span class="hf-views__select-label">Vista:</span>
      </template>
    </USelect>

    <span class="hf-views__grow" />

    <span v-if="isDirty" class="hf-views__unsaved" data-testid="table-views-unsaved">
      <span class="hf-views__dot" aria-hidden="true" />
      <span :class="isMobile ? 'sr-only' : undefined">Cambios sin guardar</span>
    </span>

    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-rotate-ccw"
      class="hf-views__action"
      :disabled="!canReset"
      :aria-label="resetLabel"
      data-testid="table-views-reset"
      @click="resetView"
    >
      <span v-if="!isMobile">Restablecer</span>
    </UButton>

    <UDropdownMenu :items="saveItems" :content="{ align: 'end' }" :ui="{ content: contentClass }">
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-save"
        class="hf-views__action"
        aria-label="Guardar vista"
        data-testid="table-views-save"
      >
        <span v-if="!isMobile">Guardar vista</span>
      </UButton>
    </UDropdownMenu>

    <UDropdownMenu
      v-if="!active.builtIn"
      :items="optionsItems"
      :content="{ align: 'end' }"
      :ui="{ content: contentClass }"
    >
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-ellipsis"
        class="hf-views__action"
        :aria-label="`Opciones de la vista ${active.name}`"
        data-testid="table-views-options"
      />
    </UDropdownMenu>

    <UModal
      v-model:open="dialogOpen"
      :title="dialogMode === 'rename' ? 'Renombrar vista' : 'Guardar como nueva vista'"
      :description="
        dialogMode === 'rename'
          ? 'El nombre aparece en la pestaña de la vista.'
          : 'Guarda el orden, el fijado, los anchos, las columnas, la densidad, el orden de filas y el filtro de la vista.'
      "
      :ui="{ content: contentClass }"
      @after:leave="onDialogAfterLeave"
    >
      <template #body>
        <form class="hf-views__form" data-testid="table-views-name-form" novalidate @submit.prevent="submitName">
          <label class="hf-views__label" :for="fieldId">Nombre de la vista</label>
          <UInput
            :id="fieldId"
            v-model="nameValue"
            autofocus
            autocomplete="off"
            :maxlength="TABLE_VIEW_NAME_MAX"
            :color="nameError ? 'error' : undefined"
            :highlight="!!nameError"
            :aria-invalid="nameError ? 'true' : undefined"
            :aria-describedby="nameError ? `${errorId} ${hintId}` : hintId"
            class="w-full"
            data-testid="table-views-name-input"
            @update:model-value="nameError = null"
          />
          <p v-if="nameError" :id="errorId" class="hf-views__error" data-testid="table-views-name-error">
            {{ nameError }}
          </p>
          <p :id="hintId" class="hf-views__hint">Hasta {{ TABLE_VIEW_NAME_MAX }} caracteres. Solo se guarda en este navegador.</p>
          <div class="hf-views__form-actions">
            <UButton color="neutral" variant="outline" @click="dialogOpen = false">Cancelar</UButton>
            <UButton type="submit" data-testid="table-views-name-submit">
              {{ dialogMode === 'rename' ? 'Guardar nombre' : 'Crear vista' }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>

    <div class="sr-only" aria-live="polite" aria-atomic="true" data-testid="table-views-announcer">
      <span :key="announcementKey">{{ announcement }}</span>
    </div>
  </div>
</template>
