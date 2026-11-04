<script setup lang="ts" generic="T">
/**
 * AdminMobileCard — the mobile form of an admin list row (Mobile cards rules).
 *
 * The name is the primary text (a real button when the card opens something),
 * the ⋮ menu sits at the top-right, then an optional secondary line, an
 * optional badge row and a separated footer. The whole card opens the record
 * through `useClickableRow`; the ⋮ menu never does.
 *
 * Slots: `leading` (avatar), `title` (defaults to `label`), `secondary`,
 * `badges`, `footer`.
 */
import { computed, useSlots } from 'vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'

const props = defineProps<{
  item: T
  /** Names the row for assistive tech and is the default title. */
  label: string
  actions: RowAction[]
  /** The card (and its title) open the record; false for read-only roles. */
  openable?: boolean
  portalClass?: string
  testId?: string
}>()

const emit = defineEmits<{
  open: [item: T]
  action: [key: string, item: T]
}>()

const slots = useSlots()
const clickable = useClickableRow<T>((item) => emit('open', item), { focusable: false })
const rowProps = computed(() => (props.openable ? clickable.rowProps(props.item) : {}))
</script>

<template>
  <article v-bind="rowProps" class="admin-card" :data-testid="testId ?? 'admin-card'">
    <div class="admin-card-heading">
      <slot name="leading" />
      <div class="admin-card-title">
        <button
          v-if="openable"
          type="button"
          class="hf-row-primary admin-card-name"
          data-testid="admin-card-name"
          @click="emit('open', item)"
        >
          <slot name="title">{{ label }}</slot>
        </button>
        <span v-else class="hf-row-primary admin-card-name" data-testid="admin-card-name">
          <slot name="title">{{ label }}</slot>
        </span>
        <span v-if="slots.secondary" class="hf-row-secondary"><slot name="secondary" /></span>
      </div>
      <RowActionsMenu
        class="admin-card-menu"
        :actions="actions"
        :row-label="label"
        :portal-class="portalClass"
        @select="emit('action', $event, item)"
      />
    </div>
    <div v-if="slots.badges" class="admin-card-badges"><slot name="badges" /></div>
    <div v-if="slots.footer" class="admin-card-footer"><slot name="footer" /></div>
  </article>
</template>

<style scoped>
.admin-card {
  min-width: 0;
  border: 1px solid var(--hf-border);
  border-radius: 12px;
  background: var(--hf-surface);
  padding: 16px;
}
.admin-card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.admin-card-title {
  display: grid;
  flex: 1;
  min-width: 0;
}
.admin-card-name {
  text-align: left;
}
.admin-card-menu {
  flex-shrink: 0;
  margin: -8px -8px 0 0;
}
.admin-card-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.admin-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  border-top: 1px solid var(--hf-border);
  padding-top: 12px;
  color: var(--hf-muted);
  font-size: 13px;
}
</style>
