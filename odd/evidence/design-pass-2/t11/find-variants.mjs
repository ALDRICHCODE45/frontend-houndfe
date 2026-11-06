#!/usr/bin/env node
// T11: prints the name and id of products with variants (read-only GET), to open their detail.
import { call, login } from '../t4/lib.mjs'
const { token } = await login('admin@houndfe.com', 'superAdmin')
const page = await call('GET', '/products?page=1&limit=100', token)
console.log('shape', Array.isArray(page) ? 'array' : Object.keys(page).join(','))
const items = Array.isArray(page) ? page : page.items ?? page.data ?? []
for (const p of items) if (p.hasVariants || (p.variantsCount ?? p.variantCount ?? 0) > 0) console.log(p.id, p.name)
console.log('total', items.length, 'keys', Object.keys(items[0] ?? {}).join(','))
