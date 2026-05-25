import { defineFiltersSchema, filter, type FilterOption } from '@/core/shared/data-table-filters'

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
        { value: 'DRAFT', label: 'Borrador' },
        { value: 'CONFIRMED', label: 'Confirmada' },
        { value: 'CANCELED', label: 'Cancelada' },
      ] }),
    filter.multiEnum({ id: 'paymentStatus', section: 'Estado', label: 'Estado de pago', param: 'paymentStatus', options: [
        { value: 'PAID', label: 'Pagada' },
        { value: 'PARTIAL', label: 'Parcial' },
        { value: 'CREDIT', label: 'A crédito' },
      ] }),
    filter.multiEnum({ id: 'paymentMethod', section: 'Estado', label: 'Método de pago', param: 'paymentMethod', includeNull: { param: 'paymentMethodIncludeNull', label: 'Sin método' }, options: [
        { value: 'CASH', label: 'Efectivo' },
        { value: 'CARD_DEBIT', label: 'Tarjeta débito' },
        { value: 'CARD_CREDIT', label: 'Tarjeta crédito' },
        { value: 'TRANSFER', label: 'Transferencia' },
      ] }),
    filter.multiEnum({ id: 'deliveryStatus', section: 'Estado', label: 'Entrega', param: 'deliveryStatus', options: [
        { value: 'PENDING', label: 'Pendiente' },
        { value: 'DELIVERED', label: 'Entregada' },
      ] }),
    filter.multiAsync({ id: 'customerId', section: 'Personas', label: 'Cliente', param: 'customerId', includeNull: { param: 'customerIncludeNull', label: 'Incluir Público en General' }, options: sources.customerOptions, loading: sources.customerLoading, loadingLabel: 'Cargando clientes...', placeholder: 'Buscar cliente' }),
    filter.multiAsync({ id: 'cashierUserId', section: 'Personas', label: 'Cajero', param: 'cashierUserId', options: sources.cashierOptions, loading: sources.cashierLoading, loadingLabel: 'Cargando cajeros...', placeholder: 'Buscar cajero' }),
    filter.numericRange({ id: 'totalCents', section: 'Montos', label: 'Total', minParam: 'totalMin', maxParam: 'totalMax', unit: '$', formatAs: 'currency', step: 100 }),
    filter.numericRange({ id: 'debtCents', section: 'Montos', label: 'Deuda', minParam: 'debtMin', maxParam: 'debtMax', unit: '$', formatAs: 'currency', step: 100 }),
    filter.dateRange({ id: 'confirmedAt', section: 'Fechas', label: 'Fecha de venta', fromParam: 'confirmedFrom', toParam: 'confirmedTo', presets: true }),
    filter.dateRange({ id: 'dueDate', section: 'Fechas', label: 'Vencimiento', fromParam: 'dueDateFrom', toParam: 'dueDateTo', presets: true, includeNull: { param: 'dueDateIncludeNull', label: 'Incluir ventas sin vencimiento' } }),
  ])
}
