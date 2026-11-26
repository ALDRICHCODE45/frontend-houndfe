/**
 * The KPI strip of the customer page (customers-module T4 artboard 02, T5 data): Deuda, Vencido,
 * Total comprado, Ticket promedio and Última compra. Every amount comes as is from
 * `GET /customers/:customerId/sales-summary` (handoff 32 §5, same rules as the listing row); nothing
 * is added up here. Without sales the backend sends zeros and `null` average / last purchase.
 */
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import { formatSaleDueDate } from '@/features/POS/sales/utils/saleDate.utils'
import type { CustomerSalesMetrics } from '../interfaces/customer.types'

export type CustomerKpiKey = 'debt' | 'overdue' | 'total' | 'average' | 'last'
export type CustomerKpiTone = 'neutral' | 'warning' | 'success'

export interface CustomerKpi {
  key: CustomerKpiKey
  label: string
  value: string
  note: string | null
  tone: CustomerKpiTone
}

const EMPTY = '—'

/** A due day (`"YYYY-MM-DD"` or a midnight timestamp) read from its first 10 characters. */
export function formatDueDay(value: string): string {
  return formatSaleDueDate(value.slice(0, 10))
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

export function buildCustomerKpis(metrics: CustomerSalesMetrics): CustomerKpi[] {
  const hasDebt = metrics.openDebtCents > 0
  const isOverdue = metrics.overdueDebtCents > 0 || metrics.overdueCount > 0
  const overdueNote = isOverdue
    ? [
        metrics.overdueCount > 0 ? plural(metrics.overdueCount, 'vencida', 'vencidas') : null,
        metrics.oldestOverdueDueDate ? `desde ${formatDueDay(metrics.oldestOverdueDueDate)}` : null,
      ].filter(Boolean).join(' · ') || null
    : 'Nada vencido'

  const lastPurchase = metrics.lastPurchaseAt ? new Date(metrics.lastPurchaseAt) : null
  const hasLastPurchase = !!lastPurchase && !Number.isNaN(lastPurchase.getTime())
  const hasAverage = typeof metrics.averageTicketCents === 'number'

  return [
    {
      key: 'debt',
      label: 'Deuda',
      value: formatCentsMXN(metrics.openDebtCents),
      note: hasDebt ? 'Por cobrar' : 'Al corriente',
      tone: hasDebt ? 'warning' : 'success',
    },
    {
      key: 'overdue',
      label: 'Vencido',
      value: formatCentsMXN(metrics.overdueDebtCents),
      note: overdueNote,
      tone: isOverdue ? 'warning' : 'neutral',
    },
    {
      key: 'total',
      label: 'Total comprado',
      value: formatCentsMXN(metrics.totalSoldCents),
      note: plural(metrics.salesCount, 'venta', 'ventas'),
      tone: 'neutral',
    },
    {
      key: 'average',
      label: 'Ticket promedio',
      value: hasAverage ? formatCentsMXN(metrics.averageTicketCents as number) : EMPTY,
      note: hasAverage ? 'por venta' : 'Sin ventas',
      tone: 'neutral',
    },
    {
      key: 'last',
      label: 'Última compra',
      // An instant (not a due day): shown in the person's time zone, like the sale rows.
      value: hasLastPurchase ? format(lastPurchase!, 'd MMM yyyy', { locale: es }) : EMPTY,
      note: hasLastPurchase ? null : 'Sin compras',
      tone: 'neutral',
    },
  ]
}
