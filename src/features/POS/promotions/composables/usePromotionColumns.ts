import type { TableColumn } from '@nuxt/ui'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { PromotionResponse } from '../interfaces/promotion.types'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import {
  getStatusConfig,
  getTypeConfig,
  getMethodConfig,
} from '../utils/promotionStatusConfig.utils'

/**
 * Format ISO date string to human-readable format (timezone-safe).
 * Extracts the date part (YYYY-MM-DD) to avoid timezone offset issues
 * where "2026-04-01T00:00:00.000Z" could display as March 31 in local time.
 *
 * @param isoString - ISO date string or null
 * @returns Formatted date (e.g., "1 de abr 2026") or "—" if null
 */
function formatDate(isoString: string | null): string {
  if (!isoString) return '—'
  try {
    const datePart = isoString.slice(0, 10)
    const [year, month, day] = datePart.split('-').map(Number)
    if (!year || !month || !day) return '—'
    // Use noon to avoid any timezone boundary issues
    const date = new Date(year, month - 1, day, 12, 0, 0)
    return format(date, "d 'de' MMM yyyy", { locale: es })
  } catch {
    return '—'
  }
}

export function usePromotionColumns() {
  const columns: TableColumn<PromotionResponse>[] = [
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

  return { columns, getStatusConfig, getTypeConfig, getMethodConfig, formatDate }
}
