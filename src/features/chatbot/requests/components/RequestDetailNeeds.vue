<script setup lang="ts">
/**
 * RequestDetailNeeds — what the customer needs (free text) and the flat context of the moment.
 * Both come from the bot or the customer: plain text only, never `v-html`.
 */
import { computed, ref, useId } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { ChatbotRequestContext } from '../interfaces/chatbot-request.types'
import { contextEntries } from '../utils/detail-format'
import ReceiptSaleSummaryModal from './ReceiptSaleSummaryModal.vue'

const props = defineProps<{
  needs: string | null
  context: ChatbotRequestContext | null
  /** The folio of `context.saleId` when the page knows it (e.g. from the receipt decision). */
  saleFolio?: string | null
}>()

const auth = useAuthStore()
const canReadSale = computed(() => auth.userCan('read', 'Sale'))
const saleOpen = ref(false)

const headingId = useId()
const entries = computed(() => contextEntries(props.context))
// The raw sale id means nothing to a person: show the folio and let them open the sale.
const saleId = computed(() => entries.value.find((e) => e.key === 'saleId')?.value ?? null)
const needsText = computed(() => props.needs?.trim() || 'El bot no dejó más detalles.')
</script>

<template>
  <section class="rd-panel" :aria-labelledby="headingId" data-testid="needs-card">
    <h2 :id="headingId">Qué necesita el cliente</h2>
    <p class="rd-quote" data-testid="request-needs">{{ needsText }}</p>
    <div v-if="entries.length" data-testid="request-context">
      <h3 class="rd-subhead">Contexto del momento</h3>
      <dl class="rd-kv">
        <template v-for="entry in entries" :key="entry.key">
          <dt>{{ entry.label }}</dt>
          <dd v-if="entry.key === 'saleId'" data-testid="context-sale">
            <b v-if="saleFolio" class="rd-fig">{{ saleFolio }}</b>
            <span v-else-if="!canReadSale">Venta ligada</span>
            <button
              v-if="canReadSale"
              type="button"
              class="rd-link"
              :class="{ 'ml-2': saleFolio }"
              data-testid="context-sale-open"
              @click="saleOpen = true"
            >
              Ver venta
            </button>
          </dd>
          <dd v-else :title="entry.title">{{ entry.value }}</dd>
        </template>
      </dl>
      <ReceiptSaleSummaryModal
        v-if="saleId && canReadSale"
        v-model:open="saleOpen"
        :sale-id="saleId"
        :folio="saleFolio ?? null"
      />
    </div>
  </section>
</template>
