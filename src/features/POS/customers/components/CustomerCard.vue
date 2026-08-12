<script setup lang="ts">
/**
 * CustomerCard — single-card view for a Customer row.
 *
 * Mirrors the EmployeeCard pattern (article + EntityAvatar + name + chip
 * row + dashed divider + 2-col body) but exposes only the fields the
 * customer list cares about: fullName, email, phone (with country code),
 * globalPriceListName, createdAt. RFC / fiscal data lives on
 * CustomerDetail (out of scope for the list card).
 *
 * The kebab is gated by `canUpdate || canDelete` so read-only users never
 * see an empty menu. Clicks on the kebab stop propagation so they do not
 * bubble to the card-level `click` handler.
 */

import { computed } from 'vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import type { Customer } from '../interfaces/customer.types'

const props = defineProps<{
  customer: Customer
  canUpdate?: boolean
  canDelete?: boolean
}>()

const emit = defineEmits<{
  edit: [customer: Customer]
  delete: [customer: Customer]
  click: [customer: Customer]
}>()

const canManage = computed(() => Boolean(props.canUpdate || props.canDelete))

const phoneDisplay = computed(() => {
  if (!props.customer.phone) return '—'
  const code = props.customer.phoneCountryCode ? `${props.customer.phoneCountryCode} ` : ''
  return `${code}${props.customer.phone}`
})

function handleEdit(): void {
  emit('edit', props.customer)
}

function handleDelete(): void {
  emit('delete', props.customer)
}
</script>

<template>
  <article
    class="group relative flex cursor-pointer flex-col rounded-xl border border-default bg-default px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    @click="emit('click', customer)"
  >
    <!-- Top-right kebab (gated by canManage) -->
    <div
      v-if="canManage"
      class="absolute right-3 top-3 z-10"
      data-testid="kebab-wrapper"
      @click.stop
    >
      <UDropdownMenu
        :items="[
          ...(canUpdate ? [{ label: 'Editar', onSelect: handleEdit }] : []),
          ...(canDelete
            ? [{ label: 'Eliminar', color: 'error' as const, onSelect: handleDelete }]
            : []),
        ]"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          class="size-7 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Acciones del cliente"
          data-testid="kebab-menu"
        />
      </UDropdownMenu>
    </div>

    <!-- Header: avatar + name + email -->
    <div class="flex flex-col items-start gap-3">
      <EntityAvatar
        :name="customer.fullName"
        :seed="customer.id"
        size="lg"
      />

      <div class="min-w-0 space-y-1 pr-7">
        <p class="truncate text-sm font-semibold leading-tight text-highlighted">
          {{ customer.fullName }}
        </p>
        <p class="line-clamp-1 text-xs text-muted">{{ customer.email ?? '—' }}</p>
      </div>

      <!-- Chip row: globalPriceListName -->
      <div class="flex min-h-6 flex-wrap items-center gap-1.5">
        <AppBadge
          v-if="customer.globalPriceListName"
          tone="neutral"
        >
          {{ customer.globalPriceListName }}
        </AppBadge>
      </div>
    </div>

    <!-- Dashed divider -->
    <div class="my-3 border-t border-dashed border-default" />

    <!-- 2-col body: phone / createdAt -->
    <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <div class="min-w-0">
        <p class="text-muted">Teléfono</p>
        <p class="mt-1 truncate font-medium text-default font-mono">{{ phoneDisplay }}</p>
      </div>
      <div class="min-w-0 text-right">
        <p class="text-muted">Creado</p>
        <p class="mt-1 truncate font-semibold text-default">
          {{ new Date(customer.createdAt).toLocaleDateString() }}
        </p>
      </div>
    </div>
  </article>
</template>
