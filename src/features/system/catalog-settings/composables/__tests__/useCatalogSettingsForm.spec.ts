// useCatalogSettingsForm.spec.ts — STRICT-TDD tests for the WU3B settings form
// composable (REQ-6 / REQ-7 / REQ-9 / REQ-10 lifecycle pins).
//
// The composable owns draft / pristine / accepted snapshots: hydration derives
// from priceContexts ONLY at controlled boundaries; a refetch never overwrites
// a dirty or pending draft; a successful PATCH is accepted directly from its
// response; a tenant-id change clears every snapshot.

import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useCatalogSettingsForm } from '../useCatalogSettingsForm'
import type { CatalogSettingsResponseDto } from '../../interfaces/catalog-settings.types'

function makeResponse(
  overrides: Partial<CatalogSettingsResponseDto> = {},
): CatalogSettingsResponseDto {
  return {
    catalogPublished: false,
    effectivePublication: false,
    priceContexts: [
      { priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: true },
      { priceListId: 'pl_b', name: 'Lista B', isCatalogDefault: false },
    ],
    stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    warnings: [],
    updatedAt: '2026-02-14T10:00:00.000Z',
    ...overrides,
  }
}

function makeForm(published = false, contexts = makeResponse().priceContexts) {
  const tenantId = ref('tenant-1')
  const settings = ref<CatalogSettingsResponseDto | undefined>(
    makeResponse({ priceContexts: contexts, catalogPublished: published }),
  )
  const form = useCatalogSettingsForm(tenantId, settings)
  return { tenantId, settings, form }
}

describe('useCatalogSettingsForm — hydration derives from priceContexts (REQ-6)', () => {
  it('hydrates draft/pristine/accepted from the initial response in server order', async () => {
    const { form } = makeForm()
    await nextTick()
    expect(form.draft.value).toEqual({
      catalogPublished: false,
      publicPriceListIds: ['pl_a', 'pl_b'],
      catalogDefaultPriceListId: 'pl_a',
      stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    })
    expect(form.pristine.value).toEqual(form.draft.value)
    expect(form.accepted.value?.priceContexts).toEqual(makeResponse().priceContexts)
  })

  it('empty priceContexts yields [] allowlist and null default', async () => {
    const { form } = makeForm(false, [])
    await nextTick()
    expect(form.draft.value?.publicPriceListIds).toEqual([])
    expect(form.draft.value?.catalogDefaultPriceListId).toBeNull()
  })
})

describe('useCatalogSettingsForm — dirty / validation / rising edge', () => {
  it('isDirty reflects the draft vs pristine diff', async () => {
    const { form } = makeForm()
    await nextTick()
    expect(form.isDirty.value).toBe(false)
    form.draft.value!.stockPresentationDefault = {
      mode: 'CUSTOM_QUANTITY',
      customQuantity: 0,
    }
    expect(form.isDirty.value).toBe(true)
  })

  it('publish requires non-empty allowlist plus selected default', async () => {
    const { form } = makeForm(false, [])
    await nextTick()
    form.draft.value!.catalogPublished = true
    expect(form.validationErrors.value.length).toBeGreaterThan(0)
  })

  it('isRisingEdge fires only on false → true', async () => {
    const { form } = makeForm(false)
    await nextTick()
    form.draft.value!.catalogPublished = true
    expect(form.isRisingEdge.value).toBe(true)
  })
})

describe('useCatalogSettingsForm — requestSave gates (REQ-7 / REQ-9 / REQ-10)', () => {
  it('pristine and invalid drafts save nothing', async () => {
    const { form } = makeForm()
    await nextTick()
    expect(form.requestSave()).toBeNull()
    form.draft.value!.catalogPublished = true
    // Invalid (published without contexts on an empty list): gated.
    const invalid = makeForm(false, [])
    invalid.form.acceptPatch(makeResponse({ priceContexts: [] }))
    invalid.form.draft.value!.catalogPublished = true
    expect(invalid.form.requestSave()).toBeNull()
  })

  it('rising edge routes to confirm; descending edge routes to save', async () => {
    const { form } = makeForm(false)
    await nextTick()
    form.draft.value!.catalogPublished = true
    expect(form.requestSave()).toBe('confirm')
    expect(form.confirmationOpen.value).toBe(true)
    form.cancelPublish()
    expect(form.confirmationOpen.value).toBe(false)
    // Cancel keeps the dirty draft editable (REQ-10): draft still flipped.
    expect(form.draft.value!.catalogPublished).toBe(true)
    expect(form.confirmPublish()).toBe('save')
  })

  it('descending edge saves without confirmation and the body is whitelisted', async () => {
    const { form } = makeForm(true)
    await nextTick()
    form.draft.value!.catalogPublished = false
    expect(form.requestSave()).toBe('save')
    expect(form.buildSaveBody()).toEqual({ catalogPublished: false })
  })

  it('atomic clear emits exactly the REQ-9 triple without confirmation', async () => {
    const { form } = makeForm(true)
    await nextTick()
    form.draft.value!.publicPriceListIds = []
    form.draft.value!.catalogDefaultPriceListId = null
    form.draft.value!.catalogPublished = false
    expect(form.requestSave()).toBe('save')
    expect(form.buildSaveBody()).toEqual({
      catalogPublished: false,
      publicPriceListIds: [],
      catalogDefaultPriceListId: null,
    })
  })
})

describe('useCatalogSettingsForm — pending suppression and PATCH acceptance (REQ-6)', () => {
  it('a refetch while dirty or pending does not overwrite the draft', async () => {
    const { form, settings } = makeForm()
    await nextTick()
    form.draft.value!.catalogPublished = true
    settings.value = makeResponse({ updatedAt: '2026-02-15T10:00:00.000Z' })
    await nextTick()
    expect(form.draft.value!.catalogPublished).toBe(true)

    form.beginMutation()
    settings.value = makeResponse({ updatedAt: '2026-02-16T10:00:00.000Z' })
    await nextTick()
    expect(form.accepted.value?.updatedAt).toBe('2026-02-14T10:00:00.000Z')
  })

  it('a refetch deferred while pending cannot replace a PATCH accepted before endMutation', async () => {
    const { form, settings } = makeForm()
    await nextTick()
    form.beginMutation()
    settings.value = makeResponse({ updatedAt: '2026-02-16T10:00:00.000Z' })
    await nextTick()
    form.acceptPatch(makeResponse({ updatedAt: '2026-02-18T10:00:00.000Z' }))
    form.endMutation()
    await nextTick()
    expect(form.accepted.value?.updatedAt).toBe('2026-02-18T10:00:00.000Z')
    expect(form.draft.value?.catalogPublished).toBe(false)
  })

  it('acceptPatch rebuilds draft/pristine from the PATCH response, not the body', async () => {
    const { form } = makeForm()
    await nextTick()
    form.draft.value!.catalogPublished = true
    form.acceptPatch(makeResponse({ catalogPublished: true, effectivePublication: true }))
    expect(form.accepted.value?.catalogPublished).toBe(true)
    expect(form.pristine.value?.catalogPublished).toBe(true)
    expect(form.draft.value?.catalogPublished).toBe(true)
    expect(form.isDirty.value).toBe(false)
  })

  it('a newer refetch is accepted only when no newer local edit exists', async () => {
    const { form, settings } = makeForm()
    await nextTick()
    form.acceptPatch(makeResponse({ updatedAt: '2026-02-15T10:00:00.000Z' }))
    settings.value = makeResponse({ updatedAt: '2026-02-16T10:00:00.000Z' })
    await nextTick()
    expect(form.accepted.value?.updatedAt).toBe('2026-02-16T10:00:00.000Z')

    // A local edit after acceptance defers hydration again.
    form.draft.value!.stockPresentationDefault = {
      mode: 'CUSTOM_QUANTITY',
      customQuantity: 3,
    }
    settings.value = makeResponse({ updatedAt: '2026-02-17T10:00:00.000Z' })
    await nextTick()
    expect(form.draft.value!.stockPresentationDefault.customQuantity).toBe(3)
  })

  it('tenant-id change clears every snapshot before new hydration', async () => {
    const { form, tenantId } = makeForm()
    await nextTick()
    expect(form.draft.value).not.toBeNull()
    tenantId.value = 'tenant-2'
    await nextTick()
    expect(form.draft.value).toBeNull()
    expect(form.pristine.value).toBeNull()
    expect(form.accepted.value).toBeNull()
  })
})
