// API fixtures shaped from the app's types/decoders. fixtures(ctx, opts)(path, search) → body | undefined.
const T0 = '2026-10-01T12:00:00.000Z'
export const pg = (rows) => ({ data: rows, pagination: { pageIndex: 0, pageSize: 20, totalCount: rows.length, pageCount: rows.length ? 1 : 0 } })
export function fixtures({ USER, PERMS }, opts) {
  const users = [
    { id: 'u-1', name: 'Ana Auditora' }, { id: 'u-2', name: 'Bruno Cajero' }, { id: 'u-3', name: 'Carla Gerente' },
    { id: 'u-4', name: 'Diego Repartidor' }, { id: 'u-5', name: 'Elena Almacén' },
  ]
  return (p, q) => {
    if (p === '/auth/me/permissions') return { permissionCodes: PERMS }
    if (p === '/auth/me') return { user: USER, ...USER }
    if (p === '/notifications/unread-count') return { count: 0 }
    if (p === '/notifications') return { items: [], nextCursor: null }
    if (p === '/sales/refunds/pending' || p === '/delivery-zone-validations') return pg([])
    // 1 notifications config
    if (p === '/notification-config') return opts.notifOff
      ? { enabled: false, recipients: [], enabledActions: [] }
      : { enabled: true, recipients: ['u-1', 'u-3'], enabledActions: ['LOW_STOCK', 'PROMOTION_EXPIRING'] }
    if (p === '/users/assignable' || p === '/users/assignable-drivers') return users
    // 2 product detail
    if (p === '/tenants/t-1/catalog-settings') return {
      catalogPublished: true, catalogRequiresPublishedEditorial: false, effectivePublication: true,
      priceContexts: [{ priceListId: 'pl-1', name: 'Público', isCatalogDefault: true }, { priceListId: 'pl-2', name: 'Mayoreo', isCatalogDefault: false }],
      stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null }, warnings: [], updatedAt: T0,
    }
    if (p === '/products/p1') return product
    if (p === '/categories') return [{ id: 'c-1', name: 'Alimento' }, { id: 'c-2', name: 'Accesorios' }]
    if (p === '/brands') return [{ id: 'b-1', name: 'NutriCan' }]
    if (p === '/price-lists') return [{ id: 'pl-1', name: 'Público', isDefault: true, createdAt: T0, updatedAt: T0 }, { id: 'pl-2', name: 'Mayoreo', isDefault: false, createdAt: T0, updatedAt: T0 }]
    if (p === '/products/p1/price-lists') return [
      { id: 'pl-1', productId: 'p1', name: 'Público', priceCents: 78000, tierPrices: [], createdAt: T0, updatedAt: T0 },
      { id: 'pl-2', productId: 'p1', name: 'Mayoreo', priceCents: 70000, tierPrices: [{ id: 'tp1', minQuantity: 5, priceCents: 68000 }], createdAt: T0, updatedAt: T0 },
    ]
    if (p === '/products/p1/images') return []
    if (p === '/products/p1/variants') return opts.variants === false ? [] : variants
    if (/^\/products\/p1\/variants\/[^/]+\/prices$/.test(p)) return []
    if (p === '/products/p1/lots') return []
    if (p.endsWith('/packaging')) return null
    // 3 promotions
    if (p === '/promotions/bot-eligibility-capabilities') return { rules: [] }
    // 4 roles
    if (p === '/admin/roles') return [{ role: role, userCount: 3 }]
    if (p === '/admin/roles/r-1') return role
    if (p === '/admin/permissions') return grouped
    // 5 cash
    if (p === '/cash-registers') return { items: [{ id: 'cr-1', name: 'Caja 1', isActive: true, createdAt: T0 }, { id: 'cr-2', name: 'Caja 2', isActive: true, createdAt: T0 }] }
    if (p === '/cash-sessions') return { items: [], page: 1, limit: 25, total: 0 }
    if (p === '/cash-handovers/custody') return { pendingHandovers: { items: [], page: 1, limit: 25, total: 0 }, eligibleFloat: { items: [], page: 1, limit: 25, total: 0 } }
    // 6 employees
    if (p === '/admin/employees') return { data: employees, total: employees.length, page: 1, limit: 10, pageSize: 10 }
    if (/^\/admin\/employees\/e-\d$/.test(p)) return employees.find((e) => e.id === p.split('/').pop())
    if (/^\/admin\/employees\/e-\d\/(subordinates|manager-chain|salary-history|emergency-contacts)$/.test(p)) return []
    // 7 sales / customers
    if (p === '/sales/s-1') return sale
    if (p === '/customers') return customers
    if (p === '/sales/drafts') return [{ id: 'd-1', userId: 'u-1', status: 'DRAFT', items: [], customer: null, shippingAddress: null, createdAt: T0, updatedAt: T0, subtotalCents: 0, discountCents: 0, totalCents: 0 }]
    if (p === '/sales/pos-catalog') return { items: [], total: 0, limit: 36, offset: 0 }
    if (p === '/sales/payment-methods') return []
    if (/^\/customers\/cus-\d\/addresses$/.test(p)) return []
    // 8 routes
    if (p === '/delivery-routes') return []
    if (p === '/delivery-routes/eligible-sales') return eligible
    return undefined
  }
}
const emp = (i, fullName, pos, dep, status = 'ACTIVE') => ({
  id: `e-${i}`, employeeNumber: `EMP-00${i}`, fullName, email: `emp${i}@hound.test`, phone: '5512345678', dateOfBirth: '1990-04-12', nationalId: null, nationalIdType: null,
  street: 'Av. Reforma', exteriorNumber: '100', interiorNumber: null, zipCode: '06000', neighborhood: 'Centro', municipality: 'Cuauhtémoc', city: 'CDMX', state: 'CDMX',
  status, terminationDate: null, terminationReason: null, contractType: 'PERMANENT', workModality: 'ONSITE', currentPosition: pos, currentDepartment: dep,
  currentSchedule: 'L-V 9:00-18:00', currentResponsibilities: null, annualVacationDays: 12, managerId: null, hireDate: '2024-02-01', photoFileId: null, cvFileId: null,
  createdAt: '2024-02-01T12:00:00.000Z', updatedAt: '2026-10-01T12:00:00.000Z',
})
const employees = [emp(1, 'María Fernández', 'Gerente de tienda', 'Operación'), emp(2, 'Luis Ramírez', 'Cajero', 'Ventas'), emp(3, 'Sofía Torres', 'Almacenista', 'Almacén', 'ON_LEAVE'), emp(4, 'Jorge Méndez', 'Repartidor', 'Entregas')]
const sale = {
  id: 's-1', folio: 'V-1042', status: 'CONFIRMED', channel: 'POS', register: 'Caja 1', confirmedAt: '2026-11-09T17:00:00.000Z', dueDate: null,
  subtotalCents: 205000, discountCents: 21000, totalCents: 184000, paidCents: 100000, debtCents: 84000, changeDueCents: 0, paymentStatus: 'PARTIAL', deliveryStatus: 'PENDING',
  customer: { id: 'cus-1', name: 'Juan Pérez' }, cashier: { id: 'u-2', name: 'Bruno Cajero' }, seller: { id: 'u-3', name: 'Carla Gerente' }, timeline: [],
  payments: [],
  items: [
    { productName: 'Croquetas Premium Adulto 15 kg', variantName: 'Pollo y arroz', imageUrl: null, unitPriceCents: 78000, quantity: 2, discountCents: 0, subtotalCents: 156000 },
    { productName: 'Arena sanitaria aglomerante con aroma a lavanda para gatos 10 kg', variantName: null, imageUrl: null, unitPriceCents: 32000, quantity: 1, discountCents: 16000, subtotalCents: 16000 },
    { productName: 'Collar antipulgas', variantName: 'Talla M · Azul', imageUrl: null, unitPriceCents: 16000, quantity: 2, discountCents: 5000, subtotalCents: 27000 },
  ],
}
const customers = [
  { id: 'cus-1', firstName: 'Juan', lastName: 'Pérez', phoneCountryCode: '+52', phone: '3312345678', email: 'juan@correo.mx', globalPriceListId: null, comments: null, createdAt: T0, updatedAt: T0 },
  { id: 'cus-2', firstName: 'Mariana', lastName: 'López', phoneCountryCode: '+52', phone: '3398765432', email: null, globalPriceListId: 'pl-2', globalPriceList: { id: 'pl-2', name: 'Mayoreo' }, comments: null, createdAt: T0, updatedAt: T0 },
  { id: 'cus-3', firstName: 'Veterinaria', lastName: 'San Roque', phoneCountryCode: null, phone: null, email: 'contacto@sanroque.mx', globalPriceListId: null, comments: null, createdAt: T0, updatedAt: T0 },
]
const addr = (o) => ({ id: 'a-0', label: null, street: null, exteriorNumber: null, interiorNumber: null, zipCode: null, neighborhood: null, municipality: null, city: null, state: null, latitude: null, longitude: null, ...o })
const er = (id, folio, name, address, availability, products) => ({ id, folio, status: 'CONFIRMED', paymentStatus: 'PAID', deliveryStatus: 'SHIPPED', totalCents: 58900, debtCents: 0, confirmedAt: '2026-10-07T18:30:00.000Z', dueDate: null, customer: { id: 'c-' + id, name }, shippingAddress: address, productSummary: products, availability })
const eligible = {
  data: [
    er('5a1e0000-0000-4000-8000-000000000001', 'A-202610-000003', 'Ana López', addr({ label: 'Casa', street: 'Av. Reforma', exteriorNumber: '100', neighborhood: 'Centro', city: 'CDMX', zipCode: '06000' }), { state: 'AVAILABLE' }, ['Croqueta 15 kg', 'Correa reflectante']),
    er('5a1e0000-0000-4000-8000-000000000002', 'A-202610-000004', 'Ana López', addr({ label: 'Oficina', street: 'Calle 5', exteriorNumber: '200', neighborhood: 'Del Valle', city: 'CDMX' }), { state: 'AVAILABLE' }, ['Alimento seco 15 kg']),
    er('5a1e0000-0000-4000-8000-000000000003', 'A-202610-000099', 'Carlos Ocupado', addr({ label: 'Bodega', street: 'Av. Insurgentes', exteriorNumber: '500', city: 'CDMX' }), { state: 'OCCUPIED', reason: 'RESERVED_BY_ROUTE', occupiedRoute: { id: 'b2000000-0000-4000-8000-0000000000b2', status: 'DRAFT' } }, ['Collar']),
    er('5a1e0000-0000-4000-8000-000000000004', 'A-202610-000077', 'Diana SinDirección', null, { state: 'INELIGIBLE', reason: 'MISSING_ADDRESS' }, ['Juguete']),
  ],
  pagination: { page: 1, limit: 20, total: 4, totalPages: 1 },
}
const grouped = {
  Product: ['read', 'create', 'update', 'delete'].map((a) => ({ id: `Product:${a}`, action: a, description: null })),
  Sale: ['read', 'create', 'update'].map((a) => ({ id: `Sale:${a}`, action: a, description: null })),
  Customer: ['read', 'create'].map((a) => ({ id: `Customer:${a}`, action: a, description: null })),
}
const role = {
  id: 'r-1', name: 'Cajero', description: 'Atiende la caja y las ventas', isSystem: false, createdAt: '2026-10-01T12:00:00.000Z', updatedAt: '2026-10-01T12:00:00.000Z',
  permissions: [{ subject: 'Product', action: 'read', description: null }, { subject: 'Product', action: 'update', description: null }, { subject: 'Sale', action: 'read', description: null }, { subject: 'Sale', action: 'create', description: null }, { subject: 'Sale', action: 'update', description: null }],
}
const product = {
  id: 'p1', name: 'Croquetas Premium Adulto 15 kg', type: 'PRODUCT', sku: 'CRO-15', barcode: '7501234567890', categoryId: 'c-1', categoryName: 'Alimento',
  brandId: 'b-1', brandName: 'NutriCan', description: 'Alimento completo para perro adulto.', location: 'Pasillo 3', satKey: null, unit: 'UNIDAD',
  priceCents: 78000, quantity: 24, minQuantity: 5, useStock: true, hasVariants: true, useLotsAndExpirations: false, sellInPos: true,
  includeInOnlineCatalog: true, hidePriceInOnlineCatalog: false, supportedCatalogPriceListIds: [], supportsAllCatalogPriceLists: true,
  onlineStockPresentation: null, onlineStockPresentationCustomQty: null, requiresPrescription: false, chargeProductTaxes: true,
  ivaRate: 'IVA_16', iepsRate: 'NO_APLICA', purchaseCostMode: 'NET', purchaseNetCostCents: 52000, purchaseGrossCostCents: 60320,
  variantStockTotal: 24, variantCount: 2, status: 'active', serviceDetail: null, createdAt: T0, updatedAt: T0,
}
const variants = [
  { id: 'v1', productId: 'p1', name: 'Pollo y arroz', option: 'Sabor', value: 'Pollo y arroz', sku: 'CRO-15-P', barcode: null, priceCents: 78000, quantity: 14, minQuantity: 3, purchaseNetCostCents: 52000, variantPrices: [], catalogPublishMode: 'INHERIT', createdAt: T0, updatedAt: T0 },
  { id: 'v2', productId: 'p1', name: 'Res', option: 'Sabor', value: 'Res', sku: 'CRO-15-R', barcode: null, priceCents: 79000, quantity: 10, minQuantity: 3, purchaseNetCostCents: 53000, variantPrices: [], catalogPublishMode: 'INHERIT', createdAt: T0, updatedAt: T0 },
]
