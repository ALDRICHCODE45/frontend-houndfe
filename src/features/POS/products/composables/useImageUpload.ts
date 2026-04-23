import { ref, computed, type ComputedRef } from 'vue'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { productApi } from '../api/product.api'
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from '../interfaces/product.types'

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
  onSuccess?: () => void | Promise<void>
}

export interface ValidationResult {
  valid: File[]
  invalid: Array<{ file: File; reason: string }>
}

// ── Pure validation function (testable without Vue context) ───

export function validateImageFiles(files: File[] | FileList): ValidationResult {
  const fileArray = Array.from(files)
  const valid: File[] = []
  const invalid: Array<{ file: File; reason: string }> = []

  for (const file of fileArray) {
    // Check MIME type
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as any)) {
      invalid.push({
        file,
        reason: 'Formato no soportado (usá JPG, PNG, WEBP o GIF)',
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

export function useImageUpload(options: UseImageUploadOptions) {
  const { productId, variantId, onSuccess } = options
  const toast = useToast()

  const dropZoneRef = ref<HTMLElement | null>(null)
  const isUploading = ref(false)

  // ── VueUse composables ─────────────────────────────────────
  const { isOverDropZone } = useDropZone(dropZoneRef, {
    onDrop: (files) => {
      if (files) {
        uploadBatch(Array.from(files))
      }
    },
  })

  const { open: openPicker, onChange } = useFileDialog({
    accept: ALLOWED_IMAGE_MIME_TYPES.join(','),
    multiple: true,
  })

  onChange((files) => {
    if (files && files.length > 0) {
      uploadBatch(files)
    }
  })

  // ── Upload ─────────────────────────────────────────────────

  async function uploadBatch(files: File[] | FileList): Promise<void> {
    const { valid, invalid } = validateImageFiles(files)

    // Show errors for invalid files
    for (const { file, reason } of invalid) {
      toast.add({
        title: reason,
        description: file.name,
        color: 'error',
      })
    }

    if (valid.length === 0) return

    isUploading.value = true

    try {
      const uploadPromises = valid.map((file) => {
        const currentVariantId = variantId?.value ?? null
        if (currentVariantId) {
          return productApi.uploadVariantImage(productId.value, currentVariantId, file)
        }
        return productApi.uploadProductImage(productId.value, file)
      })

      const results = await Promise.allSettled(uploadPromises)

      let successCount = 0

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++
        } else {
          const file = valid[index]
          toast.add({
            title: 'Error al subir imagen',
            description: file?.name ?? 'Archivo desconocido',
            color: 'error',
          })
        }
      })

      if (successCount > 0) {
        toast.add({
          title: `${successCount} imagen${successCount > 1 ? 'es' : ''} subida${successCount > 1 ? 's' : ''}`,
          color: 'success',
        })
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          await onSuccess()
        }
      }
    } finally {
      isUploading.value = false
    }
  }

  function reset() {
    isUploading.value = false
  }

  return {
    dropZoneRef,
    isOverDropZone,
    openPicker,
    isUploading: computed(() => isUploading.value),
    uploadBatch,
    reset,
  }
}
