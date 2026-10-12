export interface CountChannel {
  channelKey: string
  channelLabel: string
  method: 'CASH' | 'CARD_CREDIT' | 'CARD_DEBIT' | 'TRANSFER'
}

export function integerCents(value: string): number {
  if (!/^(0|[1-9]\d*)$/.test(value))
    throw new Error('Ingresa centavos enteros; cero debe ser explícito.')
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || amount > 2147483647)
    throw new Error('Importe fuera de rango.')
  return amount
}

// ─── Money in PESOS (human entry) ─────────────────────────────────────────────
//
// A human enters money in pesos; the wire carries integer cents. These helpers
// make that conversion EXACT: the whole part and the (at most two) fraction
// digits are scaled from their own digits, so no float multiplication or
// rounding ever happens, and a third decimal is rejected instead of rounded.
// An empty field stays distinct from an explicit `0`.
//
// `MAX_CASH_MONEY_CENTS` is the PostgreSQL `Int` upper bound shared by every
// cash MONEY field on the wire — opening, manual movements, count lines,
// denomination amounts and custody declared/received amounts (see
// `api/cash.api.ts#assertCents`). It is deliberately NOT a blanket UI ceiling:
// a field with a different, narrower limit passes its own bound explicitly.

/** Upper bound in cents for every cash money field persisted as a PG `Int`. */
export const MAX_CASH_MONEY_CENTS = 2147483647

/** Upper bound of a denomination QUANTITY, which is a count of pieces, not money. */
export const MAX_CASH_QUANTITY = 2147483647

/** Denomination amounts are money and, unlike other money fields, must be >= 1 cent. */
export const MIN_DENOMINATION_CENTS = 1

export interface CentsBounds {
  /** Inclusive minimum in cents. Defaults to `0`; an explicit zero is valid money. */
  minCents?: number
  /** Inclusive maximum in cents for THIS field. Defaults to `MAX_CASH_MONEY_CENTS`. */
  maxCents?: number
}

const PESOS_BLANK = 'Ingresa el importe en pesos (el cero debe ser explícito).'
const PESOS_FORMAT =
  'Importe inválido: usa pesos con hasta dos decimales, sin signos ni exponentes.'
const MONEY_RANGE = 'Importe fuera de rango.'
const QUANTITY_BLANK = 'Ingresa una cantidad entera de piezas (el cero debe ser explícito).'
const QUANTITY_FORMAT = 'Cantidad inválida: usa un número entero de piezas, sin decimales.'
const QUANTITY_RANGE = 'Cantidad fuera de rango.'
const FORMAT_CENTS = 'Valor de centavos inválido.'

/**
 * A single comma is accepted as the decimal separator (the app's existing
 * input convention). Two separators are never guessed: they fall through to
 * the format error.
 */
function normalizePesos(value: string): string {
  const raw = String(value ?? '').trim()
  if (!raw.includes(',') || raw.includes('.')) return raw
  return raw.replace(',', '.')
}

/**
 * Exact pesos → integer cents. `'350' → 35000`, `'0.01' → 1`, `'0' → 0`.
 * Throws on blank, on a fraction beyond two decimals (never silently rounds),
 * on signs/exponents/non-finite text and on a value outside `bounds`.
 */
export function pesosToCents(value: string, bounds: CentsBounds = {}): number {
  const raw = normalizePesos(value)
  if (raw === '') throw new Error(PESOS_BLANK)
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(raw)
  if (!match) throw new Error(PESOS_FORMAT)
  const whole = Number(match[1])
  const fraction = (match[2] ?? '').padEnd(2, '0')
  const cents = whole * 100 + Number(fraction)
  const minCents = bounds.minCents ?? 0
  const maxCents = bounds.maxCents ?? MAX_CASH_MONEY_CENTS
  if (!Number.isSafeInteger(cents) || cents < minCents || cents > maxCents) {
    throw new Error(MONEY_RANGE)
  }
  return cents
}

/** Denomination money in pesos; keeps the unchanged minimum of one cent. */
export function denominationCentsFromPesos(value: string): number {
  return pesosToCents(value, { minCents: MIN_DENOMINATION_CENTS })
}

/**
 * Editable pesos text for a non-negative integer cents value. Exact integer
 * arithmetic, so `pesosToCents(centsToPesosInput(x)) === x` for every cents
 * value within the default parser bounds (`0 .. MAX_CASH_MONEY_CENTS`):
 * `35000 → '350.00'` (a received/default FLOAT renders in pesos). The formatter
 * itself only requires a safe integer, so a safe cents value ABOVE that default
 * money maximum is still formatted — but the default parser rejects it as out of
 * range, and a caller that widens `maxCents` must widen it consistently.
 */
export function centsToPesosInput(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error(FORMAT_CENTS)
  const fraction = cents % 100
  const whole = (cents - fraction) / 100
  return `${whole}.${String(fraction).padStart(2, '0')}`
}

/**
 * A denomination QUANTITY is a count of pieces, not money: it stays an integer
 * and its errors keep count units (never "pesos"/"centavos").
 */
export function countQuantity(value: string, maxQuantity = MAX_CASH_QUANTITY): number {
  const raw = String(value ?? '').trim()
  if (raw === '') throw new Error(QUANTITY_BLANK)
  if (!/^(0|[1-9]\d*)$/.test(raw)) throw new Error(QUANTITY_FORMAT)
  const quantity = Number(raw)
  if (!Number.isSafeInteger(quantity) || quantity > maxQuantity) throw new Error(QUANTITY_RANGE)
  return quantity
}

export function countPayload(
  channels: CountChannel[],
  values: Record<string, string>,
  notes?: string,
) {
  if (
    !channels.length ||
    new Set(channels.map((item) => item.channelKey)).size !== channels.length
  ) {
    throw new Error('No hay canales congelados válidos para contar.')
  }
  const lines = channels.map(({ channelKey }) => ({
    channelKey,
    amountCents: integerCents(values[channelKey] ?? ''),
  }))
  return { lines, ...(notes?.trim() ? { notes: notes.trim() } : {}) }
}

// One instance per form. Reset only after confirmed success or explicit abandonment.
export function commandAttempt(generateKey: () => string = () => crypto.randomUUID()) {
  let fingerprint: string | undefined
  let key: string | undefined
  return {
    key(route: string, body: unknown) {
      const next = JSON.stringify([route, body])
      if (fingerprint !== next || !key) {
        fingerprint = next
        key = generateKey()
      }
      return key
    },
    reset() {
      fingerprint = undefined
      key = undefined
    },
  }
}
