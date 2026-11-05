<script setup lang="ts">
/**
 * SatKeySelect — async-searchable SAT key select.
 *
 * Reusable across both the quick-create slideover and the full
 * ProductDetailView editor. Built on a plain-HTML combobox shell
 * (mirrors CategorySelect) to dodge the Reka UI focus-trap freeze
 * that USelectMenu has inside USlideover (nuxt/ui #3408).
 *
 * Behavior contract (mirrors sat-key-searchable-select spec):
 *  - Fires GET /sat-keys only when the trimmed query is ≥ 2 chars
 *    (delegated to useSatKeySearch).
 *  - Renders 3 distinct states: idle ("type to search"), loading,
 *    no-matches ("Sin resultados"), results.
 *  - Each option label is "<key> — <description>"; v-model emits the
 *    8-digit key string only — never the description.
 *  - On mount with a non-empty v-model, useSatKeyLookup fetches the
 *    label once. 404 → raw key string, no crash, v-model preserved.
 *  - "showing 20 of N" hint appears only when total > items.length.
 *  - Cleared selection emits "" and does not throw.
 *  - :error prop surfaces a field-level error below the trigger.
 */
import '@/core/shared/design-system/houndfe-ui.css'
import { computed, ref, watch, nextTick, useId } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useSatKeySearch } from '../composables/useSatKeySearch'
import { useSatKeyLookup } from '../composables/useSatKeyLookup'
import {
  buildSatKeyOptions,
  deriveSearchState,
  formatSatKeyLabel,
  mergeCurrentKeyOption,
  type SatKeyOption,
} from '../composables/satKeyHelpers'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    disabled?: boolean
    placeholder?: string
    error?: string
    id?: string
  }>(),
  {
    modelValue: '',
    disabled: false,
    placeholder: 'Buscar clave SAT...',
    error: '',
    id: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const listId = useId()
const errorId = `${listId}-error`
const triggerRef = ref<HTMLButtonElement | null>(null)
const highlightedIndex = ref(-1)
const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchInput = ref('') // local copy of the live search term

onClickOutside(containerRef, () => {
  isOpen.value = false
})

// ── Composable bindings ──────────────────────────────────────────────────────

const search = useSatKeySearch(() => searchInput.value)
const { items, total, limit, isFetching, isLoading } = search

const lookup = useSatKeyLookup(() => props.modelValue)

// ── Derived data ─────────────────────────────────────────────────────────────

/** Currently selected option, hydrated from lookup if available. */
const currentOption = computed<SatKeyOption | null>(() => {
  const key = props.modelValue
  if (!key) return null
  const hydrated = lookup.satKey.value
  if (hydrated) {
    return { value: hydrated.key, label: formatSatKeyLabel(hydrated.key, hydrated.description) }
  }
  return { value: key, label: key }
})

/** Dropdown options: fetched results + the current option (if absent). */
const visibleOptions = computed<SatKeyOption[]>(() => {
  const opts = buildSatKeyOptions(items.value)
  return mergeCurrentKeyOption(opts, currentOption.value)
})

/** Trigger label — the human label, or the raw key, or the placeholder. */
const triggerLabel = computed(() => currentOption.value?.label ?? '')

/** State token used by the template to pick what to render. */
const state = computed(() =>
  deriveSearchState({
    term: search.debouncedTerm.value,
    isLoading: isFetching.value || isLoading.value,
    items: buildSatKeyOptions(items.value),
  }),
)

/** "showing 20 of 152" — only when there's a real page overflow. */
const totalHint = computed(() => {
  if (total.value <= items.value.length) return ''
  return `mostrando ${limit.value} de ${total.value}`
})

// ── Interactions ─────────────────────────────────────────────────────────────

function close() {
  isOpen.value = false
  nextTick(() => triggerRef.value?.focus())
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    close()
  } else if (state.value === 'results') {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      highlightedIndex.value = Math.max(0, Math.min(highlightedIndex.value + step, visibleOptions.value.length - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = visibleOptions.value[highlightedIndex.value]
      if (option) selectOption(option)
    }
  }
}

watch([searchInput, visibleOptions], () => { highlightedIndex.value = -1 })

function open() {
  if (props.disabled) return
  isOpen.value = true
  highlightedIndex.value = -1
  // Seed the search box with the current key so the user can refine.
  searchInput.value = props.modelValue
  nextTick(() => searchInputRef.value?.focus())
}

function toggle() {
  if (isOpen.value) {
    isOpen.value = false
  } else {
    open()
  }
}

function selectOption(option: SatKeyOption) {
  emit('update:modelValue', option.value)
  close()
  searchInput.value = ''
}

function clear() {
  if (props.disabled) return
  emit('update:modelValue', '')
  close()
  searchInput.value = ''
}

// Keep the search input in sync with modelValue when it changes externally.
watch(
  () => props.modelValue,
  (next) => {
    if (!isOpen.value) {
      searchInput.value = next
    }
  },
)
</script>

<template>
  <div ref="containerRef" class="hf-theme hf-ui sat-select relative min-w-0 w-full">
    <!-- Trigger row: button + clear button + chevron -->
    <div class="relative flex min-w-0 w-full items-center gap-1">
      <button
        :id="id"
        ref="triggerRef"
        type="button"
        aria-haspopup="listbox"
        :aria-label="triggerLabel || placeholder"
        :aria-expanded="isOpen"
        :aria-controls="isOpen ? listId : undefined"
        :aria-invalid="!!error"
        :aria-describedby="error ? errorId : undefined"
        :disabled="disabled"
        class="products-select-trigger hf-select-field relative min-w-0 flex-1 rounded-md border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-75"
        :class="{ 'border-error': error }"
        @click="toggle"
        @keydown.down.prevent="open"
      >
        <span class="flex items-center justify-between gap-2">
          <span v-if="triggerLabel" class="truncate text-default">{{ triggerLabel }}</span>
          <span v-else class="truncate text-dimmed">{{ placeholder }}</span>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-5 shrink-0 text-dimmed transition-transform duration-200"
            :class="{ 'rotate-180': isOpen }"
          />
        </span>
      </button>

      <button
        v-if="modelValue && !disabled"
        type="button"
        aria-label="Limpiar"
        class="hf-select-clear shrink-0 rounded p-2"
        @click.stop="clear"
      >
        <UIcon name="i-lucide-x" class="size-4" />
      </button>
    </div>

    <!-- Error message -->
    <p
      v-if="error"
      :id="errorId"
      role="alert"
      data-testid="sat-error"
      class="mt-1 text-xs text-error"
    >
      {{ error }}
    </p>

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
        <!-- Search input -->
        <div class="border-b border-default p-1.5">
          <input
            ref="searchInputRef"
            v-model="searchInput"
            type="text"
            class="hf-select-field w-full min-w-0 rounded px-2 py-1.5 text-sm"
            aria-label="Buscar clave SAT"
            role="combobox"
            aria-expanded="true"
            :aria-controls="listId"
            :aria-activedescendant="highlightedIndex >= 0 ? `${listId}-${highlightedIndex}` : undefined"
            :placeholder="placeholder"
            @keydown="handleKeydown"
          />
        </div>

        <!-- Body — three states + a spinner overlay -->
        <div :id="listId" role="listbox" aria-label="Claves SAT" :aria-busy="state === 'loading'" class="max-h-60 overflow-y-auto p-1 scroll-py-1">
          <!-- Loading: spinner only when we already have a valid term -->
          <div
            v-if="state === 'loading'"
            role="status"
            class="flex items-center justify-center p-4 text-sm text-muted"
          >
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
            <span class="ml-2">Buscando...</span>
          </div>

          <!-- Idle: prompt -->
          <p
            v-else-if="state === 'idle'"
            class="p-2.5 text-center text-sm text-muted"
          >
            Escribe al menos 2 caracteres para buscar
          </p>

          <!-- No matches -->
          <p
            v-else-if="state === 'no-matches'"
            class="p-2.5 text-center text-sm text-muted"
          >
            Sin resultados
          </p>

          <!-- Results -->
          <template v-else>
            <button
              v-for="(option, index) in visibleOptions"
              :key="option.value"
              type="button"
              :id="`${listId}-${index}`"
              role="option"
              :aria-selected="option.value === modelValue"
              :data-highlighted="highlightedIndex === index"
              class="hf-select-option relative flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-2 text-left text-sm"
              @mouseenter="highlightedIndex = index"
              @focus="highlightedIndex = index"
              @keydown="handleKeydown"
              @click="selectOption(option)"
            >
              <span class="truncate">{{ option.label }}</span>
              <UIcon
                v-if="option.value === modelValue"
                name="i-lucide-check"
                class="ml-auto size-5 shrink-0 text-[var(--hf-active)]"
              />
            </button>

            <p
              v-if="totalHint"
              class="border-t border-default px-2 py-1.5 text-center text-xs text-dimmed"
            >
              {{ totalHint }}
            </p>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.hf-select-field, .hf-select-option, .hf-select-clear { min-height: var(--hf-control-height); }
.hf-select-field { background: var(--hf-field); border-color: var(--hf-border); color: var(--hf-ink); }
.hf-select-field:hover:not(:disabled, [aria-invalid='true']) { border-color: var(--hf-field-border); }
.hf-select-field[aria-invalid='true'] { border-color: var(--ui-error); }
.hf-select-field:focus-visible, .hf-select-option:focus-visible, .hf-select-clear:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: -2px; }
.hf-select-menu { background: var(--hf-surface); border: 1px solid var(--hf-border); }
.hf-select-option { color: var(--hf-ink); }
.hf-select-clear { min-width: var(--hf-control-height); color: var(--hf-muted); }
.hf-select-option:hover, .hf-select-clear:hover, .hf-select-option[data-highlighted='true'], .hf-select-option[aria-selected='true'] { background: var(--hf-active-soft); color: var(--hf-active); }
@media (prefers-reduced-motion: reduce) { .sat-select :deep(*) { transition: none; } }
</style>
