import { call, login } from './api.mjs'
const { token } = await login('admin@houndfe.com', 'superAdmin')
const voc = await call('GET', '/catalog-editorial/vocabulary', token)
const rev = voc.vocabularyRevision
const list = await call('GET', '/products?limit=100', token)
const tally = {}
for (const p of list.data ?? list.items ?? list) {
  try {
    const r = await call('GET', `/products/${p.id}/editorial`, token, undefined, { 'Editorial-Vocabulary-Revision': rev })
    const s = r.state; if (s.draft || s.published) console.log(p.name, '| draft', !!s.draft, '| pub', !!s.published)
  } catch (err) { const c = String(err).match(/→ (\d+)/)?.[1]; tally[c] = (tally[c] ?? 0) + 1; if (c === '500') console.log('500', p.name) }
}
console.log(tally)
