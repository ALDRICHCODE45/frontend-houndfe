/**
 * useCollectionReceiptDownload.ts — «Comprobante de cobro» PDF (handoff 30 §7).
 *
 * One download at a time; the validated PDF is saved through the statement's anchor helper.
 */
import { readonly, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'
import { saveCustomerStatementPdf } from '@/features/POS/customers/statement/customerStatementFile'
import { customerCollectionApi } from './collection.api'
import { readCollectionError } from './collectionErrors'
import type { CollectionReceiptFormat } from './collection.types'

const RECEIPT_FORBIDDEN = 'No tienes permiso para ver el comprobante.'
const RECEIPT_FAILED = 'No se pudo generar el comprobante. Intenta de nuevo.'

export function useCollectionReceiptDownload(
  collectionId: MaybeRefOrGetter<string | null | undefined>,
) {
  const downloading = shallowRef<CollectionReceiptFormat | null>(null)
  const error = shallowRef<string | null>(null)

  /** `true` when the PDF was saved. */
  async function download(format: CollectionReceiptFormat): Promise<boolean> {
    const id = toValue(collectionId)
    if (!id || downloading.value) return false
    downloading.value = format
    error.value = null
    try {
      const { blob, fileName } = await customerCollectionApi.getReceiptPdf(id, format)
      saveCustomerStatementPdf(blob, fileName)
      return true
    } catch (failure) {
      const mapped = readCollectionError(failure)
      error.value =
        mapped.code === 'FORBIDDEN'
          ? RECEIPT_FORBIDDEN
          : mapped.code === 'UNKNOWN' || mapped.code === 'NETWORK'
            ? RECEIPT_FAILED
            : mapped.message
      return false
    } finally {
      downloading.value = null
    }
  }

  return { downloading: readonly(downloading), error: readonly(error), download }
}
