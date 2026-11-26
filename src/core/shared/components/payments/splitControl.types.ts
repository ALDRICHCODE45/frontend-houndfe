import type { SplitTender } from '@/core/shared/payments/tenderSplit'

/** One tender as the split controls see it: a stable `key` and the label shown to the cashier. */
export interface SplitControlTender extends SplitTender {
  key: string
  label: string
}
