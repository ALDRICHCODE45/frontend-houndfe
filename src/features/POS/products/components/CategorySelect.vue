<script setup lang="ts">
/**
 * Custom select that visually matches Nuxt UI's USelect but uses plain HTML.
 * Built specifically to avoid the Reka UI focus trap conflict that occurs
 * when USelect is placed inside USlideover (freezes UI in Vite dev mode).
 * See: https://github.com/nuxt/ui/issues/3408
 */
import { computed, ref, watch, nextTick } from 'vue'
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
    isOpen.value = false
    return
  }

  emit('update:modelValue', item.value)
  isOpen.value = false
}

function handleKeydown(e: KeyboardEvent) {
  const navigable = filteredItems.value.filter((i) => i.type !== 'separator')

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
    isOpen.value = false
  }
}

watch(search, () => {
  highlightedIndex.value = -1
})
</script>

<template>
  <div ref="containerRef" class="relative w-full">
    <!-- Trigger -->
    <button
      type="button"
      :disabled="disabled"
      class="relative w-full rounded-md border border-accented bg-default shadow-xs outline-none transition-colors focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-75"
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
        class="absolute z-[80] mt-1 w-full overflow-hidden rounded-md bg-default shadow-lg ring ring-default"
      >
        <!-- Search -->
        <div class="border-b border-default p-1.5">
          <input
            ref="searchInputRef"
            v-model="search"
            type="text"
            class="w-full rounded bg-transparent px-2 py-1.5 text-sm text-default placeholder:text-dimmed outline-none"
            placeholder="Buscar..."
            @keydown="handleKeydown"
          />
        </div>

        <!-- Items -->
        <div class="max-h-60 overflow-y-auto p-1 scroll-py-1">
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
              class="relative flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm text-primary outline-none transition-colors before:absolute before:inset-px before:z-[-1] before:rounded-md hover:before:bg-elevated/50"
              @click="selectItem(item)"
            >
              <UIcon v-if="item.icon" :name="item.icon" class="size-5 shrink-0" />
              <span>{{ item.label }}</span>
            </button>

            <!-- Regular item -->
            <button
              v-else
              type="button"
              class="relative flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm text-default outline-none transition-colors before:absolute before:inset-px before:z-[-1] before:rounded-md hover:before:bg-elevated/50"
              :class="{
                'before:bg-elevated/50 text-highlighted':
                  highlightedIndex === selectableItems.indexOf(item),
              }"
              @click="selectItem(item)"
              @mouseenter="highlightedIndex = selectableItems.indexOf(item)"
            >
              <UIcon v-if="item.icon" :name="item.icon" class="size-5 shrink-0 text-dimmed" />
              <span class="truncate">{{ item.label }}</span>
              <UIcon
                v-if="item.value === modelValue"
                name="i-lucide-check"
                class="ml-auto size-5 shrink-0 text-primary"
              />
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>
