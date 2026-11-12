import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useBreadcrumb } from '../useBreadcrumb'

// Route instance mock — useBreadcrumb only reads the resolved `path`.
const routePath = ref('/dashboard')

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: routePath.value }),
}))

const DASHBOARD_TRAIL = [{ label: 'Resumen', to: '/dashboard' }]

describe('useBreadcrumb', () => {
  beforeEach(() => {
    routePath.value = '/dashboard'
  })

  it('returns a single Dashboard item for the /dashboard route', () => {
    routePath.value = '/dashboard'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual(DASHBOARD_TRAIL)
  })

  it('targets /dashboard for the removed / path (no fallback link to "/")', () => {
    routePath.value = '/'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual(DASHBOARD_TRAIL)
  })

  it('falls back to Dashboard for unmatched routes', () => {
    routePath.value = '/ruta-desconocida'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual(DASHBOARD_TRAIL)
  })

  it('returns Módulo / Sección for a normal module route', () => {
    routePath.value = '/pos/ventas'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([{ label: 'POS' }, { label: 'Ventas', to: '/pos/ventas' }])
  })

  it('uses Chatbot / Solicitudes for the request inbox URL', () => {
    routePath.value = '/chatbot/solicitudes'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([
      { label: 'Chatbot' },
      { label: 'Solicitudes', to: '/chatbot/solicitudes' },
    ])
  })

  it('keeps Chatbot / Solicitudes for a request detail (/chatbot/solicitudes/:id)', () => {
    routePath.value = '/chatbot/solicitudes/2b7c1a90-6f3e-4d2a-8b1c-0d9e8f7a6b5c'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([
      { label: 'Chatbot' },
      { label: 'Solicitudes', to: '/chatbot/solicitudes' },
    ])
  })

  it('the old human-decisions URL has no nav entry any more and falls back to Resumen', () => {
    routePath.value = '/pos/decisiones-pendientes'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual(DASHBOARD_TRAIL)
  })

  it('keeps the parent section for a detail sub-route (/:id)', () => {
    routePath.value = '/pos/ventas/123'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([{ label: 'POS' }, { label: 'Ventas', to: '/pos/ventas' }])
  })

  it('keeps the parent section for a create sub-route (/nueva)', () => {
    routePath.value = '/pos/cotizaciones/nueva'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([
      { label: 'POS' },
      { label: 'Cotizaciones', to: '/pos/cotizaciones' },
    ])
  })

  it('picks the most specific match for nested admin routes', () => {
    routePath.value = '/admin/colaboradores/documentos-vencer'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([
      { label: 'RR.HH.' },
      { label: 'Documentos por vencer', to: '/admin/colaboradores/documentos-vencer' },
    ])
  })

  it('resolves the admin payment-details section', () => {
    routePath.value = '/admin/payment-details'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([
      { label: 'Admin' },
      { label: 'Datos bancarios', to: '/admin/payment-details' },
    ])
  })

  it('resolves the sistema notification config section', () => {
    routePath.value = '/sistema/configuracion/notificaciones'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([
      { label: 'Sistema' },
      { label: 'Notificaciones', to: '/sistema/configuracion/notificaciones' },
    ])
  })
})
