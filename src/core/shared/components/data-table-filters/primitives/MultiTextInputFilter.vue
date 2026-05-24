<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string[]
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

const emit = defineEmits<{
  (event: 'update:modelValue', value: string[]): void
}>()

const inputValue = ref('')

watch(() => props.modelValue, (value) => {
  inputValue.value = value.join(', ')
}, { immediate: true })

const helperText = computed(() => {
  if (props.modelValue.length === 0) return ''
  return `Valores detectados: ${props.modelValue.join(', ')}`
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
  emit('update:modelValue', parsed)
  inputValue.value = parsed.join(', ')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  commit()
}
</script>

<template>
  <div class="space-y-2" data-testid="multi-text-input-filter">
    <label class="text-sm font-medium text-highlighted">{{ props.label }}</label>

    <UInput
      v-model="inputValue"
      data-testid="multi-text-input"
      :placeholder="props.placeholder"
      @blur="commit"
      @keydown="onKeydown"
    />

    <p v-if="helperText" class="text-xs text-muted" data-testid="multi-text-helper">
      {{ helperText }}
    </p>

    <p v-if="props.error" class="text-sm text-error">{{ props.error }}</p>
  </div>
</template>
