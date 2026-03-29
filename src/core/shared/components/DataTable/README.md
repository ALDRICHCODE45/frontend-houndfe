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
✅ **Slots para todo** — renderiza celdas y headers con template Vue puro

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
    ├── DataTableColumnHeader.ts      # Helper: createSimpleHeader
    ├── SortableHeader.vue            # Reusable sortable header button
    ├── SelectColumn.vue              # Reusable select checkbox (header + cell)
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

Las columnas solo definen estructura y configuración. **No uses `h()` ni `resolveComponent()` con componentes NuxtUI** — no funcionan porque NuxtUI se auto-importa solo en templates `.vue`.

```ts
// src/features/POS/products/composables/useProductColumns.ts
import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { Product } from '../interfaces/product.types'

export function useProductColumns() {
  const columns: TableColumn<Product>[] = [
    {
      id: 'select',
      header: '',
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: 'Nombre',
    },
    {
      accessorKey: 'sku',
      header: createSimpleHeader('SKU'),
    },
    {
      accessorKey: 'price',
      header: 'Precio',
      meta: { class: { th: 'text-right', td: 'text-right' } },
    },
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

Toda la lógica de renderizado de NuxtUI va en **template slots** donde auto-import funciona correctamente. Usa `SortableHeader` y `SelectColumn` para DRY:

```vue
<script setup lang="ts">
import { AppDataTable, SortableHeader, SelectColumn } from '@/core/shared/components/DataTable'
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
  persistKey: 'pos-products',
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
        <!-- ── Select (checkbox header + cell) ─────────── -->
        <template #select-header="{ table }">
          <SelectColumn mode="header" :table="table" />
        </template>
        <template #select-cell="{ row }">
          <SelectColumn mode="cell" :row="row" />
        </template>

        <!-- ── Sortable headers ────────────────────────── -->
        <template #name-header="{ column }">
          <SortableHeader :column="column" label="Nombre" />
        </template>
        <template #price-header="{ column }">
          <SortableHeader :column="column" label="Precio" />
        </template>

        <!-- ── Cell slots ──────────────────────────────── -->
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

### Sortable Header (via template slot)

In the column definition — just set the string label:

```ts
{
  accessorKey: 'name',
  header: 'Nombre', // Fallback text if slot is not provided
}
```

In the view template — use the `SortableHeader` component:

```vue
<template #name-header="{ column }">
  <SortableHeader :column="column" label="Nombre" />
</template>
```

### Select Checkbox Column (via template slots)

In the column definition:

```ts
{
  id: 'select',
  header: '',
  enableSorting: false,
  enableHiding: false,
}
```

In the view template — use the `SelectColumn` component:

```vue
<template #select-header="{ table }">
  <SelectColumn mode="header" :table="table" />
</template>
<template #select-cell="{ row }">
  <SelectColumn mode="cell" :row="row" />
</template>
```

### ⚠️ NUNCA uses h() con componentes NuxtUI

```ts
// ❌ MAL — NuxtUI components are auto-imported only in .vue templates
// resolveComponent('UButton') returns a string in external .ts files
import { h, resolveComponent } from 'vue'
const UButton = resolveComponent('UButton')
header: ({ column }) => h(UButton, { ... }) // renders NOTHING

// ✅ BIEN — Use template slots with reusable .vue components
// In column definition:
header: 'Nombre',

// In view template:
<template #name-header="{ column }">
  <SortableHeader :column="column" label="Nombre" />
</template>
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

1. **Usa template slots para CUALQUIER componente NuxtUI** — `h()` + `resolveComponent()` no funciona en Vite + NuxtUI
2. **Usa `SortableHeader` para headers con sort** — componente reutilizable, sin repetir código
3. **Usa `SelectColumn` para checkboxes de selección** — header + cell en un solo componente
4. **Usa `createSimpleHeader()` para headers estáticos** — retorna string puro, siempre funciona
5. **Define queryKeys en constants/** — facilita invalidación de cache
6. **Envuelve tablas en UCard** — con `px-6 py-5` para match con PF2 aesthetic
7. **Activa URL sync solo si tiene sentido** — no para modales o secciones colapsables
8. **Siempre pasa `persistKey`** — para localStorage de preferences (pinning, visibility)

## Ejemplo Real

Ver implementación completa en:

- `src/features/POS/products/` — ejemplo completo con todas las features

## Troubleshooting

### Headers no se muestran (invisibles)

**Problema:** Usaste `h(resolveComponent('UButton'), {...})` en un archivo `.ts`. `resolveComponent()` retorna un string (no un componente) fuera de `.vue` templates cuando se usa NuxtUI con `unplugin-vue-components`.

**Solución:** Usa template slots con `SortableHeader` o `SelectColumn`. Estos son componentes `.vue` donde NuxtUI auto-import funciona correctamente.

### Paginación no funciona

**Problema:** Usaste `v-model` en lugar de `v-model:page` en UPagination

**Solución:** UPagination usa named model `page`, no `modelValue` por defecto

### Flash al cambiar de página

**Problema:** No estás usando `keepPreviousData` en TanStack Query

**Solución:** `useServerTable` ya lo incluye por defecto, verifica que tu API retorne data rápido

### TypeScript errors en slots

**Problema:** `row.original` no tiene el tipo correcto

**Solución:** Pasa el tipo genérico a `TableColumn<Product>[]` en tu composable
