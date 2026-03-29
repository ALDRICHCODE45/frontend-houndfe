<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    globalFilter: string
    searchPlaceholder?: string
    showAddButton?: boolean
    addButtonText?: string
    addButtonIcon?: string
    showColumnVisibility?: boolean
    showRefresh?: boolean
    fetching?: boolean
  }>(),
  {
    searchPlaceholder: 'Buscar...',
    addButtonText: 'Agregar',
    addButtonIcon: 'i-lucide-plus',
    showColumnVisibility: false,
    showRefresh: false,
    fetching: false,
  },
)

const emit = defineEmits<{
  'update:globalFilter': [value: string]
  add: []
  refresh: []
}>()

// Table API injection for column visibility — provided by parent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tableApi = defineModel<any>('tableApi')

/** Capitalize first letter of a string */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex flex-1 items-center gap-2">
      <!-- Search Input -->
      <UInput
        :model-value="props.globalFilter"
        :placeholder="props.searchPlaceholder"
        icon="i-lucide-search"
        class="max-w-sm"
        @update:model-value="emit('update:globalFilter', $event as string)"
      />

      <!-- Extra filter slots -->
      <slot name="filters" />
    </div>

    <div class="flex items-center gap-2">
      <!-- Refresh Button -->
      <UTooltip v-if="showRefresh" text="Refrescar">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          :loading="fetching"
          @click="emit('refresh')"
        />
      </UTooltip>

      <!-- Column Visibility Dropdown -->
      <UDropdownMenu
        v-if="showColumnVisibility && tableApi"
        :items="
          tableApi
            .getAllColumns()
            .filter((col: any) => col.getCanHide())
            .map((col: any) => ({
              label: capitalize(col.id),
              type: 'checkbox' as const,
              checked: col.getIsVisible(),
              onUpdateChecked: (checked: boolean) => col.toggleVisibility(!!checked),
              onSelect: (e: Event) => e.preventDefault(),
            }))
        "
        :content="{ align: 'end' as const }"
      >
        <UButton
          color="neutral"
          variant="outline"
          label="Columnas"
          trailing-icon="i-lucide-chevron-down"
        />
      </UDropdownMenu>

      <!-- Add Button -->
      <UButton
        v-if="showAddButton"
        :label="addButtonText"
        :icon="addButtonIcon"
        @click="emit('add')"
      />

      <!-- Extra action slots -->
      <slot name="actions" />
    </div>
  </div>
</template>
