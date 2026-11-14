// The dev API (:3003) has no animal.target facet for «centro» (its price contexts do not require
// published editorial data, so attributes are absent and facet= answers 400 FACET_NOT_AVAILABLE).
// To exercise the UI this harness augments the REAL products response with a facet built from the
// owner's screenshot data (odd/tasks/catalog-animal-filters.md L2). Read-only: nothing is posted.
const sp = (code, label, count) => ({ code, label, count })
export const BASE_OPTIONS = [
  sp('ani.dom.dog', 'Perro', 26), sp('ani.dom.cat', 'Gato', 13),
  sp('ani.freshwater_group.bettas', 'Bettas', 1), sp('ani.freshwater.swordtail', 'Colas de espada', 1),
  sp('ani.freshwater.corydoras', 'Corydoras', 1), sp('ani.freshwater.guppy', 'Guppy', 2),
  sp('ani.freshwater.molly', 'Mollys', 2), sp('ani.freshwater.platy', 'Platys', 2), sp('ani.freshwater.neon_tetra', 'Tetra neón', 2),
  sp('ani.bird_pet.canary', 'Canario doméstico', 1), sp('ani.bird_pet.zebra_finch', 'Diamante mandarín', 1),
  sp('ani.bird_pet.cockatiel', 'Ninfa', 1), sp('ani.bird_pet.budgerigar', 'Periquito australiano', 1),
  sp('ani.lizard.anole', 'Anolis', 1), sp('ani.lizard.bearded_dragon', 'Dragones barbudos', 1),
  sp('ani.lizard.crested_gecko', 'Gecko crestado', 1), sp('ani.lizard.leopard_gecko', 'Gecko leopardo', 1),
  sp('ani.snake.corn_snake', 'Serpiente del maíz', 1),
]
export const EXTRA_FISH = ['Escalares', 'Ángeles', 'Disco', 'Goldfish', 'Koi', 'Cíclidos africanos', 'Barbos tigre', 'Neón cardenal']
  .map((l, i) => sp(`ani.freshwater.extra${i}`, l, 1))
export const CONTROL = { id: 'c0ffee00-0000-4000-8000-0000000000d1', name: 'Control de desechos', count: 6 }

export async function installMock(context, { many = false, options = null } = {}) {
  const opts = options ?? (many ? [...BASE_OPTIONS, ...EXTRA_FISH] : BASE_OPTIONS)
  const log = []
  await context.route('**/public/catalog/centro/products*', async (route) => {
    const url = new URL(route.request().url())
    const facets = url.searchParams.getAll('facet')
    const cat = url.searchParams.get('categoryId')
    const real = new URL(url); real.searchParams.delete('facet')
    if (cat === CONTROL.id) real.searchParams.delete('categoryId')
    const res = await route.fetch({ url: real.toString() })
    const body = await res.json()
    const picked = facets.map((f) => f.split(':')[1])
    let total = body.meta.total
    if (picked.length) total = Math.min(total, picked.reduce((n, c) => n + (opts.find((o) => o.code === c)?.count ?? 0), 0))
    else if (cat === CONTROL.id) total = CONTROL.count
    const limit = body.meta.limit
    body.items = body.items.slice(0, Math.min(limit, total))
    body.meta = { ...body.meta, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
    body.facets = { ...body.facets, categories: [...body.facets.categories, CONTROL], attributes: [{ code: 'animal.target', label: 'Especie', options: opts }] }
    log.push({ facets, cat, total })
    await route.fulfill({ response: res, json: body })
  })
  return log
}
