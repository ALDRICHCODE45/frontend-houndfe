<script setup lang="ts">
/**
 * HF category select using plain HTML.
 * Built specifically to avoid the Reka UI focus trap conflict that occurs
 * when USelect is placed inside USlideover (freezes UI in Vite dev mode).
 * See: https://github.com/nuxt/ui/issues/3408
 */
import '@/core/shared/design-system/houndfe-ui.css'
import { computed, ref, watch, nextTick, useId } from 'vue'
import { onClickOutside } from '@vueuse/core'

export interface CategorySelectItem {
  label: string
  value: string
  icon?: string
  type?: 'separator' | 'action'
}

const props = withDefaults(
  defineProps<{
    modelValue?: string
    items?: CategorySelectItem[]
    placeholder?: string
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    modelValue: '',
    items: () => [],
    placeholder: 'Seleccionar...',
    disabled: false,
    size: 'lg',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  action: [value: string]
}>()

const listId = useId()
const triggerRef = ref<HTMLButtonElement | null>(null)
const isOpen = ref(false)
const search = ref('')
const highlightedIndex = ref(-1)
const containerRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

onClickOutside(containerRef, () => {
  isOpen.value = false
})

const selectableItems = computed(() => props.items.filter((item) => item.type !== 'separator'))

const filteredItems = computed(() => {
  const query = search.value.toLowerCase().trim()
  if (!query) return props.items

  return props.items.filter((item) => {
    if (item.type === 'separator') return false
    if (item.type === 'action') return true
    return item.label.toLowerCase().includes(query)
  })
})

const navigableItems = computed(() => filteredItems.value.filter((item) => item.type !== 'separator'))

function close() {
  isOpen.value = false
  nextTick(() => triggerRef.value?.focus())
}

const selectedLabel = computed(() => {
  const found = selectableItems.value.find((item) => item.value === props.modelValue)
  return found?.label ?? ''
})

const sizeClasses = computed(() => {
  const sizes: Record<string, string> = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-2.5 py-1.5 text-sm',
    lg: 'px-3 py-2 text-sm',
  }
  return sizes[props.size] ?? sizes.md
})

function toggle() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    search.value = ''
    highlightedIndex.value = -1
    nextTick(() => searchInputRef.value?.focus())
  }
}

function selectItem(item: CategorySelectItem) {
  if (item.type === 'action') {
    emit('action', item.value)
    close()
    return
  }

  emit('update:modelValue', item.value)
  close()
}

function handleKeydown(e: KeyboardEvent) {
  const navigable = navigableItems.value

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, navigable.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
  } else if (e.key === 'Enter' && highlightedIndex.value >= 0) {
    e.preventDefault()
    const item = navigable[highlightedIndex.value]
    if (item) selectItem(item)
  } else if (e.key === 'Escape') {
    e.stopPropagation()
    close()
  }
}

watch(search, () => {
  highlightedIndex.value = -1
})
</script>

<template>
  <div ref="containerRef" class="hf-theme hf-ui category-select relative min-w-0 w-full">
    <!-- Trigger -->
    <button
      ref="triggerRef"
      type="button"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-controls="isOpen ? listId : undefined"
      class="products-select-trigger hf-select-field relative w-full rounded-md border text-left disabled:cursor-not-allowed disabled:opacity-75"
      :class="sizeClasses"
      @click="toggle"
      @keydown.down.prevent="toggle"
    >
      <span class="flex items-center justify-between gap-2">
        <span v-if="selectedLabel" class="truncate text-default">{{ selectedLabel }}</span>
        <span v-else class="truncate text-dimmed">{{ placeholder }}</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-5 shrink-0 text-dimmed transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }"
        />
      </span>
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="scale-95 opacity-0"
      enter-to-class="scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="scale-100 opacity-100"
      leave-to-class="scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        class="hf-select-menu absolute z-[80] mt-1 w-full overflow-hidden rounded-md shadow-lg"
      >
        <!-- Search -->
        <div class="border-b border-default p-1.5">
          <input
            ref="searchInputRef"
            v-model="search"
            type="text"
            class="hf-select-field w-full min-w-0 rounded px-2 py-1.5 text-sm"
            aria-label="Buscar opciones"
            role="combobox"
            aria-expanded="true"
            :aria-controls="listId"
            :aria-activedescendant="highlightedIndex >= 0 ? `${listId}-${highlightedIndex}` : undefined"
            placeholder="Buscar..."
            @keydown="handleKeydown"
          />
        </div>

        <!-- Items -->
        <div :id="listId" role="listbox" :aria-label="placeholder" class="max-h-60 overflow-y-auto p-1 scroll-py-1">
          <template v-if="filteredItems.length === 0">
            <p class="p-2.5 text-center text-sm text-muted">Sin resultados</p>
          </template>

          <template v-for="(item, index) in filteredItems" :key="item.value ?? `sep-${index}`">
            <!-- Separator -->
            <div v-if="item.type === 'separator'" class="-mx-1 my-1 h-px bg-border" />

            <!-- Action item (e.g., "Crear categoría") -->
            <button
              v-else-if="item.type === 'action'"
              type="button"
              class="products-select-action hf-select-option relative flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-2 text-left text-sm"
              :id="`${listId}-${navigableItems.indexOf(item)}`"
              role="option"
              :aria-selected="false"
              :data-highlighted="highlightedIndex === navigableItems.indexOf(item)"
              @focus="highlightedIndex = navigableItems.indexOf(item)"
              @keydown="handleKeydown"
              @click="selectItem(item)"
            >
              <UIcon v-if="item.icon" :name="item.icon" class="size-5 shrink-0" />
              <span class="min-w-0 break-words">{{ item.label }}</span>
            </button>

            <!-- Regular item -->
            <button
              v-else
              type="button"
              class="hf-select-option relative flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-2 text-left text-sm"
              :id="`${listId}-${navigableItems.indexOf(item)}`"
              role="option"
              :aria-selected="item.value === modelValue"
              :data-highlighted="highlightedIndex === navigableItems.indexOf(item)"
              @focus="highlightedIndex = navigableItems.indexOf(item)"
              @keydown="handleKeydown"
              @click="selectItem(item)"
              @mouseenter="highlightedIndex = navigableItems.indexOf(item)"
            >
              <UIcon v-if="item.icon" :name="item.icon" class="size-5 shrink-0 text-dimmed" />
              <span class="truncate">{{ item.label }}</span>
              <UIcon
                v-if="item.value === modelValue"
                name="i-lucide-check"
                class="ml-auto size-5 shrink-0 text-[var(--hf-active)]"
              />
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.hf-select-field, .hf-select-option { min-height: var(--hf-control-height); }
.hf-select-field { background: var(--hf-field); border-color: var(--hf-field-border); color: var(--hf-ink); }
.hf-select-field:focus-visible, .hf-select-option:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: -2px; }
.hf-select-menu { background: var(--hf-surface); border: 1px solid var(--hf-border); }
.hf-select-option { color: var(--hf-ink); overflow-wrap: anywhere; }
.hf-select-option:hover, .hf-select-option[data-highlighted='true'], .hf-select-option[aria-selected='true'] { background: var(--hf-active-soft); color: var(--hf-active); }
.products-select-action { color: var(--hf-action); }
@media (prefers-reduced-motion: reduce) { .category-select :deep(*) { transition: none; } }
</style>
