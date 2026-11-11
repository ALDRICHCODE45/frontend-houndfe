// public-catalog.types.ts
// Generated from backend SDD public-online-catalog (v1).

/** GET /public/catalog/branches */
export type PublicBranchDto = {
  id: string
  name: string
  slug: string
  address: string | null
  phone: string | null
  /** Public catalog v0 (handoff 15 §5): the bot's WhatsApp number; absent on a backend without v0. */
  whatsappNumber?: string | null
}
