const paymentMethodLabels: Record<string, string> = {
  CASH: 'Efectivo',
  CARD_CREDIT: 'Tarjeta de Crédito',
  CARD_DEBIT: 'Tarjeta de Débito',
  TRANSFER: 'Transferencia',
  CREDIT: 'Crédito',
}

export function formatPaymentMethod(method: string): string {
  return paymentMethodLabels[method] ?? method
}
