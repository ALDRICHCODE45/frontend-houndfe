import { computed, readonly, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { newIdempotencyKey } from '@/features/POS/sales/utils/idempotency.utils'
import { chatbotRequestApi } from '../api/chatbot-request.api'
import { chatbotRequestKeys } from '../constants/queryKeys'
import type {
  CancelRequestBody,
  ChatbotRequestCommandResponse,
  ChatbotRequestVersionedBody,
  ClaimRequestBody,
  FinishRequestBody,
  LinkCustomerRequestBody,
  MergeRequestBody,
  ReassignRequestBody,
  ReleaseRequestBody,
  ReplyRequestBody,
  ResolveRequestBody,
} from '../interfaces/chatbot-request.types'
import { isStateChangingError } from '../utils/command-copy'
import { readRequestError, requestErrorMessage, type ChatbotRequestError } from '../utils/requestErrors'

export type RequestCommandOutcome =
  | { status: 'ignored' }
  | { status: 'done'; response: ChatbotRequestCommandResponse }
  | { status: 'failed'; error: ChatbotRequestError; message: string }

interface Attempt {
  signature: string
  key: string
}

/**
 * Runs the staff commands of a chatbot request with the idempotency rules of handoffs 11 and 12
 * (the recipe of `useSettleRefund`):
 *
 *   - One `Idempotency-Key` per attempt. An attempt is the command, the request and the exact
 *     body; the same body sent again after a network error or a `5xx` (whose answer is unknown)
 *     reuses the key, and any other body opens a new attempt.
 *   - A success and any answer the server gave on purpose (`4xx`) close the attempt: a new try
 *     after a `409`/`422` needs a new key.
 *   - A submit while one is in flight is ignored (double click).
 *   - After a success, and after an error that means the request moved (`409`, `NOT_ASSIGNEE`,
 *     `NOT_FOUND`…), the whole feature key of the tenant is invalidated: the detail refetches and
 *     shows the server's current state instead of a patch that would leave `allowedActions` stale.
 */
export function useRequestCommand() {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const pending = ref(false)
  const error = ref<ChatbotRequestError | null>(null)
  let attempt: Attempt | null = null

  function refresh(): Promise<void> {
    return queryClient.invalidateQueries({ queryKey: chatbotRequestKeys.all(tenantId.value) })
  }

  async function run(
    name: string,
    requestId: string,
    body: ChatbotRequestVersionedBody,
    send: (idempotencyKey: string) => Promise<ChatbotRequestCommandResponse>,
  ): Promise<RequestCommandOutcome> {
    if (pending.value) return { status: 'ignored' }

    const signature = JSON.stringify([name, requestId, body])
    if (!attempt || attempt.signature !== signature) attempt = { signature, key: newIdempotencyKey() }
    const current = attempt

    pending.value = true
    error.value = null
    try {
      const response = await send(current.key)
      attempt = null
      void refresh()
      return { status: 'done', response }
    } catch (caught) {
      const failure = readRequestError(caught)
      error.value = failure
      // Network errors and 5xx leave the answer unknown: the same key is resent safely.
      if (failure.status !== null && failure.status < 500) attempt = null
      // Stay pending until the detail is refetched: a resend before it lands would carry the old
      // expectedVersion and earn a second VERSION_CONFLICT.
      if (isStateChangingError(failure)) await refresh().catch(() => undefined)
      return { status: 'failed', error: failure, message: requestErrorMessage(failure) }
    } finally {
      pending.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  /** Forget the error and the open attempt (the form closed or moved to another request). */
  function reset() {
    attempt = null
    error.value = null
  }

  return {
    isPending: readonly(pending),
    error: readonly(error) as Readonly<typeof error>,
    message: computed(() => (error.value ? requestErrorMessage(error.value) : null)),
    clearError,
    reset,
    run,
    claim: (id: string, body: ClaimRequestBody) =>
      run('claim', id, body, (key) => chatbotRequestApi.claim(id, body, key)),
    release: (id: string, body: ReleaseRequestBody) =>
      run('release', id, body, (key) => chatbotRequestApi.release(id, body, key)),
    reassign: (id: string, body: ReassignRequestBody) =>
      run('reassign', id, body, (key) => chatbotRequestApi.reassign(id, body, key)),
    cancel: (id: string, body: CancelRequestBody) =>
      run('cancel', id, body, (key) => chatbotRequestApi.cancel(id, body, key)),
    merge: (id: string, body: MergeRequestBody) =>
      run('merge', id, body, (key) => chatbotRequestApi.merge(id, body, key)),
    linkCustomer: (id: string, body: LinkCustomerRequestBody) =>
      run('link-customer', id, body, (key) => chatbotRequestApi.linkCustomer(id, body, key)),
    resolve: (id: string, body: ResolveRequestBody) =>
      run('resolve', id, body, (key) => chatbotRequestApi.resolve(id, body, key)),
    reply: (id: string, body: ReplyRequestBody) =>
      run('reply', id, body, (key) => chatbotRequestApi.reply(id, body, key)),
    finish: (id: string, body: FinishRequestBody) =>
      run('finish', id, body, (key) => chatbotRequestApi.finish(id, body, key)),
  }
}
