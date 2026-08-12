<script setup lang="ts">
/**
 * TenantCard — single-card view for an admin tenant row.
 *
 * Mirrors the EmployeeCard pattern (article + EntityAvatar + name + slug +
 * StatusDotBadge chip row + dashed divider + 2-col body) but exposes only
 * the fields the admin tenants list cares about: name, slug, address,
 * phone, isActive, createdAt. Cards do NOT render a kebab or checkbox —
 * clicks open the edit slideover and table-level actions (Editar /
 * Gestionar miembros / Desactivar) stay on the table row.
 *
 * The chip row holds `isActive` (Activa / Inactiva) as the sole chip.
 * The 2-col body holds `Dirección` (null-safe → '—') and `Creación`
 * (es-AR).
 */

import { computed } from 'vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import { activityToBadgeTone } from '@/core/shared/utils/badge.utils'
import type { TenantTableRow } from '../interfaces/tenant.types'

const props = defineProps<{
  tenant: TenantTableRow
}>()

const emit = defineEmits<{
  click: [tenant: TenantTableRow]
}>()

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const statusLabel = computed(() => (props.tenant.isActive ? 'Activa' : 'Inactiva'))
const statusTone = computed(() => activityToBadgeTone(props.tenant.isActive))
const createdAtLabel = computed(() => dateFormatter.format(new Date(props.tenant.createdAt)))
const addressLabel = computed(() => props.tenant.address ?? '—')
</script>

<template>
  <article
    class="group relative flex cursor-pointer flex-col rounded-xl border border-default bg-default px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    data-testid="tenant-card"
    @click="emit('click', tenant)"
  >
    <div class="flex items-start gap-3">
      <EntityAvatar
        :name="tenant.name"
        :seed="tenant.id"
        size="lg"
      />

      <div class="min-w-0 flex-1 space-y-1">
        <p class="line-clamp-2 text-sm font-semibold leading-tight text-highlighted">
          {{ tenant.name }}
        </p>
        <p class="line-clamp-1 text-xs text-muted">{{ tenant.slug }}</p>
        <div class="flex min-h-6 flex-wrap items-center gap-1.5 pt-1">
          <StatusDotBadge
            :tone="statusTone"
            :label="statusLabel"
            compact
          />
        </div>
      </div>
    </div>

    <div class="my-3 border-t border-dashed border-default" />

    <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <div class="min-w-0">
        <p class="text-muted">Dirección</p>
        <p class="mt-1 truncate font-medium text-default">{{ addressLabel }}</p>
      </div>
      <div class="min-w-0 text-right">
        <p class="text-muted">Creación</p>
        <p class="mt-1 truncate font-semibold text-default">{{ createdAtLabel }}</p>
      </div>
    </div>
  </article>
</template>