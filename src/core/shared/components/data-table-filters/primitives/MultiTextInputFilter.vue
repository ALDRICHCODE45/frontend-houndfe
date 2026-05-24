<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  label: string
  placeholder?: string
  max?: number
  stripPrefix?: string
  error?: string
}>(), {
  placeholder: 'Ingresá valores separados por coma',
  max: 200,
  stripPrefix: undefined,
  error: undefined,
})

const modelValue = defineModel<string[]>({ default: () => [] })

const inputValue = ref('')

watch(() => modelValue.value, (value) => {
  inputValue.value = value.join(', ')
}, { immediate: true })

const helperText = computed(() => {
  if (modelValue.value.length === 0) return ''
  return `${modelValue.value.length} valores`
})

function normalizeToken(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) return ''

  if (!props.stripPrefix) return trimmed

  const escaped = props.stripPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return trimmed.replace(new RegExp(`^${escaped}+`), '')
}

function parseInput(value: string): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const rawToken of value.split(',')) {
    const token = normalizeToken(rawToken)
    if (!token || seen.has(token)) continue
    seen.add(token)
    output.push(token)
    if (output.length >= props.max) break
  }

  return output
}

function commit() {
  const parsed = parseInput(inputValue.value)
  modelValue.value = parsed
  inputValue.value = parsed.join(', ')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  commit()
}
</script>

<template>
  <UFormField :label="props.label" :error="props.error" class="w-full" data-testid="multi-text-input-filter">
    <UInput
      v-model="inputValue"
      class="w-full"
      data-testid="multi-text-input"
      :placeholder="props.placeholder"
      @blur="commit"
      @keydown="onKeydown"
    />

    <p v-if="helperText" class="mt-2 text-xs text-muted" data-testid="multi-text-helper">
      {{ helperText }}
    </p>
  </UFormField>
</template>
