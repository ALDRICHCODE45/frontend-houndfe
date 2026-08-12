<script setup lang="ts">
/**
 * MemberCard — single-card view for an admin tenant member row.
 *
 * Mirrors the TenantCard pattern (article + EntityAvatar + name +
 * email + dashed divider + 2-col body) but exposes only the fields the
 * admin tenant members list cares about: userName, userEmail,
 * roleName, userIsActive, createdAt. Cards do NOT render a kebab or
 * checkbox — clicks open the edit slideover and table-level actions
 * (Editar / Eliminar) stay on the table row.
 *
 * The chip row holds the optional `userIsActive` status (Activo /
 * Inactivo) as the sole chip; the role lives in the body `Rol` column
 * (UserCard / TenantCard parity). When `userIsActive` is omitted on
 * the row the badge is not rendered at all — no fallback tone.
 */

import { computed } from 'vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import { activityToBadgeTone } from '@/core/shared/utils/badge.utils'
import type { MembershipTableRow } from '../interfaces/membership.types'

const props = defineProps<{
  member: MembershipTableRow
}>()

const emit = defineEmits<{
  click: [member: MembershipTableRow]
}>()

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const hasUserIsActive = computed(() => props.member.userIsActive !== undefined)
const statusLabel = computed(() => (props.member.userIsActive ? 'Activo' : 'Inactivo'))
const statusTone = computed(() => activityToBadgeTone(Boolean(props.member.userIsActive)))
const createdAtLabel = computed(() =>
  props.member.createdAt
    ? dateFormatter.format(new Date(props.member.createdAt))
    : '-',
)
const avatarSeed = computed(() => props.member.userId || props.member.id)
</script>

<template>
  <article
    class="group relative flex cursor-pointer flex-col rounded-xl border border-default bg-default px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    data-testid="member-card"
    @click="emit('click', member)"
  >
    <div class="flex items-start gap-3">
      <EntityAvatar
        :name="member.userName"
        :seed="avatarSeed"
        size="lg"
      />

      <div class="min-w-0 flex-1 space-y-1">
        <p class="line-clamp-2 text-sm font-semibold leading-tight text-highlighted">
          {{ member.userName }}
        </p>
        <p class="line-clamp-1 text-xs text-muted">{{ member.userEmail }}</p>
        <div class="flex min-h-6 flex-wrap items-center gap-1.5 pt-1">
          <StatusDotBadge
            v-if="hasUserIsActive"
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
        <p class="text-muted">Rol</p>
        <p class="mt-1 truncate font-medium text-default">{{ member.roleName }}</p>
      </div>
      <div class="min-w-0 text-right">
        <p class="text-muted">Fecha de ingreso</p>
        <p class="mt-1 truncate font-semibold text-default">{{ createdAtLabel }}</p>
      </div>
    </div>
  </article>
</template>