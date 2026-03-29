import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import type { Product, ProductStatus } from '../interfaces/product.types'

const categories = [
  'Computadoras',
  'Periféricos',
  'Almacenamiento',
  'Audio',
  'Accesorios',
  'Cables',
  'Componentes',
] as const

const productTemplates: { name: string; prefix: string; category: (typeof categories)[number] }[] =
  [
    { name: 'Laptop HP ProBook 450 G10', prefix: 'LAP', category: 'Computadoras' },
    { name: 'Notebook Lenovo ThinkPad T14', prefix: 'LAP', category: 'Computadoras' },
    { name: 'Desktop Dell OptiPlex 7010', prefix: 'DES', category: 'Computadoras' },
    { name: 'MacBook Air M3 15"', prefix: 'LAP', category: 'Computadoras' },
    { name: 'All-in-One HP EliteOne 840', prefix: 'AIO', category: 'Computadoras' },
    { name: 'Mouse Logitech MX Master 3S', prefix: 'MOU', category: 'Periféricos' },
    { name: 'Mouse Razer DeathAdder V3', prefix: 'MOU', category: 'Periféricos' },
    { name: 'Teclado Mecánico Redragon K552', prefix: 'TEC', category: 'Periféricos' },
    { name: 'Teclado Logitech MX Keys S', prefix: 'TEC', category: 'Periféricos' },
    { name: 'Monitor LG UltraWide 34"', prefix: 'MON', category: 'Periféricos' },
    { name: 'Monitor Samsung Odyssey G5 27"', prefix: 'MON', category: 'Periféricos' },
    { name: 'Monitor Dell UltraSharp 27"', prefix: 'MON', category: 'Periféricos' },
    { name: 'Webcam Logitech C920 HD Pro', prefix: 'WEB', category: 'Periféricos' },
    { name: 'Webcam Logitech Brio 4K', prefix: 'WEB', category: 'Periféricos' },
    { name: 'SSD Samsung 870 EVO 1TB', prefix: 'SSD', category: 'Almacenamiento' },
    { name: 'SSD Kingston NV2 500GB', prefix: 'SSD', category: 'Almacenamiento' },
    { name: 'SSD WD Blue SN580 2TB', prefix: 'SSD', category: 'Almacenamiento' },
    { name: 'Disco Externo Seagate 2TB', prefix: 'HDD', category: 'Almacenamiento' },
    { name: 'Disco Externo WD Elements 4TB', prefix: 'HDD', category: 'Almacenamiento' },
    { name: 'Pendrive Kingston 64GB USB 3.2', prefix: 'USB', category: 'Almacenamiento' },
    { name: 'Auriculares Sony WH-1000XM5', prefix: 'AUR', category: 'Audio' },
    { name: 'Auriculares HyperX Cloud III', prefix: 'AUR', category: 'Audio' },
    { name: 'Auriculares JBL Tune 770NC', prefix: 'AUR', category: 'Audio' },
    { name: 'Parlante JBL Charge 5', prefix: 'SPK', category: 'Audio' },
    { name: 'Parlante Marshall Stanmore III', prefix: 'SPK', category: 'Audio' },
    { name: 'Micrófono Blue Yeti X', prefix: 'MIC', category: 'Audio' },
    { name: 'Micrófono HyperX QuadCast S', prefix: 'MIC', category: 'Audio' },
    { name: 'Cable HDMI 2.1 2m', prefix: 'CAB', category: 'Cables' },
    { name: 'Cable USB-C a USB-C 1m', prefix: 'CAB', category: 'Cables' },
    { name: 'Cable DisplayPort 1.4 3m', prefix: 'CAB', category: 'Cables' },
    { name: 'Cable de Red Cat6 5m', prefix: 'CAB', category: 'Cables' },
    { name: 'Cable USB-C a Lightning 1m', prefix: 'CAB', category: 'Cables' },
    { name: 'Hub USB-C 7 puertos Ugreen', prefix: 'HUB', category: 'Accesorios' },
    { name: 'Dock Station USB-C Dell WD19S', prefix: 'DOC', category: 'Accesorios' },
    { name: 'Soporte Monitor ErgoArm Pro', prefix: 'SOP', category: 'Accesorios' },
    { name: 'Mousepad XXL HyperX Fury S', prefix: 'PAD', category: 'Accesorios' },
    { name: 'Base Notebook Cooler Master', prefix: 'BAS', category: 'Accesorios' },
    { name: 'Mochila Notebook Targus 15.6"', prefix: 'MOC', category: 'Accesorios' },
    { name: 'Funda Notebook Neoprene 14"', prefix: 'FUN', category: 'Accesorios' },
    { name: 'Cargador Universal 65W USB-C', prefix: 'CAR', category: 'Accesorios' },
    { name: 'Memoria RAM Kingston 16GB DDR5', prefix: 'RAM', category: 'Componentes' },
    { name: 'Memoria RAM Corsair 32GB DDR5', prefix: 'RAM', category: 'Componentes' },
    { name: 'Placa de Video RTX 4060 Ti', prefix: 'GPU', category: 'Componentes' },
    { name: 'Placa de Video RX 7700 XT', prefix: 'GPU', category: 'Componentes' },
    { name: 'Procesador Intel i7-14700K', prefix: 'CPU', category: 'Componentes' },
    { name: 'Procesador AMD Ryzen 7 7800X3D', prefix: 'CPU', category: 'Componentes' },
    { name: 'Fuente Corsair RM750x 750W', prefix: 'PSU', category: 'Componentes' },
    { name: 'Gabinete NZXT H5 Flow', prefix: 'GAB', category: 'Componentes' },
    { name: 'Mother ASUS ROG Strix B650-A', prefix: 'MOT', category: 'Componentes' },
    { name: 'Cooler Noctua NH-D15 S', prefix: 'CLR', category: 'Componentes' },
  ]

// Seeded pseudo-random for deterministic data
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateMockProducts(): Product[] {
  const rand = seededRandom(42)
  const statuses: ProductStatus[] = ['active', 'inactive', 'out_of_stock']
  const now = Date.now()
  const sixMonthsMs = 180 * 24 * 60 * 60 * 1000

  return productTemplates.map((template, index) => {
    const r = rand()
    const statusIndex = r < 0.65 ? 0 : r < 0.85 ? 1 : 2
    const status = statuses[statusIndex]!

    // Stock: out_of_stock always 0, otherwise varied
    let stock: number
    if (status === 'out_of_stock') {
      stock = 0
    } else {
      const stockRand = rand()
      stock =
        stockRand < 0.15
          ? Math.floor(rand() * 9) + 1 // low: 1-9
          : stockRand < 0.5
            ? Math.floor(rand() * 40) + 10 // medium: 10-49
            : Math.floor(rand() * 150) + 50 // high: 50-199
    }

    // Price in ARS: $5,000 - $500,000 (varies by category)
    const priceRanges: Record<string, [number, number]> = {
      Computadoras: [250_000, 500_000],
      Periféricos: [15_000, 180_000],
      Almacenamiento: [12_000, 120_000],
      Audio: [20_000, 200_000],
      Accesorios: [5_000, 60_000],
      Cables: [5_000, 15_000],
      Componentes: [30_000, 450_000],
    }
    const [minPrice, maxPrice] = priceRanges[template.category] ?? [5_000, 100_000]
    const price = Math.round((minPrice + rand() * (maxPrice - minPrice)) / 100) * 100

    // Spread createdAt across last 6 months
    const createdAt = new Date(now - Math.floor(rand() * sixMonthsMs)).toISOString()

    const sku = `${template.prefix}-${String(index + 1).padStart(3, '0')}`

    return {
      id: `prod_${String(index + 1).padStart(4, '0')}`,
      name: template.name,
      sku,
      category: template.category,
      price,
      stock,
      status,
      createdAt,
    }
  })
}

const mockProducts: Product[] = generateMockProducts()

export const productApi = {
  async getPaginated(params: ServerTableParams): Promise<PaginatedResponse<Product>> {
    await new Promise((resolve) => setTimeout(resolve, 300))

    let filtered = [...mockProducts]

    // Global filter: search across name, sku, category
    if (params.globalFilter) {
      const search = params.globalFilter.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.sku.toLowerCase().includes(search) ||
          p.category.toLowerCase().includes(search),
      )
    }

    // Sorting
    if (params.sorting && params.sorting.length > 0) {
      const sort = params.sorting[0]!
      filtered.sort((a, b) => {
        const aVal = a[sort.id as keyof Product]
        const bVal = b[sort.id as keyof Product]
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sort.desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sort.desc ? bVal - aVal : aVal - bVal
        }
        return 0
      })
    }

    // Pagination
    const totalCount = filtered.length
    const pageCount = Math.ceil(totalCount / params.pageSize)
    const start = params.pageIndex * params.pageSize
    const data = filtered.slice(start, start + params.pageSize)

    return {
      data,
      pagination: {
        pageIndex: params.pageIndex,
        pageSize: params.pageSize,
        totalCount,
        pageCount,
      },
    }
  },
}
