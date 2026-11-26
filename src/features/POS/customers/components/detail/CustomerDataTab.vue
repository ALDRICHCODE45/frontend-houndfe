<script setup lang="ts">
/**
 * «Datos y direcciones» of the customer page (customers-module T4): contact, fiscal data,
 * addresses, price list and comments («Notas»), read-only. «Editar» opens the customer editor.
 */
import { computed } from 'vue'
import { formatAddress } from '@/core/shared/utils/formatAddress'
import type { CustomerDetail } from '../../interfaces/customer.types'
import { formatCustomerPhone } from '../../utils/customerPhone.utils'

const props = defineProps<{ customer: CustomerDetail; canEdit: boolean }>()
const emit = defineEmits<{ edit: [] }>()

const EMPTY = '—'
const show = (value: string | null | undefined) => value?.trim() || EMPTY

const phone = computed(() => formatCustomerPhone(props.customer.phoneCountryCode, props.customer.phone))
const billingAddress = computed(() => formatAddress({
  street: props.customer.billingStreet,
  exteriorNumber: props.customer.billingExteriorNumber,
  interiorNumber: props.customer.billingInteriorNumber,
  neighborhood: props.customer.billingNeighborhood,
  municipality: props.customer.billingMunicipality,
  city: props.customer.billingCity,
  state: props.customer.billingState,
  zipCode: props.customer.billingZipCode,
}))
const hasFiscal = computed(() => [
  props.customer.businessName,
  props.customer.rfc,
  props.customer.fiscalRegime,
  props.customer.fiscalZipCode,
  billingAddress.value,
].some((value) => !!value?.trim()))
const addresses = computed(() =>
  props.customer.addresses.map((address) => ({ id: address.id, text: formatAddress(address) })),
)
</script>

<template>
  <div class="grid gap-4" data-testid="customer-tab-datos">
    <section class="customer-section" aria-labelledby="customer-contact-title">
      <div class="customer-section-head">
        <h2 id="customer-contact-title" class="customer-section-title">Contacto</h2>
        <UButton
          v-if="canEdit"
          icon="i-lucide-pencil"
          color="neutral"
          variant="outline"
          data-testid="customer-data-edit"
          @click="emit('edit')"
        >
          Editar
        </UButton>
      </div>
      <dl class="customer-dl">
        <div><dt>Nombre</dt><dd>{{ customer.fullName }}</dd></div>
        <div><dt>Teléfono</dt><dd class="hf-figure">{{ phone }}</dd></div>
        <div><dt>Correo electrónico</dt><dd>{{ show(customer.email) }}</dd></div>
        <div><dt>Lista de precios</dt><dd>{{ show(customer.globalPriceListName) }}</dd></div>
      </dl>
    </section>

    <section class="customer-section" aria-labelledby="customer-fiscal-title">
      <h2 id="customer-fiscal-title" class="customer-section-title">Datos fiscales</h2>
      <dl v-if="hasFiscal" class="customer-dl">
        <div><dt>Razón social</dt><dd>{{ show(customer.businessName) }}</dd></div>
        <div><dt>RFC</dt><dd class="hf-figure">{{ show(customer.rfc) }}</dd></div>
        <div><dt>Régimen fiscal</dt><dd>{{ show(customer.fiscalRegime) }}</dd></div>
        <div><dt>Código postal fiscal</dt><dd class="hf-figure">{{ show(customer.fiscalZipCode) }}</dd></div>
        <div class="md:col-span-2"><dt>Dirección de facturación</dt><dd>{{ billingAddress || EMPTY }}</dd></div>
      </dl>
      <p v-else class="text-[13px] text-[var(--hf-muted)]">Sin datos fiscales.</p>
    </section>

    <section class="customer-section" aria-labelledby="customer-addresses-title">
      <h2 id="customer-addresses-title" class="customer-section-title">
        Direcciones <span class="hf-figure text-[13px] font-medium text-[var(--hf-muted)]">{{ addresses.length }}</span>
      </h2>
      <ul v-if="addresses.length" class="customer-list">
        <li v-for="address in addresses" :key="address.id">{{ address.text }}</li>
      </ul>
      <p v-else class="text-[13px] text-[var(--hf-muted)]">Sin direcciones guardadas.</p>
    </section>

    <section class="customer-section" aria-labelledby="customer-notes-title">
      <h2 id="customer-notes-title" class="customer-section-title">Notas</h2>
      <p v-if="customer.comments?.trim()" class="whitespace-pre-line text-sm text-[var(--hf-ink)]">{{ customer.comments }}</p>
      <p v-else class="text-[13px] text-[var(--hf-muted)]">Sin notas.</p>
    </section>
  </div>
</template>
