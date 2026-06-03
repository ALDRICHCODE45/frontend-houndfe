/**
 * Catalog API — mock adapter for demo.
 *
 * All functions return mock data instantly. The function signatures match
 * the real backend contract so swapping to real API calls later requires
 * only replacing the body of each function with an axios call.
 */
import type {
  PublicBranchDto,
  PublicProductListResponse,
  PublicCatalogProductCard,
  PublicCatalogProductDetail,
  ListProductsQuery,
  PublicSortOption,
} from '../interfaces/catalog.types'
import { MOCK_BRANCHES, MOCK_PRODUCTS, MOCK_CATEGORIES, getMockProductDetail } from '../data/mock-catalog'

// ─── Branches ────────────────────────────────────────────────────────────────

async function getBranches(): Promise<PublicBranchDto[]> {
  return MOCK_BRANCHES
}

// ─── Products list ───────────────────────────────────────────────────────────

async function getProducts(
  _tenantSlug: string,
  query: ListProductsQuery = {},
): Promise<PublicProductListResponse> {
  let items: PublicCatalogProductCard[] = MOCK_PRODUCTS.map(({ _detail: _, ...card }) => card)

  // Category filter
  if (query.categoryId) {
    items = items.filter((p) => p.category?.id === query.categoryId)
  }

  // Search filter
  if (query.q) {
    const q = query.q.toLowerCase()
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand?.name.toLowerCase().includes(q) ?? false) ||
        (p.description?.toLowerCase().includes(q) ?? false),
    )
  }

  // Sort
  const sort: PublicSortOption = query.sort ?? 'newest'
  switch (sort) {
    case 'price_asc':
      items.sort((a, b) => (a.price.fromPriceCents ?? Infinity) - (b.price.fromPriceCents ?? Infinity))
      break
    case 'price_desc':
      items.sort((a, b) => (b.price.fromPriceCents ?? 0) - (a.price.fromPriceCents ?? 0))
      break
    case 'relevance':
    case 'newest':
    case 'rating_desc':
    default:
      // Keep original order (mock "newest" / "relevance")
      break
  }

  // Build facets from ALL products (unfiltered) so counts stay accurate
  const allProducts: PublicCatalogProductCard[] = MOCK_PRODUCTS.map(({ _detail: _, ...card }) => card)
  const facetMap = new Map<string, { id: string; name: string; count: number }>()
  for (const p of allProducts) {
    if (p.category) {
      const existing = facetMap.get(p.category.id)
      if (existing) {
        existing.count++
      } else {
        facetMap.set(p.category.id, { id: p.category.id, name: p.category.name, count: 1 })
      }
    }
  }
  // Sort facets by the static category order
  const categoryOrder = MOCK_CATEGORIES.map((c) => c.id)
  const categories = [...facetMap.values()].sort(
    (a, b) => categoryOrder.indexOf(a.id) - categoryOrder.indexOf(b.id),
  )

  // Pagination
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const total = items.length
  const totalPages = Math.ceil(total / limit)
  const start = (page - 1) * limit
  const paginatedItems = items.slice(start, start + limit)

  return {
    items: paginatedItems,
    meta: { page, limit, total, totalPages },
    facets: { categories },
  }
}

// ─── Product detail ──────────────────────────────────────────────────────────

async function getProductDetail(
  _tenantSlug: string,
  productId: string,
  selectedBranchSlug?: string,
): Promise<PublicCatalogProductDetail | null> {
  return getMockProductDetail(productId, selectedBranchSlug ?? 'centro')
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const catalogApi = {
  getBranches,
  getProducts,
  getProductDetail,
}
