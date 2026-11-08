import type { TableColumn } from '@nuxt/ui'
import type { PromotionResponse } from '../interfaces/promotion.types'
import {
  getStatusConfig,
  getTypeConfig,
  getMethodConfig,
} from '../utils/promotionStatusConfig.utils'
import { formatPromotionDate } from '../utils/promotionDate.utils'

export function usePromotionColumns() {
  const columns: TableColumn<PromotionResponse>[] = [
    // ── Select checkbox ──────────────────────────────────────────────
    // Header & cell rendered via #select-header / #select-cell slots
    // in PromotionsView.vue (NuxtUI components need template context)
    {
      id: 'select',
      header: '',
      enableSorting: false,
      enableHiding: false,
    },

    // ── Promoción: título (sortable) con el tipo como línea secundaria ──
    {
      accessorKey: 'title',
      header: 'Promoción',
      enableSorting: true,
    },

    // ── Estado — badge via getStatusConfig ────────────────────────────
    {
      accessorKey: 'status',
      header: 'Estado',
      enableSorting: false,
    },

    // ── Método — texto vía getMethodConfig ────────────────────────────
    {
      accessorKey: 'method',
      header: 'Método',
      enableSorting: false,
    },

    // ── Cupo — server-owned capacity (PCA-1) ──────────────────────────
    // Rendered via the #capacity-cell slot in PromotionsView.vue using the
    // single-responsibility PromotionCapacityStatus component. Not sortable:
    // the backend listing exposes no capacity sort key.
    {
      id: 'capacity',
      header: 'Cupo',
      enableSorting: false,
      // Room for the whole badge («Quedan 400 unidades») by default.
      size: 176,
    },

    // ── Fecha de inicio (sortable) ─────────────────────────────────────
    {
      accessorKey: 'startDate',
      header: 'Inicio',
      enableSorting: true,
      size: 112,
    },

    // ── Fecha de creación (sortable) ──────────────────────────────────
    {
      accessorKey: 'createdAt',
      header: 'Creada',
      enableSorting: true,
    },

    // ── Acciones ──────────────────────────────────────────────────────
    {
      id: 'actions',
      header: 'Acciones',
      enableHiding: false,
      enableSorting: false,
      meta: { class: { th: 'w-16', td: 'w-16 text-right' } },
    },
  ]

  return {
    columns,
    getStatusConfig,
    getTypeConfig,
    getMethodConfig,
    formatDate: formatPromotionDate,
  }
}
