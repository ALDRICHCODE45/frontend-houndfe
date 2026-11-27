/**
 * customers-module T6 (S3, artboard 01): the filters sheet of the customers table on top of the
 * shared data-table-filters engine, the same one as Ventas. Every filter maps 1:1 to a
 * GET /customers/listing param (handoff 32 §2.3); ids equal the param, or the range name for
 * ranges (`openDebt` → openDebtMin/Max), which is also the `field` of LISTING_INVERTED_RANGE.
 *
 * Money ranges hold cents and are shown in pesos by the shared NumericRangeFilter
 * (`formatAs: 'currency'` divides by 100). Without read:Sale the money and purchase filters are not
 * in the schema at all, so neither the sheet nor a stale URL can send a metric param.
 */
import { defineFiltersSchema, filter, type FilterDefinition, type FilterOption } from '@/core/shared/data-table-filters'
import { PET_SIZE_LABELS } from '../pets/petForm'
import type { PetSize } from '../pets/pet.types'
import type { CustomerListingOptionField } from '../interfaces/customer-listing.types'

export interface CustomersFilterSources {
  canReadSales: boolean
  priceListOptions: FilterOption[]
  priceListLoading: boolean
  /** Options of GET /customers/listing/options per field («Del Valle (41)»). */
  locationOptions: Record<CustomerListingOptionField, FilterOption[]>
  locationLoading: boolean
}

/** The filters that need read:Sale (handoff 32 §2.6: the 16 metric params). */
export const CUSTOMERS_METRIC_FILTER_IDS = [
  'hasDebt',
  'openDebt',
  'hasOverdue',
  'overdueMoreThanDays',
  'oldestOverdue',
  'totalSold',
  'salesCount',
  'averageTicket',
  'lastPurchase',
  'noPurchaseMoreThanDays',
] as const

/** Filter labels by id, shared with the error sentences. */
export const CUSTOMERS_FILTER_LABELS: Record<string, string> = {
  hasDebt: 'Con deuda',
  openDebt: 'Monto de deuda',
  hasOverdue: 'Con ventas vencidas',
  overdueMoreThanDays: 'Vencida hace más de',
  oldestOverdue: 'Vencimiento más viejo',
  totalSold: 'Total comprado',
  salesCount: 'Número de compras',
  averageTicket: 'Ticket promedio',
  lastPurchase: 'Última compra',
  noPurchaseMoreThanDays: 'Sin comprar hace más de',
  created: 'Cliente desde',
  petSpecies: 'Especie',
  petSize: 'Tamaño de mascota',
  activePets: 'Número de mascotas',
  hasPets: 'Con mascotas',
  neighborhood: 'Colonia',
  municipality: 'Municipio',
  city: 'Ciudad',
  zipCode: 'Código postal',
  deliveryZoneType: 'Zona de reparto',
  priceListId: 'Lista de precios',
  isTrusted: 'Cliente de confianza',
  hasRfc: 'Datos fiscales',
  fiscalRegime: 'Régimen fiscal',
  hasEmail: 'Correo',
  hasPhone: 'Teléfono',
  hasChatbotRequests: 'Solicitudes del chatbot',
}

const DAYS_OPTIONS: FilterOption[] = [
  { label: '30 días', value: '30' },
  { label: '60 días', value: '60' },
  { label: '90 días', value: '90' },
]

// Same order and words as the pets module («Otra» there names a species the customer typed).
const SPECIES_OPTIONS: FilterOption[] = [
  { label: 'Perro', value: 'DOG' },
  { label: 'Gato', value: 'CAT' },
  { label: 'Otra', value: 'OTHER' },
]

const SIZE_OPTIONS: FilterOption[] = (Object.keys(PET_SIZE_LABELS) as PetSize[]).map(size => ({
  label: PET_SIZE_LABELS[size],
  value: size,
}))

// The delivery zone types of the branch (`DeliveryZoneType`), labelled as in Zonas de reparto.
const ZONE_OPTIONS: FilterOption[] = [
  { label: 'Envío gratis', value: 'FREE' },
  { label: 'Con cargo', value: 'SURCHARGE' },
  { label: 'Solo paquetería', value: 'CARRIER_ONLY' },
  { label: 'Sin entrega', value: 'DENIED' },
]

const label = (id: string) => CUSTOMERS_FILTER_LABELS[id]!
const money = (id: string, section: string, min: string, max: string) =>
  filter.numericRange({ id, section, label: label(id), minParam: min, maxParam: max, unit: '$', formatAs: 'currency', step: 100 })
const count = (id: string, section: string, min: string, max: string) =>
  filter.numericRange({ id, section, label: label(id), minParam: min, maxParam: max, unit: '', formatAs: 'plain', step: 1 })
const dates = (id: string, section: string, from: string, to: string) =>
  filter.dateRange({ id, section, label: label(id), fromParam: from, toParam: to, presets: true })
const flag = (id: string, section: string, trueLabel?: string, falseLabel?: string) =>
  filter.booleanFlag({ id, section, label: label(id), trueLabel, falseLabel, placeholder: 'Todos' })

export function createCustomersFiltersSchema(sources: CustomersFilterSources) {
  const { locationOptions: options, locationLoading: loading } = sources
  const location = (id: CustomerListingOptionField, placeholder: string) =>
    filter.multiAsync({
      id,
      section: 'Ubicación',
      label: label(id),
      param: id,
      options: options[id],
      loading,
      loadingLabel: 'Cargando opciones...',
      placeholder,
    })

  const debt: FilterDefinition[] = [
    flag('hasDebt', 'Deuda'),
    money('openDebt', 'Deuda', 'openDebtMin', 'openDebtMax'),
    flag('hasOverdue', 'Deuda'),
    filter.singleEnum({ id: 'overdueMoreThanDays', section: 'Deuda', label: label('overdueMoreThanDays'), options: DAYS_OPTIONS }),
    dates('oldestOverdue', 'Deuda', 'oldestOverdueFrom', 'oldestOverdueTo'),
  ]
  const purchases: FilterDefinition[] = [
    money('totalSold', 'Compras', 'totalSoldMin', 'totalSoldMax'),
    count('salesCount', 'Compras', 'salesCountMin', 'salesCountMax'),
    money('averageTicket', 'Compras', 'averageTicketMin', 'averageTicketMax'),
    dates('lastPurchase', 'Compras', 'lastPurchaseFrom', 'lastPurchaseTo'),
    // Includes the customers who never bought (handoff 32 §2.3.2).
    filter.singleEnum({ id: 'noPurchaseMoreThanDays', section: 'Compras', label: label('noPurchaseMoreThanDays'), options: DAYS_OPTIONS }),
  ]

  return defineFiltersSchema([
    ...(sources.canReadSales ? [...debt, ...purchases] : []),
    dates('created', 'Compras', 'createdFrom', 'createdTo'),

    filter.multiEnum({ id: 'petSpecies', section: 'Mascotas', label: label('petSpecies'), param: 'petSpecies', options: SPECIES_OPTIONS }),
    filter.multiEnum({ id: 'petSize', section: 'Mascotas', label: label('petSize'), param: 'petSize', options: SIZE_OPTIONS }),
    count('activePets', 'Mascotas', 'activePetsMin', 'activePetsMax'),
    flag('hasPets', 'Mascotas', 'Con mascotas', 'Sin mascotas'),

    location('neighborhood', 'Buscar colonia'),
    location('municipality', 'Buscar municipio'),
    location('city', 'Buscar ciudad'),
    location('zipCode', 'Buscar código postal'),
    filter.multiEnum({
      id: 'deliveryZoneType',
      section: 'Ubicación',
      label: label('deliveryZoneType'),
      param: 'deliveryZoneType',
      options: ZONE_OPTIONS,
      includeNull: { param: 'deliveryZoneNone', label: 'Sin zona' },
    }),

    filter.multiAsync({
      id: 'priceListId',
      section: 'Comercial y contacto',
      label: label('priceListId'),
      param: 'priceListId',
      options: sources.priceListOptions,
      loading: sources.priceListLoading,
      loadingLabel: 'Cargando listas...',
      placeholder: 'Todas',
      includeNull: { param: 'priceListIncludeNull', label: 'Sin lista' },
    }),
    flag('isTrusted', 'Comercial y contacto'),
    flag('hasRfc', 'Comercial y contacto', 'Con RFC', 'Sin RFC'),
    filter.multiAsync({
      id: 'fiscalRegime',
      section: 'Comercial y contacto',
      label: label('fiscalRegime'),
      param: 'fiscalRegime',
      options: options.fiscalRegime,
      loading,
      loadingLabel: 'Cargando opciones...',
      placeholder: 'Cualquiera',
    }),
    flag('hasEmail', 'Comercial y contacto', 'Con correo', 'Sin correo'),
    flag('hasPhone', 'Comercial y contacto', 'Con teléfono', 'Sin teléfono'),
    flag('hasChatbotRequests', 'Comercial y contacto'),
  ])
}
