import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

/** Run a composable inside a component with a fresh QueryClient. */
export function withQuery<T>(setup: () => T, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  let result!: T
  const wrapper = mount(
    defineComponent({
      setup() {
        result = setup()
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  )
  return { result, client, wrapper }
}
