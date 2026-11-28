<script setup lang="ts" generic="T extends Record<string, any>">
/**
 * The phone list of AppDataTable (odd/tasks/mobile-tables.md S4, design/mobile-tables 01 and 02):
 * - `rows` (A · Lista densa): edge-to-edge rows of 72px or more with hairline dividers — lead,
 *   full name, secondary line and the key figure. No ⋮: a record's actions live in its page; the
 *   ones for many in the selection bar.
 * - `cards` (B · Tarjetas ricas): 12px cards with the name, secondary line, status and a mini grid
 *   of up to three stats.
 * Both read the columns' `meta.mobile` (`resolveMobileRow`); `#mobile-lead`, `#mobile-secondary`
 * and `#mobile-status` replace a zone with richer content. In selection mode the selection mark
 * sits inside the record (the row's lead, the card's corner) and a tap marks instead of opening.
 * A long press enters selection mode with that record marked.
 */
import { computed, onBeforeUnmount } from 'vue'
import type { TableColumn, TableMobileTone, VisibilityState } from '../../types/table.types'
import HfRowMark from '../selection/HfRowMark.vue'
import StatusBadge from '../StatusBadge.vue'
import { resolveMobileRow, type MobileRowModel } from './mobileFields'

const props = defineProps<{
  variant: 'rows' | 'cards'
  data: T[]
  columns: TableColumn<T, unknown>[]
  columnVisibility: VisibilityState
  /** The table offers row selection (long press and marks). */
  selectable: boolean
  /** Selection mode is on: marks show and a tap marks. */
  selecting: boolean
  /** Page marks keyed by the row's index on the page. */
  selected: Record<string | number, boolean>
  rowOpen?: (row: T) => void
  markLabel: (row: T, index: number) => string
  /** Accessible name of the list («Clientes, página 1 de 9»). */
  label?: string
}>()

const emit = defineEmits<{
  toggle: [index: number, value: boolean]
  /** A long press: selection mode on, with this row marked. */
  'start-selection': [index: number]
}>()

defineSlots<{
  'mobile-lead'?: (props: { row: T; index: number }) => unknown
  'mobile-secondary'?: (props: { row: T; index: number; fields: MobileRowModel['secondary'] }) => unknown
  'mobile-status'?: (props: { row: T; index: number; fields: MobileRowModel['status'] }) => unknown
}>()

const models = computed(() =>
  props.data.map((row, index) =>
    resolveMobileRow(props.columns, row, index, {
      visibility: props.columnVisibility,
      honourVisibility: props.variant === 'cards',
    }),
  ),
)

const STATUS_TONE: Record<TableMobileTone, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  neutral: 'neutral',
  muted: 'neutral',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
}
const badgeTone = (tone: TableMobileTone | undefined) => STATUS_TONE[tone ?? 'neutral']

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')

const isSelected = (index: number) => !!props.selected[index]

// ── Long press (touch or a held pointer) → selection mode with this row marked ──
const LONG_PRESS_MS = 500
const MOVE_TOLERANCE = 10
let pressTimer: ReturnType<typeof setTimeout> | undefined
let pressOrigin: { x: number; y: number } | undefined
let swallowClick = false

function cancelPress() {
  if (pressTimer) clearTimeout(pressTimer)
  pressTimer = undefined
  pressOrigin = undefined
}

function onPointerDown(event: PointerEvent, index: number) {
  if (!props.selectable || props.selecting || event.button > 0) return
  cancelPress()
  pressOrigin = { x: event.clientX, y: event.clientY }
  pressTimer = setTimeout(() => {
    pressTimer = undefined
    swallowClick = true
    emit('start-selection', index)
  }, LONG_PRESS_MS)
}

function onPointerMove(event: PointerEvent) {
  if (!pressOrigin) return
  if (Math.hypot(event.clientX - pressOrigin.x, event.clientY - pressOrigin.y) > MOVE_TOLERANCE) cancelPress()
}

function onContextMenu(event: Event) {
  // The long press already selected: no browser menu over it.
  if (swallowClick) event.preventDefault()
}

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [role="menuitem"]'

function onRecordClick(event: MouseEvent, row: T, index: number) {
  if (swallowClick) {
    swallowClick = false
    event.preventDefault()
    event.stopPropagation()
    return
  }
  if (props.selecting) {
    // The mark handles its own click (it stops the event); anything else on the record toggles.
    emit('toggle', index, !isSelected(index))
    return
  }
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest(INTERACTIVE) && !target.closest('[data-mobile-open]')) return
  if (window.getSelection?.()?.toString()) return
  props.rowOpen?.(row)
}

function openFromName(event: MouseEvent, row: T, index: number) {
  event.stopPropagation()
  onRecordClick(event, row, index)
}

onBeforeUnmount(cancelPress)
</script>

<template>
  <!-- A · Lista densa -->
  <ul
    v-if="variant === 'rows'"
    class="hf-mrows"
    :class="{ 'is-selecting': selecting }"
    :aria-label="label"
    data-testid="mobile-list-rows"
  >
    <li
      v-for="(row, index) in data"
      :key="index"
      class="hf-mrow"
      :class="{
        'is-selected': selecting && isSelected(index),
        'has-lead': !!models[index]!.lead || !!$slots['mobile-lead'] || selecting,
        'is-openable': !!rowOpen || selecting,
      }"
      data-testid="mobile-list-row"
      @click="onRecordClick($event, row, index)"
      @pointerdown="onPointerDown($event, index)"
      @pointermove="onPointerMove"
      @pointerup="cancelPress"
      @pointercancel="cancelPress"
      @pointerleave="cancelPress"
      @contextmenu="onContextMenu"
    >
      <span
        v-if="models[index]!.lead || $slots['mobile-lead'] || selecting"
        class="hf-mrow__lead"
        data-testid="mobile-row-lead"
      >
        <HfRowMark
          v-if="selecting"
          :checked="isSelected(index)"
          :label="markLabel(row, index)"
          @update:checked="emit('toggle', index, $event)"
        />
        <slot v-else-if="$slots['mobile-lead']" name="mobile-lead" :row="row" :index="index" />
        <span v-else-if="models[index]!.lead?.icon" class="hf-mrow__thumb" aria-hidden="true">
          <UIcon :name="models[index]!.lead!.icon!" class="size-5" />
        </span>
        <span v-else class="hf-mrow__avatar" aria-hidden="true">{{ initials(models[index]!.lead!.text) }}</span>
      </span>

      <div class="hf-mrow__main">
        <button
          v-if="rowOpen && !selecting"
          type="button"
          class="hf-mrow__name hf-mrow__name--link"
          data-mobile-open
          data-testid="mobile-row-primary"
          @click="openFromName($event, row, index)"
        >
          {{ models[index]!.primary?.text }}
        </button>
        <span v-else class="hf-mrow__name" data-testid="mobile-row-primary">{{ models[index]!.primary?.text }}</span>
        <p
          v-if="$slots['mobile-secondary'] || models[index]!.secondary.length > 0"
          class="hf-mrow__sec"
          data-testid="mobile-row-secondary"
        >
          <slot name="mobile-secondary" :row="row" :index="index" :fields="models[index]!.secondary">
            <template v-for="(field, fieldIndex) in models[index]!.secondary" :key="`${field.id}-${fieldIndex}`">
              <span v-if="fieldIndex > 0" aria-hidden="true">·</span>
              <span class="hf-mrow__sec-item">{{ field.text }}</span>
            </template>
          </slot>
        </p>
      </div>

      <div
        v-if="models[index]!.figure || models[index]!.figureNote || models[index]!.status.length > 0 || $slots['mobile-status']"
        class="hf-mrow__fig"
      >
        <b v-if="models[index]!.figure" class="hf-mrow__figure" :data-tone="models[index]!.figure!.tone" data-testid="mobile-row-figure">{{
          models[index]!.figure!.text
        }}</b>
        <small
          v-if="models[index]!.figureNote"
          class="hf-mrow__note"
          :data-tone="models[index]!.figureNote!.tone"
          data-testid="mobile-row-note"
        >{{ models[index]!.figureNote!.text }}</small>
        <slot name="mobile-status" :row="row" :index="index" :fields="models[index]!.status">
          <StatusBadge
            v-for="field in models[index]!.status"
            :key="field.id"
            :label="field.text"
            :tone="badgeTone(field.tone)"
          />
        </slot>
      </div>
    </li>
  </ul>

  <!-- B · Tarjetas ricas -->
  <ul v-else class="hf-mcards" :class="{ 'is-selecting': selecting }" :aria-label="label" data-testid="mobile-list-cards">
    <li
      v-for="(row, index) in data"
      :key="index"
      class="hf-mcard"
      :class="{ 'is-selected': selecting && isSelected(index), 'is-openable': !!rowOpen || selecting }"
      data-testid="mobile-list-card"
      @click="onRecordClick($event, row, index)"
      @pointerdown="onPointerDown($event, index)"
      @pointermove="onPointerMove"
      @pointerup="cancelPress"
      @pointercancel="cancelPress"
      @pointerleave="cancelPress"
      @contextmenu="onContextMenu"
    >
      <div class="hf-mcard__top">
        <div class="hf-mcard__who">
          <button
            v-if="rowOpen && !selecting"
            type="button"
            class="hf-mcard__name hf-mcard__name--link"
            data-mobile-open
            data-testid="mobile-card-primary"
            @click="openFromName($event, row, index)"
          >
            {{ models[index]!.primary?.text }}
          </button>
          <span v-else class="hf-mcard__name" data-testid="mobile-card-primary">{{ models[index]!.primary?.text }}</span>
          <p
            v-if="$slots['mobile-secondary'] || models[index]!.secondary.length > 0"
            class="hf-mcard__sec"
            data-testid="mobile-card-secondary"
          >
            <slot name="mobile-secondary" :row="row" :index="index" :fields="models[index]!.secondary">
              <template v-for="(field, fieldIndex) in models[index]!.secondary" :key="`${field.id}-${fieldIndex}`">
                <span v-if="fieldIndex > 0" aria-hidden="true">·</span>
                <span>{{ field.text }}</span>
              </template>
            </slot>
          </p>
        </div>
        <span v-if="selecting" class="hf-mcard__corner" data-testid="mobile-card-corner">
          <HfRowMark
            :checked="isSelected(index)"
            :label="markLabel(row, index)"
            @update:checked="emit('toggle', index, $event)"
          />
        </span>
      </div>

      <div
        v-if="$slots['mobile-status'] || models[index]!.status.length > 0"
        class="hf-mcard__status"
        data-testid="mobile-card-status"
      >
        <slot name="mobile-status" :row="row" :index="index" :fields="models[index]!.status">
          <StatusBadge
            v-for="field in models[index]!.status"
            :key="field.id"
            :label="field.text"
            :tone="badgeTone(field.tone)"
          />
        </slot>
      </div>

      <dl v-if="models[index]!.stats.length > 0" class="hf-mcard__stats" data-testid="mobile-card-stats">
        <div v-for="stat in models[index]!.stats" :key="`${stat.id}-${stat.label}`" class="hf-mcard__stat">
          <dt>{{ stat.label }}</dt>
          <dd :data-tone="stat.tone">
            {{ stat.text }}<small v-if="stat.note">{{ stat.note }}</small>
          </dd>
        </div>
      </dl>
    </li>
  </ul>
</template>
