// T6: find the product with the editorial draft (L10) and check its editorial read.
import { call, password } from '../t4/lib.mjs'
const first = await call('POST', '/auth/login', null, { email: 'admin@houndfe.com', password: password('superAdmin') })
const centro = first.tenants.find((t) => t.name === 'Sucursal Centro')
const sw = await call('POST', '/auth/switch-tenant', first.accessToken, { tenantId: centro.id })
const list = await call('GET', '/products?search=' + encodeURIComponent('Cachorro Raza Mediana') + '&limit=5', sw.accessToken)
const items = list.items ?? list.data ?? list
for (const p of items) {
  let ed = 'ok'
  try { await call('GET', `/products/${p.id}/editorial`, sw.accessToken) } catch (e) { ed = String(e.message).replace(/\/products\/[^\/]+/, '/products/:id').slice(0, 140) }
  let edGlobal = 'ok'
  try { await call('GET', `/products/${p.id}/editorial`, first.accessToken) } catch (e) { edGlobal = String(e.message).replace(/\/products\/[^\/]+/, '/products/:id').slice(0, 140) }
  console.log(p.name, '| tenant editorial:', ed, '| global:', edGlobal, '| ID_FOR_SCRIPT', p.id)
}
