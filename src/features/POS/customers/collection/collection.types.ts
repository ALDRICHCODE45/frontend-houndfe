/**
 * collection.types.ts — «Cobrar todo» wire shapes (handoff 30 §2, §4-§6).
 *
 * All amounts are integer cents. The POS v1 never sends `saleIds` (F3): a collection always
 * covers every sale of the customer with open debt, oldest due day first.
 */
import type {
  CollectionPaymentMethod,
  SalePaymentStatus,
} from '@/features/POS/sales/interfaces/sale.types'

/** One tender as it travels: `cash`, `card_credit`, `card_debit` or `transfer` (never `credit`). */
export interface CollectionTender {
  method: CollectionPaymentMethod
  amountCents: number
  paymentMethodId?: string
  /** At most 120 characters; omitted when blank. */
  reference?: string
}

/** Preview body: 0-5 tenders. `cashSessionId` / `expectedDebtCents` are ignored by the preview. */
export interface CollectionPreviewBody {
  payments?: CollectionTender[]
}

/** Apply body: 1-5 tenders, the caller's OPEN session and the last preview's `debtCents`. */
export interface CollectionApplyBody {
  payments: CollectionTender[]
  cashSessionId: string
  expectedDebtCents: number
}

export interface CollectionTenderEcho {
  method: CollectionPaymentMethod
  /** Tendered amount (cash includes the change). */
  amountCents: number
  catalog: { paymentMethodId: string; name: string; subtitle?: string | null } | null
}

export interface CollectionCustomer {
  id: string
  name: string
}

export interface CollectionSaleAllocation {
  saleId: string
  folio: string
  confirmedAt: string
  /** Same string as the `GET /sales` row; the due day is its first 10 characters. */
  dueDate: string | null
  /** Before the collection (handoff 28 rule). */
  overdue: boolean
  /** Received by this collection; 0 = stays pending. */
  appliedCents: number
  /** After the (simulated) collection. */
  paidCents: number
  debtCents: number
  paymentStatus: SalePaymentStatus
}

export interface CollectionPreview {
  customer: CollectionCustomer
  /** Open debt of the candidates before the collection: send it back as `expectedDebtCents`. */
  debtCents: number
  tenderedCents: number
  appliedCents: number
  changeDueCents: number
  payments: CollectionTenderEcho[]
  /** Every candidate in allocation order, including those that receive nothing. */
  sales: CollectionSaleAllocation[]
  remainingCustomerDebtCents: number
}

export interface CollectionResultSale extends CollectionSaleAllocation {
  paymentIds: string[]
  /** Present on `GET /collections/:id` only. */
  saleStatus?: 'CONFIRMED' | 'CANCELED'
}

/** `201`/`200` apply response; `GET /collections/:id` adds `saleStatus` and nullable customer. */
export interface CollectionResult {
  collectionId: string
  customer: CollectionCustomer | null
  createdAt: string
  tenderedCents: number
  appliedCents: number
  changeDueCents: number
  payments: CollectionTenderEcho[]
  /** Only the sales that received money, in allocation order. */
  sales: CollectionResultSale[]
  remainingCustomerDebtCents: number | null
}

export type CollectionReceiptFormat = 'ticket' | 'a4'

export interface CollectionReceiptPdf {
  blob: Blob
  fileName: string
}
