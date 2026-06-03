import type {
  PublicBranchDto,
  PublicCatalogProductCard,
  PublicCatalogProductDetail,
  PublicVariantDto,
  PublicStockStatus,
  CatalogCategory,
} from '../interfaces/catalog.types'

// ─── Branches ────────────────────────────────────────────────────────────────

export const MOCK_BRANCHES: PublicBranchDto[] = [
  {
    id: 'branch-centro-uuid',
    name: 'Sucursal Centro',
    slug: 'centro',
    address: 'Av. Hidalgo 240, Centro',
    phone: '+5215512345678',
  },
  {
    id: 'branch-norte-uuid',
    name: 'Sucursal Norte',
    slug: 'norte',
    address: 'Plaza Cumbres, Local 12',
    phone: '+5215587654321',
  },
  {
    id: 'branch-sur-uuid',
    name: 'Sucursal Sur',
    slug: 'sur',
    address: 'Blvd. del Valle 1180',
    phone: '+5215598765432',
  },
]

// ─── Categories ──────────────────────────────────────────────────────────────

export const MOCK_CATEGORIES: CatalogCategory[] = [
  { id: 'cat-perro', name: 'Perro', emoji: '🐕' },
  { id: 'cat-gato', name: 'Gato', emoji: '🐈' },
  { id: 'cat-juguetes', name: 'Juguetes', emoji: '🎾' },
  { id: 'cat-salud', name: 'Salud', emoji: '💊' },
  { id: 'cat-higiene', name: 'Higiene', emoji: '🧼' },
  { id: 'cat-accesorios', name: 'Accesorios', emoji: '🎀' },
]

// ─── Color palette for product card placeholders ─────────────────────────────

export const PASTEL_COLORS = [
  'bg-emerald-100', // mint
  'bg-orange-100', // peach
  'bg-violet-100', // lavender
  'bg-sky-100', // baby blue
  'bg-pink-100', // light pink
  'bg-amber-100', // cream
  'bg-rose-100', // rose
  'bg-teal-100', // teal
  'bg-indigo-100', // soft indigo
  'bg-lime-100', // soft lime
] as const

export type PastelColor = (typeof PASTEL_COLORS)[number]

export function getProductColor(index: number): PastelColor {
  return PASTEL_COLORS[index % PASTEL_COLORS.length]!
}

// ─── Helper to generate per-branch availability ──────────────────────────────

function branchAvailability(
  statuses: Record<string, PublicStockStatus>,
  selectedSlug: string,
) {
  return MOCK_BRANCHES.map((b) => ({
    branchId: b.id,
    branchName: b.name,
    branchSlug: b.slug,
    availability: statuses[b.slug] ?? ('available' as PublicStockStatus),
    isSelected: b.slug === selectedSlug,
  }))
}

// ─── Products (20 realistic Mexican pet store products) ──────────────────────

type MockProduct = PublicCatalogProductCard & {
  _detail: Omit<
    PublicCatalogProductDetail,
    | 'id'
    | 'name'
    | 'slug'
    | 'category'
    | 'brand'
    | 'availability'
    | 'hasVariants'
    | 'rating'
    | 'featuredLabel'
  >
}

export const MOCK_PRODUCTS: MockProduct[] = [
  // ─── 1. Perro ──────────────────────────────────────────────────────────
  {
    id: 'prod-01',
    name: 'Adult Medium Breed',
    slug: null,
    description: 'Alimento seco premium para perros adultos de raza mediana. Formulado con proteínas de alta calidad y nutrientes esenciales para una vida activa y saludable.',
    category: { id: 'cat-perro', name: 'Perro' },
    brand: { name: 'Royal Canin' },
    image: null,
    price: { fromPriceCents: 48900, priceCents: 125900, hidden: false },
    availability: 'available',
    hasVariants: true,
    rating: 4.8,
    featuredLabel: 'Mas vendido',
    _detail: {
      description: 'Alimento seco premium para perros adultos de raza mediana. Formulado con proteínas de alta calidad y nutrientes esenciales para una vida activa y saludable.',
      images: [],
      price: { priceCents: 125900, hidden: false },
      variants: [
        {
          id: 'var-01a',
          name: '3 kg',
          option: 'Peso',
          value: '3 kg',
          image: null,
          price: { priceCents: 48900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'low_stock' }, 'centro'),
        },
        {
          id: 'var-01b',
          name: '10 kg',
          option: 'Peso',
          value: '10 kg',
          image: null,
          price: { priceCents: 125900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'available' }, 'centro'),
        },
        {
          id: 'var-01c',
          name: '15 kg',
          option: 'Peso',
          value: '15 kg',
          image: null,
          price: { priceCents: 175900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'out_of_stock', sur: 'available' }, 'centro'),
        },
      ],
    },
  },
  {
    id: 'prod-02',
    name: 'Etapa 3 Nutrición Completa',
    slug: null,
    description: 'Croquetas para perros adultos con nutrientes balanceados. Fortalece huesos y articulaciones.',
    category: { id: 'cat-perro', name: 'Perro' },
    brand: { name: 'Pedigree' },
    image: null,
    price: { fromPriceCents: 32900, priceCents: 89900, hidden: false },
    availability: 'available',
    hasVariants: true,
    rating: 4.3,
    featuredLabel: null,
    _detail: {
      description: 'Croquetas para perros adultos con nutrientes balanceados. Fortalece huesos y articulaciones.',
      images: [],
      price: { priceCents: 89900, hidden: false },
      variants: [
        {
          id: 'var-02a',
          name: '2 kg',
          option: 'Peso',
          value: '2 kg',
          image: null,
          price: { priceCents: 32900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'available' }, 'centro'),
        },
        {
          id: 'var-02b',
          name: '10 kg',
          option: 'Peso',
          value: '10 kg',
          image: null,
          price: { priceCents: 89900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'low_stock', sur: 'available' }, 'centro'),
        },
        {
          id: 'var-02c',
          name: '25 kg',
          option: 'Peso',
          value: '25 kg',
          image: null,
          price: { priceCents: 175000, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'low_stock', norte: 'available', sur: 'out_of_stock' }, 'centro'),
        },
      ],
    },
  },
  {
    id: 'prod-03',
    name: 'Pro Plan Adult Sensitive Skin',
    slug: null,
    description: 'Fórmula especializada para perros con piel sensible. Con salmón como proteína principal y ácidos grasos omega.',
    category: { id: 'cat-perro', name: 'Perro' },
    brand: { name: 'Pro Plan' },
    image: null,
    price: { fromPriceCents: 65900, priceCents: 149900, hidden: false },
    availability: 'available',
    hasVariants: true,
    rating: 4.7,
    featuredLabel: 'Premium',
    _detail: {
      description: 'Fórmula especializada para perros con piel sensible. Con salmón como proteína principal y ácidos grasos omega.',
      images: [],
      price: { priceCents: 149900, hidden: false },
      variants: [
        {
          id: 'var-03a',
          name: '3 kg',
          option: 'Peso',
          value: '3 kg',
          image: null,
          price: { priceCents: 65900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'available' }, 'centro'),
        },
        {
          id: 'var-03b',
          name: '13 kg',
          option: 'Peso',
          value: '13 kg',
          image: null,
          price: { priceCents: 149900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'low_stock' }, 'centro'),
        },
      ],
    },
  },
  {
    id: 'prod-04',
    name: "Hill's Science Diet Adult",
    slug: null,
    description: 'Nutrición clínicamente probada para perros adultos. Ingredientes naturales de alta calidad.',
    category: { id: 'cat-perro', name: 'Perro' },
    brand: { name: "Hill's" },
    image: null,
    price: { fromPriceCents: 72900, priceCents: 159900, hidden: false },
    availability: 'low_stock',
    hasVariants: true,
    rating: 4.6,
    featuredLabel: null,
    _detail: {
      description: 'Nutrición clínicamente probada para perros adultos. Ingredientes naturales de alta calidad.',
      images: [],
      price: { priceCents: 159900, hidden: false },
      variants: [
        {
          id: 'var-04a',
          name: '3.5 kg',
          option: 'Peso',
          value: '3.5 kg',
          image: null,
          price: { priceCents: 72900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'low_stock', norte: 'available', sur: 'available' }, 'centro'),
        },
        {
          id: 'var-04b',
          name: '13.6 kg',
          option: 'Peso',
          value: '13.6 kg',
          image: null,
          price: { priceCents: 159900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'low_stock', norte: 'out_of_stock', sur: 'available' }, 'centro'),
        },
      ],
    },
  },
  {
    id: 'prod-05',
    name: 'Cachorro Raza Pequeña',
    slug: null,
    description: 'Alimento para cachorros de raza pequeña con DHA para el desarrollo cerebral.',
    category: { id: 'cat-perro', name: 'Perro' },
    brand: { name: 'Royal Canin' },
    image: null,
    price: { fromPriceCents: 45900, priceCents: 45900, hidden: false },
    availability: 'available',
    hasVariants: false,
    rating: 4.9,
    featuredLabel: 'Favorito',
    _detail: {
      description: 'Alimento para cachorros de raza pequeña con DHA para el desarrollo cerebral.',
      images: [],
      price: { priceCents: 45900, hidden: false },
      variants: [],
    },
  },
  // ─── 2. Gato ───────────────────────────────────────────────────────────
  {
    id: 'prod-06',
    name: 'Atún en Salsa Pouch',
    slug: null,
    description: 'Alimento húmedo para gatos adultos. Delicioso atún en salsa que encantará a tu felino.',
    category: { id: 'cat-gato', name: 'Gato' },
    brand: { name: 'Whiskas' },
    image: null,
    price: { fromPriceCents: 1800, priceCents: 19900, hidden: false },
    availability: 'available',
    hasVariants: true,
    rating: 4.2,
    featuredLabel: null,
    _detail: {
      description: 'Alimento húmedo para gatos adultos. Delicioso atún en salsa que encantará a tu felino.',
      images: [],
      price: { priceCents: 19900, hidden: false },
      variants: [
        {
          id: 'var-06a',
          name: '85 g',
          option: 'Presentación',
          value: '85 g',
          image: null,
          price: { priceCents: 1800, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'available' }, 'centro'),
        },
        {
          id: 'var-06b',
          name: 'Pack 12 pz',
          option: 'Presentación',
          value: 'Pack 12 pz',
          image: null,
          price: { priceCents: 19900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'low_stock', sur: 'available' }, 'centro'),
        },
      ],
    },
  },
  {
    id: 'prod-07',
    name: 'Felix Sensaciones en Salsa',
    slug: null,
    description: 'Sobres de comida húmeda para gatos con trocitos en salsa. Variedad de sabores irresistibles.',
    category: { id: 'cat-gato', name: 'Gato' },
    brand: { name: 'Felix' },
    image: null,
    price: { fromPriceCents: 2200, priceCents: 2200, hidden: false },
    availability: 'available',
    hasVariants: false,
    rating: 4.4,
    featuredLabel: 'Nuevo',
    _detail: {
      description: 'Sobres de comida húmeda para gatos con trocitos en salsa. Variedad de sabores irresistibles.',
      images: [],
      price: { priceCents: 2200, hidden: false },
      variants: [],
    },
  },
  {
    id: 'prod-08',
    name: 'Indoor Adult',
    slug: null,
    description: 'Alimento seco para gatos de interior. Fórmula con fibra para bolas de pelo y control de peso.',
    category: { id: 'cat-gato', name: 'Gato' },
    brand: { name: 'Royal Canin' },
    image: null,
    price: { fromPriceCents: 52900, priceCents: 119900, hidden: false },
    availability: 'available',
    hasVariants: true,
    rating: 4.7,
    featuredLabel: 'Mas vendido',
    _detail: {
      description: 'Alimento seco para gatos de interior. Fórmula con fibra para bolas de pelo y control de peso.',
      images: [],
      price: { priceCents: 119900, hidden: false },
      variants: [
        {
          id: 'var-08a',
          name: '1.5 kg',
          option: 'Peso',
          value: '1.5 kg',
          image: null,
          price: { priceCents: 52900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'available' }, 'centro'),
        },
        {
          id: 'var-08b',
          name: '4 kg',
          option: 'Peso',
          value: '4 kg',
          image: null,
          price: { priceCents: 119900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'low_stock' }, 'centro'),
        },
        {
          id: 'var-08c',
          name: '10 kg',
          option: 'Peso',
          value: '10 kg',
          image: null,
          price: { priceCents: 249900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'low_stock', norte: 'out_of_stock', sur: 'available' }, 'centro'),
        },
      ],
    },
  },
  // ─── 3. Juguetes ───────────────────────────────────────────────────────
  {
    id: 'prod-09',
    name: 'Classic Kong',
    slug: null,
    description: 'Juguete dispensador de premios de caucho natural ultra resistente. Ideal para perros que muerden mucho.',
    category: { id: 'cat-juguetes', name: 'Juguetes' },
    brand: { name: 'Kong' },
    image: null,
    price: { fromPriceCents: 24900, priceCents: 34900, hidden: false },
    availability: 'available',
    hasVariants: true,
    rating: 4.9,
    featuredLabel: 'Favorito',
    _detail: {
      description: 'Juguete dispensador de premios de caucho natural ultra resistente. Ideal para perros que muerden mucho.',
      images: [],
      price: { priceCents: 34900, hidden: false },
      variants: [
        {
          id: 'var-09a',
          name: 'Mediano',
          option: 'Tamaño',
          value: 'Mediano',
          image: null,
          price: { priceCents: 24900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'available' }, 'centro'),
        },
        {
          id: 'var-09b',
          name: 'Grande',
          option: 'Tamaño',
          value: 'Grande',
          image: null,
          price: { priceCents: 34900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'out_of_stock' }, 'centro'),
        },
      ],
    },
  },
  {
    id: 'prod-10',
    name: 'Pelota de Cuerda Dental',
    slug: null,
    description: 'Pelota con cuerda para limpiar dientes mientras juega. Material seguro y duradero.',
    category: { id: 'cat-juguetes', name: 'Juguetes' },
    brand: { name: 'HoundFe' },
    image: null,
    price: { fromPriceCents: 8900, priceCents: 8900, hidden: false },
    availability: 'available',
    hasVariants: false,
    rating: 4.1,
    featuredLabel: null,
    _detail: {
      description: 'Pelota con cuerda para limpiar dientes mientras juega. Material seguro y duradero.',
      images: [],
      price: { priceCents: 8900, hidden: false },
      variants: [],
    },
  },
  {
    id: 'prod-11',
    name: 'Ratón de Peluche con Catnip',
    slug: null,
    description: 'Ratón de peluche relleno de catnip orgánico. Irresistible para gatos.',
    category: { id: 'cat-juguetes', name: 'Juguetes' },
    brand: { name: 'Plato Feliz' },
    image: null,
    price: { fromPriceCents: 6900, priceCents: 6900, hidden: false },
    availability: 'low_stock',
    hasVariants: false,
    rating: 4.5,
    featuredLabel: null,
    _detail: {
      description: 'Ratón de peluche relleno de catnip orgánico. Irresistible para gatos.',
      images: [],
      price: { priceCents: 6900, hidden: false },
      variants: [],
    },
  },
  // ─── 4. Salud ──────────────────────────────────────────────────────────
  {
    id: 'prod-12',
    name: 'Antipulgas y Garrapatas',
    slug: null,
    description: 'Pipeta antipulgas de aplicación tópica. Protección por 30 días contra pulgas, garrapatas y mosquitos.',
    category: { id: 'cat-salud', name: 'Salud' },
    brand: { name: 'HoundFe' },
    image: null,
    price: { fromPriceCents: 35900, priceCents: 35900, hidden: false },
    availability: 'available',
    hasVariants: false,
    rating: 4.6,
    featuredLabel: 'Mas vendido',
    _detail: {
      description: 'Pipeta antipulgas de aplicación tópica. Protección por 30 días contra pulgas, garrapatas y mosquitos.',
      images: [],
      price: { priceCents: 35900, hidden: false },
      variants: [],
    },
  },
  {
    id: 'prod-13',
    name: 'Desparasitante Interno',
    slug: null,
    description: 'Tabletas desparasitantes de amplio espectro. Requiere prescripción veterinaria.',
    category: { id: 'cat-salud', name: 'Salud' },
    brand: { name: "Hill's" },
    image: null,
    price: { fromPriceCents: null, priceCents: null, hidden: true },
    availability: 'available',
    hasVariants: false,
    rating: 4.3,
    featuredLabel: null,
    _detail: {
      description: 'Tabletas desparasitantes de amplio espectro. Requiere prescripción veterinaria.',
      images: [],
      price: { priceCents: null, hidden: true },
      variants: [],
    },
  },
  {
    id: 'prod-14',
    name: 'Multivitamínico Senior',
    slug: null,
    description: 'Suplemento multivitamínico para perros senior (+7 años). Apoya articulaciones, visión y vitalidad.',
    category: { id: 'cat-salud', name: 'Salud' },
    brand: { name: 'Pro Plan' },
    image: null,
    price: { fromPriceCents: null, priceCents: null, hidden: true },
    availability: 'available',
    hasVariants: false,
    rating: 4.4,
    featuredLabel: null,
    _detail: {
      description: 'Suplemento multivitamínico para perros senior (+7 años). Apoya articulaciones, visión y vitalidad.',
      images: [],
      price: { priceCents: null, hidden: true },
      variants: [],
    },
  },
  // ─── 5. Higiene ────────────────────────────────────────────────────────
  {
    id: 'prod-15',
    name: 'Shampoo Antipulgas Natural',
    slug: null,
    description: 'Shampoo con extractos naturales de neem y citronela. Limpia profundamente y repele pulgas.',
    category: { id: 'cat-higiene', name: 'Higiene' },
    brand: { name: 'HoundFe' },
    image: null,
    price: { fromPriceCents: 15900, priceCents: 15900, hidden: false },
    availability: 'available',
    hasVariants: false,
    rating: 4.2,
    featuredLabel: null,
    _detail: {
      description: 'Shampoo con extractos naturales de neem y citronela. Limpia profundamente y repele pulgas.',
      images: [],
      price: { priceCents: 15900, hidden: false },
      variants: [],
    },
  },
  {
    id: 'prod-16',
    name: 'Arena Aglutinante Natural',
    slug: null,
    description: 'Arena para gato de maíz 100% biodegradable. Aglutina rápido, controla olores naturalmente.',
    category: { id: 'cat-higiene', name: 'Higiene' },
    brand: { name: "World's Best" },
    image: null,
    price: { fromPriceCents: 28900, priceCents: 64900, hidden: false },
    availability: 'available',
    hasVariants: true,
    rating: 4.8,
    featuredLabel: 'Premium',
    _detail: {
      description: 'Arena para gato de maíz 100% biodegradable. Aglutina rápido, controla olores naturalmente.',
      images: [],
      price: { priceCents: 64900, hidden: false },
      variants: [
        {
          id: 'var-16a',
          name: '3.18 kg',
          option: 'Peso',
          value: '3.18 kg',
          image: null,
          price: { priceCents: 28900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'available' }, 'centro'),
        },
        {
          id: 'var-16b',
          name: '6.35 kg',
          option: 'Peso',
          value: '6.35 kg',
          image: null,
          price: { priceCents: 64900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'low_stock' }, 'centro'),
        },
      ],
    },
  },
  {
    id: 'prod-17',
    name: 'Toallas Húmedas Multiusos',
    slug: null,
    description: 'Toallitas húmedas desechables para limpieza rápida de patas, cara y cuerpo. Sin alcohol.',
    category: { id: 'cat-higiene', name: 'Higiene' },
    brand: { name: 'HoundFe' },
    image: null,
    price: { fromPriceCents: 8900, priceCents: 8900, hidden: false },
    availability: 'out_of_stock',
    hasVariants: false,
    rating: 4.0,
    featuredLabel: null,
    _detail: {
      description: 'Toallitas húmedas desechables para limpieza rápida de patas, cara y cuerpo. Sin alcohol.',
      images: [],
      price: { priceCents: 8900, hidden: false },
      variants: [],
    },
  },
  // ─── 6. Accesorios ─────────────────────────────────────────────────────
  {
    id: 'prod-18',
    name: 'Collar Ajustable Reflectante',
    slug: null,
    description: 'Collar de nylon con banda reflectante para paseos nocturnos. Hebilla de liberación rápida.',
    category: { id: 'cat-accesorios', name: 'Accesorios' },
    brand: { name: 'HoundFe' },
    image: null,
    price: { fromPriceCents: 12900, priceCents: 18900, hidden: false },
    availability: 'available',
    hasVariants: true,
    rating: 4.3,
    featuredLabel: null,
    _detail: {
      description: 'Collar de nylon con banda reflectante para paseos nocturnos. Hebilla de liberación rápida.',
      images: [],
      price: { priceCents: 18900, hidden: false },
      variants: [
        {
          id: 'var-18a',
          name: 'Mediano',
          option: 'Tamaño',
          value: 'Mediano',
          image: null,
          price: { priceCents: 12900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'available' }, 'centro'),
        },
        {
          id: 'var-18b',
          name: 'Grande',
          option: 'Tamaño',
          value: 'Grande',
          image: null,
          price: { priceCents: 18900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'low_stock', sur: 'available' }, 'centro'),
        },
      ],
    },
  },
  {
    id: 'prod-19',
    name: 'Plato Doble Acero Inoxidable',
    slug: null,
    description: 'Plato doble de acero inoxidable con base antideslizante. Para agua y comida.',
    category: { id: 'cat-accesorios', name: 'Accesorios' },
    brand: { name: 'Plato Feliz' },
    image: null,
    price: { fromPriceCents: 19900, priceCents: 19900, hidden: false },
    availability: 'available',
    hasVariants: false,
    rating: 4.5,
    featuredLabel: 'Nuevo',
    _detail: {
      description: 'Plato doble de acero inoxidable con base antideslizante. Para agua y comida.',
      images: [],
      price: { priceCents: 19900, hidden: false },
      variants: [],
    },
  },
  {
    id: 'prod-20',
    name: 'Cama Ortopédica Memory Foam',
    slug: null,
    description: 'Cama ortopédica con espuma de memoria para perros medianos y grandes. Funda lavable y antideslizante.',
    category: { id: 'cat-accesorios', name: 'Accesorios' },
    brand: { name: 'HoundFe' },
    image: null,
    price: { fromPriceCents: 89900, priceCents: 129900, hidden: false },
    availability: 'available',
    hasVariants: true,
    rating: 4.7,
    featuredLabel: 'Premium',
    _detail: {
      description: 'Cama ortopédica con espuma de memoria para perros medianos y grandes. Funda lavable y antideslizante.',
      images: [],
      price: { priceCents: 129900, hidden: false },
      variants: [
        {
          id: 'var-20a',
          name: 'Mediano (60x80 cm)',
          option: 'Tamaño',
          value: 'Mediano',
          image: null,
          price: { priceCents: 89900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'low_stock', sur: 'available' }, 'centro'),
        },
        {
          id: 'var-20b',
          name: 'Grande (80x110 cm)',
          option: 'Tamaño',
          value: 'Grande',
          image: null,
          price: { priceCents: 129900, hidden: false },
          availabilityByBranch: branchAvailability({ centro: 'available', norte: 'available', sur: 'out_of_stock' }, 'centro'),
        },
      ],
    },
  },
]

// ─── Helper to resolve a product detail from mock data ───────────────────────

export function getMockProductDetail(
  productId: string,
  selectedBranchSlug: string,
): PublicCatalogProductDetail | null {
  const product = MOCK_PRODUCTS.find((p) => p.id === productId)
  if (!product) return null

  const variants: PublicVariantDto[] = product._detail.variants.map((v) => ({
    ...v,
    availabilityByBranch: v.availabilityByBranch.map((a) => ({
      ...a,
      isSelected: a.branchSlug === selectedBranchSlug,
    })),
  }))

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category,
    brand: product.brand,
    images: product._detail.images,
    price: product._detail.price,
    availability: product.availability,
    hasVariants: product.hasVariants,
    variants,
    rating: product.rating,
    featuredLabel: product.featuredLabel,
  }
}
