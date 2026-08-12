import type { TableColumn } from '@nuxt/ui'
import type { PromotionResponse } from '../interfaces/promotion.types'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
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

    // ── Título (sortable) ─────────────────────────────────────────────
    {
      accessorKey: 'title',
      header: 'Título',
      enableSorting: true,
    },

    // ── Estado — badge via getStatusConfig ────────────────────────────
    {
      accessorKey: 'status',
      header: 'Estado',
      enableSorting: false,
    },

    // ── Tipo — badge via getTypeConfig ────────────────────────────────
    {
      accessorKey: 'type',
      header: 'Tipo',
      enableSorting: false,
    },

    // ── Método — badge via getMethodConfig ────────────────────────────
    {
      accessorKey: 'method',
      header: 'Método',
      enableSorting: false,
    },

    // ── Fecha de inicio (sortable) ─────────────────────────────────────
    {
      accessorKey: 'startDate',
      header: 'Inicio',
      enableSorting: true,
    },

    // ── Fecha de creación (sortable) ──────────────────────────────────
    {
      accessorKey: 'createdAt',
      header: 'Creada',
      enableSorting: true,
    },

    // ── Fecha de actualización (sortable) ─────────────────────────────
    {
      accessorKey: 'updatedAt',
      header: 'Actualizada',
      enableSorting: true,
    },

    // ── Acciones ──────────────────────────────────────────────────────
    {
      id: 'actions',
      header: createSimpleHeader(''),
      enableHiding: false,
      enableSorting: false,
      meta: { class: { td: 'text-right' } },
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
