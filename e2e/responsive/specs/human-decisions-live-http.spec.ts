import type { Page } from '@playwright/test'
import { seedAuthSession } from '../fixtures/auth'
import { expect, RESPONSIVE_ORIGIN, test } from '../fixtures/test'
import type { DeclaredRoute, StrictNetworkController } from '../fixtures/network'

const decisionId = 'decision-restock-0001'
const resolutionRequestId = '00000000-0000-4000-8000-000000000001'
const pendingDecision = {
  id: decisionId,
  type: 'RESTOCK',
  title: 'Solicitud de reposición',
  sanitizedSummary: 'Se requiere una decisión humana sobre la reposición.',
  createdAt: '2026-09-25T10:00:00.000Z',
  status: 'PENDING',
  version: 1,
  resolution: null,
  allowedActions: ['PROVIDE_RESTOCK_ESTIMATE', 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE'],
  snapshot: {
    branchId: 'e2e-tenant-0001',
    branchName: 'Tienda E2E Centro',
    productId: 'product-demo-0001',
    productName: 'Alimento seco 15 kg',
    variantId: null,
    sku: 'ALIM-15KG-DEMO',
    requestedQuantity: 2,
    observedStockAtRequest: 0,
    stockObservedAt: '2026-09-25T09:55:00.000Z',
  },
} as const
const resolvedDecision = {
  ...pendingDecision,
  status: 'RESOLVED',
  version: 2,
  allowedActions: [],
  resolution: {
    action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
    resolvedAt: '2026-09-25T10:05:00.000Z',
    resolvedBy: { id: 'e2e-user-0001', displayName: 'Sesión E2E' },
  },
} as const
const listQuery = {
  status: 'PENDING',
  page: '1',
  limit: '20',
  sortBy: 'createdAt',
  sortOrder: 'asc',
}
const pendingPage = {
  data: [pendingDecision],
  pagination: { pageIndex: 0, pageSize: 20, totalCount: 1, pageCount: 1 },
}
const emptyPage = {
  data: [],
  pagination: { pageIndex: 0, pageSize: 20, totalCount: 0, pageCount: 0 },
}
const resolutionPayload = {
  action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
  expectedVersion: 1,
  resolutionRequestId,
} as const

function readRoutes(): readonly DeclaredRoute[] {
  return [
    { method: 'GET', path: '/human-decisions', query: listQuery, json: pendingPage, count: 1 },
    { method: 'GET', path: `/human-decisions/${decisionId}`, json: pendingDecision, count: 1 },
  ]
}

function resolveRoutes(
  responses: NonNullable<DeclaredRoute['responses']> = [{ json: resolvedDecision }],
): readonly DeclaredRoute[] {
  return [
    {
      method: 'GET',
      path: '/human-decisions',
      query: listQuery,
      responses: [{ json: pendingPage }, { json: emptyPage }],
    },
    {
      method: 'GET',
      path: `/human-decisions/${decisionId}`,
      responses: [{ json: pendingDecision }, { json: resolvedDecision }],
    },
    {
      method: 'POST',
      path: `/human-decisions/${decisionId}/resolve`,
      body: resolutionPayload,
      responses,
    },
  ]
}

async function openDecision(page: Page): Promise<void> {
  await page.goto(`${RESPONSIVE_ORIGIN}/pos/decisiones-pendientes`)
  await expect(page.getByRole('heading', { name: 'Decisiones pendientes' })).toBeVisible()
  await expect(page.getByText('Alimento seco 15 kg')).toBeVisible()
  await page.getByTestId('human-decision-table-open').click()
  await expect(page.getByTestId('human-decision-detail')).toBeVisible()
}

async function submitUnavailable(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sin fecha estimada por ahora' }).click()
  await page
    .getByRole('dialog', { name: 'Confirmar respuesta' })
    .getByRole('button', { name: 'Registrar respuesta' })
    .click()
}

function expectRequestCounts(network: StrictNetworkController, postCount: number): void {
  const requests = network.requests()
  expect(
    requests.filter(({ method, path }) => method === 'GET' && path === '/human-decisions'),
  ).toHaveLength(2)
  expect(
    requests.filter(
      ({ method, path }) => method === 'GET' && path === `/human-decisions/${decisionId}`,
    ),
  ).toHaveLength(2)
  expect(requests.filter(({ method }) => method === 'POST')).toHaveLength(postCount)
}

test.describe('RESTOCK live HTTP mount — read only', () => {
  test.use({ declaredRoutes: { routes: readRoutes() } })

  test('reviewer can fetch list/detail without resolution actions', async ({
    page,
    strictNetwork,
  }) => {
    await seedAuthSession(page, { permissions: ['read:HumanDecision'] })
    await test.step('open production HTTP-backed detail', async () => openDecision(page))

    await expect(page.getByText('SIMULACIÓN · datos sintéticos · sin HTTP')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sin fecha estimada por ahora' })).toHaveCount(0)
    expect(strictNetwork.violations()).toEqual([])
    expect(strictNetwork.requests().map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /human-decisions',
      `GET /human-decisions/${decisionId}`,
    ])
  })
})

test.describe('RESTOCK live HTTP mount — resolve', () => {
  test.use({ declaredRoutes: { routes: resolveRoutes() } })

  test('authorized reviewer sends exact CAS and idempotency payload', async ({
    page,
    strictNetwork,
  }) => {
    await seedAuthSession(page, {
      permissions: ['read:HumanDecision', 'update:HumanDecision'],
    })
    await page.addInitScript((id) => {
      Object.defineProperty(window.crypto, 'randomUUID', { configurable: true, value: () => id })
    }, resolutionRequestId)
    await test.step('open production HTTP-backed detail', async () => openDecision(page))

    await submitUnavailable(page)

    await expect(page.getByText('Respondida')).toBeVisible()
    await expect(
      page.getByText('Por ahora no tenemos una fecha estimada de reposición.'),
    ).toBeVisible()
    await expect(page.getByText('No hay decisiones pendientes.')).toBeVisible()
    await expect(page.getByText('cliente notificado')).toHaveCount(0)
    expect(strictNetwork.violations()).toEqual([])
    expectRequestCounts(strictNetwork, 1)
    expect(strictNetwork.requests().filter(({ method }) => method === 'POST')).toEqual([
      expect.objectContaining({
        path: `/human-decisions/${decisionId}/resolve`,
        body: resolutionPayload,
      }),
    ])
  })
})

test.describe('RESTOCK live HTTP mount — retry', () => {
  test.use({
    declaredRoutes: {
      routes: resolveRoutes([
        { status: 503, json: { code: 'SERVICE_UNAVAILABLE', message: 'Reintenta.' } },
        { json: resolvedDecision },
      ]),
    },
  })

  test('ambiguous retry reuses the same resolution request id', async ({ page, strictNetwork }) => {
    await seedAuthSession(page, {
      permissions: ['read:HumanDecision', 'update:HumanDecision'],
    })
    await page.addInitScript((id) => {
      Object.defineProperty(window.crypto, 'randomUUID', { configurable: true, value: () => id })
    }, resolutionRequestId)
    await openDecision(page)

    await submitUnavailable(page)
    await expect(page.getByRole('alert')).toContainText('No se pudo registrar la respuesta')
    await submitUnavailable(page)

    await expect(page.getByText('Respondida')).toBeVisible()
    await expect(page.getByText('No hay decisiones pendientes.')).toBeVisible()
    expect(strictNetwork.violations()).toEqual([])
    expectRequestCounts(strictNetwork, 2)
    expect(
      strictNetwork
        .requests()
        .filter(({ method }) => method === 'POST')
        .map(({ body }) => body),
    ).toEqual([resolutionPayload, resolutionPayload])
  })
})

test.describe('RESTOCK live HTTP mount — version conflict', () => {
  test.use({
    declaredRoutes: {
      routes: resolveRoutes([
        {
          status: 409,
          json: { code: 'VERSION_CONFLICT', message: 'La decisión cambió.' },
        },
      ]),
    },
  })

  test('refetches canonical resolved state and removes stale actions', async ({
    page,
    strictNetwork,
  }) => {
    await seedAuthSession(page, {
      permissions: ['read:HumanDecision', 'update:HumanDecision'],
    })
    await page.addInitScript((id) => {
      Object.defineProperty(window.crypto, 'randomUUID', { configurable: true, value: () => id })
    }, resolutionRequestId)
    await openDecision(page)
    await submitUnavailable(page)

    await expect(page.getByText('Respondida')).toBeVisible()
    await expect(page.getByText('No hay decisiones pendientes.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sin fecha estimada por ahora' })).toHaveCount(0)
    expect(strictNetwork.violations()).toEqual([])
    expectRequestCounts(strictNetwork, 1)
  })
})
