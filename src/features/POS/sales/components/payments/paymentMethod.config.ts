import type { CollectionPaymentMethod } from '../../interfaces/sale.types'

export const PAYMENT_METHOD_CONFIG: Record<CollectionPaymentMethod, { label: string; icon: string }> = {
  cash: { label: 'Efectivo', icon: 'i-lucide-banknote' },
  card_credit: { label: 'Tarjeta crédito', icon: 'i-lucide-credit-card' },
  card_debit: { label: 'Tarjeta débito', icon: 'i-lucide-credit-card' },
  transfer: { label: 'Transferencia', icon: 'i-lucide-arrow-left-right' },
}
