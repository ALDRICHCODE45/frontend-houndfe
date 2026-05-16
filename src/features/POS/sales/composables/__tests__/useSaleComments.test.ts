import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useSaleComments } from '../useSaleComments'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { SaleCommentError } from '../../interfaces/sale.types'

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    addComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
  },
}))

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
}))

function mountComposable(saleId: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  let result: ReturnType<typeof useSaleComments> | undefined

  const TestComponent = defineComponent({
    setup() {
      result = useSaleComments(computed(() => saleId))
      return () => h('div')
    },
  })

  mount(TestComponent, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })

  return { composable: result!, invalidateQueries }
}

describe('useSaleComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(saleApi.addComment).mockResolvedValue({
      id: 'comment-1',
      saleId: 'sale-1',
      tenantId: 'tenant-1',
      authorUserId: 'user-1',
      body: 'hola',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    })
    vi.mocked(saleApi.updateComment).mockResolvedValue({
      id: 'comment-1',
      saleId: 'sale-1',
      tenantId: 'tenant-1',
      authorUserId: 'user-1',
      body: 'editado',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:01:00.000Z',
      deletedAt: null,
    })
    vi.mocked(saleApi.deleteComment).mockResolvedValue(undefined)
  })

  it('invalidates sale detail on add/update/delete', async () => {
    const { composable, invalidateQueries } = mountComposable('sale-1')
    await composable.addComment({ body: 'hola' })
    await composable.updateComment('comment-1', { body: 'editado' })
    await composable.deleteComment('comment-1')

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: saleQueryKeys.detail('tenant-1', 'sale-1') })
    expect(invalidateQueries).toHaveBeenCalledTimes(3)
  })

  it('maps domain error as lastError', async () => {
    const { composable } = mountComposable('sale-1')
    vi.mocked(saleApi.addComment).mockRejectedValueOnce(new SaleCommentError('COMMENT_AUTHOR_FORBIDDEN'))

    await expect(composable.addComment({ body: 'x' })).rejects.toMatchObject({ code: 'COMMENT_AUTHOR_FORBIDDEN' })
    expect(composable.lastError.value?.code).toBe('COMMENT_AUTHOR_FORBIDDEN')
  })

  it('toggles isPending during mutation', async () => {
    const { composable } = mountComposable('sale-1')
    let resolvePromise: ((value: any) => void) | null = null
    vi.mocked(saleApi.addComment).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve
        }),
    )

    const promise = composable.addComment({ body: 'hola' })
    await Promise.resolve()
    expect(composable.isPending.value).toBe(true)

    if (!resolvePromise) throw new Error('resolver not set')
    ;(resolvePromise as (value: any) => void)({
      id: 'comment-1',
      saleId: 'sale-1',
      tenantId: 'tenant-1',
      authorUserId: 'user-1',
      body: 'hola',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    })
    await promise
    expect(composable.isPending.value).toBe(false)
  })
})
