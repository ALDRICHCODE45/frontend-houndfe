declare module 'virtual:hf-local-icons' {
  import type { addCollection } from '@iconify/vue'

  /** Local Lucide collection (whole set in dev, used subset in build). */
  const collection: Parameters<typeof addCollection>[0]
  export default collection
}
