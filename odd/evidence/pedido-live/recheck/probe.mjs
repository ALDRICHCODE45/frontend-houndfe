// Read-only: quotation saleId/saleStatus and drafts list membership.
import { session } from '../api.mjs'
const { get } = await session()
const q = await get(`/quotations/${process.argv[2]}`)
console.log('quotation', q.status, JSON.stringify({ status: q.data?.status, saleId: q.data?.saleId, saleStatus: q.data?.saleStatus, totalCents: q.data?.totalCents }))
const d = await get('/sales/drafts')
for (const s of d.data ?? []) console.log('draft', s.id, s.totalCents, s.quotationId ?? '-', s.createdAt, (s.items ?? []).map((i) => `${i.quantity}x promo=${i.promotionId} disc=${i.discountAmountCents}`).join(';'))
