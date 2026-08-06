<script setup lang="ts">
/**
 * `QuotationCustomerCard.vue` — T-UI-15 / REQ-UI-005.
 *
 * Renders the client section of the quotation detail view: avatar + name +
 * contact rows + outlined "Cambiar cliente" affordance.
 *
 * Visual contract (Coco reference, `docs/redesign/quotations-detail-comparison.md`):
 *   - Avatar (EntityAvatar, size=lg) on the left, name (bold) to its right
 *   - Email + phone rows render BELOW the name with their respective icons
 *     (email envelope, phone receiver). Missing rows are omitted — no
 *     blank placeholders.
 *   - Full-width outlined "Cambiar cliente" button at the bottom — only
 *     visible when `editable=true`. The view flips `editable` on/off
 *     based on quotation status (DRAFT → true, others → false).
 *
 * Props:
 *   customer: QuotationCustomer | null  — null = no customer assigned yet
 *   editable: boolean                   — show the change-customer button
 *
 * Emits:
 *   change-customer: []                 — parent opens the slideover / picker
 *
 * Testids:
 *   root:               quotation-customer-card
 *   name:               customer-name
 *   email row:          customer-email
 *   phone row:          customer-phone
 *   change button:      change-customer-button
 *   avatar:             inherited from EntityAvatar (`[aria-label="..."]`)
 */
import { computed } from 'vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import type { QuotationCustomer } from '../interfaces/quotation.types'

const props = withDefaults(
  defineProps<{
    customer: QuotationCustomer | null
    editable?: boolean
  }>(),
  { editable: false },
)

defineEmits<{
  'change-customer': []
}>()

/** Display name — concatenates first + last, dropping null/missing parts. */
const customerName = computed<string>(() => {
  const c = props.customer
  if (!c) return ''
  return [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
})

/** Show the phone row only when phone is present and non-empty. */
const hasPhone = computed<boolean>(() => {
  const phone = props.customer?.phone
  return typeof phone === 'string' && phone.trim().length > 0
})

/** Show the email row only when email is present and non-empty. */
const hasEmail = computed<boolean>(() => {
  const email = props.customer?.email
  return typeof email === 'string' && email.trim().length > 0
})
</script>

<template>
  <section
    class="flex flex-col gap-4"
    data-testid="quotation-customer-card"
  >
    <!-- Top row: avatar + name -->
    <div v-if="customer" class="flex items-center gap-3" data-testid="customer-header-row">
      <EntityAvatar
        :name="customerName"
        :seed="customer.id"
        size="lg"
      />
      <p
        class="text-base font-semibold text-highlighted truncate"
        data-testid="customer-name"
      >{{ customerName }}</p>
    </div>

    <!-- Contact rows (icon + value), each omitted when its data is missing -->
    <div
      v-if="hasEmail"
      class="flex items-center gap-2 text-sm text-muted"
      data-testid="customer-email"
    >
      <UIcon name="i-lucide-mail" class="h-4 w-4 shrink-0" />
      <span class="truncate">{{ customer!.email }}</span>
    </div>

    <div
      v-if="hasPhone"
      class="flex items-center gap-2 text-sm text-muted"
      data-testid="customer-phone"
    >
      <UIcon name="i-lucide-phone" class="h-4 w-4 shrink-0" />
      <span class="truncate">{{ customer!.phone }}</span>
    </div>

    <!-- Outlined "Cambiar cliente" CTA — only when editable. The button
         carries the icon prefix per the Coco reference; the click bubbles
         up the `change-customer` event so the parent can open the
         AssignCustomerSlideover (or any future picker). -->
    <button
      v-if="editable"
      type="button"
      class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-default px-3 py-2 text-sm font-medium hover:bg-elevated"
      data-testid="change-customer-button"
      @click="$emit('change-customer')"
    >
      <UIcon name="i-lucide-search" class="h-4 w-4" />
      Cambiar cliente
    </button>
  </section>
</template>
