// Read-only: draft totals/promotions for given sale ids, and quotation saleStatus.
import { session } from './api.mjs'
const { get } = await session()
const [qid, ...sids] = process.argv.slice(2)
const dr = await get('/sales/drafts')
for (const s of dr.data ?? []) {
  if (sids.length && !sids.includes(s.id)) continue
  const pick = Object.fromEntries(Object.entries(s).filter(([k]) => /total|subtotal|discount|promo|quotation|status|veto/i.test(k)))
  console.log('draft', s.id, JSON.stringify(pick).slice(0, 1500))
  for (const it of s.items ?? []) console.log('  item', JSON.stringify(Object.fromEntries(Object.entries(it).filter(([k]) => /price|discount|promo|total|quantity/i.test(k)))).slice(0, 800))
}
if (qid) { const q = await get(`/quotations/${qid}`); console.log('quotation', q.status, JSON.stringify({ status: q.data?.status, saleId: q.data?.saleId, saleStatus: q.data?.saleStatus, convertedAt: q.data?.convertedAt, totalCents: q.data?.totalCents, ivaBreakdown: q.data?.ivaBreakdown })) }
