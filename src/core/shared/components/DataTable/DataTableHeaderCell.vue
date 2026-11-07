<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

/**
 * The header of an arrangeable column (artboard 01): the label is the single focus target, and the
 * grip and the ⋯ menu float over its edges on hover or focus. AppDataTable owns the keyboard, the
 * drag and the menu actions; this only lays the parts out.
 */
const props = defineProps<{
  columnId: string
  label: string
  /** The target's accessible name: the label plus its pin and sort state. */
  name: string
  sortable: boolean
  pinned?: 'left' | 'right'
  items: DropdownMenuItem[][]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  pointerdown: [event: PointerEvent]
  activate: []
  /** The menu closed; the table puts the focus back on a header. */
  'menu-closed': []
}>()

const SHORTCUTS = 'Alt+ArrowLeft Alt+ArrowRight Alt+Shift+ArrowLeft Alt+Shift+ArrowRight Shift+F10'
const MENU_UI = {
  content: 'hf-theme hf-ui min-w-64',
  item: 'min-h-11',
  itemLeadingIcon: 'size-4',
}

function onCloseAutoFocus(event: Event) {
  event.preventDefault()
  emit('menu-closed')
}
</script>

<template>
  <div class="hf-th" @pointerdown="emit('pointerdown', $event)">
    <span class="hf-th-grip" aria-hidden="true" data-hf-grip>
      <UIcon name="i-lucide-grip-vertical" />
    </span>
    <div
      class="hf-th-target"
      role="button"
      tabindex="0"
      data-hf-header
      :data-column-id="props.columnId"
      :aria-label="props.name"
      :aria-haspopup="props.sortable ? undefined : 'menu'"
      :aria-keyshortcuts="SHORTCUTS"
      @click="emit('activate')"
    >
      <slot />
    </div>
    <UIcon v-if="props.pinned" name="i-lucide-pin" class="hf-th-pin" aria-hidden="true" />
    <UDropdownMenu
      v-model:open="open"
      :items="props.items"
      :modal="false"
      :content="{ align: 'end', sideOffset: 4, onCloseAutoFocus }"
      :ui="MENU_UI"
    >
      <button
        type="button"
        class="hf-th-menu"
        tabindex="-1"
        :aria-label="`Opciones de la columna ${props.label}`"
        data-hf-header-menu
        @pointerdown.stop
      >
        <UIcon name="i-lucide-ellipsis" />
      </button>
    </UDropdownMenu>
  </div>
</template>
