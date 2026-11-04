import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, shallowRef } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { editorialIssueMessage, useEditorialEditor } from '../useEditorialEditor'
import { editorialContractApi } from '../../api/editorial-contract.api'
import { document, state, success, vocabularyEnvelope, read, update, failure } from '../../__tests__/editorial-contract-fixtures'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isSuperAdmin: false, isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u1' }, currentTenant: { id: 't1' } as { id: string } | null, permissionsLoaded: true, permissionCodes: [read, update] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
const scopes: ReturnType<typeof effectScope>[] = []
function setup(productId = shallowRef('p1')) {
  const scope = effectScope(); scopes.push(scope)
  return scope.run(() => useEditorialEditor(productId, shallowRef(editorialContractApi)))!
}
function reads(snapshot = state()) {
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope() }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(snapshot)))
}
beforeEach(() => { vi.resetAllMocks(); Object.assign(auth, { isSuperAdmin: false, currentTenant: { id: 't1' }, permissionCodes: [read, update], permissionsLoaded: true }); reads() })
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

describe('quiet refresh after an acknowledged write', () => {
  it('a failed quiet read keeps the loaded editor, flags the view as stale and shows no read error', async () => {
    const editor = setup(); await flushPromises()
    editor.lifecycle.buffer.value!.commercialTitle = 'LOCAL'
    http.get.mockRejectedValue(failure(500, 'INTERNAL_ERROR'))
    expect(await editor.refresh('retain', { quiet: true })).toBe(false)
    expect(editor.staleView.value).toBe(true)
    expect(editor.errorMessage.value).toBeNull()
    expect(editor.readStatus.value).toBeNull()
    expect(editor.loading.value).toBe(false)
    expect(editor.lifecycle.buffer.value!.commercialTitle).toBe('LOCAL')
    expect(editor.editable.value).toBe(true)
  })

  it('a later successful read clears the stale flag', async () => {
    const editor = setup(); await flushPromises()
    http.get.mockRejectedValue(failure(500, 'INTERNAL_ERROR'))
    await editor.refresh('retain', { quiet: true })
    reads(state({ ...document(), commercialTitle: 'FROM GET' }, 4))
    expect(await editor.refresh('retain', { quiet: true })).toBe(true)
    expect(editor.staleView.value).toBe(false)
    expect(editor.lifecycle.authoritative.value!.draft!.revision).toBe(4)
  })

  it('a failed explicit read is still the read error, never a stale view', async () => {
    const editor = setup(); await flushPromises()
    http.get.mockRejectedValue(failure(500, 'INTERNAL_ERROR'))
    expect(await editor.refresh('retain')).toBe(false)
    expect(editor.staleView.value).toBe(false)
    expect(editor.errorMessage.value).not.toBeNull()
  })

  it('a refused quiet read is still a refusal: access is not a stale view', async () => {
    const editor = setup(); await flushPromises()
    http.get.mockRejectedValue(failure(403, 'FORBIDDEN'))
    await editor.refresh('retain', { quiet: true })
    expect(editor.readStatus.value).toBe(403)
    expect(editor.errorMessage.value).not.toBeNull()
    expect(editor.staleView.value).toBe(false)
  })

  it('changing the product starts clean', async () => {
    const product = shallowRef('p1')
    const editor = setup(product); await flushPromises()
    http.get.mockRejectedValue(failure(500, 'INTERNAL_ERROR'))
    await editor.refresh('retain', { quiet: true })
    expect(editor.staleView.value).toBe(true)
    reads(); product.value = 'p2'; await flushPromises()
    expect(editor.staleView.value).toBe(false)
  })
})

describe('editorialIssueMessage in plain words', () => {
  it.each([
    ['TITLE_LIMIT', 'El título es demasiado largo. El máximo es 200 caracteres.'],
    ['DESCRIPTION_LIMIT', 'La descripción es demasiado larga. El máximo es 20,000 caracteres.'],
    ['EVIDENCE', 'La evidencia necesita una fuente y una fecha válida.'],
    ['RANGE_ORDER', 'El mínimo no puede ser mayor que el máximo.'],
    ['NUMERIC_INTEGER', 'Este dato debe ser un número entero.'],
    ['NUMERIC_BOUNDS', 'El valor está fuera del rango permitido.'],
    ['NA_NOT_ALLOWED', 'Este dato no admite «No aplica».'],
    ['DUPLICATE_VALUE', 'Este dato está repetido.'],
  ])('%s', (code, message) => {
    expect(editorialIssueMessage({ code })).toBe(message)
  })

  it('keeps the generic fallback for a code it does not know', () => {
    expect(editorialIssueMessage({ code: 'SOMETHING_NEW' })).toContain('SOMETHING_NEW')
  })
})
