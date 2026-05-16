import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { SaleCommentError } from '../interfaces/sale.types'

export function useSaleComments(saleId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const lastError = ref<SaleCommentError | null>(null)

  const invalidateDetail = async () => {
    await queryClient.invalidateQueries({
      queryKey: saleQueryKeys.detail(tenantId.value, toValue(saleId)),
    })
  }

  const addMutation = useMutation({
    mutationFn: async (payload: { body: string }) => saleApi.addComment(toValue(saleId), payload),
    onSuccess: async () => {
      lastError.value = null
      await invalidateDetail()
    },
    onError: (error) => {
      lastError.value = error instanceof SaleCommentError ? error : null
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ commentId, payload }: { commentId: string; payload: { body: string } }) =>
      saleApi.updateComment(toValue(saleId), commentId, payload),
    onSuccess: async () => {
      lastError.value = null
      await invalidateDetail()
    },
    onError: (error) => {
      lastError.value = error instanceof SaleCommentError ? error : null
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => saleApi.deleteComment(toValue(saleId), commentId),
    onSuccess: async () => {
      lastError.value = null
      await invalidateDetail()
    },
    onError: (error) => {
      lastError.value = error instanceof SaleCommentError ? error : null
    },
  })

  return {
    addComment: addMutation.mutateAsync,
    updateComment: (commentId: string, payload: { body: string }) =>
      updateMutation.mutateAsync({ commentId, payload }),
    deleteComment: deleteMutation.mutateAsync,
    isPending: computed(
      () => addMutation.isPending.value || updateMutation.isPending.value || deleteMutation.isPending.value,
    ),
    lastError: computed(() => lastError.value),
  }
}
