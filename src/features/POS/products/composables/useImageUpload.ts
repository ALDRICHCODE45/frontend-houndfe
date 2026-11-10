import type { AxiosError } from 'axios'
import { ref, computed, type ComputedRef } from 'vue'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { productApi } from '../api/product.api'
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from '../interfaces/product.types'
import { mapDomainError, type DomainApiError } from '@/core/shared/utils/error.utils'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

interface UseImageUploadOptions {
  productId: ComputedRef<string>
  variantId?: ComputedRef<string | null>
  /** Files dropped while false are ignored (read-only screens). Default: true. */
  enabled?: ComputedRef<boolean>
  onSuccess?: () => void | Promise<void>
}

export interface ValidationResult {
  valid: File[]
  invalid: Array<{ file: File; reason: string }>
}

export type UploadStatus = 'queued' | 'uploading' | 'failed'

/** One file on its way to the server; a successful file leaves the queue. */
export interface UploadItem {
  id: string
  name: string
  /** Local preview while it uploads; null where object URLs are unavailable. */
  previewUrl: string | null
  status: UploadStatus
  /** 0–100 while uploading. */
  progress: number
  reason: string | null
  /** A network/server failure can be retried; a rejected file cannot. */
  retryable: boolean
  /** Destination fixed when the file was queued (null = product). */
  variantId: string | null
  file: File
}

const UPLOAD_FAILED_REASON = 'No se pudo subir. Inténtalo de nuevo.'

// ── Pure validation function (testable without Vue context) ───

export function validateImageFiles(files: File[] | FileList): ValidationResult {
  const fileArray = Array.from(files)
  const valid: File[] = []
  const invalid: Array<{ file: File; reason: string }> = []

  for (const file of fileArray) {
    // Check MIME type
    if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      invalid.push({
        file,
        reason: 'Formato no soportado (usa JPG, PNG, WEBP o GIF)',
      })
      continue
    }

    // Check file size
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      invalid.push({
        file,
        reason: 'La imagen no puede pesar más de 10 MB',
      })
      continue
    }

    valid.push(file)
  }

  return { valid, invalid }
}

let uploadSeq = 0

function createPreview(file: File): string | null {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null
  try {
    return URL.createObjectURL(file)
  } catch {
    return null
  }
}

function revokePreview(url: string | null) {
  if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
}

export function useImageUpload(options: UseImageUploadOptions) {
  const { productId, variantId, enabled, onSuccess } = options
  const toast = useToast()

  const dropZoneRef = ref<HTMLElement | null>(null)
  const items = ref<UploadItem[]>([])
  const isWorking = ref(false)
  // Counters of the current run (from the first queued file until the queue is idle).
  const runTotal = ref(0)
  const runProcessed = ref(0)
  let runSucceeded = 0

  const isEnabled = () => enabled?.value ?? true

  // ── VueUse composables ─────────────────────────────────────
  const { isOverDropZone: rawOver } = useDropZone(dropZoneRef, {
    // Only files light the drop target; dragged text or links do not.
    checkValidity: (dragged) => Array.from(dragged).some((entry) => entry.kind === 'file'),
    onDrop: (files) => {
      if (files && isEnabled()) void uploadBatch(Array.from(files))
    },
  })
  const isOverDropZone = computed(() => rawOver.value && isEnabled())

  const { open: openPicker, onChange } = useFileDialog({
    accept: ALLOWED_IMAGE_MIME_TYPES.join(','),
    multiple: true,
  })

  onChange((files) => {
    if (files && files.length > 0) void uploadBatch(files)
  })

  // ── Queue ──────────────────────────────────────────────────

  const activeCount = computed(() => items.value.filter((item) => item.status !== 'failed').length)
  const isUploading = computed(() => isWorking.value || activeCount.value > 0)

  /** «Subiendo 2 de 3…» while a run is active; null otherwise. */
  const progressLabel = computed(() =>
    isUploading.value && runTotal.value > 0
      ? `Subiendo ${Math.min(runProcessed.value + 1, runTotal.value)} de ${runTotal.value}…`
      : null,
  )

  function update(id: string, patch: Partial<UploadItem>) {
    const item = items.value.find((entry) => entry.id === id)
    if (item) Object.assign(item, patch)
  }

  function remove(id: string) {
    const item = items.value.find((entry) => entry.id === id)
    if (!item) return
    revokePreview(item.previewUrl)
    items.value = items.value.filter((entry) => entry.id !== id)
  }

  function startRunIfIdle() {
    if (isUploading.value) return
    runTotal.value = 0
    runProcessed.value = 0
    runSucceeded = 0
  }

  async function uploadOne(item: UploadItem): Promise<boolean> {
    const config = {
      onUploadProgress: (event: { loaded: number; total?: number; progress?: number }) => {
        const ratio = event.total ? event.loaded / event.total : (event.progress ?? 0)
        update(item.id, { progress: Math.min(100, Math.round(ratio * 100)) })
      },
    }
    try {
      if (item.variantId) await productApi.uploadVariantImage(productId.value, item.variantId, item.file, config)
      else await productApi.uploadProductImage(productId.value, item.file, config)
      return true
    } catch {
      return false
    }
  }

  async function drain(): Promise<void> {
    if (isWorking.value) return
    isWorking.value = true
    try {
      let next = items.value.find((item) => item.status === 'queued')
      while (next) {
        update(next.id, { status: 'uploading', progress: 0 })
        const ok = await uploadOne(next)
        runProcessed.value++
        if (ok) {
          runSucceeded++
          remove(next.id)
          if (onSuccess) await onSuccess()
        } else {
          update(next.id, { status: 'failed', reason: UPLOAD_FAILED_REASON, retryable: true, progress: 0 })
        }
        next = items.value.find((item) => item.status === 'queued')
      }
    } finally {
      isWorking.value = false
    }
    if (runSucceeded > 0) {
      toast.add({
        title: runSucceeded > 1 ? `${runSucceeded} imágenes subidas` : '1 imagen subida',
        color: 'success',
      })
      runSucceeded = 0
    }
  }

  async function uploadBatch(files: File[] | FileList): Promise<void> {
    const list = Array.from(files)
    if (list.length === 0) return
    const { invalid } = validateImageFiles(list)
    const rejected = new Map(invalid.map(({ file, reason }) => [file, reason]))
    const destination = variantId?.value ?? null

    startRunIfIdle()
    runTotal.value += list.length
    for (const file of list) {
      const reason = rejected.get(file) ?? null
      if (reason) runProcessed.value++
      items.value.push({
        id: `upload-${++uploadSeq}`,
        name: file.name,
        previewUrl: reason ? null : createPreview(file),
        status: reason ? 'failed' : 'queued',
        progress: 0,
        reason,
        retryable: false,
        variantId: destination,
        file,
      })
    }
    await drain()
  }

  function retry(id: string) {
    const item = items.value.find((entry) => entry.id === id)
    if (!item || item.status !== 'failed' || !item.retryable) return
    startRunIfIdle()
    runTotal.value++
    update(id, { status: 'queued', reason: null, progress: 0 })
    void drain()
  }

  function discard(id: string) {
    const item = items.value.find((entry) => entry.id === id)
    if (item?.status === 'failed') remove(id)
  }

  /** «Elegir otra»: drop the rejected file and open the picker again. */
  function replace(id: string) {
    discard(id)
    openPicker()
  }

  /** Clears the failed files (an open popover closing); uploads in flight finish. */
  function reset() {
    for (const item of items.value.filter((entry) => entry.status === 'failed')) remove(item.id)
  }

  return {
    dropZoneRef,
    isOverDropZone,
    openPicker,
    isUploading,
    uploads: computed(() => items.value),
    progressLabel,
    uploadBatch,
    retry,
    discard,
    replace,
    reset,
  }
}

/** Set main and delete for one product's images, with the same toasts and cache refresh everywhere. */
export function useProductImageActions(productId: ComputedRef<string>) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()

  async function invalidateImages() {
    await queryClient.invalidateQueries({ queryKey: productQueryKeys.images(tenantId.value, productId.value) })
  }

  const setMain = useMutation({
    mutationFn: (imageId: string) => productApi.setMainImage(productId.value, imageId),
    onSuccess: async () => {
      toast.add({ title: 'Imagen principal actualizada', color: 'success' })
      await invalidateImages()
    },
    onError: (error) => {
      toast.add({
        title: 'Error al cambiar imagen principal',
        description: mapDomainError(error as AxiosError<DomainApiError>),
        color: 'error',
      })
    },
  })

  const remove = useMutation({
    mutationFn: (imageId: string) => productApi.removeImage(productId.value, imageId),
    onSuccess: async () => {
      toast.add({ title: 'Imagen eliminada', color: 'success' })
      await invalidateImages()
    },
    onError: (error) => {
      toast.add({
        title: 'Error al eliminar imagen',
        description: mapDomainError(error as AxiosError<DomainApiError>),
        color: 'error',
      })
    },
  })

  return { setMain, remove, invalidateImages }
}
