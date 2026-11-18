// API fixtures shaped from the app's types/decoders. fixtures(ctx, opts)(path, search) → body | undefined | { __status, body }.
// opts.mode: 'loaded' (default) | 'empty' | 'error' — applied to the main endpoint(s) of the screen under test.
// Shapes:
//   chatbot requests  src/features/chatbot/requests/interfaces/chatbot-request.types.ts (+ __tests__/chatbot-request.fixture.ts, utils/detail-fixture.ts)
//   chatbot settings  src/features/system/chatbot-settings/interfaces/__tests__/chatbot-settings.fixture.ts (Zod schema in chatbot-settings.types.ts)
//   shipping          src/features/shipping/shipping-settings/interfaces/shipping-settings.types.ts, delivery-zones/interfaces/delivery-zone.types.ts
//   profile           src/features/profile/interfaces/profile.types.ts
//   public catalog    src/features/catalog/api/catalog-{product-detail,branch-detail,price-contexts,branches}.api.ts (runtime guards)
export const T0 = '2026-11-16T17:00:00.000Z'
const NOW = Date.parse('2026-11-18T17:00:00.000Z')
const iso = (msFromNow) => new Date(NOW + msFromNow).toISOString()
export const pg = (rows) => ({ data: rows, pagination: { pageIndex: 0, pageSize: 20, totalCount: rows.length, pageCount: rows.length ? 1 : 0 } })
const ERR = { __status: 500, body: { message: 'Internal server error', statusCode: 500 } }

// ── chatbot requests ───────────────────────────────────────────────────────
const row = (o = {}) => ({
  id: 'req-1', folio: 'S-000001', customerKey: 'k1.abc', kind: 'DECISION', subtype: 'RESTOCK', status: 'NEW', displayStatus: 'NEW',
  summary: 'Croquetas 15 kg', assignee: null, createdAt: T0, claimDeadlineAt: iso(3600e3), resolveDeadlineAt: null, overdueAt: null,
  slaPaused: false, slaResumesAt: null, whatsappWindowClosesAt: iso(5 * 3600e3), unreadCustomerMessages: 0, scheduledFor: null, scheduleVersion: 0,
  requiresTemplateAtStart: false, needsReschedule: false, liveSession: null, closedAt: null, resolvedBy: null, version: 1,
  cancelReason: null, staffCancelReason: null, mergedInto: null, slaLevel: 'OK', allowedActions: ['CLAIM'], deniedActions: [], ...o,
})
const USERREF = { id: 'u-1', displayName: 'Ana Auditora' }
const rows = {
  receipt: row({ id: 'req-rcpt', folio: 'S-000123', customerKey: 'k1.abc', subtype: 'TRANSFER_RECEIPT', status: 'IN_PROGRESS', displayStatus: 'IN_PROGRESS',
    summary: 'Comprobante de transferencia de la venta V-1042', assignee: USERREF, claimDeadlineAt: null, resolveDeadlineAt: iso(2 * 3600e3), version: 3,
    allowedActions: ['RESOLVE', 'RELEASE', 'CANCEL'] }),
  zone: row({ id: 'req-zone', folio: 'S-000124', customerKey: 'k2.def', subtype: 'DELIVERY_ZONE', summary: 'Entrega a domicilio en CP 44160 (Guadalajara, Americana)',
    claimDeadlineAt: iso(-1800e3), overdueAt: iso(-1800e3), slaLevel: 'OVERDUE', unreadCustomerMessages: 2, allowedActions: ['CLAIM', 'CANCEL'] }),
  restock: row({ id: 'req-3', folio: 'S-000125', customerKey: 'k2.def', summary: 'Croquetas Premium Adulto 15 kg — 6 piezas para el viernes' }),
  talk: row({ id: 'req-4', folio: 'S-000126', customerKey: 'k3.ghi', kind: 'CONVERSATION', subtype: 'TALK_TO_HUMAN', summary: 'Quiere hablar con una persona sobre su pedido',
    status: 'IN_PROGRESS', displayStatus: 'IN_PROGRESS', assignee: { id: 'u-3', displayName: 'Carla Gerente' }, allowedActions: ['RELEASE'] }),
}
const group = (key, customer, reqs) => ({ customerKey: key, customer, mostUrgentAt: reqs[0].claimDeadlineAt ?? reqs[0].resolveDeadlineAt, openCount: reqs.length,
  overdueCount: reqs.filter((r) => r.overdueAt).length, requests: reqs, moreRequests: 0 })
const groups = [
  group('k2.def', { id: null, displayName: null, phone: '+52 33 **** 4411', isTrusted: false }, [rows.zone, rows.restock]),
  group('k1.abc', { id: 'cus-1', displayName: 'Juan Pérez Hernández', phone: '+52 33 **** 5678', isTrusted: true }, [rows.receipt]),
  group('k3.ghi', { id: 'cus-3', displayName: 'María Fernanda Villaseñor', phone: '+52 55 **** 1020', isTrusted: false }, [rows.talk]),
]
const counts = { new: 2, inProgress: 2, mine: 1, overdue: 1, windowClosingSoon: 1, scheduled: 0, needsReschedule: 0, resolved7d: 12, cancelled7d: 5, openGroups: 3, unassigned: 2 }
const zeroCounts = Object.fromEntries(Object.keys(counts).map((k) => [k, 0]))
const customer = (o = {}) => ({ id: 'cus-1', displayName: 'Juan Pérez Hernández', phone: '+52 33 **** 5678', customerSince: '2025-03-02T10:00:00.000Z', isTrusted: true,
  priceList: { id: 'pl-1', name: 'Mayoreo' }, ambiguous: false, candidates: [],
  recentOrders: [{ saleId: 'sale-1', folio: 'V-1042', createdAt: '2026-11-09T17:00:00.000Z', totalCents: 184000, status: 'CONFIRMED', paymentStatus: 'PENDING' }], ...o })
const audit = (o = {}) => ({ id: 'ev-1', type: 'CREATED', createdAt: T0, actor: { kind: 'SYSTEM', id: null, displayName: null }, fromStatus: null, toStatus: 'NEW', version: 1, data: {}, ...o })
const details = {
  'req-rcpt': { ...rows.receipt, templateCostText: null, needs: 'El cliente mandó su comprobante de la venta V-1042.', context: { saleId: 'sale-1' }, customer: customer(),
    otherOpenRequests: [], zoneImpact: null, deliveries: [], audit: [audit({ toStatus: 'NEW' }), audit({ id: 'ev-2', type: 'CLAIMED', actor: { kind: 'USER', ...USERREF }, fromStatus: 'NEW', toStatus: 'IN_PROGRESS', version: 2 })].reverse(), auditNextCursor: null,
    decision: { subtype: 'TRANSFER_RECEIPT', receiptId: 'rec-1', saleId: 'sale-1', saleFolio: 'V-1042', declaredAmountCents: 184000, declaredAmountProvided: true,
      declaredDate: '2026-11-11', declaredReference: '9988776', saleTotalCents: 184000, salePaidCents: 0, saleDebtCents: 184000,
      file: { mimeType: 'image/svg+xml', sizeBytes: 2048, previewStatus: 'READY', originalUrl: '/sales/sale-1/receipts/rec-1/file', previewUrl: '/sales/sale-1/receipts/rec-1/preview' },
      extracted: { amountCents: 184000, date: '2026-11-11', reference: '9988776', bank: 'BBVA', confidence: 0.92 }, mismatch: null, resolution: null } },
  'req-zone': { ...rows.zone, templateCostText: 'Enviar la plantilla tiene un costo para el negocio.', needs: 'Quiere que le lleven 2 bultos de croquetas a su casa en la colonia Americana.',
    context: { quantity: 2 }, customer: customer({ id: null, displayName: null, phone: '+52 33 **** 4411', customerSince: null, isTrusted: false, priceList: null, recentOrders: [] }),
    otherOpenRequests: [rows.restock], zoneImpact: { requests: 3, customers: 3, setVersion: 7, validationId: 'val-1' }, deliveries: [], audit: [audit()], auditNextCursor: null,
    decision: { subtype: 'DELIVERY_ZONE', validationId: 'val-1', zipCode: '44160', state: 'Jalisco', municipality: 'Guadalajara', neighborhood: 'Americana',
      requesterCount: 3, lastCustomerMessageAt: iso(-3600e3), resolution: null } },
}
const conversation = (id) => ({ hasMoreBefore: false, items: [] , id })

// ── chatbot settings ───────────────────────────────────────────────────────
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
const week = (r = {}) => ({ timeZone: 'America/Mexico_City', days: DAYS.map((day) => ({ day, ranges: (r[day] ?? []).map(([open, close]) => ({ open, close })) })) })
const FULL = [['09:00', '19:00']]
const chatbotSettings = {
  version: 3, openingHours: week({ MONDAY: FULL, TUESDAY: FULL, WEDNESDAY: [['09:00', '14:00'], ['16:00', '19:00']], THURSDAY: FULL, FRIDAY: FULL, SATURDAY: [['09:00', '14:00']] }),
  closedDates: ['2026-12-25', '2027-01-01'], closedDateReasons: {},
  slas: [
    { subtype: 'RESTOCK', claimMinutes: 60, resolveMinutes: 240 }, { subtype: 'EXPIRATION', claimMinutes: 60, resolveMinutes: 240 },
    { subtype: 'DELIVERY_ZONE', claimMinutes: 60, resolveMinutes: 240 }, { subtype: 'TRANSFER_RECEIPT', claimMinutes: null, resolveMinutes: null },
    { subtype: 'TALK_TO_HUMAN', claimMinutes: 10, resolveMinutes: null }, { subtype: 'COMPLAINT', claimMinutes: 30, resolveMinutes: 240 },
    { subtype: 'UNKNOWN_QUESTION', claimMinutes: 30, resolveMinutes: 120 }, { subtype: 'DISCOUNT', claimMinutes: 30, resolveMinutes: 120 },
  ],
  windowWarningMinutes: 120, templateName: null, templateCostText: 'Enviar la plantilla tiene un costo para el negocio.',
  enabledSubtypes: ['RESTOCK', 'COMPLAINT', 'DELIVERY_ZONE', 'TRANSFER_RECEIPT'], receiptCloseMarginMinutes: 60, startTimeoutSeconds: 120, templateLanguageCode: 'es_MX',
  scheduling: { enabled: true, slotMinutes: 30, slotsOffered: 3, maxScheduledPerSlot: 3 },
  branchOpeningHours: week({ MONDAY: [['10:00', '18:00']], TUESDAY: [['10:00', '18:00']] }), updatedBy: { id: 'u-1', displayName: 'Ana Auditora' }, updatedAt: T0,
}

// ── shipping ───────────────────────────────────────────────────────────────
const box = (id, name, l, w, h, g, max, act = true) => ({ id, name, innerLengthCm: l, innerWidthCm: w, innerHeightCm: h, weightG: g, maxContentWeightG: max, isActive: act, createdAt: T0, updatedAt: T0 })
const boxes = [box('bx-1', 'Caja chica', 30, 20, 15, 250, 5000), box('bx-2', 'Caja mediana para bultos de croquetas', 60, 40, 30, 600, 20000), box('bx-3', 'Caja vieja', 25, 25, 25, 300, 4000, false)]
const origin = { configured: true, origin: { addressLine1: 'Av. Chapultepec 480', addressLine2: 'Local 3', neighborhood: 'Americana', municipality: 'Guadalajara', state: 'Jalisco', postalCode: '44160', contactPhone: '3312345678', updatedAt: T0 } }
const hours = { configured: true, openingHours: { ...week({ MONDAY: FULL, TUESDAY: FULL, WEDNESDAY: FULL, THURSDAY: FULL, FRIDAY: FULL, SATURDAY: [['09:00', '14:00']] }), updatedAt: T0 } }
const zone = (id, zip, type, o = {}) => ({ id, zipCode: zip, type, surchargeCents: type === 'SURCHARGE' ? 4500 : null, etaDays: type === 'DENIED' ? null : 1, state: 'Jalisco', municipality: 'Guadalajara',
  neighborhood: 'Americana', isActive: true, approvedBy: { id: 'u-1', displayName: 'Ana Auditora' }, approvedAt: T0, sourceValidationId: null, createdAt: T0, updatedAt: T0, ...o })
const zones = [zone('z-1', '44160', 'FREE'), zone('z-2', '44600', 'SURCHARGE', { neighborhood: 'Providencia 1a. Sección' }), zone('z-3', '45010', 'CARRIER_ONLY', { municipality: 'Zapopan', neighborhood: null, etaDays: 3 }), zone('z-4', '45500', 'DENIED', { municipality: 'San Pedro Tlaquepaque', neighborhood: 'Centro', isActive: false })]
const validation = (id, zip, level, o = {}) => ({ id, zipCode: zip, state: 'Jalisco', municipality: 'Guadalajara', neighborhood: 'Americana', status: 'PENDING', version: 2, createdAt: T0,
  requesterCount: 3, lastCustomerMessageAt: iso(-3600e3), urgency: { deadlineAt: iso(level === 'EXPIRED' ? -3600e3 : 4 * 3600e3), hoursLeft: level === 'EXPIRED' ? 0 : 4, level }, resolution: null, ...o })
const validations = [validation('val-1', '44160', 'CRITICAL'), validation('val-2', '45070', 'OK', { municipality: 'Zapopan', neighborhood: 'Ciudad Granja', requesterCount: 1 }),
  validation('val-3', '44100', 'EXPIRED', { neighborhood: null, municipality: null, state: null })]

// ── public catalog ─────────────────────────────────────────────────────────
const PRICE_CTX = [{ priceListId: 'pl-1', name: 'Público', isCatalogDefault: true }, { priceListId: 'pl-2', name: 'Mayoreo', isCatalogDefault: false }]
const branchDetail = { name: 'Tienda Centro', phone: '3312345678', address: { formatted: 'Av. Chapultepec 480, Americana, 44160 Guadalajara, Jal.' },
  hours: { timeZone: 'America/Mexico_City', summary: 'Lun a vie 9:00–19:00 · Sáb 9:00–14:00', days: DAYS.map((d, i) => ({ day: d, label: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][i], closed: i === 6, ranges: i === 6 ? [] : [{ open: '09:00', close: i === 5 ? '14:00' : '19:00' }] })) },
  pickupAvailable: true, deliveryAvailable: true, whatsappNumber: '5213312345678' }
const sp = (status) => ({ mode: 'SYSTEM_STATUS', status, customQuantity: null })
const variant = (id, name, value, priceCents, status, API) => ({ id, name, option: 'Sabor', value, image: null, price: { hidden: false, priceCents }, stockPresentation: sp(status),
  availabilityByBranch: [{ branchId: 't-1', branchName: 'Tienda Centro', branchSlug: 'centro', availability: status, isSelected: true }] })
const productDetail = (API, priceListId) => ({
  id: 'p1', name: 'Croquetas Premium Adulto Raza Mediana y Grande 15 kg', slug: null,
  description: 'Alimento completo y balanceado para perros adultos. Con proteína de pollo como primer ingrediente, omega 3 y 6 para piel y pelo sanos.',
  category: { id: 'c-1', name: 'Alimento para perro' }, brand: { name: 'NutriCan' },
  images: [{ id: 'img-1', url: `${API}/media/p1-main.svg`, isMain: true }, { id: 'img-2', url: `${API}/media/p1-back.svg`, isMain: false }],
  price: { hidden: false, priceCents: 78000 }, availability: 'available', stockPresentation: sp('available'), hasVariants: true,
  variants: [variant('v-1', 'Pollo y arroz', 'Pollo y arroz', 78000, 'available'), variant('v-2', 'Cordero', 'Cordero', 81000, 'low_stock'), variant('v-3', 'Salmón', 'Salmón', 85000, 'out_of_stock')],
  rating: null, featuredLabel: null,
  attributes: [
    { code: 'species', label: 'Especie', display: 'Perro', section: { code: 'animal', label: 'Animal' }, value: { type: 'enum', value: 'DOG' } },
    { code: 'life_stage', label: 'Etapa de vida', display: 'Adulto', section: { code: 'animal', label: 'Animal' }, value: { type: 'enum', value: 'ADULT' } },
    { code: 'net_weight', label: 'Contenido neto', display: '15 kg', section: null, value: { type: 'number', value: 15 } },
  ],
  priceContext: PRICE_CTX.find((c) => c.priceListId === priceListId) ?? { priceListId, name: 'Público', isCatalogDefault: true }, excludedCount: 0,
})
export const SVG = (label) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="#e8dcc8"/><rect x="150" y="90" width="300" height="420" rx="24" fill="#b5562b"/><text x="300" y="320" font-family="sans-serif" font-size="40" fill="#fff" text-anchor="middle">${label}</text></svg>`

export function fixtures({ USER, PERMS, API }, opts) {
  const mode = opts.mode ?? 'loaded'
  return (p, q) => {
    // shell
    if (p === '/auth/me/permissions') return { permissionCodes: PERMS }
    if (p === '/auth/me') return { user: USER, ...USER }
    if (p === '/notifications/unread-count') return { count: 0 }
    if (p === '/notifications') return { items: [], nextCursor: null }
    if (p === '/sales/refunds/pending') return pg([])
    // chatbot requests
    if (p === '/chatbot-requests/counts') return mode === 'error' ? ERR : mode === 'empty' ? zeroCounts : counts
    if (p === '/chatbot-requests/groups') return mode === 'error' ? ERR : { items: mode === 'empty' ? [] : groups, nextCursor: null }
    if (p === '/chatbot-requests/history') return { items: [], nextCursor: null }
    if (p === '/chatbot-requests') return { items: [], nextCursor: null }
    if (p === '/chatbot-requests/assignable-users') return { items: [USERREF, { id: 'u-3', displayName: 'Carla Gerente' }] }
    let m = p.match(/^\/chatbot-requests\/([^/]+)(\/.*)?$/)
    if (m) {
      const [, id, sub] = m
      if (!sub) return mode === 'error' ? { __status: 404, body: { message: 'Not found', statusCode: 404 } } : details[id]
      if (sub === '/conversation') return conversation(id)
      if (sub === '/audit') return { items: [], nextCursor: null }
      if (sub === '/merge-candidates') return { items: [] }
      if (sub === '/zone-impact') return details[id]?.zoneImpact ?? { requests: 1, customers: 1, setVersion: 1 }
      if (sub === '/scheduling/slots') return { slots: [] }
    }
    if (p === '/sales/sale-1/receipts/rec-1/preview' || p === '/sales/sale-1/receipts/rec-1/file') return { __svg: SVG('Comprobante') }
    // chatbot settings
    if (p === '/chatbot-settings') return mode === 'error' ? ERR : chatbotSettings
    // shipping
    if (p === '/tenants/t-1/shipping-boxes') return mode === 'error' ? ERR : { data: mode === 'empty' ? [] : boxes }
    if (p === '/tenants/t-1/shipping-origin') return mode === 'empty' ? { configured: false, origin: null } : origin
    if (p === '/tenants/t-1/opening-hours') return mode === 'empty' ? { configured: false, openingHours: null } : hours
    if (p === '/delivery-zones') return mode === 'error' ? ERR : pg(mode === 'empty' ? [] : zones)
    if (p === '/delivery-zone-validations') return mode === 'error' ? ERR : pg(mode === 'empty' ? [] : validations)
    m = p.match(/^\/delivery-zone-validations\/([^/]+)$/); if (m) return validations.find((v) => v.id === m[1])
    // profile
    if (p === '/me/notification-preferences') return mode === 'error' ? ERR : { emailEnabled: true, soundEnabled: false }
    // public catalog
    if (p === '/public/catalog/branches') return [{ id: 't-1', name: 'Tienda Centro', slug: 'centro', address: 'Av. Chapultepec 480, Guadalajara', phone: '3312345678', whatsappNumber: '5213312345678' }]
    if (p === '/public/catalog/centro/branch') return branchDetail
    if (p === '/public/catalog/centro/price-contexts') return PRICE_CTX
    m = p.match(/^\/public\/catalog\/centro\/products\/([^/]+)$/)
    if (m) return mode === 'error' ? { __status: 404, body: { message: 'Not found', statusCode: 404 } } : productDetail(API, q.get('priceListId') ?? 'pl-1')
    if (p === '/public/catalog/centro/products') return { data: [], pagination: { pageIndex: 0, pageSize: 20, totalCount: 0, pageCount: 0 } }
    m = p.match(/^\/media\/(.+)\.svg$/); if (m) return { __svg: SVG(m[1].includes('back') ? 'Reverso' : 'NutriCan') }
    return undefined
  }
}
