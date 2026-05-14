const paymentMethodLabels: Record<string, string> = {
  CASH: 'Efectivo',
  CARD_CREDIT: 'Tarjeta de Crédito',
  CARD_DEBIT: 'Tarjeta de Débito',
  TRANSFER: 'Transferencia',
  CREDIT: 'Crédito',
}

const paymentMethodColors: Record<string, string> = {
  CASH: 'success',
  CARD_CREDIT: 'info',
  CARD_DEBIT: 'primary',
  TRANSFER: 'warning',
  CREDIT: 'error',
}

export function formatPaymentMethod(method: string): string {
  return paymentMethodLabels[method] ?? method
}

export function getPaymentMethodColor(method: string): string {
  return paymentMethodColors[method] ?? 'neutral'
}
