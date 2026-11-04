const paymentMethodLabels: Record<string, string> = {
  CASH: 'Efectivo',
  CARD_CREDIT: 'Tarjeta de crédito',
  CARD_DEBIT: 'Tarjeta de débito',
  TRANSFER: 'Transferencia',
  CREDIT: 'Crédito',
}

export function formatPaymentMethod(method: string): string {
  return paymentMethodLabels[method] ?? method
}
