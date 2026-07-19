import { defineFiltersSchema, filter, type FilterOption } from '@/core/shared/data-table-filters'
import {
  SALE_DELIVERY_STATUS,
  SALE_PAYMENT_STATUS,
  SALE_STATUS,
  SALE_DETAIL_PAYMENT_METHOD,
} from '../constants/sale.constants' // sdd/magic-string-constants slice 3 — swap ONLY the `value` (logic) side, leave `label` (UI copy) untouched.

type SalesFilterSchemaSources = {
  customerOptions: FilterOption[]
  customerLoading: boolean
  cashierOptions: FilterOption[]
  cashierLoading: boolean
}

export function createSalesFiltersSchema(sources: SalesFilterSchemaSources) {
  return defineFiltersSchema([
    filter.multiText({ id: 'folio', label: 'Folio', param: 'folio', placeholder: 'Ej: #15, #16, 20', max: 200, parse: { stripPrefix: '#' } }),
    filter.multiEnum({ id: 'status', section: 'Estado', label: 'Estado', param: 'status', options: [
        { value: SALE_STATUS.DRAFT, label: 'Borrador' },
        { value: SALE_STATUS.CONFIRMED, label: 'Confirmada' },
        { value: SALE_STATUS.CANCELED, label: 'Cancelada' },
      ] }),
    filter.multiEnum({ id: 'paymentStatus', section: 'Estado', label: 'Estado de pago', param: 'paymentStatus', options: [
        { value: SALE_PAYMENT_STATUS.PAID, label: 'Pagada' },
        { value: SALE_PAYMENT_STATUS.PARTIAL, label: 'Parcial' },
        { value: SALE_PAYMENT_STATUS.CREDIT, label: 'A crédito' },
      ] }),
    filter.multiEnum({ id: 'paymentMethod', section: 'Estado', label: 'Método de pago', param: 'paymentMethod', includeNull: { param: 'paymentMethodIncludeNull', label: 'Sin método' }, options: [
        { value: SALE_DETAIL_PAYMENT_METHOD.CASH, label: 'Efectivo' },
        { value: SALE_DETAIL_PAYMENT_METHOD.CARD_DEBIT, label: 'Tarjeta débito' },
        { value: SALE_DETAIL_PAYMENT_METHOD.CARD_CREDIT, label: 'Tarjeta crédito' },
        { value: SALE_DETAIL_PAYMENT_METHOD.TRANSFER, label: 'Transferencia' },
      ] }),
    filter.multiEnum({ id: 'deliveryStatus', section: 'Estado', label: 'Entrega', param: 'deliveryStatus', options: [
        { value: SALE_DELIVERY_STATUS.PENDING, label: 'Pendiente' },
        { value: SALE_DELIVERY_STATUS.DELIVERED, label: 'Entregada' },
      ] }),
    filter.multiAsync({ id: 'customerId', section: 'Personas', label: 'Cliente', param: 'customerId', includeNull: { param: 'customerIncludeNull', label: 'Incluir Público en General' }, options: sources.customerOptions, loading: sources.customerLoading, loadingLabel: 'Cargando clientes...', placeholder: 'Buscar cliente' }),
    filter.multiAsync({ id: 'cashierUserId', section: 'Personas', label: 'Cajero', param: 'cashierUserId', options: sources.cashierOptions, loading: sources.cashierLoading, loadingLabel: 'Cargando cajeros...', placeholder: 'Buscar cajero' }),
    filter.numericRange({ id: 'totalCents', section: 'Montos', label: 'Total', minParam: 'totalMin', maxParam: 'totalMax', unit: '$', formatAs: 'currency', step: 100 }),
    filter.numericRange({ id: 'debtCents', section: 'Montos', label: 'Deuda', minParam: 'debtMin', maxParam: 'debtMax', unit: '$', formatAs: 'currency', step: 100 }),
    filter.dateRange({ id: 'confirmedAt', section: 'Fechas', label: 'Fecha de venta', fromParam: 'confirmedFrom', toParam: 'confirmedTo', presets: true }),
    filter.dateRange({ id: 'dueDate', section: 'Fechas', label: 'Vencimiento', fromParam: 'dueDateFrom', toParam: 'dueDateTo', presets: true, includeNull: { param: 'dueDateIncludeNull', label: 'Incluir ventas sin vencimiento' } }),
  ])
}
