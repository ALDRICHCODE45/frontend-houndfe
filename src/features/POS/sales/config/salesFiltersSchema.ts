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
      section: 'Estado',
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
      section: 'Estado',
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
      section: 'Estado',
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
      section: 'Estado',
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
      section: 'Personas',
      label: 'Cliente',
      param: 'customerId',
      includeNull: { param: 'customerIncludeNull', label: 'Incluir Público en General' },
      options: sources.customerOptions ?? [],
      loading: sources.customersLoading,
      loadingLabel: 'Cargando clientes...',
      placeholder: 'Buscar cliente',
    },
    {
      id: 'cashierUserId',
      kind: 'multi-async',
      section: 'Personas',
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
      section: 'Montos',
      label: 'Total',
      minParam: 'totalMin',
      maxParam: 'totalMax',
      unit: 'cents',
    },
    {
      id: 'debtCents',
      kind: 'number-range',
      section: 'Montos',
      label: 'Deuda',
      minParam: 'debtMin',
      maxParam: 'debtMax',
      unit: 'cents',
    },
    {
      id: 'confirmedAt',
      kind: 'date-range',
      section: 'Fechas',
      label: 'Fecha de venta',
      fromParam: 'confirmedFrom',
      toParam: 'confirmedTo',
      presets: true,
    },
    {
      id: 'dueDate',
      kind: 'date-range',
      section: 'Fechas',
      label: 'Vencimiento',
      fromParam: 'dueDateFrom',
      toParam: 'dueDateTo',
      presets: true,
      includeNull: { param: 'dueDateIncludeNull', label: 'Incluir ventas sin vencimiento' },
    },
  ]
}

export const salesFiltersSchema = createSalesFiltersSchema()
