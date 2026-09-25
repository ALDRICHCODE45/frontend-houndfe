import type { HumanDecisionResolvePayload } from '../interfaces/human-decision.types'

export type HumanDecisionResolutionInput =
  | {
      action: 'PROVIDE_RESTOCK_ESTIMATE'
      restockDays: number
      expectedVersion: number
    }
  | {
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE'
      expectedVersion: number
    }

export interface HumanDecisionResolutionAttempt {
  decisionId: string
  payload: HumanDecisionResolvePayload
}

export function createHumanDecisionResolutionAttempt(
  decisionId: string,
  input: HumanDecisionResolutionInput,
  generateId: () => string = () => crypto.randomUUID(),
): HumanDecisionResolutionAttempt {
  const resolutionRequestId = generateId()
  const payload: HumanDecisionResolvePayload =
    input.action === 'PROVIDE_RESTOCK_ESTIMATE'
      ? {
          action: input.action,
          restockDays: input.restockDays,
          expectedVersion: input.expectedVersion,
          resolutionRequestId,
        }
      : {
          action: input.action,
          expectedVersion: input.expectedVersion,
          resolutionRequestId,
        }

  return { decisionId, payload }
}
