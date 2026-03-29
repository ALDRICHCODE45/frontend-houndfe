# DataTable System

Sistema completo de tablas con paginación, ordenamiento y filtrado del lado del servidor. Construido sobre **NuxtUI UTable** + **TanStack Vue Table** + **TanStack Vue Query**.

## Stack

- **NuxtUI v4** — componentes UI (UTable, UButton, UCheckbox, UCard, UBadge, etc.)
- **TanStack Vue Table** — lógica de tabla headless (sorting, pagination, row selection)
- **TanStack Vue Query** — data fetching con cache, refetch automático, keepPreviousData
- **Vue Router** (opcional) — sincronización de estado con URL query params

## Características

✅ **Server-side por defecto** — manualPagination, manualSorting  
✅ **keepPreviousData** — sin flash entre páginas  
✅ **Búsqueda global debounced** — 300ms delay automático  
✅ **Smart page size change** — mantiene posición visible al cambiar tamaño de página  
✅ **URL sync (opt-in)** — ?page=2&sort=name:asc&q=laptop  
✅ **Column visibility** — show/hide con localStorage persistence  
✅ **Column pinning** — left/right sticky columns  
✅ **Row selection** — checkboxes + bulk actions  
✅ **Bulk actions** — sticky bottom bar con animación  
✅ **Loading states** — carousel animation en header + fetching indicator  
✅ **Slots para todo** — renderiza celdas con template Vue puro

## Arquitectura

```
src/core/shared/
├── types/table.types.ts              # Tipos compartidos
├── constants/query-keys.ts           # Factories de query keys
├── composables/
│   ├── useServerTable.ts             # ⭐ Composable principal
│   ├── useTablePreferences.ts        # localStorage (pinning, visibility)
│   └── useTableUrlSync.ts            # URL query params sync
└── components/DataTable/
    ├── AppDataTable.vue              # Wrapper principal
    ├── DataTableToolbar.vue          # Search + refresh + filters + actions
    ├── DataTablePagination.vue       # UPagination + page size selector
    ├── DataTableBulkActions.vue      # Sticky bottom bar
    ├── DataTableColumnHeader.ts      # Helpers: createSimpleHeader, createSortableHeader
    └── index.ts                      # Exports
```

## Quick Start

### 1. Define el modelo de datos

```ts
// src/features/POS/products/interfaces/product.types.ts
export interface Product {
  id: string
  name: string
  sku: string
  category: string
  price: number
  stock: number
  status: 'active' | 'inactive' | 'out_of_stock'
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
    pageCount: number
  }
}
```

### 2. Crea el API

```ts
// src/features/POS/products/api/product.api.ts
import type { ServerTableParams } from '@/core/shared/types/table.types'
import type { Product, PaginatedResponse } from '../interfaces/product.types'

export const productApi = {
  async getPaginated(params: ServerTableParams): Promise<PaginatedResponse<Product>> {
    // Implementa tu lógica de fetch aquí
    // params contiene: page, pageSize, sort, q (global filter)
    const response = await fetch('/api/products', {
      method: 'POST',
      body: JSON.stringify(params),
    })
    return response.json()
  },
}
```

### 3. Define las columnas

```ts
// src/features/POS/products/composables/useProductColumns.ts
import { resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader, createSortableHeader } from '@/core/shared/components/DataTable'
import type { Product } from '../interfaces/product.types'

export function useProductColumns() {
  // resolveComponent solo para elementos que necesitan h():
  // - Headers con sort (dependen del estado de columna en runtime)
  // - Select checkbox (estado indeterminate/checked)
  const UButton = resolveComponent('UButton')
  const UCheckbox = resolveComponent('UCheckbox')

  const columns: TableColumn<Product>[] = [
    // ── Select checkbox (OBLIGATORIO usar h()) ───────────────
    {
      id: 'select',
      header: ({ table }) =>
        h(UCheckbox, {
          modelValue: table.getIsSomePageRowsSelected()
            ? 'indeterminate'
            : table.getIsAllPageRowsSelected(),
          'onUpdate:modelValue': (value) => table.toggleAllPageRowsSelected(!!value),
          ariaLabel: 'Seleccionar todos',
        }),
      cell: ({ row }) =>
        h(UCheckbox, {
          modelValue: row.getIsSelected(),
          'onUpdate:modelValue': (value) => row.toggleSelected(!!value),
          ariaLabel: 'Seleccionar fila',
        }),
      enableSorting: false,
      enableHiding: false,
    },

    // ── Nombre (sortable) ─────────────────────────────────────
    {
      accessorKey: 'name',
      header: ({ column }) => createSortableHeader(column, 'Nombre', UButton),
      // Cell usa slot #name-cell en el componente padre
    },

    // ── SKU (simple) ──────────────────────────────────────────
    {
      accessorKey: 'sku',
      header: createSimpleHeader('SKU'),
      // Cell usa slot #sku-cell en el componente padre
    },

    // ── Precio (sortable + aligned) ───────────────────────────
    {
      accessorKey: 'price',
      header: ({ column }) => createSortableHeader(column, 'Precio', UButton),
      meta: { class: { th: 'text-right', td: 'text-right' } },
    },

    // ── Acciones ──────────────────────────────────────────────
    {
      id: 'actions',
      header: createSimpleHeader(''),
      enableHiding: false,
      enableSorting: false,
      meta: { class: { td: 'text-right' } },
    },
  ]

  return { columns }
}
```

### 4. Usa la tabla en tu view

```vue
<script setup lang="ts">
import { AppDataTable } from '@/core/shared/components/DataTable'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import { productApi } from '../api/product.api'
import { useProductColumns } from '../composables/useProductColumns'
import type { Product } from '../interfaces/product.types'

const { columns } = useProductColumns()

const {
  pagination,
  sorting,
  globalFilter,
  rowSelection,
  columnPinning,
  columnVisibility,
  data,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  refresh,
  pageSizeOptions,
  showingFrom,
  showingTo,
} = useServerTable<Product>({
  queryKey: productQueryKeys.paginated(),
  queryFn: (params) => productApi.getPaginated(params),
  defaultPageSize: 10,
  persistKey: 'pos-products', // localStorage key
  defaultSorting: [{ id: 'name', desc: false }],
  defaultPinning: { left: [], right: ['actions'] },
})

const bulkActions = [
  {
    id: 'delete',
    label: 'Eliminar',
    icon: 'i-lucide-trash-2',
    variant: 'destructive',
    onClick: (rows) => console.log('Delete:', rows),
  },
]
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <div class="px-6 py-5">
      <AppDataTable
        v-model:sorting="sorting"
        v-model:pagination="pagination"
        v-model:global-filter="globalFilter"
        v-model:column-pinning="columnPinning"
        v-model:column-visibility="columnVisibility"
        v-model:row-selection="rowSelection"
        :columns="columns"
        :data="data"
        :loading="isLoading"
        :fetching="isFetching"
        :page-count="pageCount"
        :total-count="totalCount"
        :showing-from="showingFrom"
        :showing-to="showingTo"
        :page-size-options="pageSizeOptions"
        :bulk-actions="bulkActions"
        search-placeholder="Buscar productos..."
        show-add-button
        add-button-text="Nuevo Producto"
        enable-column-visibility
        enable-row-selection
        @add="handleAdd"
        @refresh="refresh"
      >
        <!-- ── Slots para celdas (Vue template puro) ──── -->
        <template #name-cell="{ row }">
          <span>{{ row.original.name }}</span>
        </template>

        <template #sku-cell="{ row }">
          <span class="font-mono text-xs text-muted">{{ row.original.sku }}</span>
        </template>

        <template #price-cell="{ row }">
          <span class="font-medium tabular-nums">
            {{ currencyFormatter.format(row.original.price) }}
          </span>
        </template>

        <template #actions-cell="{ row }">
          <UDropdownMenu :items="getRowItems(row.original)">
            <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" />
          </UDropdownMenu>
        </template>
      </AppDataTable>
    </div>
  </UCard>
</template>
```

## Column Header Patterns

### Simple Header (no sortable)

```ts
{
  accessorKey: 'sku',
  header: createSimpleHeader('SKU'),
}
```

### Sortable Header (con botón de toggle)

```ts
{
  accessorKey: 'name',
  header: ({ column }) => createSortableHeader(column, 'Nombre', UButton),
}
```

### Sortable Header con Dropdown (Asc/Desc con checkboxes)

```ts
{
  accessorKey: 'price',
  header: ({ column }) => createSortableHeaderDropdown(column, 'Precio', UButton, UDropdownMenu),
}
```

### ⚠️ NUNCA uses strings directos

```ts
// ❌ MAL — no se renderiza en NuxtUI UTable
{
  accessorKey: 'sku',
  header: 'SKU',
}

// ✅ BIEN
{
  accessorKey: 'sku',
  header: createSimpleHeader('SKU'),
}
```

## URL Sync

Para sincronizar el estado de la tabla con URL query params:

```ts
useServerTable<Product>({
  queryKey: productQueryKeys.paginated(),
  queryFn: (params) => productApi.getPaginated(params),
  persistKey: 'pos-products',
  urlSync: true, // ← Activa sync con URL
})
```

Esto genera URLs como:

```
/pos/products?page=2&sort=name:asc&q=laptop
```

## Customización de Celdas

### Con Slots (RECOMENDADO)

```vue
<template #status-cell="{ row }">
  <UBadge :color="getStatusColor(row.original.status)" variant="outline">
    {{ getStatusLabel(row.original.status) }}
  </UBadge>
</template>
```

### Con h() (solo para casos dinámicos complejos)

```ts
{
  accessorKey: 'status',
  cell: ({ row }) => h(UBadge, {
    color: getStatusColor(row.original.status),
    variant: 'outline',
  }, () => getStatusLabel(row.original.status)),
}
```

## Tipos Importantes

```ts
// De @/core/shared/types/table.types

export interface ServerTableParams {
  page: number
  pageSize: number
  sort?: string // formato: "name:asc" o "price:desc"
  q?: string // global filter
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
    pageCount: number
  }
}

export interface BulkAction<T> {
  id: string
  label: string
  icon?: string
  variant?: 'default' | 'destructive'
  onClick: (rows: T[]) => void | Promise<void>
}
```

## Mejores Prácticas

1. **Usa `createSimpleHeader()` para headers sin sort** — previene el bug de strings
2. **Usa slots para celdas complejas** — más legible que h()
3. **Solo usa h() para:** select checkbox y sortable headers (dependen de estado runtime)
4. **Define queryKeys en constants/** — facilita invalidación de cache
5. **Envuelve tablas en UCard** — con `px-6 py-5` para match con PF2 aesthetic
6. **Usa `variant="outline"` para badges** — más pastel/sutil que `variant="subtle"`
7. **Activa URL sync solo si tiene sentido** — no para modales o secciones colapsables
8. **Siempre pasa `persistKey`** — para localStorage de preferences (pinning, visibility)

## Ejemplo Real

Ver implementación completa en:

- `src/features/POS/products/` — ejemplo completo con todas las features

## Troubleshooting

### Headers no muestran texto

**Problema:** Definiste `header: 'String'` en lugar de `header: createSimpleHeader('String')`

**Solución:** Usa siempre helpers `createSimpleHeader()` o `createSortableHeader()`

### Paginación no funciona

**Problema:** Usaste `v-model` en lugar de `v-model:page` en UPagination

**Solución:** UPagination usa named model `page`, no `modelValue` por defecto

### Flash al cambiar de página

**Problema:** No estás usando `keepPreviousData` en TanStack Query

**Solución:** `useServerTable` ya lo incluye por defecto, verifica que tu API retorne data rápido

### TypeScript errors en slots

**Problema:** `row.original` no tiene el tipo correcto

**Solución:** Pasa el tipo genérico a `TableColumn<Product>[]` en tu composable
