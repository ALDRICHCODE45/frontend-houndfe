/**
 * `quotationFiltersSchema.ts` — REQ-QAF-015 / T-FE-04.
 *
 * `defineFiltersSchema` for the Quotations list slideover. Mirrors the
 * `salesFiltersSchema` pattern (customerId as a `multi-async` loaded from the
 * customer API). There is no status filter here: the list's status tabs are
 * the only status filter.
 *
 * The 4 filters:
 *   - `customerId` (multi-async, customer API) → `customerId`
 *   - `createdAt` (date-range) → `createdFrom` / `createdTo`
 *   - `expiresAt` (date-range) → `expiresFrom` / `expiresTo`
 *   - `totalCents` (numeric-range, currency, step 100) → `minTotalCents` / `maxTotalCents`
 *
 * The backend contract serializes arrays as CSV strings (Axios
 * `csvParamsSerializer`), so all multi-value fields naturally round-trip
 * `deserialize(serialize(state))` to themselves.
 */

import { defineFiltersSchema, filter, type FilterOption } from '@/core/shared/data-table-filters'

type QuotationFilterSchemaSources = {
  customerOptions: FilterOption[]
  customerLoading: boolean
}

export function createQuotationFiltersSchema(sources: QuotationFilterSchemaSources) {
  return defineFiltersSchema([
    filter.multiAsync({
      id: 'customerId',
      section: 'Personas',
      label: 'Cliente',
      param: 'customerId',
      options: sources.customerOptions,
      loading: sources.customerLoading,
      loadingLabel: 'Cargando clientes...',
      placeholder: 'Buscar cliente',
    }),
    filter.dateRange({
      id: 'createdAt',
      section: 'Fechas',
      label: 'Fecha de creación',
      fromParam: 'createdFrom',
      toParam: 'createdTo',
      presets: true,
    }),
    filter.dateRange({
      id: 'expiresAt',
      section: 'Fechas',
      label: 'Fecha de expiración',
      fromParam: 'expiresFrom',
      toParam: 'expiresTo',
      presets: true,
    }),
    filter.numericRange({
      id: 'totalCents',
      section: 'Montos',
      label: 'Total',
      minParam: 'minTotalCents',
      maxParam: 'maxTotalCents',
      unit: '$',
      formatAs: 'currency',
      step: 100,
    }),
  ])
}
