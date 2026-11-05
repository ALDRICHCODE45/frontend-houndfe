// T5 probe: which products have several presentations, stock in several places and movements.
import { call, login } from './api.mjs'
const { token } = await login('manager@houndfe.com', 'manager')
const list = await call('GET', '/products?limit=100', token)
const items = list.data ?? list.items ?? list
console.log('products', items.length)
for (const p of items) {
  let stock = null, mov = null
  try { stock = await call('GET', `/inventory/products/${p.id}/stock`, token) } catch (e) { stock = String(e).slice(0, 60) }
  try { mov = await call('GET', `/inventory/movements?productId=${p.id}&limit=50`, token) } catch (e) { mov = null }
  const s = typeof stock === 'object' && stock
  console.log(JSON.stringify({ name: p.name, type: p.type, useStock: p.useStock, hasVariants: p.hasVariants, lots: p.useLotsAndExpirations,
    variants: s ? s.variants?.length : '?', slots: s ? s.lots?.length : '?', qty: s?.product?.quantity, moves: mov?.items?.length ?? mov?.data?.length }))
}
