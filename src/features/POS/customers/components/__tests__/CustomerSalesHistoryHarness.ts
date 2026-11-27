/**
 * Test host for the customer's sales history (style-cleanup U6). The history slideover was removed
 * once the customer page took over its «Ventas» tab; its behaviour specs now mount the live pieces
 * the way that page does: one `useCustomerSalesHistoryView` controller handed to
 * `CustomerSalesHistoryBody` and `CustomerSalesHistoryPager`, with the body's `collect` opening
 * `CustomerCollectionSlideover` for the shown customer. `active` follows `open`, and a defensive 403
 * emits `update:open` (false) through `onForbidden`. No production glue is re-implemented here.
 */
import { defineComponent, h, shallowRef, watch, type PropType } from 'vue'
import type { Customer } from '../../interfaces/customer.types'
import CustomerSalesHistoryBody from '../CustomerSalesHistoryBody.vue'
import CustomerSalesHistoryPager from '../CustomerSalesHistoryPager.vue'
import CustomerCollectionSlideover from '../CustomerCollectionSlideover.vue'
import { useCustomerSalesHistoryView } from '../../composables/useCustomerSalesHistoryView'

export default defineComponent({
  name: 'CustomerSalesHistoryHarness',
  props: {
    open: { type: Boolean, default: true },
    customer: { type: Object as PropType<Customer | null>, default: null },
  },
  emits: { 'update:open': (_value: boolean) => true },
  setup(props, { emit, expose }) {
    const collectionOpen = shallowRef(false)
    watch(() => props.customer?.id, () => {
      collectionOpen.value = false
    }, { flush: 'sync' })

    const history = useCustomerSalesHistoryView({
      customer: () => props.customer,
      active: () => props.open,
      onForbidden: () => emit('update:open', false),
    })
    expose({ history })

    return () => h('div', { 'data-testid': 'history-host' }, [
      h(CustomerSalesHistoryBody, { history, onCollect: () => { collectionOpen.value = true } }),
      h(CustomerSalesHistoryPager, { history }),
      collectionOpen.value && props.customer
        ? h(CustomerCollectionSlideover, {
            key: props.customer.id,
            open: collectionOpen.value,
            'onUpdate:open': (value: boolean) => { collectionOpen.value = value },
            customerId: props.customer.id,
            customerName: props.customer.fullName,
          })
        : null,
    ])
  },
})
