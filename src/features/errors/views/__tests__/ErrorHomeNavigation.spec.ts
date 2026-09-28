// ErrorHomeNavigation.spec.ts — STRICT-TDD contract for the error-page Home
// action (ODD root-last-route).
//
// Both the 403 and the 404 views must send the user home with `replace`, never
// `push`, so returning to root never traps the user in a growing history stack.
// The views are mounted for real inside <UApp> and receive the real router
// instance through the plugin, so the spy observes the exact method the
// production code calls.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, type Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { mountWithUApp } from '@/test/mountWithUApp'
import ForbiddenView from '../ForbiddenView.vue'
import NotFoundView from '../NotFoundView.vue'

const EmptyRoute = defineComponent({ name: 'EmptyRoute', render: () => null })

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'root', component: EmptyRoute },
      { path: '/403', name: 'forbidden', component: EmptyRoute },
      { path: '/:pathMatch(.*)*', name: 'not-found', component: EmptyRoute },
    ],
  })
}

async function clickButton(
  wrapper: ReturnType<typeof mountWithUApp>,
  label: string,
): Promise<void> {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().includes(label))
  if (!button) throw new Error(`button "${label}" not found`)
  await button.trigger('click')
}

const cases: Array<[string, Component]> = [
  ['ForbiddenView', ForbiddenView],
  ['NotFoundView', NotFoundView],
]

describe.each(cases)('%s error home action', (_name, view) => {
  let router: Router

  beforeEach(() => {
    router = createTestRouter()
  })

  it('navigates home with replace, not push', async () => {
    const replace = vi.spyOn(router, 'replace')
    const push = vi.spyOn(router, 'push')
    const wrapper = mountWithUApp(view, { global: { plugins: [router] } })

    await clickButton(wrapper, 'Ir al inicio')

    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/')
    expect(push).not.toHaveBeenCalled()
  })

  it('keeps the back action on history.back', async () => {
    const back = vi.spyOn(router, 'back')
    const wrapper = mountWithUApp(view, { global: { plugins: [router] } })

    await clickButton(wrapper, 'Volver')

    expect(back).toHaveBeenCalledTimes(1)
  })
})
