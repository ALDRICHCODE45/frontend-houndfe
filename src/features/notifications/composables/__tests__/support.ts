import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { NotificationItem } from '../../interfaces/notifications.types'

/** Run a composable inside a component with a fresh QueryClient. */
export function withQuery<T>(
  setup: () => T,
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
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

export function axiosError(status: number, data: Record<string, unknown> = {}) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } })
}

export function makeNotice(id: string, over: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id,
    type: 'REQUEST_CREATED',
    title: 'Nueva solicitud',
    body: 'Pregunta sin respuesta · S-000123',
    requestId: `req-${id}`,
    createdAt: '2026-11-11T10:03:41.500Z',
    readAt: null,
    ...over,
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
