<script setup lang="ts">
/**
 * UserCard — single-card view for an admin user row.
 *
 * Mirrors the EmployeeCard pattern (article + EntityAvatar + name + email +
 * StatusDotBadge chip row + dashed divider + 2-col body) but exposes only
 * the fields the admin users list cares about: name, email, roles,
 * isActive, createdAt. Cards do NOT render a kebab or checkbox — clicks
 * open the edit slideover and table-level actions stay in the table view.
 *
 * The chip row holds the `isActive` status (Activo / Inactivo) as the
 * sole chip. Roles are summarized into a single comma-separated label in
 * the 2-col body so the card stays compact.
 */

import { computed } from 'vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import { activityToBadgeTone } from '@/core/shared/utils/badge.utils'
import type { UserTableRow } from '../interfaces/user.types'

const props = defineProps<{
  user: UserTableRow
}>()

const emit = defineEmits<{
  click: [user: UserTableRow]
}>()

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const statusLabel = computed(() => (props.user.isActive ? 'Activo' : 'Inactivo'))
const statusTone = computed(() => activityToBadgeTone(props.user.isActive))
const createdAtLabel = computed(() => dateFormatter.format(new Date(props.user.createdAt)))

const rolesLabel = computed(() => {
  if (props.user.roles.length === 0) return 'Sin roles'
  return props.user.roles.map((role) => role.name).join(', ')
})
</script>

<template>
  <article
    class="group relative flex cursor-pointer flex-col rounded-xl border border-default bg-default px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    data-testid="user-card"
    @click="emit('click', user)"
  >
    <div class="flex items-start gap-3">
      <EntityAvatar
        :name="user.name"
        :seed="user.id"
        size="lg"
      />

      <div class="min-w-0 flex-1 space-y-1">
        <p class="line-clamp-2 text-sm font-semibold leading-tight text-highlighted">
          {{ user.name }}
        </p>
        <p class="line-clamp-1 text-xs text-muted">{{ user.email }}</p>
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
        <p class="text-muted">Roles</p>
        <p class="mt-1 truncate font-medium text-default">{{ rolesLabel }}</p>
      </div>
      <div class="min-w-0 text-right">
        <p class="text-muted">Creación</p>
        <p class="mt-1 truncate font-semibold text-default">{{ createdAtLabel }}</p>
      </div>
    </div>
  </article>
</template>
