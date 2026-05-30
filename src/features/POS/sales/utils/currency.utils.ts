// Module-local re-export of the canonical currency helpers.
//
// This file exists so POS sales components keep their short relative
// import path (`../utils/currency.utils`) without each component
// reaching across the project to `@/core/shared/utils/currency.utils`.
// It MUST NOT redefine any helper — single source of truth lives in
// `core/shared/utils/currency.utils.ts`.
export {
  formatCentsMXN,
  lineCents,
  sumLineCents,
  normalizeDecimalInput,
  currencyToCents,
  currencyFormatter,
  CURRENCY_CONFIG,
} from '@/core/shared/utils/currency.utils'
