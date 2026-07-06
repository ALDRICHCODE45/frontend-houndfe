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
import { computed, ref, watch, nextTick } from 'vue'
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

function open() {
  if (props.disabled) return
  isOpen.value = true
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
  isOpen.value = false
  searchInput.value = ''
}

function clear() {
  emit('update:modelValue', '')
  isOpen.value = false
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
  <div ref="containerRef" class="relative w-full">
    <!-- Trigger row: button + clear button + chevron -->
    <div class="relative flex w-full items-center">
      <button
        :id="id"
        type="button"
        :disabled="disabled"
        class="relative w-full rounded-md border bg-default px-3 py-2 text-left text-sm shadow-xs outline-none transition-colors focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-75"
        :class="error ? 'border-error' : 'border-accented'"
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
        class="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 text-dimmed hover:bg-elevated/40 hover:text-default"
        @click.stop="clear"
      >
        <UIcon name="i-lucide-x" class="size-4" />
      </button>
    </div>

    <!-- Error message -->
    <p
      v-if="error"
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
        class="absolute z-[80] mt-1 w-full overflow-hidden rounded-md bg-default shadow-lg ring ring-default"
      >
        <!-- Search input -->
        <div class="border-b border-default p-1.5">
          <input
            ref="searchInputRef"
            v-model="searchInput"
            type="text"
            class="w-full rounded bg-transparent px-2 py-1.5 text-sm text-default placeholder:text-dimmed outline-none"
            :placeholder="placeholder"
            @keydown.escape="isOpen = false"
          />
        </div>

        <!-- Body — three states + a spinner overlay -->
        <div class="max-h-60 overflow-y-auto p-1 scroll-py-1">
          <!-- Loading: spinner only when we already have a valid term -->
          <div
            v-if="state === 'loading'"
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
            Escribí al menos 2 caracteres para buscar
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
              v-for="option in visibleOptions"
              :key="option.value"
              type="button"
              class="relative flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm text-default outline-none transition-colors before:absolute before:inset-px before:z-[-1] before:rounded-md hover:before:bg-elevated/50"
              @click="selectOption(option)"
            >
              <span class="truncate">{{ option.label }}</span>
              <UIcon
                v-if="option.value === modelValue"
                name="i-lucide-check"
                class="ml-auto size-5 shrink-0 text-primary"
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
