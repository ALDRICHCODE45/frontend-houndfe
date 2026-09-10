<script setup lang="ts">
import { computed } from 'vue'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
defineOptions({ inheritAttrs: false })

interface Props {
  open: boolean
  title: string
  description?: string
  closeAriaLabel?: string
  desktopUi?: Record<string, string>
  mobileBodyClass?: string
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'after:enter': []
  'after:leave': []
}>()
const isMobile = useBreakpoints(breakpointsTailwind).smaller('lg')
const closeLabel = computed(() => props.closeAriaLabel ?? `Cerrar ${props.title}`)
</script>

<template>
  <USlideover
    v-if="isMobile"
    :open="open"
    :title="title"
    :description="description"
    side="bottom"
    inset
    :ui="{ content: 'h-[90dvh] max-h-[90dvh] rounded-t-2xl motion-reduce:transition-none' }"
    @update:open="emit('update:open', $event)"
    @after:enter="emit('after:enter')"
    @after:leave="emit('after:leave')"
  >
    <template #content="{ close }">
      <div
        data-testid="mobile-drawer-content"
        class="flex h-full flex-col"
        v-bind="$attrs"
      >
        <div class="flex shrink-0 pb-1 pt-2" aria-hidden="true">
          <span
            data-testid="mobile-drawer-handle"
            class="mx-auto block h-1.5 w-12 rounded-full bg-muted"
          />
        </div>

        <div class="flex shrink-0 items-center justify-between border-b border-default px-4 py-2.5">
          <div class="min-w-0 flex-1">
            <slot name="title">
              <span class="text-base font-bold leading-tight text-highlighted">{{ title }}</span>
            </slot>
            <!-- Nuxt UI also receives these props to create the dialog's semantic title. -->
            <span v-if="description" class="sr-only">{{ description }}</span>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            size="md"
            :aria-label="closeLabel"
            class="min-h-[44px] min-w-[44px] shrink-0"
            data-testid="mobile-drawer-close"
            @click="close"
          />
        </div>

        <div class="min-h-0 flex-1" :class="mobileBodyClass ?? 'overflow-y-auto'">
          <slot name="body" />
        </div>

        <div
          v-if="$slots.footer"
          class="empty:hidden shrink-0 border-t border-default pb-[env(safe-area-inset-bottom)]"
          data-testid="mobile-drawer-footer"
        >
          <slot name="footer" />
        </div>
      </div>
    </template>
  </USlideover>

  <USlideover
    v-else
    :open="open"
    :title="title"
    :description="description"
    side="right"
    inset
    :close="{ 'aria-label': closeLabel }"
    :ui="desktopUi"
    v-bind="$attrs"
    @update:open="emit('update:open', $event)"
    @after:enter="emit('after:enter')"
    @after:leave="emit('after:leave')"
  >
    <template #title><slot name="title">{{ title }}</slot></template>
    <template v-if="description || $slots.description" #description>
      <slot name="description">{{ description }}</slot>
    </template>
    <template #body><slot name="body" /></template>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </USlideover>
</template>
