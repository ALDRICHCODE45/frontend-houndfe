/**
 * Cash registers: principal-scoped list plus create / rename-activate commands.
 *
 * Identity discipline (shared with the session commands):
 *   - the list slot is scoped by tenant + user + permission generation;
 *   - every command captures that identity BEFORE awaiting, and a result that
 *     returns after the principal changed is DISCARDED (never handed to the new
 *     user's form, never used to invalidate the new user's caches);
 *   - a command is refused up-front when there is no active tenant/user;
 *   - a cache-refresh failure after an authoritative success must not surface as
 *     a command failure.
 */
import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { cashApi } from '../api/cash.api'
import type {
  CashRegister,
  CashRegisterCreatePayload,
  CashRegisterUpdatePayload,
} from '../interfaces/cash.types'
import { cashQueryKeys } from './cashQueryKeys'
import { commandAttempt } from '../utils/cash-input'
import { useCashAccess } from './useCashAccess'
import { CashIdentityError } from './cashErrorCopy'

export function useCashRegisters() {
  const access = useCashAccess()
  const queryClient = useQueryClient()

  const listQuery = useQuery<CashRegister[]>({
    queryKey: computed(() => cashQueryKeys.registers(access.identity.value)),
    queryFn: () => cashApi.listRegisters(),
    enabled: computed(
      () =>
        access.canReadRegisters.value &&
        access.identityReady.value &&
        access.permissionsLoaded.value,
    ),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })

  const createAttempt = commandAttempt()
  const updateAttempt = commandAttempt()

  /** Refresh the captured principal's registers, best-effort. */
  async function refreshRegisters(): Promise<void> {
    try {
      await queryClient.invalidateQueries({
        queryKey: cashQueryKeys.registers(access.identity.value),
      })
    } catch {
      // The authoritative write already succeeded; a refresh failure is not a
      // command failure and must never invite a duplicate re-issue.
    }
  }

  /**
   * Run one register command under the captured identity. The attempt key is
   * scoped to the actor too, so the same body from another principal can never
   * replay this attempt; it is reset on a confirmed success BEFORE the refresh.
   */
  async function runRegisterCommand<T>(
    attempt: ReturnType<typeof commandAttempt>,
    route: string,
    body: unknown,
    task: (key: string) => Promise<T>,
  ): Promise<T> {
    const captured = access.captureIdentity()
    if (!captured.tenantId || !captured.userId) {
      throw new CashIdentityError('inactive')
    }
    // ONE key for this attempt: actor + context + body. The same value is used
    // for the request, so a retry of an unchanged command replays it instead of
    // creating a second command.
    const key = attempt.key(`${captured.tenantId}|${captured.userId}|${route}`, body)
    const result = await task(key)
    if (!access.isCurrentIdentity(captured)) {
      throw new CashIdentityError('changed')
    }
    attempt.reset()
    await refreshRegisters()
    // Re-check after the refresh continuation: a switch while it was awaited must
    // not apply this result to the principal that is active now.
    if (!access.isCurrentIdentity(captured)) {
      throw new CashIdentityError('changed')
    }
    return result
  }

  const createMutation = useMutation({
    mutationFn: (variables: { payload: CashRegisterCreatePayload; key: string }) =>
      cashApi.createRegister(variables.payload, variables.key),
  })

  const updateMutation = useMutation({
    mutationFn: (variables: { id: string; payload: CashRegisterUpdatePayload; key: string }) =>
      cashApi.updateRegister(variables.id, variables.payload, variables.key),
  })

  function createRegister(payload: CashRegisterCreatePayload): Promise<CashRegister> {
    return runRegisterCommand(createAttempt, 'POST:/cash-registers', payload, (key) =>
      createMutation.mutateAsync({ payload, key }),
    )
  }

  function updateRegister(id: string, payload: CashRegisterUpdatePayload): Promise<CashRegister> {
    return runRegisterCommand(updateAttempt, `PATCH:/cash-registers/${id}`, payload, (key) =>
      updateMutation.mutateAsync({ id, payload, key }),
    )
  }

  return {
    registers: computed(() => listQuery.data.value ?? []),
    isLoading: computed(() => listQuery.isLoading.value),
    isFetching: computed(() => listQuery.isFetching.value),
    isError: computed(() => listQuery.isError.value),
    error: listQuery.error,
    refetch: listQuery.refetch,
    createRegister,
    updateRegister,
    creating: computed(() => createMutation.isPending.value),
    updating: computed(() => updateMutation.isPending.value),
  }
}
