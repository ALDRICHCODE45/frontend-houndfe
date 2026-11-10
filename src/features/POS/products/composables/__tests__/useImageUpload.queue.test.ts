/**
 * useImageUpload — the per-file queue behind the image strip: files upload one
 * at a time («En cola» while waiting), each with its own progress; a file that
 * fails stays in the queue with its reason until the user retries or discards
 * it. The destination is fixed when the file is queued.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref } from 'vue'
import type { AxiosProgressEvent } from 'axios'

const toast = vi.hoisted(() => ({ add: vi.fn() }))
vi.stubGlobal('useToast', () => toast)
vi.mock('@nuxt/ui/runtime/composables/useToast', () => ({ useToast: () => toast }))

const api = vi.hoisted(() => ({ uploadProductImage: vi.fn(), uploadVariantImage: vi.fn() }))
vi.mock('../../api/product.api', () => ({ productApi: api }))

import { useImageUpload } from '../useImageUpload'

type Progress = { onUploadProgress?: (event: AxiosProgressEvent) => void }

function deferred<T = unknown>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const png = (name: string) => new File(['x'], name, { type: 'image/png' })
const flush = async () => {
  for (let i = 0; i < 5; i++) await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const scopes: ReturnType<typeof effectScope>[] = []
function setup(variantId = ref<string | null>(null), onSuccess = vi.fn()) {
  const scope = effectScope()
  scopes.push(scope)
  const upload = scope.run(() =>
    useImageUpload({ productId: computed(() => 'p1'), variantId: computed(() => variantId.value), onSuccess }),
  )!
  return { upload, onSuccess, variantId }
}

beforeEach(() => {
  api.uploadProductImage.mockReset()
  api.uploadVariantImage.mockReset()
  toast.add.mockClear()
})
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()))

describe('useImageUpload queue', () => {
  it('uploads one file at a time: the first shows its progress, the rest wait «queued»', async () => {
    const first = deferred()
    let report: Progress['onUploadProgress']
    api.uploadProductImage.mockImplementationOnce((_p: string, _f: File, options: Progress) => {
      report = options.onUploadProgress
      return first.promise
    })
    api.uploadProductImage.mockResolvedValueOnce({})
    const { upload, onSuccess } = setup()

    void upload.uploadBatch([png('a.png'), png('b.png')])
    await flush()

    expect(upload.uploads.value.map((item) => [item.name, item.status])).toEqual([
      ['a.png', 'uploading'],
      ['b.png', 'queued'],
    ])
    expect(api.uploadProductImage).toHaveBeenCalledTimes(1)

    report!({ loaded: 64, total: 100 } as AxiosProgressEvent)
    expect(upload.uploads.value[0]!.progress).toBe(64)
    expect(upload.progressLabel.value).toBe('Subiendo 1 de 2…')

    first.resolve({})
    await flush()

    expect(api.uploadProductImage).toHaveBeenCalledTimes(2)
    expect(upload.uploads.value).toEqual([])
    expect(onSuccess).toHaveBeenCalled()
    expect(upload.isUploading.value).toBe(false)
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: '2 imágenes subidas', color: 'success' }))
  })

  it('keeps a rejected format in the queue with its reason and no retry, without a toast', async () => {
    api.uploadProductImage.mockResolvedValue({})
    const { upload } = setup()

    await upload.uploadBatch([new File(['x'], 'lado.heic', { type: 'image/heic' })])
    await flush()

    expect(upload.uploads.value).toHaveLength(1)
    const failed = upload.uploads.value[0]!
    expect(failed.status).toBe('failed')
    expect(failed.retryable).toBe(false)
    expect(failed.reason).toContain('Formato no soportado')
    expect(api.uploadProductImage).not.toHaveBeenCalled()
    expect(toast.add).not.toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))

    upload.discard(failed.id)
    expect(upload.uploads.value).toEqual([])
  })

  it('a failed upload stays with «Reintentar»; retrying sends it again to the same destination', async () => {
    api.uploadVariantImage.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({})
    const { upload, variantId, onSuccess } = setup(ref<string | null>('v1'))

    await upload.uploadBatch([png('a.png')])
    await flush()

    const failed = upload.uploads.value[0]!
    expect(failed.status).toBe('failed')
    expect(failed.retryable).toBe(true)
    expect(failed.reason).toBe('No se pudo subir. Inténtalo de nuevo.')
    expect(onSuccess).not.toHaveBeenCalled()

    variantId.value = null // the user moved to another chip meanwhile
    upload.retry(failed.id)
    await flush()

    expect(api.uploadVariantImage).toHaveBeenLastCalledWith('p1', 'v1', expect.any(File), expect.any(Object))
    expect(api.uploadProductImage).not.toHaveBeenCalled()
    expect(upload.uploads.value).toEqual([])
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('fixes the destination when a file is queued', async () => {
    const first = deferred()
    api.uploadVariantImage.mockReturnValueOnce(first.promise).mockResolvedValue({})
    const { upload, variantId } = setup(ref<string | null>('v1'))

    void upload.uploadBatch([png('a.png'), png('b.png')])
    await flush()
    variantId.value = 'v2'
    first.resolve({})
    await flush()

    expect(api.uploadVariantImage.mock.calls.map((call) => call[1])).toEqual(['v1', 'v1'])
  })
})
