<script setup lang="ts">
/**
 * RoleCard — single-card view for an admin role row.
 *
 * Mirrors the EmployeeCard pattern (article + EntityAvatar + name +
 * description + StatusDotBadge chip row + dashed divider + 2-col body) but
 * exposes only the fields the admin roles list cares about: name,
 * description, isSystem, permissionCount, userCount, createdAt. Cards do
 * NOT render a kebab or checkbox — clicks open the edit slideover and
 * table-level actions stay in the table view.
 *
 * The chip row holds `isSystem` (info tone "Sistema"), `permissionCount`
 * ("N permisos") and `userCount` ("N usuarios") badges. The 2-col body
 * holds `Descripción` (null-safe → '—') and `Creación` (es-AR).
 */

import { computed } from 'vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import type { RoleTableRow } from '../interfaces/role.types'

const props = defineProps<{
  role: RoleTableRow
}>()

const emit = defineEmits<{
  click: [role: RoleTableRow]
}>()

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const createdAtLabel = computed(() => dateFormatter.format(new Date(props.role.createdAt)))
const descriptionLabel = computed(() => props.role.description ?? '—')
const permissionCountLabel = computed(() => `${props.role.permissionCount} permisos`)
const userCountLabel = computed(() => `${props.role.userCount} usuarios`)
</script>

<template>
  <article
    class="group relative flex cursor-pointer flex-col rounded-xl border border-default bg-default px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    data-testid="role-card"
    @click="emit('click', role)"
  >
    <div class="flex items-start gap-3">
      <EntityAvatar
        :name="role.name"
        :seed="role.id"
        size="lg"
      />

      <div class="min-w-0 flex-1 space-y-1">
        <p class="line-clamp-2 text-sm font-semibold leading-tight text-highlighted">
          {{ role.name }}
        </p>
        <p class="line-clamp-1 text-xs text-muted">{{ descriptionLabel }}</p>
        <div class="flex min-h-6 flex-wrap items-center gap-1.5 pt-1">
          <StatusDotBadge
            v-if="role.isSystem"
            tone="info"
            label="Sistema"
            compact
          />
          <AppBadge
            tone="info"
            :label="permissionCountLabel"
          />
          <AppBadge
            tone="type"
            variant="outline"
            :label="userCountLabel"
          />
        </div>
      </div>
    </div>

    <div class="my-3 border-t border-dashed border-default" />

    <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <div class="min-w-0">
        <p class="text-muted">Descripción</p>
        <p class="mt-1 truncate font-medium text-default">{{ descriptionLabel }}</p>
      </div>
      <div class="min-w-0 text-right">
        <p class="text-muted">Creación</p>
        <p class="mt-1 truncate font-semibold text-default">{{ createdAtLabel }}</p>
      </div>
    </div>
  </article>
</template>
