/**
 * Outbound links of the public catalog: the WhatsApp order/ask link and the share-preview link.
 * Pure functions; nothing here knows a number, a branch or a product.
 */

const MIN_DIGITS = 8
const MAX_DIGITS = 15

/** The digits `wa.me` expects (E.164 without the plus), or null when the number is absent or unusable. */
export function normalizeWhatsappNumber(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS ? digits : null
}

/** `https://wa.me/<digits>?text=<message>`, or null without a usable number. */
export function buildWhatsappUrl(raw: string | null | undefined, message: string): string | null {
  const digits = normalizeWhatsappNumber(raw)
  if (digits === null) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export interface ProductInquiry {
  productName: string
  /** The selected presentation, when the product has them. */
  presentationName: string | null
  branchName: string | null
  /** The storefront page of the product. */
  url: string
  outOfStock: boolean
}

/** The prefilled es-MX message: what is wanted (or asked about when sold out), where, and the page. */
export function productInquiryMessage(inquiry: ProductInquiry): string {
  const subject = [inquiry.productName, inquiry.presentationName].filter(Boolean).join(' ')
  const where = inquiry.branchName ? ` · ${inquiry.branchName}` : ''
  const first = inquiry.outOfStock
    ? `Hola, ¿cuándo vuelve ${subject}?${where}`
    : `Hola, quiero ${subject}${where}`
  return `${first}\n${inquiry.url}`
}

/**
 * The backend share route (handoff 15 §6). It lives on the API host, outside `/public/catalog`,
 * so crawlers read the Open Graph tags and people are redirected to the storefront.
 */
export function buildSharePreviewUrl(
  apiBase: string,
  branchSlug: string,
  productId: string,
  priceListId: string | null,
): string {
  const base = apiBase.replace(/\/$/, '')
  const path = `${base}/share/${encodeURIComponent(branchSlug)}/p/${encodeURIComponent(productId)}`
  return priceListId ? `${path}?priceListId=${encodeURIComponent(priceListId)}` : path
}
