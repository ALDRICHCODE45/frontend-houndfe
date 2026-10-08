/**
 * Synthetic fixtures for the T4 isolated browser acceptance of the
 * delivery-route create selector + draft-to-draft stop transfer.
 *
 * Everything here is synthetic: no production tenant, sale, route, driver,
 * customer or address is used. IDs are valid UUIDv4 so the create/transfer
 * request schemas accept them. All payloads are pinned so each spec reads on
 * its own and the strict `/__e2e-api` network fixture can assert exact bodies.
 *
 * The shapes mirror the app contract (no app imports — the e2e tree stays
 * decoupled from `src/`):
 *   - `GET /delivery-routes/eligible-sales` → `{ data, pagination }`
 *   - `GET /delivery-routes?status=DRAFT`   → `DeliveryRouteResponseDto[]`
 *   - `GET /users/assignable-drivers`       → `{ id, name }[]`
 *   - `POST /delivery-routes` 409          → flat `{ error, conflictSaleIds }`
 *   - `POST /delivery-routes/:id/stops/:stopId/transfer` → `{ originRoute, destinationRoute }`
 */
import { RESPONSIVE_VIEWPORTS, type ViewportCase } from '../targets/types'

const viewportByKey = (key: ViewportCase['key']): ViewportCase => {
  const found = RESPONSIVE_VIEWPORTS.find((candidate) => candidate.key === key)
  if (!found) throw new Error(`unknown responsive viewport: ${key}`)
  return found
}

/** Desktop shell + phone width — the two-width matrix for this acceptance slice. */
export const DELIVERY_ROUTE_BROWSER_VIEWPORTS: Readonly<Record<'desktop' | 'mobile', ViewportCase>> =
  Object.freeze({
    desktop: viewportByKey('shell-1024'),
    mobile: viewportByKey('phone-375'),
  })

/**
 * Manager seed: `read:DeliveryRoute` opens the route, `create:DeliveryRoute`
 * makes the manager branch (not the driver cockpit) render, `update` enables
 * the per-stop "Mover"/append affordances, and `read:Sale` matches the
 * eligible-sales endpoint's documented requirement.
 */
export const DELIVERY_ROUTE_MANAGER_PERMISSIONS: readonly string[] = Object.freeze([
  'read:DeliveryRoute',
  'create:DeliveryRoute',
  'update:DeliveryRoute',
  'read:Sale',
])

// ─── Synthetic identifiers (all valid UUIDv4) ─────────────────────────────────
export const SYNTHETIC_SALE_IDS = Object.freeze({
  ana: '5a1e0000-0000-4000-8000-000000000001',
  lookAlike: '5a1e0000-0000-4000-8000-000000000002',
  occupied: '5a1e0000-0000-4000-8000-000000000003',
  missingAddress: '5a1e0000-0000-4000-8000-000000000004',
  pageTwo: '5a1e0000-0000-4000-8000-000000000005',
  searchOnly: '5a1e0000-0000-4000-8000-000000000006',
})

export const SYNTHETIC_ROUTE_IDS = Object.freeze({
  origin: 'a1000000-0000-4000-8000-0000000000a1',
  destination: 'b2000000-0000-4000-8000-0000000000b2',
  spare: 'c3000000-0000-4000-8000-0000000000c3',
})

export const SYNTHETIC_DRIVER_IDS = Object.freeze({
  one: 'd1000000-0000-4000-8000-0000000000d1',
  two: 'd2000000-0000-4000-8000-0000000000d2',
  three: 'd3000000-0000-4000-8000-0000000000d3',
})

export const SYNTHETIC_STOP_IDS = Object.freeze({
  originStop: 'f1000000-0000-4000-8000-0000000000f1',
  destinationStop: 'f2000000-0000-4000-8000-0000000000f2',
})

// ─── Eligible sales rows ──────────────────────────────────────────────────────
interface SyntheticAddress {
  id: string
  label: string | null
  street: string | null
  exteriorNumber: string | null
  interiorNumber: string | null
  zipCode: string | null
  neighborhood: string | null
  municipality: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
}

const address = (overrides: Partial<SyntheticAddress> = {}): SyntheticAddress => ({
  id: 'a0000000-0000-4000-8000-0000000000a0',
  label: null,
  street: null,
  exteriorNumber: null,
  interiorNumber: null,
  zipCode: null,
  neighborhood: null,
  municipality: null,
  city: null,
  state: null,
  latitude: null,
  longitude: null,
  ...overrides,
})

const ANA_ADDRESS = address({
  label: 'Casa',
  street: 'Av. Reforma',
  exteriorNumber: '100',
  neighborhood: 'Centro',
  municipality: 'Cuauhtémoc',
  city: 'CDMX',
  state: 'CDMX',
  zipCode: '06000',
})

const LOOK_ALIKE_ADDRESS = address({
  label: 'Oficina',
  street: 'Calle 5',
  exteriorNumber: '200',
  neighborhood: 'Del Valle',
  municipality: 'Benito Juárez',
  city: 'CDMX',
  state: 'CDMX',
  zipCode: '03100',
})

const OCCUPIED_ADDRESS = address({
  label: 'Bodega',
  street: 'Av. Insurgentes',
  exteriorNumber: '500',
  neighborhood: 'Roma',
  city: 'CDMX',
  zipCode: '06700',
})

/** Two look-alike sales (same customer, same folio suffix) that differ by address, folio and products. */
export const ELIGIBLE_ANA_ROW = {
  id: SYNTHETIC_SALE_IDS.ana,
  folio: 'A-202610-000003',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  deliveryStatus: 'SHIPPED',
  totalCents: 58900,
  debtCents: 0,
  confirmedAt: '2026-10-07T18:30:00.000Z',
  dueDate: null,
  customer: { id: 'cust-ana', name: 'Ana López' },
  shippingAddress: ANA_ADDRESS,
  productSummary: ['Croqueta 15 kg', 'Correa reflectante'],
  availability: { state: 'AVAILABLE' },
} as const

export const ELIGIBLE_LOOK_ALIKE_ROW = {
  id: SYNTHETIC_SALE_IDS.lookAlike,
  folio: 'A-202610-000004',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  deliveryStatus: 'SHIPPED',
  totalCents: 58900,
  debtCents: 0,
  confirmedAt: '2026-10-06T16:05:00.000Z',
  dueDate: null,
  customer: { id: 'cust-ana', name: 'Ana López' },
  shippingAddress: LOOK_ALIKE_ADDRESS,
  productSummary: ['Alimento seco 15 kg'],
  availability: { state: 'AVAILABLE' },
} as const

export const ELIGIBLE_OCCUPIED_ROW = {
  id: SYNTHETIC_SALE_IDS.occupied,
  folio: 'A-202610-000099',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  deliveryStatus: 'SHIPPED',
  totalCents: 120000,
  debtCents: 0,
  confirmedAt: '2026-10-05T12:00:00.000Z',
  dueDate: null,
  customer: { id: 'cust-carlos', name: 'Carlos Ocupado' },
  shippingAddress: OCCUPIED_ADDRESS,
  productSummary: ['Collar'],
  availability: {
    state: 'OCCUPIED',
    reason: 'RESERVED_BY_ROUTE',
    occupiedRoute: { id: SYNTHETIC_ROUTE_IDS.destination, status: 'DRAFT' },
  },
} as const

export const ELIGIBLE_MISSING_ADDRESS_ROW = {
  id: SYNTHETIC_SALE_IDS.missingAddress,
  folio: 'A-202610-000077',
  status: 'CONFIRMED',
  paymentStatus: null,
  deliveryStatus: 'SHIPPED',
  totalCents: 30500,
  debtCents: 0,
  confirmedAt: '2026-10-04T10:10:00.000Z',
  dueDate: null,
  customer: { id: 'cust-diana', name: 'Diana SinDirección' },
  shippingAddress: null,
  productSummary: ['Juguete'],
  availability: { state: 'INELIGIBLE', reason: 'MISSING_ADDRESS' },
} as const

export const ELIGIBLE_PAGE_TWO_ROW = {
  id: SYNTHETIC_SALE_IDS.pageTwo,
  folio: 'A-202610-000055',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  deliveryStatus: 'SHIPPED',
  totalCents: 45000,
  debtCents: 0,
  confirmedAt: '2026-10-03T09:00:00.000Z',
  dueDate: null,
  customer: { id: 'cust-elena', name: 'Elena Segunda' },
  shippingAddress: address({ street: 'Av. Universidad', exteriorNumber: '7' }),
  productSummary: ['Arena para gato'],
  availability: { state: 'AVAILABLE' },
} as const

export const ELIGIBLE_SEARCH_ROW = {
  id: SYNTHETIC_SALE_IDS.searchOnly,
  folio: 'A-202610-000088',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  deliveryStatus: 'SHIPPED',
  totalCents: 22000,
  debtCents: 0,
  confirmedAt: '2026-10-02T08:00:00.000Z',
  dueDate: null,
  customer: { id: 'cust-zoe', name: 'Zoe Búsqueda' },
  shippingAddress: address({ street: 'Calle Luna', exteriorNumber: '9' }),
  productSummary: ['Juguete de cuerda'],
  availability: { state: 'AVAILABLE' },
} as const

/** Page 1 of the authoritative endpoint: 24 total / 2 pages so pagination controls render. */
export const ELIGIBLE_SALES_PAGE_ONE = {
  data: [
    ELIGIBLE_ANA_ROW,
    ELIGIBLE_LOOK_ALIKE_ROW,
    ELIGIBLE_OCCUPIED_ROW,
    ELIGIBLE_MISSING_ADDRESS_ROW,
  ],
  pagination: { page: 1, limit: 20, total: 24, totalPages: 2 },
} as const

export const ELIGIBLE_SALES_PAGE_TWO = {
  data: [ELIGIBLE_PAGE_TWO_ROW],
  pagination: { page: 2, limit: 20, total: 24, totalPages: 2 },
} as const

export const ELIGIBLE_SALES_SEARCH = {
  data: [ELIGIBLE_SEARCH_ROW],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
} as const

// ─── Drivers ──────────────────────────────────────────────────────────────────
export const ASSIGNABLE_DRIVERS = [
  { id: SYNTHETIC_DRIVER_IDS.one, name: 'Repartidor Uno' },
  { id: SYNTHETIC_DRIVER_IDS.two, name: 'Repartidor Dos' },
  { id: SYNTHETIC_DRIVER_IDS.three, name: 'Repartidor Tres' },
] as const

// ─── Route DTOs ───────────────────────────────────────────────────────────────
const driver = (id: string, name: string, email: string) => ({ id, name, email })

export const SYNTHETIC_STOP = {
  id: SYNTHETIC_STOP_IDS.originStop,
  saleId: SYNTHETIC_SALE_IDS.ana,
  saleFolio: 'A-202610-000003',
  sortOrder: 0,
  status: 'PENDING',
  checkedInAt: null,
  completedAt: null,
  customer: { id: 'cust-ana', name: 'Ana López', email: null },
  shippingAddress: ANA_ADDRESS,
} as const

export const SYNTHETIC_DESTINATION_STOP = {
  id: SYNTHETIC_STOP_IDS.destinationStop,
  saleId: SYNTHETIC_SALE_IDS.pageTwo,
  saleFolio: 'A-202610-000055',
  sortOrder: 0,
  status: 'PENDING',
  checkedInAt: null,
  completedAt: null,
  customer: { id: 'cust-elena', name: 'Elena Segunda', email: null },
  shippingAddress: address({ street: 'Av. Universidad', exteriorNumber: '7' }),
} as const

/** Origin route BEFORE the move — one stop. */
export const ROUTE_ORIGIN_WITH_STOP = {
  id: SYNTHETIC_ROUTE_IDS.origin,
  status: 'DRAFT',
  driver: driver(SYNTHETIC_DRIVER_IDS.one, 'Repartidor Uno', 'uno@e2e.test'),
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  notes: null,
  stops: [SYNTHETIC_STOP],
  timeline: [],
} as const

/** Origin route AFTER the move — the stop is gone (origin refresh proof). */
export const ROUTE_ORIGIN_WITHOUT_STOP = {
  ...ROUTE_ORIGIN_WITH_STOP,
  stops: [],
} as const

export const ROUTE_DESTINATION = {
  id: SYNTHETIC_ROUTE_IDS.destination,
  status: 'DRAFT',
  driver: driver(SYNTHETIC_DRIVER_IDS.two, 'Repartidor Dos', 'dos@e2e.test'),
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  notes: null,
  stops: [SYNTHETIC_DESTINATION_STOP],
  timeline: [],
} as const

/** Destination route AFTER the move — it gained the moved stop (destination refresh proof). */
export const ROUTE_DESTINATION_AFTER_MOVE = {
  ...ROUTE_DESTINATION,
  status: 'DRAFT',
  stops: [{ ...SYNTHETIC_STOP, sortOrder: 1 }],
} as const

export const ROUTE_SPARE = {
  id: SYNTHETIC_ROUTE_IDS.spare,
  status: 'DRAFT',
  driver: driver(SYNTHETIC_DRIVER_IDS.three, 'Repartidor Tres', 'tres@e2e.test'),
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  notes: null,
  stops: [],
  timeline: [],
} as const

export const TRANSFER_RESPONSE = {
  originRoute: ROUTE_ORIGIN_WITHOUT_STOP,
  destinationRoute: ROUTE_DESTINATION_AFTER_MOVE,
} as const

// ─── Create responses ─────────────────────────────────────────────────────────
export const CREATED_ROUTE = {
  id: SYNTHETIC_ROUTE_IDS.spare,
  status: 'DRAFT',
  driver: driver(SYNTHETIC_DRIVER_IDS.one, 'Repartidor Uno', 'uno@e2e.test'),
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  notes: null,
  stops: [{ ...SYNTHETIC_STOP, sortOrder: 0 }],
  timeline: [],
} as const

/** Flat 409 envelope — conflictSaleIds is FLAT (never nested under details). */
export const CREATE_CONFLICT_409 = {
  statusCode: 409,
  error: 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE',
  message: 'Una de las ventas ya pertenece a otra ruta activa.',
  timestamp: '2026-10-07T18:35:00.000Z',
  conflictSaleIds: [SYNTHETIC_SALE_IDS.ana],
} as const

/** Minimal flat route list for the manager table (create flow entry point). */
export const ROUTE_LIST_EMPTY: readonly unknown[] = Object.freeze([])
