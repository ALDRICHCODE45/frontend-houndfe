// public-catalog.types.ts
// Generated from backend SDD public-online-catalog (v1).

/** GET /public/catalog/branches */
export type PublicBranchDto = {
  id: string
  name: string
  slug: string
  address: string | null
  phone: string | null
}
