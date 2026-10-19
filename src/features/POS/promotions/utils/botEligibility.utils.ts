import type { BotEligibilityRule, PromotionFormState } from '../interfaces/promotion.types'
import { PROMOTION_METHOD_LABELS, PROMOTION_TYPE_LABELS } from '../interfaces/promotion.types'
import { CUSTOMER_SCOPE_OPTIONS, TARGET_TYPE_OPTIONS } from '../composables/usePromotionForm'

export interface BotEligibilityEvaluation {
  supported: boolean
  reason?: string
}

/** Filter whole rules progressively: never combine permissions from different rules. */
export function evaluateBotEligibility(
  state: PromotionFormState,
  rules: readonly BotEligibilityRule[],
): BotEligibilityEvaluation {
  if (rules.length === 0) {
    return { supported: false, reason: 'No hay combinaciones disponibles para el chatbot.' }
  }
  const combinations = [
    ...new Set(
      rules.map(
        (rule) => `${PROMOTION_TYPE_LABELS[rule.type]} · ${PROMOTION_METHOD_LABELS[rule.method]}`,
      ),
    ),
  ].join('; ')
  const sameMethod = rules.filter((rule) => rule.method === state.method)
  if (!sameMethod.length) {
    return {
      supported: false,
      reason: `El método ${PROMOTION_METHOD_LABELS[state.method]} no está disponible. Combinaciones permitidas: ${combinations}.`,
    }
  }
  let candidates = sameMethod.filter((rule) => rule.type === state.type)
  if (!candidates.length) {
    return {
      supported: false,
      reason: `El tipo ${PROMOTION_TYPE_LABELS[state.type]} con método ${PROMOTION_METHOD_LABELS[state.method]} no está disponible. Combinaciones permitidas: ${combinations}.`,
    }
  }
  const allowedTargets = [...new Set(candidates.flatMap((rule) => rule.appliesTo ?? []))]
  candidates = candidates.filter(
    (rule) =>
      rule.appliesTo === null || rule.appliesTo.some((target) => target === state.appliesTo),
  )
  if (!candidates.length) {
    const label =
      TARGET_TYPE_OPTIONS.find((option) => option.value === state.appliesTo)?.label ??
      'sin seleccionar'
    const allowed = TARGET_TYPE_OPTIONS.filter((option) => allowedTargets.includes(option.value))
      .map((option) => option.label)
      .join(', ')
    return {
      supported: false,
      reason: `Aplica a: ${label}. Para el chatbot selecciona: ${allowed}.`,
    }
  }
  const allowedScopes = [...new Set(candidates.flatMap((rule) => rule.customerScopes))]
  candidates = candidates.filter((rule) => rule.customerScopes.includes(state.customerScope))
  if (!candidates.length) {
    const label = CUSTOMER_SCOPE_OPTIONS.find(
      (option) => option.value === state.customerScope,
    )?.label
    const allowed = CUSTOMER_SCOPE_OPTIONS.filter((option) => allowedScopes.includes(option.value))
      .map((option) => option.label)
      .join(', ')
    return {
      supported: false,
      reason: `Clientes: ${label}. Para el chatbot selecciona: ${allowed}.`,
    }
  }
  candidates = candidates.filter(
    (rule) => rule.allowsPriceLists || !state.hasPriceLists || state.priceListIds.length === 0,
  )
  if (!candidates.length) {
    return { supported: false, reason: 'El chatbot no admite estas listas de precios.' }
  }
  candidates = candidates.filter(
    (rule) => rule.allowsDaysOfWeek || !state.hasDaysOfWeek || state.daysOfWeek.length === 0,
  )
  if (!candidates.length) {
    return { supported: false, reason: 'El chatbot no admite estos días de la semana.' }
  }
  return { supported: true }
}
