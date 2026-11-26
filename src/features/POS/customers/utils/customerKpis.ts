/**
 * The KPI strip of the customer page (customers-module T4, artboard 02): Deuda, Vencido, Total
 * comprado, Ticket promedio and Última compra. Every amount comes as is from the customer-wide
 * `summary` / `counts` of `GET /sales?customerId=` (handoff 28); nothing is added up here. The last
 * purchase is the newest sale of the first page (sorted by `confirmedAt` desc) that was not cancelled.
 */
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type {
  ConfirmedSaleRow,
  SaleListSummary,
  SalesListCounts,
} from '@/features/POS/sales/interfaces/sale.types'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import { formatSaleDueDate } from '@/features/POS/sales/utils/saleDate.utils'

export type CustomerKpiKey = 'debt' | 'overdue' | 'total' | 'average' | 'last'
export type CustomerKpiTone = 'neutral' | 'warning' | 'success'

export interface CustomerKpi {
  key: CustomerKpiKey
  label: string
  value: string
  note: string | null
  tone: CustomerKpiTone
}

/** A due day (`"YYYY-MM-DD"` or a midnight timestamp) read from its first 10 characters. */
export function formatDueDay(value: string): string {
  return formatSaleDueDate(value.slice(0, 10))
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

export function latestPurchase(rows: readonly ConfirmedSaleRow[] | undefined): ConfirmedSaleRow | null {
  return rows?.find((row) => row.status !== 'CANCELED' && !!row.confirmedAt) ?? null
}

export function buildCustomerKpis(
  summary: SaleListSummary,
  counts: SalesListCounts | undefined,
  latest: ConfirmedSaleRow | null,
): CustomerKpi[] {
  const kpis: CustomerKpi[] = []
  const hasDebt = summary.outstandingDebtCents > 0
  const pending = counts?.pendingPayments ?? 0

  kpis.push({
    key: 'debt',
    label: 'Deuda',
    value: formatCentsMXN(summary.outstandingDebtCents),
    note: hasDebt
      ? pending > 0 ? `${plural(pending, 'venta', 'ventas')} por cobrar` : null
      : 'Al corriente',
    tone: hasDebt ? 'warning' : 'success',
  })

  // Handoff 28 §2.2: absent on an older backend → the KPI is hidden, never shown as $0.
  if (typeof summary.overdueDebtCents === 'number') {
    const overdueCount = counts?.overdue ?? 0
    const isOverdue = summary.overdueDebtCents > 0 || overdueCount > 0
    const noteParts = isOverdue
      ? [
          overdueCount > 0 ? plural(overdueCount, 'vencida', 'vencidas') : null,
          summary.oldestOverdueDueDate ? `desde ${formatDueDay(summary.oldestOverdueDueDate)}` : null,
        ].filter(Boolean)
      : ['Nada vencido']
    kpis.push({
      key: 'overdue',
      label: 'Vencido',
      value: formatCentsMXN(summary.overdueDebtCents),
      note: noteParts.join(' · ') || null,
      tone: isOverdue ? 'warning' : 'neutral',
    })
  }

  kpis.push({
    key: 'total',
    label: 'Total comprado',
    value: formatCentsMXN(summary.totalSoldCents),
    note: plural(summary.salesCount, 'venta', 'ventas'),
    tone: 'neutral',
  })

  if (typeof summary.averageTicketCents === 'number') {
    kpis.push({
      key: 'average',
      label: 'Ticket promedio',
      value: formatCentsMXN(summary.averageTicketCents),
      note: 'por venta',
      tone: 'neutral',
    })
  }

  const confirmedAt = latest?.confirmedAt ? new Date(latest.confirmedAt) : null
  const hasDate = !!confirmedAt && !Number.isNaN(confirmedAt.getTime())
  kpis.push({
    key: 'last',
    label: 'Última compra',
    // An instant (not a due day): shown in the person's time zone, like the sale rows.
    value: hasDate ? format(confirmedAt!, 'd MMM yyyy', { locale: es }) : '—',
    note: hasDate ? (latest?.folio ?? null) : 'Sin compras',
    tone: 'neutral',
  })

  return kpis
}
