import type { FilterDefinition, FilterOption } from '@/core/shared/components/data-table-filters/types'

type SalesFilterSchemaSources = {
  customerOptions?: FilterOption[]
  cashierOptions?: FilterOption[]
  customersLoading?: boolean
  cashiersLoading?: boolean
}

export function createSalesFiltersSchema(sources: SalesFilterSchemaSources = {}): FilterDefinition[] {
  return [
    {
      id: 'folio',
      kind: 'multi-text',
      label: 'Folio',
      param: 'folio',
      placeholder: 'Ej: #15, #16, 20',
      max: 200,
      parse: { stripPrefix: '#' },
    },
    {
      id: 'status',
      kind: 'multi-enum',
      label: 'Estado',
      param: 'status',
      options: [
        { value: 'DRAFT', label: 'Borrador' },
        { value: 'CONFIRMED', label: 'Confirmada' },
        { value: 'CANCELED', label: 'Cancelada' },
      ],
    },
    {
      id: 'paymentStatus',
      kind: 'multi-enum',
      label: 'Estado de pago',
      param: 'paymentStatus',
      options: [
        { value: 'PAID', label: 'Pagada' },
        { value: 'PARTIAL', label: 'Parcial' },
        { value: 'CREDIT', label: 'A crédito' },
      ],
    },
    {
      id: 'paymentMethod',
      kind: 'multi-enum',
      label: 'Método de pago',
      param: 'paymentMethod',
      includeNull: { param: 'paymentMethodIncludeNull', label: 'Sin método' },
      options: [
        { value: 'CASH', label: 'Efectivo' },
        { value: 'CARD_DEBIT', label: 'Tarjeta débito' },
        { value: 'CARD_CREDIT', label: 'Tarjeta crédito' },
        { value: 'TRANSFER', label: 'Transferencia' },
      ],
    },
    {
      id: 'deliveryStatus',
      kind: 'multi-enum',
      label: 'Entrega',
      param: 'deliveryStatus',
      options: [
        { value: 'PENDING', label: 'Pendiente' },
        { value: 'DELIVERED', label: 'Entregada' },
        { value: 'NOT_APPLICABLE', label: 'No aplica' },
      ],
    },
    {
      id: 'customerId',
      kind: 'multi-async',
      label: 'Cliente',
      param: 'customerId',
      includeNull: { param: 'customerIncludeNull', label: 'Público en General' },
      options: sources.customerOptions ?? [],
      loading: sources.customersLoading,
      loadingLabel: 'Cargando clientes...',
      placeholder: 'Buscar cliente',
    },
    {
      id: 'cashierUserId',
      kind: 'multi-async',
      label: 'Cajero',
      param: 'cashierUserId',
      options: sources.cashierOptions ?? [],
      loading: sources.cashiersLoading,
      loadingLabel: 'Cargando cajeros...',
      placeholder: 'Buscar cajero',
    },
    {
      id: 'totalCents',
      kind: 'number-range',
      label: 'Total',
      minParam: 'totalMin',
      maxParam: 'totalMax',
      unit: 'cents',
    },
    {
      id: 'debtCents',
      kind: 'number-range',
      label: 'Deuda',
      minParam: 'debtMin',
      maxParam: 'debtMax',
      unit: 'cents',
    },
    {
      id: 'confirmedAt',
      kind: 'date-range',
      label: 'Fecha de venta',
      fromParam: 'confirmedFrom',
      toParam: 'confirmedTo',
    },
    {
      id: 'dueDate',
      kind: 'date-range',
      label: 'Vencimiento',
      fromParam: 'dueDateFrom',
      toParam: 'dueDateTo',
      includeNull: { param: 'dueDateIncludeNull', label: 'Sin vencimiento' },
    },
  ]
}

export const salesFiltersSchema = createSalesFiltersSchema()
