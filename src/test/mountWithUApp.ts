import { mount, type MountingOptions } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import UApp from '@nuxt/ui/runtime/components/App.vue'

/**
 * Mount a component wrapped inside <UApp>, so Nuxt UI's TooltipProvider,
 * ToastProvider, ModalProvider, etc. are available via inject() during tests.
 *
 * Use this instead of `mount()` for ANY component that uses UTooltip, UModal,
 * UToast, UDropdownMenu, or any other Nuxt UI component that relies on the
 * provider contexts injected by <UApp>.
 */
export function mountWithUApp<T extends Component>(
  component: T,
  options: MountingOptions<any> = {},
) {
  const Wrapper = defineComponent({
    components: { UApp },
    setup() {
      return () => h(UApp, null, { default: () => h(component as any, options.props ?? {}, options.slots) })
    },
  })

  return mount(Wrapper, {
    ...options,
    props: undefined, // props already forwarded inside the wrapper
    slots: undefined,
  }).findComponent(component as any)
}