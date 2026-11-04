const messages: Record<string, string> = {
  SUPPLIER_REQUIRED: 'Selecciona un proveedor.',
  SUPPLIER_ARCHIVED: 'El proveedor está archivado. Puedes conservarlo en este borrador.',
  LINES_REQUIRED: 'Agrega al menos un renglón para completar la orden.',
  PRODUCT_REQUIRED: 'Selecciona un producto.',
  VARIANT_REQUIRED: 'Selecciona una variante del producto.',
  REFERENCE_UNAVAILABLE: 'La referencia ya no está disponible. Puedes conservarla o sustituirla.',
  REFERENCE_INCOMPATIBLE: 'La referencia no corresponde al producto seleccionado.',
  UNIT_MISMATCH: 'La unidad del costo no coincide con la del producto.',
  QUANTITY_REQUIRED: 'Indica la cantidad del producto.',
  QUANTITY_FRACTION_NOT_ALLOWED: 'Esta unidad solo admite cantidades enteras.',
  COST_AMOUNT_REQUIRED: 'Indica el importe del costo unitario.',
  COST_CURRENCY_REQUIRED: 'Falta la moneda del costo unitario.',
  COST_UNIT_REQUIRED: 'Falta la unidad del costo unitario.',
  COST_TAX_BASIS_REQUIRED: 'Indica si el costo incluye impuestos.',
}
export const diagnosticCodes = Object.keys(messages)
export function diagnosticMessage(code: string): string {
  return Object.prototype.hasOwnProperty.call(messages, code) ? messages[code]! : 'Revisa este dato del borrador.'
}
export function diagnosticTarget(path: string, lineCount: number): string {
  if (!path.startsWith('/') || /~(?![01])/.test(path)) return 'summary'
  const parts = path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'))
  if (parts.length === 1 && ['supplierId', 'note', 'lines'].includes(parts[0]!)) return path
  if (parts.join('/') === 'location/detail' && parts.length === 2) return '/location/detail'
  if (parts[0] !== 'lines' || !/^(0|[1-9]\d*)$/.test(parts[1] ?? '') || Number(parts[1]) >= lineCount) return 'summary'
  const base = `/lines/${parts[1]}`
  if (parts.length === 2) return base
  if (parts.length >= 3 && ['productId', 'variantId', 'orderedQuantity'].includes(parts[2]!)) return `${base}/${parts[2]}`
  if (parts.length === 3 && parts[2] === 'informedUnitCost') return `${base}/informedUnitCost`
  if (parts.length >= 4 && parts[2] === 'informedUnitCost' && ['amount', 'currency', 'unit', 'taxBasis'].includes(parts[3]!)) return `${base}/informedUnitCost/${parts[3]}`
  return 'summary'
}
export function commandMessage(error: unknown, uncertain = false, operation: 'edit' | 'confirm' | 'cancel' = 'edit'): string {
  if (uncertain) return 'El resultado no está confirmado. Reintenta el mismo intento antes de continuar.'
  if (!error) return ''
  const code = (error as { response?: { data?: { error?: string } } }).response?.data?.error
  // Transitions re-read the order after a conflict, so there are no local edits to keep.
  if (code === 'ORDER_VERSION_CONFLICT' && operation !== 'edit') return 'La orden cambió en otra sesión. Ya se cargó su versión actual; revísala antes de continuar.'
  if (code === 'SUPPLIER_ARCHIVED' && operation === 'confirm') return 'El proveedor de esta orden está archivado. Elige un proveedor activo y guarda el borrador antes de confirmar.'
  const copy: Record<string, string> = {
    ORDER_VERSION_CONFLICT: 'La orden cambió en otra sesión. Tus cambios locales se conservan. Puedes cargar la versión actual.',
    SUPPLIER_ARCHIVED: 'El proveedor seleccionado está archivado. Elige un proveedor activo para esta sustitución.',
    NOT_FOUND: 'La orden o una referencia seleccionada ya no está disponible.',
    MALFORMED: 'Revisa el formato de los datos del borrador.',
    FORBIDDEN: 'No tienes permiso para realizar esta operación.',
    UNAUTHORIZED: 'La sesión dejó de estar disponible. Vuelve a iniciar sesión.',
    IDEMPOTENCY_KEY_CONFLICT: 'El intento no coincide con el registrado. Consulta la orden antes de continuar.',
    ORDER_NOT_READY: 'La orden todavía no se puede confirmar. Revisa los avisos del borrador.',
    ELIGIBILITY_CHANGED: 'Algún producto o variante de la orden cambió. Revisa la orden actualizada antes de confirmar.',
    SUPPLIER_VERSION_CONFLICT: 'Los datos del proveedor cambiaron. Revisa la orden actualizada antes de confirmar.',
    ORDER_STATE_CONFLICT: 'La orden ya no está en un estado que permita esta acción. Revisa su estado actual.',
    IDEMPOTENCY_KEY_IN_FLIGHT: 'El intento sigue en proceso. Reintenta para recuperar su resultado.',
  }
  return code && Object.prototype.hasOwnProperty.call(copy, code) ? copy[code]! : 'No se pudo completar la operación. Inténtalo de nuevo.'
}
