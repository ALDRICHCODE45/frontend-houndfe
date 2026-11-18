// Read-only: POS detail (price/stock) for given product ids.
import { session } from './api.mjs'
const { get } = await session()
for (const id of process.argv.slice(2)) {
  const r = await get(`/sales/pos-catalog/${id}`)
  console.log(id, r.status, JSON.stringify(r.data).slice(700, 1800))
}
