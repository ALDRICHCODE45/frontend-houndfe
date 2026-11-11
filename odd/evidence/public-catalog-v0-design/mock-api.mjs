#!/usr/bin/env node
// Standalone mock of the public catalog API (handoff 07 + 15) for design checks.
// Plain Node, no dependencies. Shapes follow the strict FE validators in
// src/features/catalog/api/*.ts. Sample data only: nothing here ships in the app.
//
//   node odd/evidence/public-catalog-v0-design/mock-api.mjs
//   PORT=3999 MOCK_MODE=ok|error|slow   (also switchable at runtime: GET /__mock/mode?value=error)
import http from 'node:http'

const PORT = Number(process.env.PORT ?? 3999)
const ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5199'
const IMAGE = `${ORIGIN}/images/catalog-companions.png`
let mode = process.env.MOCK_MODE ?? 'ok'

// ---------------------------------------------------------------- ids and static data
const uuid = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`

const BRANCHES = {
  centro: {
    id: uuid('b1a00000', 1),
    name: 'Sucursal Centro',
    slug: 'centro',
    address: 'Av. Juárez 123, Centro',
    phone: '+525555550101',
    whatsappNumber: '+5215555550100',
  },
  norte: {
    id: uuid('b1a00000', 2),
    name: 'Sucursal Norte',
    slug: 'norte',
    address: 'Calzada Vallejo 456, Industrial Vallejo',
    phone: null,
    whatsappNumber: '+5215555550100',
  },
}
// `sur` is deliberately absent: an unpublished slug is not listed and answers 404 everywhere,
// which is the FE's «Esta sucursal aún no publica su catálogo» state.

const PRICE_LISTS = {
  publico: { priceListId: uuid('9e1c0000', 1), name: 'Público', isCatalogDefault: true },
  mayoreo: { priceListId: uuid('9e1c0000', 2), name: 'Mayoreo', isCatalogDefault: false },
}
const CONTEXTS = { centro: [PRICE_LISTS.publico, PRICE_LISTS.mayoreo], norte: [PRICE_LISTS.publico] }
const MAYOREO_FACTOR = 0.9

const BRANCH_DETAIL = {
  centro: {
    name: 'Sucursal Centro',
    phone: '+525555550101',
    address: {
      addressLine1: 'Av. Juárez 123',
      addressLine2: null,
      neighborhood: 'Centro',
      municipality: 'Cuauhtémoc',
      state: 'CDMX',
      postalCode: '06000',
      formatted: 'Av. Juárez 123, Centro, Cuauhtémoc, CDMX, C.P. 06000',
    },
    hours: {
      timeZone: 'America/Mexico_City',
      days: [
        ['MONDAY', 'Lunes'],
        ['TUESDAY', 'Martes'],
        ['WEDNESDAY', 'Miércoles'],
        ['THURSDAY', 'Jueves'],
        ['FRIDAY', 'Viernes'],
        ['SATURDAY', 'Sábado'],
        ['SUNDAY', 'Domingo'],
      ].map(([day, label]) =>
        day === 'SUNDAY'
          ? { day, label, closed: false, ranges: [{ open: '10:00', close: '15:00' }] }
          : { day, label, closed: false, ranges: [{ open: '09:00', close: '19:00' }] },
      ),
      summary: 'Lunes a sábado 09:00–19:00; domingo 10:00–15:00',
    },
    pickupAvailable: true,
    deliveryAvailable: true,
    whatsappNumber: '+5215555550100',
  },
}

const CATEGORIES = {
  dog: { id: uuid('ca700000', 1), name: 'Alimento para perro' },
  cat: { id: uuid('ca700000', 2), name: 'Alimento para gato' },
  treat: { id: uuid('ca700000', 3), name: 'Premios y snacks' },
  toy: { id: uuid('ca700000', 4), name: 'Juguetes' },
  care: { id: uuid('ca700000', 5), name: 'Higiene y cuidado' },
}

// Labels of the published vocabulary (backend editorial-production-choice-inventory).
const DEFS = {
  'animal.target': {
    label: 'Especie',
    type: 'multi',
    section: ['para-quien', 'Para quién'],
    options: { 'ani.dom.dog': 'Perro', 'ani.dom.cat': 'Gato' },
  },
  'life.stage': {
    label: 'Etapa de vida',
    type: 'multi',
    section: ['para-quien', 'Para quién'],
    options: {
      'life.dog.puppy': 'Cachorro',
      'life.dog.adult': 'Adulto',
      'life.dog.senior': 'Sénior',
      'life.dog.gestation': 'Gestación',
      'life.dog.lactation': 'Lactancia',
      'life.cat.kitten': 'Gatito',
      'life.cat.adult': 'Adulto',
      'life.cat.senior': 'Sénior',
    },
  },
  'size.animal': {
    label: 'Tamaño de mascota',
    type: 'multi',
    section: ['para-quien', 'Para quién'],
    options: {
      'size.animal.small': 'Pequeño',
      'size.animal.medium': 'Mediano',
      'size.animal.large': 'Grande',
    },
  },
  'food.format': {
    label: 'Formato del alimento',
    type: 'single',
    section: ['que-es', 'Qué es'],
    options: { 'food.format.kibble': 'Croquetas', 'food.format.pate': 'Paté' },
  },
  'treat.form': {
    label: 'Forma de premio',
    type: 'single',
    section: ['que-es', 'Qué es'],
    options: {
      'treat.form.biscuit': 'Galleta',
      'treat.form.stick': 'Palito',
      'treat.form.bite': 'Bocaditos',
      'treat.form.lickable': 'Premio para lamer',
      'treat.form.bone_shape': 'Forma de hueso',
    },
  },
  'toy.type': {
    label: 'Tipo de juego',
    type: 'multi',
    section: ['que-es', 'Qué es'],
    options: {
      'toy.type.ball': 'Pelota',
      'toy.type.rope': 'Cuerda de juego',
      'toy.type.plush': 'Peluche',
      'toy.type.wand': 'Varita',
      'toy.type.puzzle': 'Rompecabezas',
    },
  },
  'hygiene.type': {
    label: 'Tipo de higiene',
    type: 'single',
    section: ['que-es', 'Qué es'],
    options: {
      'hygiene.type.shampoo': 'Champú',
      'hygiene.type.litter': 'Arena sanitaria',
      'hygiene.type.wipes': 'Toallitas',
      'hygiene.type.brush': 'Cepillo',
      'hygiene.type.bag': 'Bolsa para residuos',
    },
  },
}
const DEF_ORDER = Object.keys(DEFS)
const FACET_DEFS = DEF_ORDER // every choice definition above is a FACET exposure

const DOG = 'ani.dom.dog'
const CAT = 'ani.dom.cat'
const kg = (value) => ({ value, unit: { code: 'kg', label: 'kg' }, code: 'measure.net_mass', label: 'Peso neto' })
const ml = (value) => ({ value, unit: { code: 'ml', label: 'ml' }, code: 'measure.net_volume', label: 'Volumen neto' })
// stock helpers: [status, quantity]
const OK = ['available', null]
const low = (n) => ['low_stock', n]
const OUT = ['out_of_stock', null]

// fields: animal [codes], attrs {definition: [option codes]}, price (cents), stock, mass, variants[], img,
// hidden, noMayoreo, ingredients
const P = (n, cat, brand, name, description, spec) => ({ n, cat, brand, name, description, ...spec })
const RAW = [
  P(1, 'dog', 'Campo Fiel', 'Croquetas adulto raza mediana', 'Alimento completo para perros adultos de raza mediana, con pollo y arroz.', {
    attrs: { 'animal.target': [DOG], 'life.stage': ['life.dog.adult'], 'size.animal': ['size.animal.medium'], 'food.format': ['food.format.kibble'] },
    ingredients: 'Pollo, arroz integral, avena, grasa de pollo, linaza, vitaminas y minerales.',
    img: true,
    variants: [
      { id: 1, value: '2 kg', measure: kg(2), price: 18900, stock: low(3) },
      { id: 2, value: '8 kg', measure: kg(8), price: 62900, stock: OK },
      { id: 3, value: '20 kg', measure: kg(20), price: 139900, stock: OUT },
    ],
  }),
  P(2, 'dog', 'Campo Fiel', 'Croquetas cachorro raza pequeña', 'Croquetas pequeñas y fáciles de masticar para cachorros de raza pequeña.', {
    attrs: { 'animal.target': [DOG], 'life.stage': ['life.dog.puppy'], 'size.animal': ['size.animal.small'], 'food.format': ['food.format.kibble'] },
    variants: [
      { id: 4, value: '1.5 kg', measure: kg(1.5), price: 15900, stock: OK },
      { id: 5, value: '7.5 kg', measure: kg(7.5), price: 64900, stock: OK },
    ],
  }),
  P(3, 'dog', 'Huella Verde', 'Croquetas senior sin cereales', 'Fórmula ligera para perros sénior con glucosamina.', {
    attrs: { 'animal.target': [DOG], 'life.stage': ['life.dog.senior'], 'size.animal': ['size.animal.medium', 'size.animal.large'], 'food.format': ['food.format.kibble'] },
    price: 25900, stock: low(4), mass: kg(3), img: true,
  }),
  P(4, 'dog', 'Cuatro Patas', 'Alimento húmedo adulto res y verduras', 'Lata de 380 g, ideal para mezclar con croquetas.', {
    attrs: { 'animal.target': [DOG], 'life.stage': ['life.dog.adult'], 'food.format': ['food.format.pate'] },
    price: 3900, stock: OK,
  }),
  P(5, 'dog', 'Huella Verde', 'Croquetas para hembras gestantes y lactantes', 'Mayor densidad energética para la gestación y la lactancia.', {
    attrs: { 'animal.target': [DOG], 'life.stage': ['life.dog.gestation', 'life.dog.lactation'], 'size.animal': ['size.animal.large'], 'food.format': ['food.format.kibble'] },
    price: 54900, stock: OK, mass: kg(10),
  }),
  P(6, 'dog', 'Pelaje Sano', 'Dieta veterinaria renal perro', 'Dieta de apoyo renal. Consulta el precio con tu veterinario en sucursal.', {
    attrs: { 'animal.target': [DOG], 'life.stage': ['life.dog.adult', 'life.dog.senior'], 'food.format': ['food.format.kibble'] },
    price: 98000, stock: OK, hidden: true,
  }),
  P(7, 'cat', 'Ronroneo', 'Croquetas gato adulto pollo', 'Croquetas con taurina para gatos adultos de interior.', {
    attrs: { 'animal.target': [CAT], 'life.stage': ['life.cat.adult'], 'food.format': ['food.format.kibble'] },
    img: true,
    variants: [
      { id: 6, value: '1.5 kg', measure: kg(1.5), price: 12900, stock: OK },
      { id: 7, value: '4 kg', measure: kg(4), price: 29900, stock: OK },
      { id: 8, value: '9 kg', measure: kg(9), price: 59900, stock: low(2) },
    ],
  }),
  P(8, 'cat', 'Ronroneo', 'Croquetas gatito salmón', 'Pequeñas croquetas con DHA para el crecimiento del gatito.', {
    attrs: { 'animal.target': [CAT], 'life.stage': ['life.cat.kitten'], 'food.format': ['food.format.kibble'] },
    price: 14900, stock: OK, mass: kg(1.5),
  }),
  P(9, 'cat', 'Campo Fiel', 'Croquetas gato sénior control de peso', 'Menos calorías y más fibra para gatos mayores de 8 años.', {
    attrs: { 'animal.target': [CAT], 'life.stage': ['life.cat.senior'], 'food.format': ['food.format.kibble'] },
    price: 21900, stock: OK, mass: kg(2),
  }),
  P(10, 'cat', 'Cuatro Patas', 'Paté gato adulto atún', 'Sobre de 85 g, textura suave.', {
    attrs: { 'animal.target': [CAT], 'life.stage': ['life.cat.adult'], 'food.format': ['food.format.pate'] },
    price: 1800, stock: OK,
  }),
  P(11, 'cat', 'Pelaje Sano', 'Croquetas gato esterilizado', 'Fórmula para gatos esterilizados, control de bolas de pelo.', {
    attrs: { 'animal.target': [CAT], 'life.stage': ['life.cat.adult'], 'food.format': ['food.format.kibble'] },
    price: 31900, stock: OUT, mass: kg(3), img: true,
  }),
  P(12, 'treat', 'Mordisco', 'Galletas de avena y miel', 'Galletas horneadas, sin colorantes.', {
    attrs: { 'animal.target': [DOG], 'treat.form': ['treat.form.biscuit'] },
    price: 6500, stock: OK,
  }),
  P(13, 'treat', 'Mordisco', 'Palitos dentales menta', 'Ayudan a reducir el sarro. Bolsa con 7 piezas.', {
    attrs: { 'animal.target': [DOG], 'treat.form': ['treat.form.stick'], 'size.animal': ['size.animal.medium'] },
    price: 8900, stock: low(2),
  }),
  P(14, 'treat', 'Ronroneo', 'Premios de salmón para gato', 'Bocaditos crujientes con centro suave.', {
    attrs: { 'animal.target': [CAT], 'treat.form': ['treat.form.bite'] },
    price: 4900, stock: OK, img: true,
  }),
  P(15, 'treat', 'Ronroneo', 'Snack lamible de pollo (4 sobres)', 'Premio cremoso para lamer, 4 sobres de 14 g.', {
    attrs: { 'animal.target': [CAT], 'treat.form': ['treat.form.lickable'] },
    price: 5500, stock: OK,
  }),
  P(16, 'treat', 'Granja Mía', 'Huesos de piel de res', 'Masticable de larga duración, bolsa con 3 piezas.', {
    attrs: { 'animal.target': [DOG], 'treat.form': ['treat.form.bone_shape'], 'size.animal': ['size.animal.large'] },
    price: 7900, stock: OK,
  }),
  P(17, 'toy', 'Mordisco', 'Pelota de goma resistente', 'Pelota de goma natural, rebota y flota.', {
    attrs: { 'animal.target': [DOG], 'toy.type': ['toy.type.ball'], 'size.animal': ['size.animal.medium'] },
    price: 6900, stock: OK, img: true,
  }),
  P(18, 'toy', 'Mordisco', 'Cuerda de algodón con nudos', 'Para jalar y morder, lavable.', {
    attrs: { 'animal.target': [DOG], 'toy.type': ['toy.type.rope'], 'size.animal': ['size.animal.large'] },
    price: 5900, stock: OK,
  }),
  P(19, 'toy', 'Ronroneo', 'Ratón de peluche con hierba gatera', 'Peluche con hierba gatera orgánica.', {
    attrs: { 'animal.target': [CAT], 'toy.type': ['toy.type.plush'] },
    price: 3500, stock: low(5),
  }),
  P(20, 'toy', 'Ronroneo', 'Varita con plumas', 'Varita de 60 cm con plumas intercambiables.', {
    attrs: { 'animal.target': [CAT], 'toy.type': ['toy.type.wand'] },
    price: 4500, stock: OK,
  }),
  P(21, 'toy', 'Cuatro Patas', 'Rompecabezas dispensador de premios', 'Juego de inteligencia que entrega premios al resolverlo.', {
    attrs: { 'animal.target': [DOG], 'toy.type': ['toy.type.puzzle'], 'size.animal': ['size.animal.small', 'size.animal.medium'] },
    price: 14900, stock: OK, img: true,
  }),
  P(22, 'care', 'Pelaje Sano', 'Champú hipoalergénico avena', 'Limpia sin resecar la piel sensible.', {
    attrs: { 'animal.target': [DOG], 'hygiene.type': ['hygiene.type.shampoo'] },
    variants: [
      { id: 9, value: '250 ml', measure: ml(250), price: 9900, stock: OK },
      { id: 10, value: '500 ml', measure: ml(500), price: 16900, stock: OK },
    ],
  }),
  P(23, 'care', 'Huella Verde', 'Arena sanitaria aglomerante', 'Arena de bentonita sin perfume, alta absorción.', {
    attrs: { 'animal.target': [CAT], 'hygiene.type': ['hygiene.type.litter'] },
    variants: [
      { id: 11, value: '5 kg', measure: kg(5), price: 9900, stock: OK },
      { id: 12, value: '10 kg', measure: kg(10), price: 17900, stock: OK },
    ],
  }),
  P(24, 'care', 'Pelaje Sano', 'Toallitas húmedas para mascotas', 'Paquete de 80 toallitas sin alcohol.', {
    attrs: { 'animal.target': [DOG, CAT], 'hygiene.type': ['hygiene.type.wipes'] },
    price: 7500, stock: OK,
  }),
  P(25, 'care', 'Cuatro Patas', 'Cepillo deslizador autolimpiable', 'Para pelo corto y largo, botón de limpieza.', {
    attrs: { 'animal.target': [DOG, CAT], 'hygiene.type': ['hygiene.type.brush'] },
    price: 11900, stock: OK,
  }),
  P(26, 'care', 'Granja Mía', 'Bolsas biodegradables para residuos', 'Rollo de 120 bolsas. Solo disponible en lista Público.', {
    attrs: { 'animal.target': [DOG], 'hygiene.type': ['hygiene.type.bag'] },
    price: 4200, stock: OK, noMayoreo: true,
  }),
]

// ---------------------------------------------------------------- derived products
const statusOf = (stock) => stock[0]
function sp(stock, { productLevel = false } = {}) {
  return {
    mode: 'SYSTEM_STATUS_EXACT_LOW_STOCK',
    status: stock[0],
    customQuantity: null,
    exactQuantity: !productLevel && stock[0] === 'low_stock' ? stock[1] : null,
  }
}
function aggregateStatus(variants) {
  const statuses = variants.map((v) => v.stock[0])
  if (statuses.includes('available')) return 'available'
  if (statuses.includes('low_stock')) return 'low_stock'
  return 'out_of_stock'
}

// First in the array is the newest; the stride shuffles categories so `newest` is varied.
const ORDERED = RAW.map((p, i) => ({ p, rank: (i * 7) % RAW.length })).sort((a, b) => a.rank - b.rank).map((e) => e.p)
const PRODUCTS = ORDERED.map((p, index) => {
  const hasVariants = Boolean(p.variants)
  const basePrice = hasVariants ? Math.max(...p.variants.map((v) => v.price)) : p.price
  const status = hasVariants ? aggregateStatus(p.variants) : statusOf(p.stock)
  return {
    ...p,
    id: uuid('0b2f0000', p.n),
    createdRank: index,
    hasVariants,
    basePrice,
    status,
    stockPresentation: hasVariants ? sp([status, null], { productLevel: true }) : sp(p.stock),
  }
})
const byId = new Map(PRODUCTS.map((p) => [p.id, p]))

const scale = (cents, list) => (list.priceListId === PRICE_LISTS.mayoreo.priceListId ? Math.round(cents * MAYOREO_FACTOR) : cents)
const sold = (p, list) => !(p.noMayoreo && list.priceListId === PRICE_LISTS.mayoreo.priceListId)
const fromPrice = (p, list) => (p.hidden ? null : scale(p.hasVariants ? Math.min(...p.variants.map((v) => v.price)) : p.price, list))
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function attributeOf(code, optionCodes) {
  const def = DEFS[code]
  const options = optionCodes.map((c) => ({ code: c, label: def.options[c] }))
  const section = { code: def.section[0], label: def.section[1] }
  if (def.type === 'single') {
    return { code, label: def.label, facet: true, section, value: { type: 'single', option: options[0] }, display: options[0].label }
  }
  return { code, label: def.label, facet: true, section, value: { type: 'multi', options }, display: options.map((o) => o.label).join(', ') }
}
function measureAttribute(m) {
  const display = `${m.value} ${m.unit.label}`
  return {
    code: m.code,
    label: m.label,
    facet: false,
    section: { code: 'contenido-empaque', label: 'Contenido y empaque' },
    value: { type: 'number', value: m.value, unit: m.unit },
    display,
  }
}
function productAttributes(p) {
  const list = DEF_ORDER.filter((code) => p.attrs[code]).map((code) => attributeOf(code, p.attrs[code]))
  if (!p.hasVariants && p.mass) list.push(measureAttribute(p.mass))
  if (p.ingredients) {
    list.push({
      code: 'text.ingredients',
      label: 'Ingredientes',
      facet: false,
      section: { code: 'composicion', label: 'Composición' },
      value: { type: 'text', text: p.ingredients },
      display: p.ingredients,
    })
  }
  return list
}

// ---------------------------------------------------------------- listing
class HttpError extends Error {
  constructor(status, body) {
    super(String(status))
    this.status = status
    this.body = body
  }
}

function parseFacets(tokens) {
  const byDefinition = new Map()
  for (const token of tokens) {
    const [definition, option] = token.split(':')
    if (!definition || !option || !DEFS[definition] || !DEFS[definition].options[option]) {
      throw new HttpError(400, {
        statusCode: 400,
        error: 'FACET_NOT_AVAILABLE',
        message: `Facet is not available: ${token}`,
        timestamp: new Date().toISOString(),
      })
    }
    if (!byDefinition.has(definition)) byDefinition.set(definition, new Set())
    byDefinition.get(definition).add(option)
  }
  return byDefinition
}
const matchesFacets = (p, selected, skip = null) =>
  [...selected].every(([definition, options]) => definition === skip || (p.attrs[definition] ?? []).some((o) => options.has(o)))
const matchesQuery = (p, q) => !q || norm(p.name).includes(norm(q)) || norm(p.brand).includes(norm(q))

function cardOf(p, list) {
  const category = CATEGORIES[p.cat]
  return {
    id: p.id,
    name: p.name,
    slug: null,
    description: p.description,
    category: { id: category.id, name: category.name },
    brand: { name: p.brand },
    image: p.img ? { url: IMAGE } : null,
    price: p.hidden
      ? { fromPriceCents: null, priceCents: null, hidden: true }
      : { fromPriceCents: fromPrice(p, list), priceCents: scale(p.basePrice, list), hidden: false },
    availability: p.stockPresentation.status,
    stockPresentation: p.stockPresentation,
    hasVariants: p.hasVariants,
    rating: null,
    featuredLabel: null,
  }
}

function listProducts(slug, params) {
  const contexts = CONTEXTS[slug]
  const requested = params.get('priceListId')
  const list = requested ? contexts.find((c) => c.priceListId === requested) : contexts.find((c) => c.isCatalogDefault)
  if (!list) throw new HttpError(404, { statusCode: 404, error: 'Not Found', message: 'Price list not published' })

  const q = (params.get('q') ?? '').trim()
  const categoryId = params.get('categoryId')
  const selected = parseFacets(params.getAll('facet'))
  const sort = params.get('sort') ?? 'newest'
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(params.get('limit') ?? '20', 10) || 20))

  const eligible = PRODUCTS.filter((p) => sold(p, list))
  const excludedCount = PRODUCTS.length - eligible.length
  const base = eligible.filter((p) => matchesQuery(p, q))
  const filtered = base.filter((p) => (!categoryId || CATEGORIES[p.cat].id === categoryId) && matchesFacets(p, selected))

  const price = (p) => fromPrice(p, list)
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'price_asc' || sort === 'price_desc') {
      const pa = price(a)
      const pb = price(b)
      if (pa === null && pb !== null) return 1
      if (pb === null && pa !== null) return -1
      if (pa !== pb) return sort === 'price_asc' ? pa - pb : pb - pa
      return a.name.localeCompare(b.name, 'es-MX') || a.id.localeCompare(b.id)
    }
    return a.createdRank - b.createdRank
  })
  const total = sorted.length
  const items = sorted.slice((page - 1) * limit, page * limit).map((p) => cardOf(p, list))

  // Category counts: q and facets applied, the category filter itself excluded (menu keeps siblings).
  const categoryPool = base.filter((p) => matchesFacets(p, selected))
  const categories = Object.values(CATEGORIES)
    .map((c) => ({ id: c.id, name: c.name, count: categoryPool.filter((p) => CATEGORIES[p.cat].id === c.id).length }))
    .filter((c) => c.count > 0 || c.id === categoryId)

  // Attribute counts: every other filter applies, the definition's own selection is excluded.
  const attributes = FACET_DEFS.map((code) => {
    const pool = base.filter((p) => (!categoryId || CATEGORIES[p.cat].id === categoryId) && matchesFacets(p, selected, code))
    const counts = new Map()
    for (const p of pool) for (const option of p.attrs[code] ?? []) counts.set(option, (counts.get(option) ?? 0) + 1)
    const own = selected.get(code) ?? new Set()
    const options = Object.entries(DEFS[code].options)
      .map(([optionCode, label]) => ({ code: optionCode, label, count: counts.get(optionCode) ?? 0 }))
      .filter((o) => o.count > 0 || own.has(o.code))
      .sort((a, b) => a.label.localeCompare(b.label, 'es-MX'))
    return { code, label: DEFS[code].label, options }
  })
    .filter((d) => d.options.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label, 'es-MX'))

  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), },
    facets: { categories, attributes },
    excludedCount,
    priceContext: list,
  }
}

// ---------------------------------------------------------------- detail
function detailOf(slug, p, list) {
  const branch = BRANCHES[slug]
  const availabilityOf = (status) => [
    { branchId: branch.id, branchName: branch.name, branchSlug: branch.slug, availability: status, isSelected: true },
  ]
  const category = CATEGORIES[p.cat]
  const images = p.img
    ? [
        { id: uuid('1a9e0000', p.n * 10 + 1), url: IMAGE, isMain: true },
        { id: uuid('1a9e0000', p.n * 10 + 2), url: IMAGE, isMain: false },
      ]
    : []
  const variants = (p.variants ?? []).map((v) => ({
    id: uuid('7a710000', v.id),
    name: `${p.name} ${v.value}`,
    option: v.measure.code === 'measure.net_volume' ? 'Volumen' : 'Peso',
    value: v.value,
    image: p.img ? { url: IMAGE } : null,
    price: { priceCents: scale(v.price, list), hidden: false },
    availabilityByBranch: availabilityOf(v.stock[0]),
    stockPresentation: sp(v.stock),
    attributes: [measureAttribute(v.measure)],
  }))
  return {
    id: p.id,
    name: p.name,
    slug: null,
    description: p.description,
    category: { id: category.id, name: category.name },
    brand: { name: p.brand },
    images,
    price: p.hidden ? { priceCents: null, hidden: true } : { priceCents: scale(p.basePrice, list), hidden: false },
    availability: p.stockPresentation.status,
    stockPresentation: p.stockPresentation,
    hasVariants: p.hasVariants,
    variants,
    rating: null,
    featuredLabel: null,
    attributes: productAttributes(p),
    priceContext: list,
    excludedCount: 0,
  }
}

// ---------------------------------------------------------------- server
const notFound = () => new HttpError(404, { message: 'Not Found', error: 'Not Found', statusCode: 404 })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function route(url) {
  const path = url.pathname.replace(/\/+$/, '')
  if (path === '/__mock/mode') {
    const value = url.searchParams.get('value')
    if (value) {
      if (!['ok', 'error', 'slow'].includes(value)) throw new HttpError(400, { error: 'mode must be ok|error|slow' })
      mode = value
    }
    return { mode }
  }
  if (path === '/public/catalog/branches') return Object.values(BRANCHES)

  const match = /^\/public\/catalog\/([^/]+)\/(price-contexts|products|branch)(?:\/([^/]+))?$/.exec(path)
  if (!match) throw notFound()
  const [, slug, resource, id] = match
  if (!BRANCHES[slug]) throw notFound()

  if (resource === 'price-contexts' && !id) return CONTEXTS[slug]
  if (resource === 'branch' && !id) {
    if (!BRANCH_DETAIL[slug]) throw notFound()
    return BRANCH_DETAIL[slug]
  }
  if (resource === 'products' && !id) {
    if (mode === 'error') throw new HttpError(500, { statusCode: 500, message: 'Internal server error' })
    return listProducts(slug, url.searchParams)
  }
  if (resource === 'products' && id) {
    const product = byId.get(id)
    const requested = url.searchParams.get('priceListId')
    const list = requested ? CONTEXTS[slug].find((c) => c.priceListId === requested) : CONTEXTS[slug].find((c) => c.isCatalogDefault)
    if (!product || !list || !sold(product, list)) throw notFound()
    return detailOf(slug, product, list)
  }
  throw notFound()
}

const server = http.createServer(async (req, res) => {
  const headers = {
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers)
    res.end()
    return
  }
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  if (mode === 'slow' && url.pathname !== '/__mock/mode') await sleep(2500)
  let status = 200
  let body
  try {
    if (req.method !== 'GET') throw notFound()
    body = route(url)
  } catch (error) {
    if (error instanceof HttpError) {
      status = error.status
      body = error.body
    } else {
      status = 500
      body = { statusCode: 500, message: String(error) }
    }
  }
  res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
  console.log(`${req.method} ${url.pathname}${url.search} -> ${status}`)
})

server.listen(PORT, () => {
  console.log(`public catalog mock on http://localhost:${PORT} (mode=${mode}, cors=${ORIGIN}, ${PRODUCTS.length} products)`)
})
