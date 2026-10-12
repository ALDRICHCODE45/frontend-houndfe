/**
 * Cash session commands for the enabled subset:
 * open, freeze, blind declare, append notes, independent verify, manual
 * movements, custody declaration/receipt and drawer release.
 *
 * Disciplines shared by every command:
 *   - a stable `Idempotency-Key` per ATTEMPT, scoped to actor + context + body,
 *     reset ONLY after a confirmed success and BEFORE the refetch — so a retry
 *     after a failure replays the same attempt, and a refresh failure never
 *     invites a duplicate re-issue;
 *   - the full session identity (tenant + user + permission generation) is
 *     captured BEFORE the request and re-checked after it. A same-tenant
 *     logout/login, a user switch or a permission change makes the in-flight
 *     result STALE: it is discarded (never returned to the new user's form) and
 *     never used to invalidate the new principal's caches;
 *   - a command is refused up-front with an actionable copy when there is no
 *     active tenant/user.
 */
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { cashApi } from '../api/cash.api'
import type {
  CashCountPayload,
  CashDeclareResponse,
  CashDeclarationNotesResponse,
  CashDrawerReleaseResponse,
  CashHandover,
  CashHandoverDeclarationPayload,
  CashHandoverReceivePayload,
  CashMovementPayload,
  CashMovementResponse,
  CashSessionOpenedResponse,
  CashStartCountResponse,
  CashVerifyResponse,
} from '../interfaces/cash.types'
import { cashQueryKeys, type CashCacheScope } from './cashQueryKeys'
import { commandAttempt } from '../utils/cash-input'
import { useCashAccess } from './useCashAccess'
import { CashCommandBusyError, CashIdentityError } from './cashErrorCopy'

export type CashCommandName =
  | 'open'
  | 'freeze'
  | 'declare'
  | 'notes'
  | 'verify'
  | 'cashIn'
  | 'cashOut'
  | 'declareHandover'
  | 'receiveHandover'
  | 'releaseDrawer'

interface OpenSessionInput {
  openingCents: number
  openingHandoverId?: string
}

interface CommandContext {
  route: string
  body: unknown
  sessionId?: string
}

export function useCashSessionCommands() {
  const access = useCashAccess()
  const queryClient = useQueryClient()
  const activeCommand = ref<CashCommandName | null>(null)

  // One attempt instance per form family — never shared between distinct bodies.
  const attempts: Record<CashCommandName, ReturnType<typeof commandAttempt>> = {
    open: commandAttempt(),
    freeze: commandAttempt(),
    declare: commandAttempt(),
    notes: commandAttempt(),
    verify: commandAttempt(),
    cashIn: commandAttempt(),
    cashOut: commandAttempt(),
    declareHandover: commandAttempt(),
    receiveHandover: commandAttempt(),
    releaseDrawer: commandAttempt(),
  }

  /**
   * Refresh the captured principal's authoritative slots. Best-effort: the write
   * already succeeded, so a refresh failure must not be reported as a command
   * failure.
   */
  async function invalidateAuthoritative(
    scope: CashCacheScope,
    sessionId: string | undefined,
    options: { custody?: boolean; registers?: boolean },
  ): Promise<void> {
    const work: Promise<unknown>[] = [
      queryClient.invalidateQueries({ queryKey: cashQueryKeys.sessionsListPrefix(scope) }),
    ]
    if (sessionId) {
      work.push(
        queryClient.invalidateQueries({
          queryKey: cashQueryKeys.sessionDetail(scope, sessionId),
        }),
      )
    }
    if (options.custody) {
      work.push(queryClient.invalidateQueries({ queryKey: cashQueryKeys.principalPrefix(scope) }))
    }
    if (options.registers) {
      work.push(queryClient.invalidateQueries({ queryKey: cashQueryKeys.registers(scope) }))
    }
    try {
      await Promise.all(work)
    } catch {
      // Swallowed on purpose (see doc comment above).
    }
  }

  async function run<T>(
    command: CashCommandName,
    context: CommandContext,
    task: (key: string) => Promise<T>,
    options: { custody?: boolean; registers?: boolean } = {},
  ): Promise<T> {
    // Refused BEFORE a key is generated or a request dispatched: a duplicate click
    // (including one landing while the previous refetch is still awaited) can
    // never start a second command nor consume a new idempotency key.
    if (activeCommand.value !== null) {
      throw new CashCommandBusyError()
    }

    const captured = access.captureIdentity()
    if (!captured.tenantId || !captured.userId) {
      throw new CashIdentityError('inactive')
    }
    const key = attempts[command].key(
      [
        captured.tenantId,
        captured.userId,
        captured.permissionFingerprint,
        context.sessionId ?? '',
        context.route,
      ].join('|'),
      context.body,
    )

    activeCommand.value = command
    try {
      const result = await task(key)
      if (!access.isCurrentIdentity(captured)) {
        // Stale result: discard it. No form feedback, no cache invalidation for
        // the principal that is active now.
        throw new CashIdentityError('changed')
      }
      attempts[command].reset()
      await invalidateAuthoritative(captured, context.sessionId, options)
      // The refresh is another async continuation: re-check before the result is
      // handed back, so a switch during the refresh cannot apply it.
      if (!access.isCurrentIdentity(captured)) {
        throw new CashIdentityError('changed')
      }
      return result
    } finally {
      if (activeCommand.value === command) activeCommand.value = null
    }
  }

  const openMutation = useMutation({
    mutationFn: (variables: { registerId: string; body: OpenSessionInput; key: string }) =>
      cashApi.openSession(
        variables.registerId,
        { ...variables.body, openingConfirmed: true },
        variables.key,
      ),
  })
  const freezeMutation = useMutation({
    mutationFn: (variables: { sessionId: string; key: string }) =>
      cashApi.startCount(variables.sessionId, variables.key),
  })
  const declareMutation = useMutation({
    mutationFn: (variables: { sessionId: string; payload: CashCountPayload; key: string }) =>
      cashApi.declare(variables.sessionId, variables.payload, variables.key),
  })
  const notesMutation = useMutation({
    mutationFn: (variables: { sessionId: string; notes: string; key: string }) =>
      cashApi.appendNotes(variables.sessionId, { notes: variables.notes }, variables.key),
  })
  const verifyMutation = useMutation({
    mutationFn: (variables: { sessionId: string; payload: CashCountPayload; key: string }) =>
      cashApi.verify(variables.sessionId, variables.payload, variables.key),
  })
  const cashInMutation = useMutation({
    mutationFn: (variables: { sessionId: string; payload: CashMovementPayload; key: string }) =>
      cashApi.cashIn(variables.sessionId, variables.payload, variables.key),
  })
  const cashOutMutation = useMutation({
    mutationFn: (variables: { sessionId: string; payload: CashMovementPayload; key: string }) =>
      cashApi.cashOut(variables.sessionId, variables.payload, variables.key),
  })
  const declareHandoverMutation = useMutation({
    mutationFn: (variables: {
      sessionId: string
      payload: CashHandoverDeclarationPayload
      key: string
    }) => cashApi.declareHandover(variables.sessionId, variables.payload, variables.key),
  })
  const receiveHandoverMutation = useMutation({
    mutationFn: (variables: {
      handoverId: string
      payload: CashHandoverReceivePayload
      key: string
    }) => cashApi.receiveHandover(variables.handoverId, variables.payload, variables.key),
  })
  const releaseDrawerMutation = useMutation({
    mutationFn: (variables: { sessionId: string; key: string }) =>
      cashApi.releaseDrawer(variables.sessionId, variables.key),
  })

  return {
    activeCommand,
    isBusy: computed(() => activeCommand.value !== null),

    openSession(registerId: string, input: OpenSessionInput): Promise<CashSessionOpenedResponse> {
      return run(
        'open',
        { route: `POST:/cash-registers/${registerId}/sessions`, body: input },
        (key) => openMutation.mutateAsync({ registerId, body: input, key }),
        { registers: true },
      )
    },

    startCount(sessionId: string): Promise<CashStartCountResponse> {
      return run(
        'freeze',
        { route: `POST:/cash-sessions/${sessionId}/start-count`, body: {}, sessionId },
        (key) => freezeMutation.mutateAsync({ sessionId, key }),
      )
    },

    declare(sessionId: string, payload: CashCountPayload): Promise<CashDeclareResponse> {
      return run(
        'declare',
        { route: `POST:/cash-sessions/${sessionId}/declarations`, body: payload, sessionId },
        (key) => declareMutation.mutateAsync({ sessionId, payload, key }),
      )
    },

    appendNotes(sessionId: string, notes: string): Promise<CashDeclarationNotesResponse> {
      return run(
        'notes',
        {
          route: `POST:/cash-sessions/${sessionId}/declaration-notes`,
          body: { notes },
          sessionId,
        },
        (key) => notesMutation.mutateAsync({ sessionId, notes, key }),
      )
    },

    verify(sessionId: string, payload: CashCountPayload): Promise<CashVerifyResponse> {
      return run(
        'verify',
        { route: `POST:/cash-sessions/${sessionId}/verifications`, body: payload, sessionId },
        (key) => verifyMutation.mutateAsync({ sessionId, payload, key }),
      )
    },

    cashIn(sessionId: string, payload: CashMovementPayload): Promise<CashMovementResponse> {
      return run(
        'cashIn',
        { route: `POST:/cash-sessions/${sessionId}/cash-in`, body: payload, sessionId },
        (key) => cashInMutation.mutateAsync({ sessionId, payload, key }),
      )
    },

    cashOut(sessionId: string, payload: CashMovementPayload): Promise<CashMovementResponse> {
      return run(
        'cashOut',
        { route: `POST:/cash-sessions/${sessionId}/cash-out`, body: payload, sessionId },
        (key) => cashOutMutation.mutateAsync({ sessionId, payload, key }),
      )
    },

    declareHandover(
      sessionId: string,
      payload: CashHandoverDeclarationPayload,
    ): Promise<CashHandover> {
      return run(
        'declareHandover',
        { route: `POST:/cash-sessions/${sessionId}/handovers`, body: payload, sessionId },
        (key) => declareHandoverMutation.mutateAsync({ sessionId, payload, key }),
        { custody: true },
      )
    },

    receiveHandover(
      handoverId: string,
      payload: CashHandoverReceivePayload,
    ): Promise<CashHandover> {
      return run(
        'receiveHandover',
        { route: `POST:/cash-handovers/${handoverId}/receive`, body: { ...payload, handoverId } },
        (key) => receiveHandoverMutation.mutateAsync({ handoverId, payload, key }),
        { custody: true },
      )
    },

    releaseDrawer(sessionId: string): Promise<CashDrawerReleaseResponse> {
      return run(
        'releaseDrawer',
        { route: `POST:/cash-sessions/${sessionId}/release-drawer`, body: {}, sessionId },
        (key) => releaseDrawerMutation.mutateAsync({ sessionId, key }),
        { custody: true },
      )
    },
  }
}
