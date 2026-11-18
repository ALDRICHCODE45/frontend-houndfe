/// <reference path="./virtual-local-icons.d.ts" />
// Registers the local Lucide collection into @iconify/vue before the app mounts.
// main.ts imports this module first, so Vite's dependency scanner sees the
// `@iconify/vue` import up front (no late re-optimization that would hand Nuxt
// UI's <UIcon> a different @iconify/vue instance than this registration).
// The collection data comes from the `hf:local-icons` plugin in vite.config.ts.
import { _api, addCollection } from '@iconify/vue'
import lucide from 'virtual:hf-local-icons'

addCollection(lucide)

// No icon is ever fetched from the Iconify API (api.iconify.design and its
// mirrors). An icon missing from the local collection fails loudly in dev and
// renders empty instead of making a third-party request.
_api.setFetch(((input: RequestInfo | URL) => {
  if (import.meta.env.DEV) {
    console.error(`[icons] icon not registered locally, remote fetch blocked: ${String(input)}`)
  }
  return Promise.resolve(new Response(null, { status: 404 }))
}) as typeof fetch)
