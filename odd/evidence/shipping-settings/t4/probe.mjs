#!/usr/bin/env node
// T4 probe: read-only. Finds the seeded packaging products and a service on
// :3003 as manager (password read from the seed at runtime, never printed).
import { call, login } from '../../design-pass-2/t4/lib.mjs'

const { token } = await login('manager@houndfe.com', 'manager')
for (const search of ['Arnés Acolchado', 'Shampoo Hipoalergénico', 'Collar', 'Baño']) {
  const page = await call('GET', `/products?search=${encodeURIComponent(search)}&limit=5`, token)
  for (const p of Array.isArray(page) ? page : page.data ?? page.items ?? []) {
    const pack = await call('GET', `/products/${p.id}/packaging`, token).catch((e) => ({ error: e.message.slice(0, 60) }))
    console.log(JSON.stringify({ id: p.id, name: p.name, type: p.type, hasVariants: p.hasVariants, packaging: pack.packaging ?? pack.error ?? null }))
    if (p.hasVariants) {
      const variants = await call('GET', `/products/${p.id}/variants`, token)
      for (const v of variants) {
        const vp = await call('GET', `/products/${p.id}/variants/${v.id}/packaging`, token)
        console.log('  ', JSON.stringify({ name: v.name, source: vp.source }))
      }
    }
  }
}
