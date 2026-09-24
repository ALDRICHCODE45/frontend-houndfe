import { mount, type ComponentMountingOptions, type VueWrapper } from '@vue/test-utils'
import {
  defineComponent,
  h,
  type Component,
  type ComponentPublicInstance,
  type ConcreteComponent,
} from 'vue'
import UApp from '@nuxt/ui/runtime/components/App.vue'

/**
 * Loose prop/slot boundary.
 *
 * `ComponentMountingOptions<T>` types `props` against the tested component's
 * real props, which rejects the intentionally-partial fixtures (missing
 * required fields, widened string literals) that existing callers rely on.
 * The helper stays permissive about props and forwards them verbatim, so the
 * `Record<string, unknown>` boundary preserves call-site compatibility without
 * an `any`.
 */
type LooseProps = Record<string, unknown>

type MountingOptionsFor<T extends Component> = Omit<ComponentMountingOptions<T>, 'props'> & {
  props?: LooseProps
}

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
  options: MountingOptionsFor<T> = {},
): VueWrapper<ComponentPublicInstance & LooseProps> {
  const Wrapper = defineComponent({
    components: { UApp },
    setup() {
      const props = (options.props ?? {}) as LooseProps
      const slots = options.slots as LooseProps | undefined
      return () => h(UApp, null, { default: () => h(component as ConcreteComponent, props, slots) })
    },
  })

  return mount(Wrapper, {
    ...options,
    props: undefined, // props already forwarded inside the wrapper
    slots: undefined,
  }).findComponent<ComponentPublicInstance & LooseProps>(
    component as unknown as ComponentPublicInstance & LooseProps,
  )
}
