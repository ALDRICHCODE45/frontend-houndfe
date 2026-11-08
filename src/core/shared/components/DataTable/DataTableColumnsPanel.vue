<script setup lang="ts">
import { onBeforeUnmount, onBeforeUpdate, onUpdated, ref, useId, useTemplateRef } from 'vue'
import type { ColumnGroup, ColumnsPanelColumn, ColumnsPanelGroups } from './columnArrange.utils'
import DataTableDensityControl from './DataTableDensityControl.vue'
import type { TableDensity } from './tableLayout'

/**
 * The «Columnas» panel of artboard 01: three sections, rows that drag (pointer) or step (↑/↓ on the
 * grip) within and across sections, pin buttons and visibility switches. AppDataTable owns the
 * layout and the announcements; this lays the rows out and reports what the user asked for. With a
 * `density`, a «Densidad» section on top sets the row height (Compacta / Normal / Cómoda).
 */
const props = defineProps<{
  groups: ColumnsPanelGroups
  density?: TableDensity
  densityDisabled?: boolean
}>()

const emit = defineEmits<{
  /** Put `id` at `index` among the other rows of `group` (pinning or unpinning it). */
  place: [id: string, group: ColumnGroup, index: number]
  /** One step up (-1) or down (+1), crossing into the next section at an edge. */
  step: [id: string, delta: number]
  pin: [id: string, side: 'left' | 'right' | false]
  visibility: [id: string, visible: boolean]
  reset: []
  close: []
  density: [density: TableDensity]
}>()

const GROUPS: readonly ColumnGroup[] = ['left', 'center', 'right']
const TITLES: Record<ColumnGroup, string> = {
  left: 'Fijadas a la izquierda',
  center: 'Columnas',
  right: 'Fijadas a la derecha',
}
const EMPTY: Record<ColumnGroup, string> = {
  left: 'Ninguna. Arrastra aquí o usa los botones de fijar.',
  center: 'Todas las columnas están fijadas.',
  right: 'Ninguna. Arrastra aquí o usa los botones de fijar.',
}
const uid = useId()
const sectionId = (group: ColumnGroup) => `${uid}-${group}`

function pinLabel(column: ColumnsPanelColumn, group: ColumnGroup, side: 'left' | 'right') {
  return group === side ? `Desfijar ${column.label}` : `Fijar ${column.label} ${side === 'left' ? 'a la izquierda' : 'a la derecha'}`
}
function togglePin(column: ColumnsPanelColumn, group: ColumnGroup, side: 'left' | 'right') {
  emit('pin', column.id, group === side ? false : side)
}

// A row that changes section is rendered anew; the control that had the focus gets it back.
const bodyRef = useTemplateRef<HTMLElement>('body')
let focusKey: string | undefined
onBeforeUpdate(() => {
  const active = document.activeElement
  focusKey = active instanceof HTMLElement && bodyRef.value?.contains(active) ? active.dataset.panelFocus : undefined
})
onUpdated(() => {
  const key = focusKey
  focusKey = undefined
  if (!key || bodyRef.value?.contains(document.activeElement)) return
  bodyRef.value?.querySelector<HTMLElement>(`[data-panel-focus="${key}"]`)?.focus()
})

function onGripKeydown(event: KeyboardEvent, id: string) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  event.preventDefault()
  emit('step', id, event.key === 'ArrowUp' ? -1 : 1)
}

// ── Pointer drag: a guide line marks the gap; an empty section lights up ────────
interface DropTarget {
  group: ColumnGroup
  index: number
  /** The guide's top inside the body, or `undefined` for an empty section. */
  y?: number
}
const DRAG_THRESHOLD = 4
const LIST_REACH = 14
const SCROLL_EDGE = 24
const SCROLL_STEP = 10
const draggingId = ref<string>()
const target = ref<DropTarget>()
let session: { id: string; pointerId: number; y0: number; active: boolean } | undefined

function onGripPointerDown(event: PointerEvent, id: string) {
  if (event.button !== 0 || event.pointerType === 'touch') return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement | null)?.focus()
  finish()
  session = { id, pointerId: event.pointerId, y0: event.clientY, active: false }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', finish)
  window.addEventListener('keydown', onKeydown, true)
}

function targetAt(id: string, y: number): DropTarget | undefined {
  const body = bodyRef.value
  if (!body) return undefined
  const top = body.getBoundingClientRect().top
  const lists = Array.from(body.querySelectorAll<HTMLElement>('[data-panel-list]')).map(list => ({
    list,
    rect: list.getBoundingClientRect(),
  }))
  const hit =
    lists.find(({ rect }) => y >= rect.top && y < rect.bottom) ??
    lists.find(({ rect }) => y >= rect.top - LIST_REACH && y < rect.bottom + LIST_REACH)
  if (!hit) return undefined
  const group = hit.list.dataset.panelList as ColumnGroup
  const rows = Array.from(hit.list.querySelectorAll<HTMLElement>('[data-panel-row]'))
    .filter(row => row.dataset.columnId !== id)
    .map(row => row.getBoundingClientRect())
  if (rows.length === 0) return { group, index: 0 }
  const index = rows.findIndex(rect => y < rect.top + rect.height / 2)
  const edge = index < 0 ? rows[rows.length - 1]!.bottom : rows[index]!.top
  return { group, index: index < 0 ? rows.length : index, y: edge - top + body.scrollTop }
}

function onMove(event: PointerEvent) {
  const current = session
  if (!current || event.pointerId !== current.pointerId) return
  if (!current.active) {
    if (Math.abs(event.clientY - current.y0) < DRAG_THRESHOLD) return
    current.active = true
    draggingId.value = current.id
  }
  const body = bodyRef.value
  if (body) {
    const bounds = body.getBoundingClientRect()
    if (event.clientY < bounds.top + SCROLL_EDGE) body.scrollTop -= SCROLL_STEP
    else if (event.clientY > bounds.bottom - SCROLL_EDGE) body.scrollTop += SCROLL_STEP
  }
  target.value = targetAt(current.id, event.clientY)
}

function onUp(event: PointerEvent) {
  if (session && event.pointerId !== session.pointerId) return
  const ended = session
  const drop = target.value
  finish()
  if (ended?.active && drop) emit('place', ended.id, drop.group, drop.index)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !session?.active) return
  event.preventDefault()
  event.stopPropagation()
  finish()
}

function finish() {
  session = undefined
  draggingId.value = undefined
  target.value = undefined
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', finish)
  window.removeEventListener('keydown', onKeydown, true)
}

onBeforeUnmount(finish)
</script>

<template>
  <div class="hf-columns-panel" data-testid="columns-panel">
    <div class="hf-columns-panel__head">
      <h2 class="hf-columns-panel__title">Columnas</h2>
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-x"
        aria-label="Cerrar columnas"
        @click="emit('close')"
      />
    </div>
    <p class="hf-columns-panel__sub">Arrastra para ordenar, fija a un lado o elige cuáles ver.</p>

    <section v-if="props.density" class="hf-columns-density" :aria-labelledby="`${uid}-density`" data-panel-density>
      <h3 :id="`${uid}-density`" class="hf-columns-section__title"><span>Densidad</span></h3>
      <DataTableDensityControl
        :density="props.density"
        :disabled="props.densityDisabled"
        @update:density="emit('density', $event)"
      />
    </section>

    <div ref="body" class="hf-columns-panel__body" data-panel-body>
      <section
        v-for="group in GROUPS"
        :key="group"
        class="hf-columns-section"
        :aria-labelledby="sectionId(group)"
        :data-panel-section="group"
      >
        <h3 :id="sectionId(group)" class="hf-columns-section__title">
          <span>{{ TITLES[group] }}</span>
          <span class="hf-columns-section__count">{{ props.groups[group].length }}</span>
        </h3>
        <ul
          class="hf-columns-list"
          :class="{ 'hf-columns-list--drop': target && target.group === group && target.y === undefined }"
          :data-panel-list="group"
        >
          <li
            v-for="column in props.groups[group]"
            :key="column.id"
            class="hf-columns-row"
            :class="{
              'hf-columns-row--off': !column.visible,
              'hf-columns-row--lifting': draggingId === column.id,
            }"
            data-panel-row
            :data-column-id="column.id"
          >
            <button
              type="button"
              class="hf-columns-grip"
              :aria-label="`Mover ${column.label}. Usa flechas arriba y abajo`"
              :aria-describedby="sectionId(group)"
              data-panel-grip
              :data-column-id="column.id"
              :data-panel-focus="`grip-${column.id}`"
              @pointerdown="onGripPointerDown($event, column.id)"
              @keydown="onGripKeydown($event, column.id)"
            >
              <UIcon name="i-lucide-grip-vertical" />
            </button>
            <span class="hf-columns-row__label" data-panel-label>{{ column.label }}</span>
            <button
              v-for="side in ['left', 'right'] as const"
              :key="side"
              type="button"
              class="hf-columns-pin"
              :aria-pressed="group === side"
              :aria-label="pinLabel(column, group, side)"
              :title="group === side ? 'Desfijar' : side === 'left' ? 'Fijar a la izquierda' : 'Fijar a la derecha'"
              :data-panel-focus="`pin-${side}-${column.id}`"
              @click="togglePin(column, group, side)"
            >
              <UIcon :name="side === 'left' ? 'i-lucide-panel-left' : 'i-lucide-panel-right'" />
            </button>
            <USwitch
              :model-value="column.visible"
              :disabled="column.primary"
              size="sm"
              :aria-label="`Mostrar ${column.label}`"
              :title="column.primary ? `${column.label} siempre está visible` : undefined"
              :data-panel-focus="`switch-${column.id}`"
              @update:model-value="emit('visibility', column.id, $event as boolean)"
            />
          </li>
          <li v-if="props.groups[group].length === 0" class="hf-columns-empty">{{ EMPTY[group] }}</li>
        </ul>
      </section>
      <div
        v-if="target && target.y !== undefined"
        class="hf-columns-guide"
        :style="{ top: `${target.y - 1}px` }"
        aria-hidden="true"
        data-testid="columns-drop-guide"
      />
    </div>

    <div class="hf-columns-panel__foot">
      <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-rotate-ccw" @click="emit('reset')">
        Restablecer columnas
      </UButton>
    </div>
  </div>
</template>
