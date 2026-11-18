// Read-only: first quotation ids per status (for a 390 comparison).
import { session } from './api.mjs'
const { get } = await session()
for (const st of ['DRAFT', 'SENT', 'CANCELLED']) {
  const r = await get(`/quotations?status=${st}&limit=2`)
  const items = r.data?.items ?? r.data?.data ?? []
  console.log(st, r.status, items.map((q) => q.id).join(' '))
}
